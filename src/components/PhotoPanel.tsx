import {
  type ClipboardEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { getFoodSuggestions } from '../lib/search';
import { getPhotoBlob } from '../lib/photoStorage';
import { getPhotoDetailMediaHeight } from '../lib/photoSizePreference';
import type { FoodProfile, PhotoItem } from '../lib/types';
import { formatNumber } from '../lib/utils';
import {
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
  photoSizeReduction: number;
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

function readSingleLineValue(element: HTMLElement) {
  return (element.textContent ?? '').replace(/[\r\n]+/g, ' ');
}

function selectEditableText(element: HTMLElement) {
  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertPlainText(element: HTMLElement, text: string) {
  const selection = window.getSelection();
  const range =
    selection && selection.rangeCount > 0 && element.contains(selection.anchorNode)
      ? selection.getRangeAt(0)
      : null;
  const textNode = document.createTextNode(text);

  if (!range || !selection) {
    element.append(textNode);
    selectEditableText(element);
    window.getSelection()?.collapseToEnd();
    return;
  }

  range.deleteContents();
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function SingleLineEditable({
  elementRef,
  className,
  labelledBy,
  inputMode,
  enterKeyHint,
  placeholder,
  value,
  ariaInvalid,
  describedBy,
  disabled,
  onValueChange,
  onFocus,
  onBlur,
  onKeyDown
}: {
  elementRef: RefObject<HTMLDivElement>;
  className: string;
  labelledBy: string;
  inputMode: 'text' | 'decimal';
  enterKeyHint: 'next' | 'done';
  placeholder: string;
  value: string;
  ariaInvalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  onFocus?: (event: FocusEvent<HTMLDivElement>) => void;
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const isComposingRef = useRef(false);

  useLayoutEffect(() => {
    const element = elementRef.current;

    if (
      !element ||
      isComposingRef.current ||
      (readSingleLineValue(element) === value && !(value === '' && element.hasChildNodes()))
    ) {
      return;
    }

    element.textContent = value;
  }, [elementRef, value]);

  function updateValue(element: HTMLDivElement) {
    const nextValue = readSingleLineValue(element);

    if (element.textContent !== nextValue || (nextValue === '' && element.hasChildNodes())) {
      element.textContent = nextValue;
    }

    onValueChange(nextValue);
  }

  function handleBeforeInput(event: FormEvent<HTMLDivElement>) {
    const inputEvent = event.nativeEvent as InputEvent;

    if (inputEvent.inputType === 'insertParagraph' || inputEvent.inputType === 'insertLineBreak') {
      event.preventDefault();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const plainText = event.clipboardData.getData('text/plain').replace(/[\r\n]+/g, ' ');
    insertPlainText(event.currentTarget, plainText);
    updateValue(event.currentTarget);
  }

  return (
    <div
      ref={elementRef}
      className={`${className} single-line-editable`}
      role="textbox"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={ariaInvalid || undefined}
      aria-disabled={disabled || undefined}
      aria-multiline="false"
      aria-placeholder={placeholder}
      data-placeholder={placeholder}
      contentEditable={disabled ? false : 'plaintext-only'}
      tabIndex={disabled ? -1 : 0}
      suppressContentEditableWarning
      inputMode={inputMode}
      enterKeyHint={enterKeyHint}
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      data-1p-ignore="true"
      data-lpignore="true"
      data-bwignore="true"
      onBeforeInput={handleBeforeInput}
      onInput={(event) => updateValue(event.currentTarget)}
      onCompositionStart={() => {
        isComposingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        isComposingRef.current = false;
        updateValue(event.currentTarget);
      }}
      onPaste={handlePaste}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={(event) => {
        if (!isComposingRef.current && !event.nativeEvent.isComposing) {
          onKeyDown(event);
        }
      }}
    />
  );
}

function PhotoDetail({
  foods,
  photo,
  isBusy,
  photoSizeReduction,
  onBack,
  onSave
}: {
  foods: FoodProfile[];
  photo: PhotoItem;
  isBusy: boolean;
  photoSizeReduction: number;
  onBack: () => void;
  onSave: (payload: { foodName: string; weightGrams: number }) => void;
}) {
  const [step, setStep] = useState<'food' | 'weight'>('food');
  const [foodName, setFoodName] = useState(photo.foodName ?? '');
  const [weightGrams, setWeightGrams] = useState(
    photo.weightGrams != null ? String(photo.weightGrams) : ''
  );
  const [error, setError] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const detailScreenRef = useRef<HTMLElement>(null);
  const activeFieldSlotRef = useRef<HTMLDivElement>(null);
  const activeFieldLayerRef = useRef<HTMLDivElement>(null);
  const foodInputRef = useRef<HTMLDivElement>(null);
  const weightInputRef = useRef<HTMLDivElement>(null);
  const gestureStartRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const previousTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const deferredQuery = useDeferredValue(foodName);
  const suggestions = useMemo(
    () => getFoodSuggestions(foods, deferredQuery, 5),
    [foods, deferredQuery]
  );

  useEffect(() => {
    setStep('food');
    setFoodName(photo.foodName ?? '');
    setWeightGrams(photo.weightGrams != null ? String(photo.weightGrams) : '');
    setError('');
    setSuggestionsOpen(false);
    setHighlightedIndex(0);
  }, [photo]);

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const input = step === 'food' ? foodInputRef.current : weightInputRef.current;

      input?.focus();
      if (input) {
        selectEditableText(input);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [photo.id, step]);

  useEffect(() => {
    const { documentElement, body } = document;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousHtmlOverscrollBehavior = documentElement.style.overscrollBehavior;
    const previousOverflow = body.style.overflow;
    const previousOverscrollBehavior = body.style.overscrollBehavior;

    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    return () => {
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      body.style.overflow = previousOverflow;
      body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, []);

  useEffect(() => {
    const scrollContainer = detailScreenRef.current?.closest('.screen-section-photo-detail');
    const viewport = window.visualViewport;

    if (!(scrollContainer instanceof HTMLElement)) {
      return;
    }

    scrollContainer.scrollTop = 0;
    scrollContainer.scrollLeft = 0;

    const previousViewportHeight = scrollContainer.style.getPropertyValue(
      '--photo-detail-viewport-height'
    );
    const previousViewportOffsetTop = scrollContainer.style.getPropertyValue(
      '--photo-detail-viewport-offset-top'
    );
    const previousKeyboardEdge = scrollContainer.style.getPropertyValue(
      '--photo-detail-keyboard-edge'
    );
    const previousFieldHeight = scrollContainer.style.getPropertyValue(
      '--photo-detail-field-height'
    );
    const previousFieldLeft = scrollContainer.style.getPropertyValue('--photo-detail-field-left');
    const previousFieldWidth = scrollContainer.style.getPropertyValue(
      '--photo-detail-field-width'
    );
    const hadKeyboardClass = scrollContainer.classList.contains('photo-detail-keyboard-open');
    let viewportFrameId = 0;
    let fieldFrameId = 0;
    let baselineHeight = Math.max(
      viewport?.height ?? 0,
      window.innerHeight,
      document.documentElement.clientHeight
    );
    let orientation = window.screen.orientation?.angle ?? window.orientation ?? 0;

    const updateFieldMetrics = () => {
      window.cancelAnimationFrame(fieldFrameId);
      fieldFrameId = window.requestAnimationFrame(() => {
        const fieldLayer = activeFieldLayerRef.current;
        const fieldSlot = activeFieldSlotRef.current;

        if (!fieldLayer || !fieldSlot) {
          return;
        }

        const fieldRect = fieldLayer.getBoundingClientRect();
        const slotRect = fieldSlot.getBoundingClientRect();

        scrollContainer.style.setProperty(
          '--photo-detail-field-height',
          `${fieldRect.height}px`
        );
        scrollContainer.style.setProperty(
          '--photo-detail-field-left',
          `${slotRect.left}px`
        );
        scrollContainer.style.setProperty(
          '--photo-detail-field-width',
          `${slotRect.width}px`
        );
      });
    };

    const updateViewport = () => {
      window.cancelAnimationFrame(viewportFrameId);
      viewportFrameId = window.requestAnimationFrame(() => {
        const nextOrientation = window.screen.orientation?.angle ?? window.orientation ?? 0;
        const activeElement = document.activeElement;
        const activeInput =
          activeElement === foodInputRef.current || activeElement === weightInputRef.current
            ? activeElement
            : null;
        const viewportHeight = viewport?.height ?? window.innerHeight;
        const viewportOffsetTop = viewport?.offsetTop ?? 0;

        if (nextOrientation !== orientation) {
          orientation = nextOrientation;
          baselineHeight = Math.max(
            viewportHeight,
            window.innerHeight,
            navigator.maxTouchPoints > 0 ? window.screen.availHeight : 0
          );
        } else if (!activeInput) {
          baselineHeight = Math.max(baselineHeight, viewportHeight, window.innerHeight);
        }

        const keyboardOpen = Boolean(activeInput && baselineHeight - viewportHeight >= 120);

        scrollContainer.style.setProperty(
          '--photo-detail-viewport-height',
          `${viewportHeight}px`
        );
        scrollContainer.style.setProperty(
          '--photo-detail-viewport-offset-top',
          `${viewportOffsetTop}px`
        );
        scrollContainer.style.setProperty(
          '--photo-detail-keyboard-edge',
          `${viewportOffsetTop + viewportHeight}px`
        );
        updateFieldMetrics();
        scrollContainer.classList.toggle('photo-detail-keyboard-open', keyboardOpen);
      });
    };

    const fieldObserver = new ResizeObserver(updateFieldMetrics);
    if (activeFieldLayerRef.current) {
      fieldObserver.observe(activeFieldLayerRef.current);
    }
    if (activeFieldSlotRef.current) {
      fieldObserver.observe(activeFieldSlotRef.current);
    }

    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    scrollContainer.addEventListener('focusin', updateViewport);
    scrollContainer.addEventListener('focusout', updateViewport);

    return () => {
      window.cancelAnimationFrame(viewportFrameId);
      window.cancelAnimationFrame(fieldFrameId);
      fieldObserver.disconnect();
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      scrollContainer.removeEventListener('focusin', updateViewport);
      scrollContainer.removeEventListener('focusout', updateViewport);
      if (previousViewportHeight) {
        scrollContainer.style.setProperty('--photo-detail-viewport-height', previousViewportHeight);
      } else {
        scrollContainer.style.removeProperty('--photo-detail-viewport-height');
      }
      if (previousViewportOffsetTop) {
        scrollContainer.style.setProperty(
          '--photo-detail-viewport-offset-top',
          previousViewportOffsetTop
        );
      } else {
        scrollContainer.style.removeProperty('--photo-detail-viewport-offset-top');
      }
      if (previousKeyboardEdge) {
        scrollContainer.style.setProperty('--photo-detail-keyboard-edge', previousKeyboardEdge);
      } else {
        scrollContainer.style.removeProperty('--photo-detail-keyboard-edge');
      }
      if (previousFieldHeight) {
        scrollContainer.style.setProperty('--photo-detail-field-height', previousFieldHeight);
      } else {
        scrollContainer.style.removeProperty('--photo-detail-field-height');
      }
      if (previousFieldLeft) {
        scrollContainer.style.setProperty('--photo-detail-field-left', previousFieldLeft);
      } else {
        scrollContainer.style.removeProperty('--photo-detail-field-left');
      }
      if (previousFieldWidth) {
        scrollContainer.style.setProperty('--photo-detail-field-width', previousFieldWidth);
      } else {
        scrollContainer.style.removeProperty('--photo-detail-field-width');
      }
      scrollContainer.classList.toggle('photo-detail-keyboard-open', hadKeyboardClass);
    };
  }, []);

  function continueToWeight() {
    if (isBusy) {
      return;
    }

    const trimmedFoodName = foodName.trim();

    if (!trimmedFoodName) {
      setError('Enter a food name.');
      return;
    }

    setFoodName(trimmedFoodName);
    setError('');
    setSuggestionsOpen(false);
    setStep('weight');
  }

  function applyFoodSuggestion(name: string) {
    if (isBusy) {
      return;
    }

    setFoodName(name);
    setError('');
    setSuggestionsOpen(false);
    setHighlightedIndex(0);
    setStep('weight');
  }

  function submitForm() {
    if (isBusy) {
      return;
    }

    const trimmedFoodName = foodName.trim();
    const trimmedWeight = weightGrams.trim();

    if (!trimmedFoodName) {
      setError('Enter a food name.');
      setStep('food');
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

  function handleGestureStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
      gestureStartRef.current = null;
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    gestureStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
  }

  function handleGestureEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const start = gestureStartRef.current;
    gestureStartRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    const absoluteHorizontalDistance = Math.abs(horizontalDistance);
    const absoluteVerticalDistance = Math.abs(verticalDistance);

    if (absoluteHorizontalDistance >= 50 && absoluteHorizontalDistance > absoluteVerticalDistance) {
      previousTapRef.current = null;

      if (horizontalDistance < 0 && step === 'weight' && !isBusy) {
        setError('');
        setStep('food');
      }

      return;
    }

    if (Math.hypot(horizontalDistance, verticalDistance) > 10) {
      previousTapRef.current = null;
      return;
    }

    const now = event.timeStamp;
    const previousTap = previousTapRef.current;

    if (
      previousTap &&
      now - previousTap.time <= 350 &&
      Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y) <= 40
    ) {
      previousTapRef.current = null;
      event.preventDefault();
      onBack();
      return;
    }

    previousTapRef.current = {
      time: now,
      x: event.clientX,
      y: event.clientY
    };
  }

  function handleGestureCancel(event: ReactPointerEvent<HTMLDivElement>) {
    gestureStartRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <section ref={detailScreenRef} className="photo-detail-screen">
      <div className="photo-detail-card">
        <div
          className="photo-detail-media"
          style={{ height: getPhotoDetailMediaHeight(photoSizeReduction) }}
          onPointerDown={handleGestureStart}
          onPointerUp={handleGestureEnd}
          onPointerCancel={handleGestureCancel}
          onLostPointerCapture={() => {
            gestureStartRef.current = null;
          }}
          onDoubleClick={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}
        >
          <StoredPhoto
            photoId={photo.id}
            alt={photo.foodName ? `${photo.foodName} photo` : 'Food photo'}
            className="photo-detail-image"
          />
        </div>

        <div className="photo-detail-form" role="form" aria-label="Photo details">
          <p className="visually-hidden" aria-live="polite">
            {step === 'food' ? 'Food name' : 'Weight'}
          </p>

          <div className="photo-detail-field-slot" ref={activeFieldSlotRef}>
            <div className="photo-detail-active-field" ref={activeFieldLayerRef}>
              {step === 'food' ? (
                <div className="field-stack autocomplete-shell">
                  <div className="field">
                    <span className="field-label" id="photo-food-label">
                      Food
                    </span>
                    <div className="search-field">
                      <SingleLineEditable
                        elementRef={foodInputRef}
                        className="field-input field-input-lg"
                        labelledBy="photo-food-label"
                        enterKeyHint="next"
                        inputMode="text"
                        placeholder="Enter food name..."
                        value={foodName}
                        ariaInvalid={Boolean(error)}
                        describedBy={error ? 'photo-food-error' : undefined}
                        disabled={isBusy}
                        onValueChange={(value) => {
                          setFoodName(value);
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
                            continueToWeight();
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

                    {error ? (
                      <p
                        className="error-copy photo-detail-error"
                        id="photo-food-error"
                        role="alert"
                      >
                        {error}
                      </p>
                    ) : null}
                  </div>

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
              ) : (
                <div className="field">
                  <span className="field-label" id="photo-weight-label">
                    Weight
                  </span>
                  <div className="input-suffix-shell">
                    <SingleLineEditable
                      elementRef={weightInputRef}
                      className="field-input number-field field-input-with-suffix"
                      labelledBy="photo-weight-label"
                      enterKeyHint="done"
                      inputMode="decimal"
                      placeholder="0"
                      value={weightGrams}
                      ariaInvalid={Boolean(error)}
                      describedBy={error ? 'photo-weight-error' : undefined}
                      disabled={isBusy}
                      onValueChange={(value) => {
                        setWeightGrams(value);
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

                  {error ? (
                    <p
                      className="error-copy photo-detail-error"
                      id="photo-weight-error"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

        </div>
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
  photoSizeReduction,
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
        key={selectedPhoto.id}
        foods={foods}
        photo={selectedPhoto}
        isBusy={isBusy}
        photoSizeReduction={photoSizeReduction}
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
