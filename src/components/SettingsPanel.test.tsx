// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { PhotoFolderStatus } from '../lib/photoFolderImport';
import { SettingsPanel } from './SettingsPanel';

const baseProps: ComponentProps<typeof SettingsPanel> = {
  foodCount: 0,
  sessionCount: 0,
  exportState: 'idle' as const,
  importState: 'idle' as const,
  importMessage: '',
  exportLeadIn: '',
  refreshState: 'idle' as const,
  themePreference: 'system' as const,
  cameraPreference: 'system' as const,
  photoSizeReduction: 0,
  autoPhotoSize: false,
  folderSupported: true,
  folderName: null,
  folderPermission: null,
  folderStatus: 'none' as PhotoFolderStatus,
  folderImportedCount: 0,
  folderMessage: '',
  onExportFoodMemory: vi.fn(),
  onImportFoodMemory: vi.fn().mockResolvedValue(undefined),
  onChangeExportLeadIn: vi.fn(),
  onForceRefresh: vi.fn().mockResolvedValue(undefined),
  onChangeTheme: vi.fn(),
  onChangeCameraPreference: vi.fn(),
  onChangePhotoSizeReduction: vi.fn(),
  onChangeAutoPhotoSize: vi.fn(),
  onChooseFolder: vi.fn(),
  onAllowFolder: vi.fn()
};

function renderSettings(overrides: Partial<ComponentProps<typeof SettingsPanel>> = {}) {
  return render(<SettingsPanel {...baseProps} {...overrides} />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SettingsPanel photo folder import', () => {
  it('explains unsupported browsers without affecting gallery import', () => {
    renderSettings({ folderSupported: false, folderStatus: 'unsupported' });

    expect(screen.getByText('Not supported in this browser')).toBeInTheDocument();
    expect(screen.getByText(/camera or gallery import/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose folder' })).not.toBeInTheDocument();
  });

  it('offers folder selection when no folder is configured', () => {
    const onChooseFolder = vi.fn();
    renderSettings({ onChooseFolder });

    fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }));
    expect(onChooseFolder).toHaveBeenCalledTimes(1);
  });

  it('shows a granted folder and its last completed scan', () => {
    const onChooseFolder = vi.fn();
    renderSettings({
      folderName: 'Meal photos',
      folderPermission: 'granted',
      folderStatus: 'complete',
      folderImportedCount: 3,
      folderMessage: '3 new photos imported.',
      onChooseFolder
    });

    expect(screen.getByText('Meal photos')).toBeInTheDocument();
    expect(screen.getByText('Granted')).toBeInTheDocument();
    expect(screen.getByText('3 new photos imported in the last scan.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change folder' }));
    expect(onChooseFolder).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['prompt', 'Required'],
    ['denied', 'Blocked']
  ] as const)('requests %s permission only after the access button is clicked', (permission, label) => {
    const onAllowFolder = vi.fn();
    renderSettings({
      folderName: 'Camera uploads',
      folderPermission: permission,
      folderStatus: 'permission',
      folderMessage: 'Allow folder access to scan for new photos.',
      onAllowFolder
    });

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(/Allow on every visit/i)).toBeInTheDocument();
    expect(onAllowFolder).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Allow folder access' }));
    expect(onAllowFolder).toHaveBeenCalledTimes(1);
  });

  it('shows scan progress and disables folder changes while scanning', () => {
    renderSettings({
      folderName: 'Meals',
      folderPermission: 'granted',
      folderStatus: 'scanning',
      folderMessage: 'Checking this folder and its subfolders...'
    });

    expect(screen.getByLabelText('Scanning photo folder')).toBeInTheDocument();
    expect(screen.getByText('Checking this folder and its subfolders...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change folder' })).toBeDisabled();
  });

  it('renders loading and errors as readable status states', () => {
    const { rerender } = renderSettings({ folderStatus: 'loading' });
    expect(screen.getByLabelText('Loading saved photo folder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose folder' })).toBeDisabled();

    rerender(
      <SettingsPanel
        {...baseProps}
        folderName="Meals"
        folderPermission="granted"
        folderStatus="error"
        folderMessage="The folder could not be scanned."
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('The folder could not be scanned.');
    expect(screen.getByRole('button', { name: 'Change folder' })).toBeEnabled();
  });
});
