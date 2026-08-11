// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import {
  findFolderImages,
  getPhotoDirectoryPermission,
  makeFolderFileKey,
  scanPhotoDirectory
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
});
