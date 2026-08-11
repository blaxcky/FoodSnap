// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhotoItem } from '../lib/types';
import type { PhotoFolderStatus } from '../lib/photoFolderImport';
import { PhotoPanel } from './PhotoPanel';

vi.mock('../lib/photoStorage', () => ({
  getPhotoBlob: vi.fn().mockResolvedValue(null)
}));

const pendingPhoto: PhotoItem = {
  id: 'pending-photo',
  status: 'pending',
  createdAt: '2026-07-30T10:15:00.000Z',
  updatedAt: '2026-07-30T10:15:00.000Z'
};

const archivedPhoto: PhotoItem = {
  id: 'archived-photo',
  status: 'archived',
  createdAt: '2026-07-29T08:00:00.000Z',
  updatedAt: '2026-07-29T08:30:00.000Z',
  completedAt: '2026-07-29T08:30:00.000Z',
  foodName: 'Apricot yogurt',
  weightGrams: 184
};

function renderPanel({
  filter = 'pending',
  onSelectPhoto = vi.fn(),
  onDeletePendingPhoto = vi.fn().mockResolvedValue(true),
  folderName = null,
  folderStatus = 'none',
  folderMessage = '',
  onChooseFolder = vi.fn(),
  onAllowFolder = vi.fn()
}: {
  filter?: 'pending' | 'archived';
  onSelectPhoto?: (photoId: string) => void;
  onDeletePendingPhoto?: (photoId: string) => Promise<boolean>;
  folderName?: string | null;
  folderStatus?: PhotoFolderStatus;
  folderMessage?: string;
  onChooseFolder?: () => void;
  onAllowFolder?: () => void;
} = {}) {
  return render(
    <PhotoPanel
      foods={[]}
      pendingPhotos={[pendingPhoto]}
      archivedPhotos={[archivedPhoto]}
      activeFilter={filter}
      selectedPhoto={null}
      isBusy={false}
      feedbackMessage=""
      feedbackTone="idle"
      photoSizeReduction={0}
      autoPhotoSize={false}
      folderName={folderName}
      folderStatus={folderStatus}
      folderImportedCount={0}
      folderMessage={folderMessage}
      onChangeFilter={vi.fn()}
      onOpenCamera={vi.fn()}
      onOpenGallery={vi.fn()}
      onChooseFolder={onChooseFolder}
      onAllowFolder={onAllowFolder}
      onSelectPhoto={onSelectPhoto}
      onCloseDetail={vi.fn()}
      onDeletePendingPhoto={onDeletePendingPhoto}
      onSavePhoto={vi.fn()}
    />
  );
}

function setCardWidth(card: HTMLElement, width = 300) {
  const container = card.parentElement as HTMLDivElement;
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 100,
    top: 0,
    right: width,
    bottom: 100,
    left: 0,
    x: 0,
    y: 0,
    toJSON: () => ({})
  });
}

