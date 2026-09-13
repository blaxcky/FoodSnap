import { Capacitor, registerPlugin } from '@capacitor/core';

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
type DirectoryPickerWindow = Window & typeof globalThis & {
  showDirectoryPicker?: (options?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandle>;
};

interface NativeDirectoryStatus {
  configured: boolean;
  permissionGranted: boolean;
  uri?: string;
  name?: string;
}
interface NativeDirectorySelection { uri: string; name: string }
interface NativeImage {
  uri: string;
  relativePath: string;
  mimeType: string;
  size: number;
  lastModified: number;
}

export interface NativePhotoFolderPlugin {
  selectDirectory: () => Promise<NativeDirectorySelection>;
  getDirectoryStatus: () => Promise<NativeDirectoryStatus>;
  listImages: () => Promise<{ images: NativeImage[] }>;
}

const PhotoFolder = registerPlugin<NativePhotoFolderPlugin>('PhotoFolder');

export interface PhotoDirectory {
  platform: 'web' | 'android';
  id: string;
  name: string;
  handle?: FileSystemDirectoryHandle;
}

export interface FolderImageFile {
  relativePath: string;
  key: string;
  size: number;
  lastModified: number;
  mimeType: string;
  loadBlob: () => Promise<Blob>;
}

export interface FolderScanResult {
  importedCount: number;
  failedCount: number;
  skippedCount: number;
}

export type PhotoFolderStatus =
  | 'unsupported' | 'loading' | 'none' | 'permission' | 'scanning' | 'complete' | 'error';

interface ImportHistory {
  getKeys: () => Promise<Set<string>>;
  addKey: (key: string) => Promise<void>;
}

export interface PhotoFolderAdapter {
  platform: 'web' | 'android';
  scanOnStartup: boolean;
  isSupported: () => boolean;
  getSavedDirectory: () => Promise<PhotoDirectory | null>;
  chooseDirectory: () => Promise<PhotoDirectory>;
  getPermission: (directory: PhotoDirectory, requestAccess?: boolean) => Promise<PermissionState>;
  listImages: (directory: PhotoDirectory) => Promise<FolderImageFile[]>;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available.'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener('error', () => reject(request.error ?? new Error('Failed to open the photo database.')));
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      for (const storeName of [PHOTO_STORE_NAME, CONFIG_STORE_NAME, HISTORY_STORE_NAME]) {
        if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName);
      }
    });
    request.addEventListener('success', () => resolve(request.result));
  });
}

function runRequest<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('Folder import storage failed.')));
    transaction.addEventListener('complete', () => database.close());
    transaction.addEventListener('abort', () => database.close());
  }));
}

async function clearImportHistory() {
  await runRequest(HISTORY_STORE_NAME, 'readwrite', (store) => store.clear());
}

function asWebDirectory(directory: PhotoDirectory | FileSystemDirectoryHandle): PhotoDirectory {
  if ('platform' in directory) return directory;
  return { platform: 'web', id: directory.name, name: directory.name, handle: directory };
}

function isImageFile(file: File) {
  return file.type.startsWith('image/') || (file.type === '' && IMAGE_FILE_EXTENSION.test(file.name));
}

function isFolderPermissionError(error: unknown) {
  return error instanceof DOMException && error.name === 'NotAllowedError';
}

export function makeFolderFileKey(relativePath: string, file: Pick<NativeImage, 'size' | 'lastModified'>) {
  return `${relativePath}\u0000${file.size}\u0000${file.lastModified}`;
}

export async function findFolderImages(directory: FileSystemDirectoryHandle, parentPath = ''): Promise<FolderImageFile[]> {
  const images: FolderImageFile[] = [];
  for await (const [name, entry] of (directory as IterableDirectoryHandle).entries()) {
    const relativePath = parentPath ? `${parentPath}/${name}` : name;
    if (entry.kind === 'directory') {
      try {
        images.push(...(await findFolderImages(entry as FileSystemDirectoryHandle, relativePath)));
      } catch (error) {
        if (isFolderPermissionError(error)) throw error;
      }
      continue;
    }

    let file: File;
    try {
      file = await (entry as FileSystemFileHandle).getFile();
    } catch (error) {
      if (isFolderPermissionError(error)) throw error;
      continue;
    }
    if (isImageFile(file)) {
      images.push({
        relativePath,
        key: makeFolderFileKey(relativePath, file),
        size: file.size,
        lastModified: file.lastModified,
        mimeType: file.type,
        loadBlob: async () => file
      });
    }
  }
  return images.sort((left, right) => left.lastModified - right.lastModified || left.relativePath.localeCompare(right.relativePath));
}

