// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const folderMocks = vi.hoisted(() => ({
  choosePhotoDirectory: vi.fn(),
  getPhotoDirectoryPermission: vi.fn(),
  getSavedPhotoDirectory: vi.fn(),
  scanPhotoDirectory: vi.fn()
}));

vi.mock('./lib/photoFolderImport', async (importOriginal) => {
  const original = await importOriginal<typeof import('./lib/photoFolderImport')>();
  return {
    ...original,
    choosePhotoDirectory: folderMocks.choosePhotoDirectory,
    getPhotoDirectoryPermission: folderMocks.getPhotoDirectoryPermission,
    getSavedPhotoDirectory: folderMocks.getSavedPhotoDirectory,
    isPhotoFolderImportSupported: () => true,
    scanPhotoDirectory: folderMocks.scanPhotoDirectory
  };
});

import App from './App';

const directory = {
  kind: 'directory',
  name: 'Meal photos'
} as FileSystemDirectoryHandle;

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  });
  folderMocks.getSavedPhotoDirectory.mockResolvedValue(directory);
  folderMocks.getPhotoDirectoryPermission.mockResolvedValue('granted');
  folderMocks.scanPhotoDirectory.mockResolvedValue({
    importedCount: 0,
    failedCount: 0,
    skippedCount: 0
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('App photo folder lifecycle', () => {
  it('checks only folder status in settings and scans exactly once when Photos opens', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    await screen.findByText('Granted');

    expect(folderMocks.getSavedPhotoDirectory).toHaveBeenCalledTimes(1);
    expect(folderMocks.getPhotoDirectoryPermission).toHaveBeenCalledWith(directory);
    expect(folderMocks.scanPhotoDirectory).not.toHaveBeenCalled();
    expect(folderMocks.getPhotoDirectoryPermission).not.toHaveBeenCalledWith(directory, true);

    fireEvent.click(screen.getByRole('button', { name: 'Photos' }));
    await waitFor(() => expect(folderMocks.scanPhotoDirectory).toHaveBeenCalledTimes(1));
    expect(folderMocks.getPhotoDirectoryPermission).not.toHaveBeenCalledWith(directory, true);
  });

  it('never opens a permission prompt automatically and requests access only after a click', async () => {
    folderMocks.getPhotoDirectoryPermission.mockImplementation(
      async (_directory: FileSystemDirectoryHandle, requestAccess?: boolean) =>
        requestAccess ? 'granted' : 'prompt'
    );
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Photos' }));
    await screen.findByLabelText('Photo folder access needed');

    expect(folderMocks.scanPhotoDirectory).not.toHaveBeenCalled();
    expect(folderMocks.getPhotoDirectoryPermission).not.toHaveBeenCalledWith(directory, true);

    fireEvent.click(screen.getByText('Open settings'));
    const allowButton = await screen.findByRole('button', { name: 'Allow folder access' });
    expect(folderMocks.getPhotoDirectoryPermission).not.toHaveBeenCalledWith(directory, true);

    fireEvent.click(allowButton);
    await waitFor(() =>
      expect(folderMocks.getPhotoDirectoryPermission).toHaveBeenCalledWith(directory, true)
    );
    await waitFor(() => expect(folderMocks.scanPhotoDirectory).toHaveBeenCalledTimes(1));
  });
});
