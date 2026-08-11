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
  autoPhotoSize: boolean;
  folderActivity: 'loading' | 'scanning' | null;
  folderNeedsPermission: boolean;
  onChangeFilter: (filter: 'pending' | 'archived') => void;
  onOpenCamera: () => void;
  onOpenGallery: () => void;
  onAllowPhotoFolder: () => void;
  onSelectPhoto: (photoId: string) => void;
  onCloseDetail: () => void;
  onDeletePendingPhoto: (photoId: string) => Promise<boolean>;
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
  onDelete?: () => Promise<boolean>;
}) {
  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const swipeLabelRef = useRef<HTMLSpanElement>(null);
  const gestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    threshold: number;
    direction: 'undecided' | 'horizontal' | 'vertical';
  } | null>(null);
  const deleteInProgressRef = useRef(false);
  const suppressClickUntilRef = useRef(0);

  function setCardPosition(offset: number, opacity = 1) {
    const card = cardRef.current;

    if (!card) {
      return;
    }

    card.style.transform = `translate3d(${offset}px, 0, 0)`;
    card.style.opacity = String(opacity);
  }

  function setSwipeProgress(offset: number, threshold: number) {
    const container = swipeContainerRef.current;

    if (!container) {
      return;
    }

    const progress = Math.min(offset / threshold, 1);
    container.style.setProperty('--swipe-delete-progress', String(progress));
    container.classList.toggle('is-delete-ready', offset >= threshold);

    if (swipeLabelRef.current) {
      swipeLabelRef.current.textContent =
        offset >= threshold ? 'Release to delete' : 'Swipe to delete';
    }
  }

  function resetCard() {
    const container = swipeContainerRef.current;

    container?.classList.add('is-settling');
    container?.classList.remove('is-swiping', 'is-delete-ready', 'is-deleting');
    setCardPosition(0);
    setSwipeProgress(0, 1);
  }

  async function deleteCard() {
    if (!onDelete || deleteInProgressRef.current) {
      return;
    }

    deleteInProgressRef.current = true;
    const container = swipeContainerRef.current;
    const card = cardRef.current;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const exitDistance = (container?.getBoundingClientRect().width ?? 320) + 64;

    container?.classList.add('is-settling', 'is-deleting');
    setCardPosition(exitDistance, 0);

    await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 0 : 240));
    const deleted = await onDelete();

    if (!deleted && card) {
      container?.classList.remove('is-deleting');
      setCardPosition(0, 1);
      setSwipeProgress(0, 1);
      deleteInProgressRef.current = false;
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!onDelete || deleteInProgressRef.current || !event.isPrimary || event.button !== 0) {
      return;
    }

    const width = swipeContainerRef.current?.getBoundingClientRect().width ?? 0;
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      threshold: Math.min(112, width * 0.32),
      direction: 'undecided'
    };
    swipeContainerRef.current?.classList.remove('is-settling');
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (gesture.direction === 'undecided') {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 8) {
        return;
      }

      gesture.direction = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }

    if (gesture.direction !== 'horizontal') {
      return;
    }

    swipeContainerRef.current?.classList.add('is-swiping');
    suppressClickUntilRef.current = Date.now() + 500;
    const positiveOffset = Math.max(0, deltaX);
    const displayedOffset =
      positiveOffset > gesture.threshold
        ? gesture.threshold + (positiveOffset - gesture.threshold) * 0.35
        : positiveOffset;

    if (positiveOffset > 0) {
      event.preventDefault();
    }

    setCardPosition(displayedOffset);
    setSwipeProgress(displayedOffset, gesture.threshold);
  }

  function finishPointerGesture(event: ReactPointerEvent<HTMLElement>, cancelled = false) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const deltaX = event.clientX - gesture.startX;
    if (!cancelled && gesture.direction === 'horizontal' && deltaX >= gesture.threshold) {
      void deleteCard();
      return;
    }

    resetCard();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if ((event.key === 'Enter' || event.key === ' ') && !deleteInProgressRef.current) {
      event.preventDefault();
      onOpen();
    } else if (event.key === 'Delete' && onDelete) {
      event.preventDefault();
      void deleteCard();
    }
  }

  const timestamp = formatPhotoTimestamp(photo.completedAt ?? photo.createdAt);
  const cardLabel =
    photo.status === 'pending'
      ? `Open food photo from ${timestamp}`
      : `Open ${photo.foodName?.trim() || 'archived food'} photo from ${timestamp}`;

  return (
    <div
      className={`photo-card-swipe photo-card-swipe-${photo.status}`}
      ref={swipeContainerRef}
    >
      {onDelete ? (
        <div className="photo-delete-reveal" aria-hidden="true">
          <TrashIcon className="ui-icon" />
          <span ref={swipeLabelRef}>Swipe to delete</span>
        </div>
      ) : null}
      <article
        className={`photo-card photo-card-${photo.status}`}
        ref={cardRef}
        role="button"
        tabIndex={0}
        aria-label={cardLabel}
        onClick={(event) => {
          if (Date.now() < suppressClickUntilRef.current || deleteInProgressRef.current) {
            event.preventDefault();
            return;
          }
          onOpen();
        }}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishPointerGesture(event)}
        onPointerCancel={(event) => finishPointerGesture(event, true)}
        onDragStart={(event) => event.preventDefault()}
      >
        <StoredPhoto
          photoId={photo.id}
          alt={photo.foodName ? `${photo.foodName} photo` : 'Food photo'}
          className="photo-thumb"
        />
        {photo.status === 'pending' ? (
          <time className="photo-timestamp" dateTime={photo.createdAt}>
            {timestamp}
          </time>
        ) : (
          <div className="photo-card-copy">
            <div className="photo-card-meta-row">
              <span className="status-badge photo-status-badge photo-status-archived">
                Archived
              </span>
              <time className="photo-timestamp" dateTime={photo.completedAt ?? photo.createdAt}>
                {timestamp}
              </time>
            </div>
            <h3>{photo.foodName?.trim() || 'Archived photo'}</h3>
            <p>
              {photo.weightGrams != null
                ? `${formatNumber(photo.weightGrams)}g saved`
                : 'Archived without linked log entry'}
            </p>
          </div>
        )}
      </article>
    </div>
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
  autoPhotoSize,
  onBack,
  onSave
}: {
  foods: FoodProfile[];
  photo: PhotoItem;
  isBusy: boolean;
  photoSizeReduction: number;
  autoPhotoSize: boolean;
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
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
  const previousTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
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

  useEffect(
    () => () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    },
    []
  );

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
    const previousKeyboardInsetBottom = scrollContainer.style.getPropertyValue(
      '--photo-detail-keyboard-inset-bottom'
    );
    const previousFieldHeight = scrollContainer.style.getPropertyValue(
      '--photo-detail-field-height'
    );
    const previousFieldLeft = scrollContainer.style.getPropertyValue('--photo-detail-field-left');
    const previousFieldWidth = scrollContainer.style.getPropertyValue(
      '--photo-detail-field-width'
    );
    const hadKeyboardClass = scrollContainer.classList.contains('photo-detail-keyboard-open');
    const hadKeyboardVisibleClass = scrollContainer.classList.contains(
      'photo-detail-keyboard-visible'
    );
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
          '--photo-detail-keyboard-inset-bottom',
          `${Math.max(0, window.innerHeight - viewportOffsetTop - viewportHeight)}px`
        );
        updateFieldMetrics();
        scrollContainer.classList.toggle('photo-detail-keyboard-visible', keyboardOpen);
        scrollContainer.classList.toggle('photo-detail-keyboard-open', keyboardOpen && !autoPhotoSize);
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
      if (previousKeyboardInsetBottom) {
        scrollContainer.style.setProperty(
          '--photo-detail-keyboard-inset-bottom',
          previousKeyboardInsetBottom
        );
      } else {
        scrollContainer.style.removeProperty('--photo-detail-keyboard-inset-bottom');
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
      scrollContainer.classList.toggle(
        'photo-detail-keyboard-visible',
        hadKeyboardVisibleClass
      );
    };
  }, [autoPhotoSize]);

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
    if (
      closeTimeoutRef.current != null ||
      !event.isPrimary ||
      (event.pointerType === 'mouse' && event.button !== 0)
    ) {
      gestureStartRef.current = null;
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    gestureStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false
    };
  }

  function handleGestureMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureStartRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;

    if (!gesture.moved && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) {
      gesture.moved = true;
      previousTapRef.current = null;
    }
  }

  function handleGestureEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const start = gestureStartRef.current;
    gestureStartRef.current = null;

    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    start.lastX = event.clientX;
    start.lastY = event.clientY;
    const endX = start.lastX;
    const endY = start.lastY;
    const horizontalDistance = endX - start.x;
    const verticalDistance = endY - start.y;
    const absoluteHorizontalDistance = Math.abs(horizontalDistance);
    const absoluteVerticalDistance = Math.abs(verticalDistance);

    if (absoluteHorizontalDistance >= 50 && absoluteHorizontalDistance > absoluteVerticalDistance) {
      previousTapRef.current = null;

      if (horizontalDistance > 0 && step === 'weight' && !isBusy) {
        setError('');
        setStep('food');
      }

      return;
    }

    if (start.moved || Math.hypot(horizontalDistance, verticalDistance) > 10) {
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
      closeTimeoutRef.current = window.setTimeout(() => {
        closeTimeoutRef.current = null;
        onBack();
      }, 120);
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
    <section
      ref={detailScreenRef}
      className={`photo-detail-screen${autoPhotoSize ? ' photo-detail-auto-fit' : ''}`}
    >
      <div className="photo-detail-card">
        <div
          className="photo-detail-media"
          style={autoPhotoSize ? undefined : { height: getPhotoDetailMediaHeight(photoSizeReduction) }}
          onPointerDown={handleGestureStart}
          onPointerMove={handleGestureMove}
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
  autoPhotoSize,
  folderActivity,
  folderNeedsPermission,
  onChangeFilter,
  onOpenCamera,
  onOpenGallery,
  onAllowPhotoFolder,
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
        autoPhotoSize={autoPhotoSize}
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

      {folderActivity ? (
        <aside
          className="photo-folder-activity"
          role="status"
          aria-live="polite"
          aria-label={
            folderActivity === 'loading' ? 'Checking saved photo folder' : 'Importing photo folder'
          }
        >
          <div className="photo-folder-activity-preview" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="photo-folder-activity-copy">
            <strong>
              {folderActivity === 'loading'
                ? 'Checking saved photo folder'
                : 'Checking for new photos'}
            </strong>
            <span>
              {folderActivity === 'loading'
                ? 'Preparing the folder scan…'
                : 'New photos will appear here as they are imported.'}
            </span>
          </div>
          <div className="photo-folder-activity-track" aria-hidden="true" />
        </aside>
      ) : null}

      {folderNeedsPermission ? (
        <aside className="photo-folder-notice" aria-label="Photo folder access needed">
          <p>Your photo folder needs access before FoodSnap can check for new photos.</p>
          <button
            className="ghost-button photo-folder-notice-button"
            type="button"
            onClick={onAllowPhotoFolder}
          >
            Allow folder access
          </button>
        </aside>
      ) : null}

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
