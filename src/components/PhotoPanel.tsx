import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { getFoodSuggestions } from '../lib/search';
import { getPhotoBlob } from '../lib/photoStorage';
import type { FoodProfile, PhotoItem } from '../lib/types';
import { formatNumber } from '../lib/utils';
import {
  ArrowLeftIcon,
  CameraIcon,
  ImageIcon,
  PhotoIcon,
  SearchIcon,
  TrashIcon
} from './Icons';

interface PhotoPanelProps {
  foods: FoodProfile[];
  pendingPhotos: PhotoItem[];
  archivedPhotos: PhotoItem[];
  activeFilter: 'pending' | 'archived';
  selectedPhoto: PhotoItem | null;
  isBusy: boolean;
  feedbackMessage: string;
  feedbackTone: 'idle' | 'error';
  onChangeFilter: (filter: 'pending' | 'archived') => void;
  onOpenCamera: () => void;
  onOpenGallery: () => void;
  onSelectPhoto: (photoId: string) => void;
  onCloseDetail: () => void;
  onDeletePendingPhoto: (photoId: string) => void;
  onSavePhoto: (photoId: string, payload: { foodName: string; weightGrams: number }) => void;
}

function formatPhotoTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function useStoredPhotoUrl(photoId: string | null) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoId) {
      setPhotoUrl(null);
      return;
    }

    let active = true;
    let nextObjectUrl = '';

    void getPhotoBlob(photoId)
      .then((blob) => {
        if (!active || !blob) {
          return;
        }

        nextObjectUrl = URL.createObjectURL(blob);
        setPhotoUrl(nextObjectUrl);
      })
      .catch(() => {
        if (active) {
          setPhotoUrl(null);
        }
      });

    return () => {
      active = false;
      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl);
      }
      setPhotoUrl(null);
    };
  }, [photoId]);

  return photoUrl;
}

function StoredPhoto({
  photoId,
  alt,
  className
}: {
  photoId: string;
  alt: string;
  className: string;
}) {
  const photoUrl = useStoredPhotoUrl(photoId);

  return photoUrl ? (
    <img className={className} src={photoUrl} alt={alt} />
  ) : (
    <div className={`${className} stored-photo-fallback`} aria-hidden="true">
      <PhotoIcon className="ui-icon" />
    </div>
  );
}

