// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoodProfile, PhotoItem } from '../lib/types';
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

const nextPendingPhoto: PhotoItem = {
  id: 'next-pending-photo',
  status: 'pending',
  createdAt: '2026-07-30T10:20:00.000Z',
  updatedAt: '2026-07-30T10:20:00.000Z'
};

const rememberedFood: FoodProfile = {
  id: 'apple',
  name: 'Apple',
  normalizedName: 'apple',
  usageCount: 3,
  lastUsedAt: '2026-07-30T09:00:00.000Z',
  createdAt: '2026-07-01T09:00:00.000Z',
  isFavorite: false,
  lastUnit: 'g'
};

function renderPanel({
  filter = 'pending',
  onSelectPhoto = vi.fn(),
  onDeletePendingPhoto = vi.fn().mockResolvedValue(true),
  folderActivity = null,
  folderNeedsPermission = false,
  onAllowPhotoFolder = vi.fn()
}: {
  filter?: 'pending' | 'archived';
  onSelectPhoto?: (photoId: string) => void;
  onDeletePendingPhoto?: (photoId: string) => Promise<boolean>;
  folderActivity?: 'loading' | 'scanning' | null;
  folderNeedsPermission?: boolean;
  onAllowPhotoFolder?: () => void;
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
      folderActivity={folderActivity}
      folderNeedsPermission={folderNeedsPermission}
      onChangeFilter={vi.fn()}
      onOpenCamera={vi.fn()}
      onOpenGallery={vi.fn()}
      onAllowPhotoFolder={onAllowPhotoFolder}
      onSelectPhoto={onSelectPhoto}
      onCloseDetail={vi.fn()}
      onDeletePendingPhoto={onDeletePendingPhoto}
      onSavePhoto={vi.fn()}
    />
  );
}

function photoDetailView(photo: PhotoItem) {
  return (
    <section className="screen-section screen-section-photo-detail">
      <PhotoPanel
        foods={[rememberedFood]}
        pendingPhotos={[pendingPhoto, nextPendingPhoto]}
        archivedPhotos={[archivedPhoto]}
        activeFilter="pending"
        selectedPhoto={photo}
        isBusy={false}
        feedbackMessage=""
        feedbackTone="idle"
        photoSizeReduction={0}
        autoPhotoSize={false}
        folderActivity={null}
        folderNeedsPermission={false}
        onChangeFilter={vi.fn()}
        onOpenCamera={vi.fn()}
        onOpenGallery={vi.fn()}
        onAllowPhotoFolder={vi.fn()}
        onSelectPhoto={vi.fn()}
        onCloseDetail={vi.fn()}
        onDeletePendingPhoto={vi.fn().mockResolvedValue(true)}
        onSavePhoto={vi.fn()}
      />
    </section>
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
  vi.unstubAllGlobals();
});

describe('PhotoPanel detail keyboard flow', () => {
  it('keeps suggestions above an open keyboard when advancing to the next photo', async () => {
    class MockVisualViewport extends EventTarget {
      height = 800;
      offsetTop = 0;
    }

    const viewport = new MockVisualViewport();
    vi.stubGlobal('visualViewport', viewport);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const { rerender } = render(photoDetailView(pendingPhoto));
    const detailSection = document.querySelector('.screen-section-photo-detail');
    const firstFoodInput = screen.getByRole('textbox', { name: 'Food' });

    expect(firstFoodInput).toHaveFocus();

    act(() => {
      viewport.height = 500;
      viewport.dispatchEvent(new Event('resize'));
    });

    expect(detailSection).toHaveClass('photo-detail-keyboard-visible');

    firstFoodInput.textContent = 'Apple';
    fireEvent.input(firstFoodInput);
    fireEvent.keyDown(firstFoodInput, { key: 'Enter' });
    expect(screen.getByRole('textbox', { name: 'Weight' })).toHaveFocus();

    rerender(photoDetailView(nextPendingPhoto));

    const nextFoodInput = screen.getByRole('textbox', { name: 'Food' });
    expect(nextFoodInput).toHaveFocus();
    expect(nextFoodInput).toHaveTextContent('');
    expect(detailSection).toHaveClass('photo-detail-keyboard-visible');

    nextFoodInput.textContent = 'Ap';
    fireEvent.input(nextFoodInput);

    const suggestions = await screen.findByRole('listbox', { name: 'Food suggestions' });
    expect(suggestions.closest('.photo-detail-suggestions')).toBeInTheDocument();
    expect(detailSection).toHaveClass('photo-detail-keyboard-visible');
  });
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
  it('shows no folder UI during normal automatic import states', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: 'Choose from gallery' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Photo folder access needed')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open settings' })).not.toBeInTheDocument();
  });

  it.each([
    ['loading', 'Checking saved photo folder', 'Preparing the folder scan'],
    ['scanning', 'Importing photo folder', 'New photos will appear here']
  ] as const)('shows the %s folder activity in Photos', (folderActivity, label, detail) => {
    renderPanel({ folderActivity });

    const activity = screen.getByLabelText(label);
    expect(activity).toHaveAttribute('role', 'status');
    expect(activity).toHaveTextContent(detail);
    expect(screen.queryByLabelText('Photo folder access needed')).not.toBeInTheDocument();
  });

  it('shows only a compact permission notice and requests access from it', () => {
    const onAllowPhotoFolder = vi.fn();
    renderPanel({
      folderNeedsPermission: true,
      onAllowPhotoFolder
    });

    expect(screen.getByLabelText('Photo folder access needed')).toHaveTextContent('needs access');
    expect(screen.queryByRole('button', { name: 'Open settings' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Allow folder access' }));
    expect(onAllowPhotoFolder).toHaveBeenCalledTimes(1);
  });
});
