// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  createNativePhotoFolderAdapter,
  findFolderImages,
  getPhotoDirectoryPermission,
  makeFolderFileKey,
  scanPhotoDirectory,
  shouldScanPhotoFolderOnOpen,
  type NativePhotoFolderPlugin
} from './photoFolderImport';

function fileHandle(file: File) {
  return {
    kind: 'file',
    name: file.name,
    getFile: vi.fn().mockResolvedValue(file)
  } as unknown as FileSystemFileHandle;
}

function directoryHandle(
  name: string,
  entries: Array<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>
) {
  return {
    kind: 'directory',
    name,
    async *entries() {
      for (const entry of entries) {
        yield entry;
      }
    }
  } as unknown as FileSystemDirectoryHandle;
}

function writeImportHistoryKey(key: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('foodsnap-photos', 2);
    request.onupgradeneeded = () => {
      for (const name of ['photos', 'photo-folder-config', 'photo-folder-imports']) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('photo-folder-imports', 'readwrite');
      transaction.objectStore('photo-folder-imports').put(true, key);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

function readImportHistoryKeys() {
  return new Promise<IDBValidKey[]>((resolve, reject) => {
    const request = indexedDB.open('foodsnap-photos', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('photo-folder-imports', 'readonly');
      const keys = transaction.objectStore('photo-folder-imports').getAllKeys();
      keys.onsuccess = () => resolve(keys.result);
      keys.onerror = () => reject(keys.error);
      transaction.oncomplete = () => database.close();
    };
  });
}

describe('photo folder import', () => {
  it('finds images recursively, ignores other files, and sorts by modified time and path', async () => {
    const newer = new File(['new'], 'newer.jpg', {
      type: 'image/jpeg',
      lastModified: 300
    });
    const sameTimeB = new File(['b'], 'b.png', { type: 'image/png', lastModified: 200 });
    const sameTimeA = new File(['a'], 'a.webp', { type: '', lastModified: 200 });
    const text = new File(['notes'], 'notes.txt', { type: 'text/plain', lastModified: 100 });
    const unreadable = {
      kind: 'file',
      name: 'unreadable.jpg',
      getFile: vi.fn().mockRejectedValue(new Error('not readable'))
    } as unknown as FileSystemFileHandle;
    const nested = directoryHandle('nested', [
      ['b.png', fileHandle(sameTimeB)],
      ['notes.txt', fileHandle(text)],
      ['a.webp', fileHandle(sameTimeA)]
    ]);
    const root = directoryHandle('photos', [
      ['newer.jpg', fileHandle(newer)],
      ['unreadable.jpg', unreadable],
      ['nested', nested]
    ]);

    const images = await findFolderImages(root);

    expect(images.map((image) => image.relativePath)).toEqual([
      'nested/a.webp',
      'nested/b.png',
      'newer.jpg'
    ]);
    expect(images[0].key).toBe(makeFolderFileKey('nested/a.webp', sameTimeA));
  });

  it('propagates a revoked folder permission instead of silently treating the scan as complete', async () => {
    const revokedFile = {
      kind: 'file',
      name: 'revoked.jpg',
      getFile: vi.fn().mockRejectedValue(new DOMException('Access revoked', 'NotAllowedError'))
    } as unknown as FileSystemFileHandle;
    const root = directoryHandle('photos', [['revoked.jpg', revokedFile]]);

    await expect(findFolderImages(root)).rejects.toMatchObject({ name: 'NotAllowedError' });
  });

  it('skips known file keys, imports new images once, and keeps failed images retryable', async () => {
    const known = new File(['known'], 'known.jpg', { type: 'image/jpeg', lastModified: 100 });
    const valid = new File(['valid'], 'valid.jpg', { type: 'image/jpeg', lastModified: 200 });
    const broken = new File(['broken'], 'broken.jpg', { type: 'image/jpeg', lastModified: 300 });
    const directory = directoryHandle('photos', [
      ['known.jpg', fileHandle(known)],
      ['valid.jpg', fileHandle(valid)],
      ['broken.jpg', fileHandle(broken)]
    ]);
    const keys = new Set([makeFolderFileKey('known.jpg', known)]);
    const history = {
      getKeys: vi.fn(async () => new Set(keys)),
      addKey: vi.fn(async (key: string) => {
        keys.add(key);
      })
    };
    const importFile = vi.fn(async ({ relativePath }: { relativePath: string }) => {
      if (relativePath === 'broken.jpg') {
        throw new Error('decode failed');
      }
    });

    const first = await scanPhotoDirectory(directory, importFile, history);
    const second = await scanPhotoDirectory(directory, importFile, history);

    expect(first).toEqual({ importedCount: 1, failedCount: 1, skippedCount: 1 });
    expect(second).toEqual({ importedCount: 0, failedCount: 1, skippedCount: 2 });
    expect(importFile.mock.calls.map(([image]) => image.relativePath)).toEqual([
      'valid.jpg',
      'broken.jpg',
      'broken.jpg'
    ]);
    expect(history.addKey).toHaveBeenCalledTimes(1);
  });

  it('rolls back a stored photo when its import key cannot be persisted', async () => {
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg', lastModified: 100 });
    const directory = directoryHandle('photos', [['photo.jpg', fileHandle(file)]]);
    const rollback = vi.fn();
    const history = {
      getKeys: vi.fn(async () => new Set<string>()),
      addKey: vi.fn(async () => {
        throw new Error('history unavailable');
      })
    };

    const result = await scanPhotoDirectory(directory, async () => rollback, history);

    expect(result).toEqual({ importedCount: 0, failedCount: 1, skippedCount: 0 });
    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it('queries and requests read permission without requesting it during an automatic scan', async () => {
    const queryPermission = vi
      .fn()
      .mockResolvedValueOnce('prompt')
      .mockResolvedValueOnce('denied')
      .mockResolvedValueOnce('granted');
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const directory = {
      kind: 'directory',
      name: 'photos',
      queryPermission,
      requestPermission
    } as unknown as FileSystemDirectoryHandle;

    await expect(getPhotoDirectoryPermission(directory)).resolves.toBe('prompt');
    await expect(getPhotoDirectoryPermission(directory)).resolves.toBe('denied');
    await expect(getPhotoDirectoryPermission(directory)).resolves.toBe('granted');
    expect(requestPermission).not.toHaveBeenCalled();
    await expect(getPhotoDirectoryPermission(directory, true)).resolves.toBe('granted');
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' });
  });

  it('scans Android at startup and both platforms whenever Photos opens', () => {
    expect(shouldScanPhotoFolderOnOpen({ scanOnStartup: true }, 'log', false)).toBe(true);
    expect(shouldScanPhotoFolderOnOpen({ scanOnStartup: true }, 'log', true)).toBe(false);
    expect(shouldScanPhotoFolderOnOpen({ scanOnStartup: true }, 'settings', true)).toBe(false);
    expect(shouldScanPhotoFolderOnOpen({ scanOnStartup: true }, 'photos', true)).toBe(true);
    expect(shouldScanPhotoFolderOnOpen({ scanOnStartup: false }, 'settings', false)).toBe(false);
    expect(shouldScanPhotoFolderOnOpen({ scanOnStartup: false }, 'photos', false)).toBe(true);
  });

  it('restores native selection, detects lost permission, and lists recursive image paths', async () => {
    const plugin: NativePhotoFolderPlugin = {
      selectDirectory: vi.fn(),
      getDirectoryStatus: vi.fn().mockResolvedValue({
        configured: true,
        permissionGranted: true,
        uri: 'content://tree/meals',
        name: 'Meals'
      }),
      listImages: vi.fn().mockResolvedValue({
        images: [
          {
            uri: 'content://tree/meals/nested/new.jpg',
            relativePath: 'nested/new.jpg',
            mimeType: 'image/jpeg',
            size: 12,
            lastModified: 200
          },
          {
            uri: 'content://tree/meals/old.png',
            relativePath: 'old.png',
            mimeType: 'image/png',
            size: 8,
            lastModified: 100
          }
        ]
      })
    };
    const loadUri = vi.fn(async () => new Blob(['image'], { type: 'image/jpeg' }));
    const adapter = createNativePhotoFolderAdapter(plugin, loadUri);
    const directory = await adapter.getSavedDirectory();

    expect(directory).toMatchObject({ platform: 'android', id: 'content://tree/meals', name: 'Meals' });
    await expect(adapter.getPermission(directory!)).resolves.toBe('granted');
    const images = await adapter.listImages(directory!);
    expect(images.map((image) => image.relativePath)).toEqual(['old.png', 'nested/new.jpg']);
    await images[1].loadBlob();
    expect(loadUri).toHaveBeenCalledWith('content://tree/meals/nested/new.jpg');

    vi.mocked(plugin.getDirectoryStatus).mockResolvedValue({
      configured: true,
      permissionGranted: false,
      uri: 'content://tree/meals',
      name: 'Meals'
    });
    await expect(adapter.getPermission(directory!)).resolves.toBe('denied');
  });

  it('keeps the native folder unchanged when selection is cancelled', async () => {
    const plugin: NativePhotoFolderPlugin = {
      getDirectoryStatus: vi.fn().mockResolvedValue({
        configured: true,
        permissionGranted: true,
        uri: 'content://tree/meals',
        name: 'Meals'
      }),
      selectDirectory: vi.fn().mockRejectedValue(new Error('cancelled')),
      listImages: vi.fn()
    };
    const adapter = createNativePhotoFolderAdapter(plugin);

    await expect(adapter.chooseDirectory()).rejects.toThrow('cancelled');
    await expect(adapter.getSavedDirectory()).resolves.toMatchObject({ id: 'content://tree/meals' });
  });

  it('clears duplicate history when the native folder changes', async () => {
    await writeImportHistoryKey('old-photo-key');
    const plugin: NativePhotoFolderPlugin = {
      getDirectoryStatus: vi.fn().mockResolvedValue({
        configured: true,
        permissionGranted: true,
        uri: 'content://tree/old',
        name: 'Old'
      }),
      selectDirectory: vi.fn().mockResolvedValue({ uri: 'content://tree/new', name: 'New' }),
      listImages: vi.fn()
    };

    await expect(createNativePhotoFolderAdapter(plugin).chooseDirectory()).resolves.toMatchObject({
      id: 'content://tree/new',
      name: 'New'
    });
    await expect(readImportHistoryKeys()).resolves.toEqual([]);
  });
});
