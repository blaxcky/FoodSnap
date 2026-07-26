export const DEFAULT_PHOTO_SIZE_REDUCTION = 25;
export const MIN_PHOTO_SIZE_REDUCTION = 0;
export const MAX_PHOTO_SIZE_REDUCTION = 50;
export const PHOTO_SIZE_REDUCTION_STEP = 5;

const PHOTO_SIZE_REDUCTION_KEY = 'foodsnap:photo-size-reduction';

export function isValidPhotoSizeReduction(value: number) {
  return (
    Number.isInteger(value) &&
    value >= MIN_PHOTO_SIZE_REDUCTION &&
    value <= MAX_PHOTO_SIZE_REDUCTION &&
    value % PHOTO_SIZE_REDUCTION_STEP === 0
  );
}

export function loadPhotoSizeReduction() {
  if (typeof window === 'undefined') {
    return DEFAULT_PHOTO_SIZE_REDUCTION;
  }

  const stored = window.localStorage.getItem(PHOTO_SIZE_REDUCTION_KEY);

  if (stored === null || stored.trim() === '') {
    return DEFAULT_PHOTO_SIZE_REDUCTION;
  }

  const parsed = Number(stored);
  return isValidPhotoSizeReduction(parsed) ? parsed : DEFAULT_PHOTO_SIZE_REDUCTION;
}

export function savePhotoSizeReduction(value: number) {
  if (typeof window === 'undefined') {
    return;
  }

  const validValue = isValidPhotoSizeReduction(value)
    ? value
    : DEFAULT_PHOTO_SIZE_REDUCTION;
  window.localStorage.setItem(PHOTO_SIZE_REDUCTION_KEY, String(validValue));
}

export function getPhotoDetailMediaHeight(reduction: number) {
  const validReduction = isValidPhotoSizeReduction(reduction)
    ? reduction
    : DEFAULT_PHOTO_SIZE_REDUCTION;
  const scale = (100 - validReduction) / 100;
  const scaled = (value: number) => Number((value * scale).toFixed(2));

  return `clamp(${scaled(260)}px, ${scaled(48)}dvh, ${scaled(520)}px)`;
}