function swipe(
  card: HTMLElement,
  { endX, endY = 0, cancel = false }: { endX: number; endY?: number; cancel?: boolean }
) {
  fireEvent.pointerDown(card, {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 0,
    clientY: 0
  });
  fireEvent.pointerMove(card, {
    pointerId: 1,
    isPrimary: true,
    clientX: endX,
    clientY: endY
  });
  fireEvent[cancel ? 'pointerCancel' : 'pointerUp'](card, {
    pointerId: 1,
    isPrimary: true,
    clientX: endX,
    clientY: endY
  });
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: true })
  });
  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: { configurable: true, value: vi.fn() },
    releasePointerCapture: { configurable: true, value: vi.fn() },
    hasPointerCapture: { configurable: true, value: vi.fn().mockReturnValue(true) }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PhotoPanel cards', () => {
  it('reduces an open card to its preview and timestamp', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: /Open food photo from/i })).toBeInTheDocument();
    expect(screen.queryByText('Unprocessed photo')).not.toBeInTheDocument();
    expect(screen.queryByText('Open the photo and add food name plus grams.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete open photo' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('button', { name: /Open food photo from/i })).queryByRole('button')
    ).not.toBeInTheDocument();
  });

  it('opens pending and archived cards by click, Enter, or Space', () => {
    const onSelectPhoto = vi.fn();
    renderPanel({ onSelectPhoto });
    const pendingCard = screen.getByRole('button', { name: /Open food photo from/i });

    fireEvent.click(pendingCard);
    fireEvent.keyDown(pendingCard, { key: 'Enter' });
    fireEvent.keyDown(pendingCard, { key: ' ' });
    expect(onSelectPhoto).toHaveBeenCalledTimes(3);
    expect(onSelectPhoto).toHaveBeenLastCalledWith('pending-photo');

    cleanup();
    renderPanel({ filter: 'archived', onSelectPhoto });
    const archivedCard = screen.getByRole('button', { name: /Open Apricot yogurt photo/i });
    fireEvent.click(archivedCard);

    expect(onSelectPhoto).toHaveBeenLastCalledWith('archived-photo');
    expect(screen.getByText('Apricot yogurt')).toBeInTheDocument();
    expect(screen.getByText('184g saved')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(archivedCard.parentElement?.querySelector('.photo-delete-reveal')).toBeNull();
  });

  it('reveals the delete action during a short right swipe and springs back without deleting', () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    renderPanel({ onDeletePendingPhoto: onDelete });
    const card = screen.getByRole('button', { name: /Open food photo from/i });
    setCardWidth(card);

    fireEvent.pointerDown(card, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 0,
      clientY: 0
    });
    fireEvent.pointerMove(card, {
      pointerId: 1,
      isPrimary: true,
      clientX: 48,
      clientY: 2
    });
    expect(screen.getByText('Swipe to delete')).toBeInTheDocument();
    expect(card.style.transform).toBe('translate3d(48px, 0, 0)');
    fireEvent.pointerUp(card, { pointerId: 1, isPrimary: true, clientX: 48, clientY: 2 });

    expect(onDelete).not.toHaveBeenCalled();
    expect(card.style.transform).toBe('translate3d(0px, 0, 0)');
  });

  it('deletes exactly once only after releasing beyond the threshold and suppresses the click', async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    const onSelectPhoto = vi.fn();
    renderPanel({ onDeletePendingPhoto: onDelete, onSelectPhoto });
    const card = screen.getByRole('button', { name: /Open food photo from/i });
    setCardWidth(card);

    swipe(card, { endX: 120 });
    fireEvent.click(card);

    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(onDelete).toHaveBeenCalledWith('pending-photo');
    expect(onSelectPhoto).not.toHaveBeenCalled();
    expect(card.style.opacity).toBe('0');
  });

  it('ignores vertical, leftward, and cancelled gestures', () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    renderPanel({ onDeletePendingPhoto: onDelete });
    const card = screen.getByRole('button', { name: /Open food photo from/i });
    setCardWidth(card);

    swipe(card, { endX: 12, endY: 120 });
    swipe(card, { endX: -130 });
    swipe(card, { endX: 130, cancel: true });

    expect(onDelete).not.toHaveBeenCalled();
    expect(card.style.transform).toBe('translate3d(0px, 0, 0)');
  });

  it('restores the card when deletion fails and supports the Delete key', async () => {
    const onDelete = vi.fn().mockResolvedValue(false);
    renderPanel({ onDeletePendingPhoto: onDelete });
    const card = screen.getByRole('button', { name: /Open food photo from/i });

    fireEvent.keyDown(card, { key: 'Delete' });

    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(card.style.transform).toBe('translate3d(0px, 0, 0)');
    expect(card.style.opacity).toBe('1');
  });
});

describe('PhotoPanel folder import', () => {
  it('keeps gallery import available when folder import is unsupported', () => {
    renderPanel({ folderStatus: 'unsupported' });

    expect(screen.getByText(/Folder import is not supported/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose from gallery' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose folder' })).not.toBeInTheDocument();
  });

  it('shows saved folder permission state and requests access from a user action', () => {
    const onAllowFolder = vi.fn();
    const onChooseFolder = vi.fn();
    renderPanel({
      folderName: 'Camera uploads',
      folderStatus: 'permission',
      folderMessage: 'Allow folder access to scan for new photos.',
      onAllowFolder,
      onChooseFolder
    });

    expect(screen.getByText('Camera uploads')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Allow folder access' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change folder' }));
    expect(onAllowFolder).toHaveBeenCalledTimes(1);
    expect(onChooseFolder).toHaveBeenCalledTimes(1);
  });

  it('shows a scan status and prevents folder changes while scanning', () => {
    renderPanel({
      folderName: 'Meals',
      folderStatus: 'scanning',
      folderMessage: 'Checking this folder and its subfolders...'
    });

    expect(screen.getByRole('status')).toHaveTextContent('Checking this folder');
    expect(screen.queryByRole('button', { name: 'Change folder' })).not.toBeInTheDocument();
  });
});
