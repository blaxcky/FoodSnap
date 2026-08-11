const DATABASE_NAME = 'foodsnap-photos';
const DATABASE_VERSION = 2;
const PHOTO_STORE_NAME = 'photos';
const CONFIG_STORE_NAME = 'photo-folder-config';
const HISTORY_STORE_NAME = 'photo-folder-imports';
const DIRECTORY_CONFIG_KEY = 'selected-directory';

const IMAGE_FILE_EXTENSION = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|webp)$/i;

type PermissionCapableDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode: 'read' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode: 'read' }) => Promise<PermissionState>;
};

type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
};

type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: (options?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandle>;
  };

export interface FolderImageFile {
  file: File;
  relativePath: string;
  key: string;
}

export interface FolderScanResult {
  importedCount: number;
  failedCount: number;
  skippedCount: number;
}

export type PhotoFolderStatus =
  | 'unsupported'
  | 'loading'
  | 'none'
  | 'permission'
  | 'scanning'
  | 'complete'
  | 'error';

interface ImportHistory {
  getKeys: () => Promise<Set<string>>;
  addKey: (key: string) => Promise<void>;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available.'));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Failed to open the photo database.'));
    });
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      for (const storeName of [PHOTO_STORE_NAME, CONFIG_STORE_NAME, HISTORY_STORE_NAME]) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName);
        }
      }
    });
    request.addEventListener('success', () => resolve(request.result));
  });
}

function runRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
) {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const request = action(transaction.objectStore(storeName));

        request.addEventListener('success', () => resolve(request.result));
        request.addEventListener('error', () => {
          reject(request.error ?? new Error('Folder import storage failed.'));
        });
        transaction.addEventListener('complete', () => database.close());
        transaction.addEventListener('abort', () => database.close());
      })
  );
}

export function isPhotoFolderImportSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function' &&
    typeof indexedDB !== 'undefined'
  );
}

export async function getSavedPhotoDirectory() {
  const result = await runRequest<unknown>(CONFIG_STORE_NAME, 'readonly', (store) =>
    store.get(DIRECTORY_CONFIG_KEY)
  );

  return result && typeof result === 'object' && (result as FileSystemHandle).kind === 'directory'
    ? (result as FileSystemDirectoryHandle)
    : null;
}

export async function choosePhotoDirectory() {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error('Folder import is not supported by this browser.');
  }

  const handle = await picker({ mode: 'read' });
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      [CONFIG_STORE_NAME, HISTORY_STORE_NAME],
      'readwrite'
    );
    transaction.objectStore(CONFIG_STORE_NAME).put(handle, DIRECTORY_CONFIG_KEY);
    transaction.objectStore(HISTORY_STORE_NAME).clear();
    transaction.addEventListener('complete', () => {
      database.close();
      resolve();
    });
    transaction.addEventListener('error', () => {
      database.close();
      reject(transaction.error ?? new Error('Failed to remember the selected folder.'));
    });
  });

  return handle;
}

export async function getPhotoDirectoryPermission(
  directory: FileSystemDirectoryHandle,
  requestAccess = false
) {
  const handle = directory as PermissionCapableDirectoryHandle;
  const method = requestAccess ? handle.requestPermission : handle.queryPermission;

  if (!method) {
    return 'granted' as PermissionState;
  }

  return method.call(handle, { mode: 'read' });
}

export function makeFolderFileKey(relativePath: string, file: Pick<File, 'size' | 'lastModified'>) {
  return `${relativePath}\u0000${file.size}\u0000${file.lastModified}`;
}

function isImageFile(file: File) {
  return file.type.startsWith('image/') || (file.type === '' && IMAGE_FILE_EXTENSION.test(file.name));
}

function isFolderPermissionError(error: unknown) {
  return error instanceof DOMException && error.name === 'NotAllowedError';
}

export async function findFolderImages(
  directory: FileSystemDirectoryHandle,
  parentPath = ''
): Promise<FolderImageFile[]> {
  const images: FolderImageFile[] = [];

  for await (const [name, entry] of (directory as IterableDirectoryHandle).entries()) {
    const relativePath = parentPath ? `${parentPath}/${name}` : name;

    if (entry.kind === 'directory') {
      try {
        images.push(...(await findFolderImages(entry as FileSystemDirectoryHandle, relativePath)));
      } catch (error) {
        if (isFolderPermissionError(error)) {
          throw error;
        }
        // An unreadable subfolder must not prevent imports from the rest of the tree.
      }
      continue;
    }

    let file: File;
    try {
      file = await (entry as FileSystemFileHandle).getFile();
    } catch (error) {
      if (isFolderPermissionError(error)) {
        throw error;
      }
      continue;
    }
    if (isImageFile(file)) {
      images.push({ file, relativePath, key: makeFolderFileKey(relativePath, file) });
    }
  }

  return images.sort(
    (left, right) =>
      left.file.lastModified - right.file.lastModified ||
      left.relativePath.localeCompare(right.relativePath)
  );
}

const persistentImportHistory: ImportHistory = {
  async getKeys() {
    const keys = await runRequest<IDBValidKey[]>(HISTORY_STORE_NAME, 'readonly', (store) =>
      store.getAllKeys()
    );
    return new Set(keys.map(String));
  },
  async addKey(key) {
    await runRequest<IDBValidKey>(HISTORY_STORE_NAME, 'readwrite', (store) =>
      store.put(true, key)
    );
  }
};

export async function scanPhotoDirectory(
  directory: FileSystemDirectoryHandle,
  importFile: (image: FolderImageFile) => Promise<void | (() => void | Promise<void>)>,
  history: ImportHistory = persistentImportHistory
): Promise<FolderScanResult> {
  const [images, importedKeys] = await Promise.all([
    findFolderImages(directory),
    history.getKeys()
  ]);
  let importedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const image of images) {
    if (importedKeys.has(image.key)) {
      skippedCount += 1;
      continue;
    }

    let rollbackImport: void | (() => void | Promise<void>) = undefined;
    try {
      rollbackImport = await importFile(image);
      await history.addKey(image.key);
      importedKeys.add(image.key);
      importedCount += 1;
    } catch {
      if (rollbackImport) {
        await Promise.resolve(rollbackImport()).catch(() => undefined);
      }
      failedCount += 1;
    }
  }

  return { importedCount, failedCount, skippedCount };
}