function PhotoCard({
  photo,
  onOpen,
  onDelete
}: {
  photo: PhotoItem;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className={`photo-card photo-card-${photo.status}`}>
      <button className="photo-card-preview-button" type="button" onClick={onOpen}>
        <StoredPhoto
          photoId={photo.id}
          alt={photo.foodName ? `${photo.foodName} photo` : 'Food photo'}
          className="photo-thumb"
        />
      </button>

      <div className="photo-card-copy">
        <div className="photo-card-meta-row">
          <span className={`status-badge photo-status-badge photo-status-${photo.status}`}>
            {photo.status === 'pending' ? 'Open' : 'Archived'}
          </span>
          <span className="photo-timestamp">
            {formatPhotoTimestamp(photo.completedAt ?? photo.createdAt)}
          </span>
        </div>

        <h3>{photo.foodName?.trim() || 'Unprocessed photo'}</h3>
        <p>
          {photo.status === 'pending'
            ? 'Open the photo and add food name plus grams.'
            : photo.weightGrams != null
            ? `${formatNumber(photo.weightGrams)}g saved`
            : 'Archived without linked log entry'}
        </p>
      </div>

      <div className="entry-actions photo-card-actions">
        <button className="ghost-button compact" type="button" onClick={onOpen}>
          Open
        </button>
        {onDelete ? (
          <button
            className="icon-action destructive-action"
            type="button"
            onClick={onDelete}
            aria-label="Delete open photo"
          >
            <TrashIcon className="ui-icon" />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function PhotoDetail({
  foods,
  photo,
  isBusy,
  onBack,
  onSave
}: {
  foods: FoodProfile[];
  photo: PhotoItem;
  isBusy: boolean;
  onBack: () => void;
  onSave: (payload: { foodName: string; weightGrams: number }) => void;
}) {
  const [foodName, setFoodName] = useState(photo.foodName ?? '');
  const [weightGrams, setWeightGrams] = useState(
    photo.weightGrams != null ? String(photo.weightGrams) : ''
  );
  const [error, setError] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const detailScreenRef = useRef<HTMLElement>(null);
  const foodInputRef = useRef<HTMLInputElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(foodName);
  const suggestions = useMemo(
    () => getFoodSuggestions(foods, deferredQuery, 5),
    [foods, deferredQuery]
  );

  useEffect(() => {
    setFoodName(photo.foodName ?? '');
    setWeightGrams(photo.weightGrams != null ? String(photo.weightGrams) : '');
    setError('');
    setSuggestionsOpen(false);
    setHighlightedIndex(0);
  }, [photo]);

  useEffect(() => {
    const scrollContainer = detailScreenRef.current?.closest('.screen-section-photo-detail');
    const viewport = window.visualViewport;

    if (!(scrollContainer instanceof HTMLElement) || !viewport) {
      return;
    }

    const previousHeight = scrollContainer.style.height;
    const previousMaxHeight = scrollContainer.style.maxHeight;
    let frameId = 0;

    const updateViewport = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const header = document.querySelector('.app-header');
        const bottomNav = document.querySelector('.bottom-nav');
        const headerBottom =
          header instanceof HTMLElement ? Math.round(header.getBoundingClientRect().bottom) : 0;
        const bottomNavTop =
          bottomNav instanceof HTMLElement ? Math.round(bottomNav.getBoundingClientRect().top) : Math.round(viewport.height);
        const availableHeight = Math.max(240, bottomNavTop - headerBottom);

        scrollContainer.style.height = `${availableHeight}px`;
        scrollContainer.style.maxHeight = `${availableHeight}px`;
      });
    };

    updateViewport();
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);

    return () => {
      window.cancelAnimationFrame(frameId);
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
      scrollContainer.style.height = previousHeight;
      scrollContainer.style.maxHeight = previousMaxHeight;
    };
  }, []);

  function applyFoodSuggestion(name: string) {
    setFoodName(name);
    setError('');
    setSuggestionsOpen(false);
    setHighlightedIndex(0);
    window.requestAnimationFrame(() => {
      weightInputRef.current?.focus();
      weightInputRef.current?.select();
    });
  }

  function submitForm() {
    const trimmedFoodName = foodName.trim();
    const trimmedWeight = weightGrams.trim();

    if (!trimmedFoodName) {
      setError('Enter a food name.');
      return;
    }

    const parsedWeight = Number(trimmedWeight);

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setError('Enter a valid weight in grams.');
      return;
    }

    onSave({
      foodName: trimmedFoodName,
      weightGrams: parsedWeight
    });
  }

  return (
    <section ref={detailScreenRef} className="photo-detail-screen">
      <div className="section-heading photo-detail-heading">
        <div className="photo-detail-heading-copy">
          <button className="ghost-button compact photo-back-button" type="button" onClick={onBack}>
            <ArrowLeftIcon className="ui-icon" />
            <span>Back</span>
          </button>
          <div>
            <p className="section-kicker">Photos</p>
            <h2>{photo.status === 'pending' ? 'Process photo' : 'Archived photo'}</h2>
          </div>
        </div>
        <span className={`status-badge photo-status-badge photo-status-${photo.status}`}>
          {photo.status === 'pending' ? 'Open' : 'Archived'}
        </span>
      </div>

      <div className="photo-detail-card">
        <div className="photo-detail-media">
          <StoredPhoto
            photoId={photo.id}
            alt={photo.foodName ? `${photo.foodName} photo` : 'Food photo'}
            className="photo-detail-image"
          />
        </div>

        <form
          className="photo-detail-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitForm();
          }}
        >
          <div className="field-stack autocomplete-shell">
            <label className="field">
              <span className="field-label">Food</span>
              <div className="search-field">
                <input
                  ref={foodInputRef}
                  className="field-input field-input-lg"
                  name="photo-food-name"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  inputMode="text"
                  placeholder="Enter food name..."
                  value={foodName}
                  onChange={(event) => {
                    setFoodName(event.target.value);
                    setError('');
                    setSuggestionsOpen(true);
                    setHighlightedIndex(0);
                  }}
                  onFocus={() => setSuggestionsOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setSuggestionsOpen(false), 120);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' && suggestions.length > 0) {
                      event.preventDefault();
                      setHighlightedIndex((current) => (current + 1) % suggestions.length);
                      return;
                    }

                    if (event.key === 'ArrowUp' && suggestions.length > 0) {
                      event.preventDefault();
                      setHighlightedIndex((current) =>
                        current === 0 ? suggestions.length - 1 : current - 1
                      );
                      return;
                    }

                    if (event.key === 'Enter') {
                      event.preventDefault();

                      if (suggestionsOpen && suggestions[highlightedIndex]) {
                        applyFoodSuggestion(suggestions[highlightedIndex].name);
                        return;
                      }

                      weightInputRef.current?.focus();
                    }

                    if (event.key === 'Escape') {
                      setSuggestionsOpen(false);
                    }
                  }}
                />
                <span className="field-icon" aria-hidden="true">
                  <SearchIcon className="ui-icon search-icon-strong" />
                </span>
              </div>
            </label>

            {suggestionsOpen && foodName.trim() && suggestions.length > 0 ? (
              <div className="suggestions-dropdown photo-detail-suggestions">
                <div className="suggestions" role="listbox" aria-label="Food suggestions">
                  {suggestions.map((food, index) => (
                    <button
                      key={food.id}
                      className={`suggestion-item${highlightedIndex === index ? ' active' : ''}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyFoodSuggestion(food.name)}
                    >
                      <span className="suggestion-copy">
                        <strong>{food.name}</strong>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <label className="field">
            <span className="field-label">Weight</span>
            <div className="input-suffix-shell">
              <input
                ref={weightInputRef}
                className="field-input number-field field-input-with-suffix"
                name="photo-weight"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="done"
                inputMode="decimal"
                placeholder="0"
                value={weightGrams}
                onChange={(event) => {
                  setWeightGrams(event.target.value);
                  setError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitForm();
                  }
                }}
              />
              <span className="input-suffix" aria-hidden="true">
                g
              </span>
            </div>
          </label>

          <p className="helper-copy photo-detail-helper">
            {photo.status === 'pending'
              ? 'Save to archive the photo and create a normal log entry.'
              : 'Changes here stay synced with the linked log entry while it remains a direct gram entry.'}
          </p>

          {error ? <p className="error-copy">{error}</p> : null}

          <div className="photo-detail-footer">
            <button className="primary-button photo-save-button" type="submit" disabled={isBusy}>
              {photo.status === 'pending'
                ? isBusy
                  ? 'Saving...'
                  : 'Save and archive'
                : isBusy
                ? 'Saving...'
                : 'Update photo'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export function PhotoPanel({
  foods,
  pendingPhotos,
  archivedPhotos,
  activeFilter,
  selectedPhoto,
  isBusy,
  feedbackMessage,
  feedbackTone,
  onChangeFilter,
  onOpenCamera,
  onOpenGallery,
  onSelectPhoto,
  onCloseDetail,
  onDeletePendingPhoto,
  onSavePhoto
}: PhotoPanelProps) {
  const visiblePhotos = activeFilter === 'pending' ? pendingPhotos : archivedPhotos;

  if (selectedPhoto) {
    return (
      <PhotoDetail
        foods={foods}
        photo={selectedPhoto}
        isBusy={isBusy}
        onBack={onCloseDetail}
        onSave={(payload) => onSavePhoto(selectedPhoto.id, payload)}
      />
    );
  }

  return (
    <section className="panel photo-panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Photos</p>
          <h2>Quick photo inbox</h2>
        </div>
        <span className="status-badge">{pendingPhotos.length} open</span>
      </div>

      <div className="photo-capture-actions">
        <button className="primary-button photo-action-button" type="button" onClick={onOpenCamera}>
          <CameraIcon className="ui-icon" />
          <span>Take photo</span>
        </button>
        <button className="ghost-button photo-action-button" type="button" onClick={onOpenGallery}>
          <ImageIcon className="ui-icon" />
          <span>Choose from gallery</span>
        </button>
      </div>

      <div className="photo-filter" role="tablist" aria-label="Photo sections">
        <button
          className={`photo-filter-button${activeFilter === 'pending' ? ' active' : ''}`}
          type="button"
          onClick={() => onChangeFilter('pending')}
        >
          Open
        </button>
        <button
          className={`photo-filter-button${activeFilter === 'archived' ? ' active' : ''}`}
          type="button"
          onClick={() => onChangeFilter('archived')}
        >
          Archive
        </button>
      </div>

      {feedbackMessage ? (
        <p className={feedbackTone === 'error' ? 'error-copy' : 'helper-copy'}>{feedbackMessage}</p>
      ) : null}

      {visiblePhotos.length === 0 ? (
        <div className="empty-state">
          <p>{activeFilter === 'pending' ? 'No open photos yet.' : 'No archived photos yet.'}</p>
          <span>
            {activeFilter === 'pending'
              ? 'Take a quick food photo and process it later.'
              : 'Processed food photos stay here for later reference.'}
          </span>
        </div>
      ) : (
        <div className="photo-list">
          {visiblePhotos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              onOpen={() => onSelectPhoto(photo.id)}
              onDelete={
                photo.status === 'pending' ? () => onDeletePendingPhoto(photo.id) : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
