const DATABASE_NAME = 'foodsnap-photos';
const DATABASE_VERSION = 1;
const STORE_NAME = 'photos';

function openPhotoDatabase() {
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

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    });

    request.addEventListener('success', () => {
      resolve(request.result);
    });
  });
}

function runPhotoTransaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: Error) => void) => void
) {
  return openPhotoDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);

        transaction.addEventListener('error', () => {
          reject(transaction.error ?? new Error('Photo transaction failed.'));
        });
        transaction.addEventListener('complete', () => {
          database.close();
        });

        action(store, resolve, reject);
      })
  );
}

export function savePhotoBlob(photoId: string, blob: Blob) {
  return runPhotoTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(blob, photoId);

    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Failed to store the photo.'));
    });

    request.addEventListener('success', () => {
      resolve(undefined);
    });
  });
}

export function getPhotoBlob(photoId: string) {
  return runPhotoTransaction<Blob | null>('readonly', (store, resolve, reject) => {
    const request = store.get(photoId);

    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Failed to load the photo.'));
    });

    request.addEventListener('success', () => {
      const result = request.result;
      resolve(result instanceof Blob ? result : null);
    });
  });
}

export function deletePhotoBlob(photoId: string) {
  return runPhotoTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(photoId);

    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Failed to delete the photo.'));
    });

    request.addEventListener('success', () => {
      resolve(undefined);
    });
  });
}

export async function deletePhotoBlobs(photoIds: string[]) {
  for (const photoId of photoIds) {
    await deletePhotoBlob(photoId);
  }
}

function loadImageFromFile(file: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode the image.'));
    };

    image.src = objectUrl;
  });
}

export async function preparePhotoBlob(file: File) {
  const image = await loadImageFromFile(file);
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longestEdge > 1600 ? 1600 / longestEdge : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to prepare the image canvas.');
  }

  context.drawImage(image, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to compress the image.'));
          return;
        }

        resolve(blob);
      },
      'image/jpeg',
      0.82
    );
  });
}
