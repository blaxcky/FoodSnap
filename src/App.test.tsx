// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    expect(folderMocks.getSavedPhotoDirectory).toHaveBeenCalledTimes(1);
    expect(folderMocks.getPhotoDirectoryPermission).toHaveBeenCalledTimes(1);
    expect(folderMocks.getPhotoDirectoryPermission).not.toHaveBeenCalledWith(directory, true);
  });

  it('keeps a click-granted handle for the session without immediately querying it again', async () => {
    folderMocks.getPhotoDirectoryPermission.mockImplementation(
      async (_directory: FileSystemDirectoryHandle, requestAccess?: boolean) =>
        requestAccess ? 'granted' : 'prompt'
    );
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Photos' }));
    await screen.findByLabelText('Photo folder access needed');

    expect(folderMocks.scanPhotoDirectory).not.toHaveBeenCalled();
    expect(folderMocks.getPhotoDirectoryPermission).not.toHaveBeenCalledWith(directory, true);

    fireEvent.click(screen.getByRole('button', { name: 'Allow folder access' }));
    await waitFor(() =>
      expect(folderMocks.getPhotoDirectoryPermission).toHaveBeenCalledWith(directory, true)
    );
    await waitFor(() => expect(folderMocks.scanPhotoDirectory).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Photos' })).toHaveClass('active');
    expect(screen.queryByLabelText('Photo folder access needed')).not.toBeInTheDocument();
    expect(folderMocks.getSavedPhotoDirectory).toHaveBeenCalledTimes(1);
    expect(folderMocks.getPhotoDirectoryPermission).toHaveBeenCalledTimes(2);

    const permissionCallsAfterGrant = folderMocks.getPhotoDirectoryPermission.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    await screen.findByText('Granted');

    expect(folderMocks.getSavedPhotoDirectory).toHaveBeenCalledTimes(1);
    expect(folderMocks.getPhotoDirectoryPermission).toHaveBeenCalledTimes(
      permissionCallsAfterGrant
    );
    expect(folderMocks.scanPhotoDirectory).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Allow folder access' })).not.toBeInTheDocument();
  });

  it.each(['prompt', 'denied'] as const)(
    'keeps the Photos permission notice retryable when direct access returns %s',
    async (permission) => {
      folderMocks.getPhotoDirectoryPermission.mockImplementation(
        async (_directory: FileSystemDirectoryHandle, requestAccess?: boolean) =>
          requestAccess ? permission : 'prompt'
      );
      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: 'Photos' }));
      const allowButton = await screen.findByRole('button', { name: 'Allow folder access' });
      fireEvent.click(allowButton);

      await waitFor(() =>
        expect(folderMocks.getPhotoDirectoryPermission).toHaveBeenCalledTimes(2)
      );
      expect(screen.getByLabelText('Photo folder access needed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Photos' })).toHaveClass('active');
      expect(folderMocks.scanPhotoDirectory).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Allow folder access' }));
      await waitFor(() =>
        expect(folderMocks.getPhotoDirectoryPermission).toHaveBeenCalledTimes(3)
      );
      expect(folderMocks.scanPhotoDirectory).not.toHaveBeenCalled();
    }
  );

  it('coalesces quick repeated permission clicks into one request', async () => {
    let resolvePermission: (permission: PermissionState) => void = () => undefined;
    const pendingPermission = new Promise<PermissionState>((resolve) => {
      resolvePermission = resolve;
    });
    folderMocks.getPhotoDirectoryPermission.mockImplementation(
      async (_directory: FileSystemDirectoryHandle, requestAccess?: boolean) =>
        requestAccess ? pendingPermission : 'prompt'
    );
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Photos' }));
    const allowButton = await screen.findByRole('button', { name: 'Allow folder access' });
    fireEvent.click(allowButton);
    fireEvent.click(allowButton);

    expect(
      folderMocks.getPhotoDirectoryPermission.mock.calls.filter(([, request]) => request).length
    ).toBe(1);
    await act(async () => {
      resolvePermission('denied');
      await pendingPermission;
    });
    expect(screen.getByRole('button', { name: 'Allow folder access' })).toBeInTheDocument();
    expect(folderMocks.scanPhotoDirectory).not.toHaveBeenCalled();
  });

  it('checks Chromium again in a new app process instead of restoring a granted value', async () => {
    folderMocks.getPhotoDirectoryPermission.mockResolvedValue('prompt');
    const firstApp = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Photos' }));
    await screen.findByLabelText('Photo folder access needed');
    firstApp.unmount();

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Photos' }));
    await screen.findByLabelText('Photo folder access needed');

    expect(folderMocks.getSavedPhotoDirectory).toHaveBeenCalledTimes(2);
    expect(folderMocks.getPhotoDirectoryPermission).toHaveBeenCalledTimes(2);
    expect(folderMocks.getPhotoDirectoryPermission).not.toHaveBeenCalledWith(directory, true);
    expect(folderMocks.scanPhotoDirectory).not.toHaveBeenCalled();
  });

  it.each(['prompt', 'denied'] as const)(
    'returns to the permission state when access becomes %s during a scan',
    async (revokedPermission) => {
      folderMocks.getPhotoDirectoryPermission
        .mockResolvedValue(revokedPermission)
        .mockResolvedValueOnce('granted')
        .mockResolvedValueOnce(revokedPermission);
      folderMocks.scanPhotoDirectory.mockRejectedValue(new DOMException('Access lost'));
      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: 'Photos' }));
      await screen.findByLabelText('Photo folder access needed');
      fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));

      expect(await screen.findByText(revokedPermission === 'denied' ? 'Blocked' : 'Required'))
        .toBeInTheDocument();
      expect(folderMocks.getPhotoDirectoryPermission).toHaveBeenCalledTimes(3);
    }
  );

  it('keeps an ordinary scan failure separate when Chromium still grants access', async () => {
    folderMocks.getPhotoDirectoryPermission.mockResolvedValue('granted');
    folderMocks.scanPhotoDirectory.mockRejectedValue(new Error('Unreadable folder contents'));
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Photos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The folder could not be scanned');
    expect(screen.getByText('Granted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Allow folder access' })).not.toBeInTheDocument();
  });
});