export function createWebPhotoFolderAdapter(): PhotoFolderAdapter {
  return {
    platform: 'web',
    scanOnStartup: false,
    isSupported() {
      return typeof window !== 'undefined' && typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function' && typeof indexedDB !== 'undefined';
    },
    async getSavedDirectory() {
      const result = await runRequest<unknown>(CONFIG_STORE_NAME, 'readonly', (store) => store.get(DIRECTORY_CONFIG_KEY));
      const handle = result && typeof result === 'object' && (result as FileSystemHandle).kind === 'directory'
        ? result as FileSystemDirectoryHandle : null;
      return handle ? asWebDirectory(handle) : null;
    },
    async chooseDirectory() {
      const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
      if (!picker) throw new Error('Folder import is not supported by this browser.');
      const handle = await picker({ mode: 'read' });
      const database = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction([CONFIG_STORE_NAME, HISTORY_STORE_NAME], 'readwrite');
        transaction.objectStore(CONFIG_STORE_NAME).put(handle, DIRECTORY_CONFIG_KEY);
        transaction.objectStore(HISTORY_STORE_NAME).clear();
        transaction.addEventListener('complete', () => { database.close(); resolve(); });
        transaction.addEventListener('error', () => { database.close(); reject(transaction.error ?? new Error('Failed to remember the selected folder.')); });
      });
      return asWebDirectory(handle);
    },
    async getPermission(directory, requestAccess = false) {
      const handle = directory.handle as PermissionCapableDirectoryHandle | undefined;
      if (!handle) return 'denied';
      const method = requestAccess ? handle.requestPermission : handle.queryPermission;
      return method ? method.call(handle, { mode: 'read' }) : 'granted';
    },
    async listImages(directory) {
      if (!directory.handle) throw new Error('The web directory handle is unavailable.');
      return findFolderImages(directory.handle);
    }
  };
}

export function createNativePhotoFolderAdapter(
  plugin: NativePhotoFolderPlugin = PhotoFolder,
  loadUri: (uri: string) => Promise<Blob> = async (uri) => {
    const response = await fetch(Capacitor.convertFileSrc(uri));
    if (!response.ok) throw new Error(`Failed to read native image (${response.status}).`);
    return response.blob();
  }
): PhotoFolderAdapter {
  return {
    platform: 'android',
    scanOnStartup: true,
    isSupported: () => true,
    async getSavedDirectory() {
      const status = await plugin.getDirectoryStatus();
      if (!status.configured || !status.uri) return null;
      return { platform: 'android', id: status.uri, name: status.name || 'Selected folder' };
    },
    async chooseDirectory() {
      const previous = await plugin.getDirectoryStatus();
      const selection = await plugin.selectDirectory();
      if (!previous.configured || previous.uri !== selection.uri) await clearImportHistory();
      return { platform: 'android', id: selection.uri, name: selection.name || 'Selected folder' };
    },
    async getPermission(directory) {
      const status = await plugin.getDirectoryStatus();
      return status.configured && status.uri === directory.id && status.permissionGranted ? 'granted' : 'denied';
    },
    async listImages() {
      const { images } = await plugin.listImages();
      return images.map((image) => ({
        relativePath: image.relativePath,
        key: makeFolderFileKey(image.relativePath, image),
        size: image.size,
        lastModified: image.lastModified,
        mimeType: image.mimeType,
        loadBlob: () => loadUri(image.uri)
      })).sort((left, right) => left.lastModified - right.lastModified || left.relativePath.localeCompare(right.relativePath));
    }
  };
}

const photoFolderAdapter = Capacitor.isNativePlatform() ? createNativePhotoFolderAdapter() : createWebPhotoFolderAdapter();

export function getPhotoFolderAdapter() { return photoFolderAdapter; }
export function shouldScanPhotoFolderOnOpen(
  adapter: Pick<PhotoFolderAdapter, 'scanOnStartup'>,
  activeTab: string,
  startupScanStarted: boolean
) {
  return adapter.scanOnStartup ? !startupScanStarted : activeTab === 'photos';
}
export function isPhotoFolderImportSupported() { return photoFolderAdapter.isSupported(); }
export function getSavedPhotoDirectory() { return photoFolderAdapter.getSavedDirectory(); }
export function choosePhotoDirectory() { return photoFolderAdapter.chooseDirectory(); }
export function getPhotoDirectoryPermission(
  directory: PhotoDirectory | FileSystemDirectoryHandle,
  requestAccess = false
) {
  return photoFolderAdapter.getPermission(asWebDirectory(directory), requestAccess);
}

const persistentImportHistory: ImportHistory = {
  async getKeys() {
    const keys = await runRequest<IDBValidKey[]>(HISTORY_STORE_NAME, 'readonly', (store) => store.getAllKeys());
    return new Set(keys.map(String));
  },
  async addKey(key) {
    await runRequest<IDBValidKey>(HISTORY_STORE_NAME, 'readwrite', (store) => store.put(true, key));
  }
};

export async function scanPhotoDirectory(
  directory: PhotoDirectory | FileSystemDirectoryHandle,
  importFile: (image: FolderImageFile) => Promise<void | (() => void | Promise<void>)>,
  history: ImportHistory = persistentImportHistory,
  adapter: PhotoFolderAdapter = photoFolderAdapter
): Promise<FolderScanResult> {
  const [images, importedKeys] = await Promise.all([adapter.listImages(asWebDirectory(directory)), history.getKeys()]);
  let importedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  for (const image of images) {
    if (importedKeys.has(image.key)) { skippedCount += 1; continue; }
    let rollbackImport: void | (() => void | Promise<void>) = undefined;
    try {
      rollbackImport = await importFile(image);
      await history.addKey(image.key);
      importedKeys.add(image.key);
      importedCount += 1;
    } catch {
      if (rollbackImport) await Promise.resolve(rollbackImport()).catch(() => undefined);
      failedCount += 1;
    }
  }
  return { importedCount, failedCount, skippedCount };
}
