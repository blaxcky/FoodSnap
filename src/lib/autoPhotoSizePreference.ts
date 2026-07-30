const AUTO_PHOTO_SIZE_KEY = 'foodsnap:auto-photo-size';

export function loadAutoPhotoSize() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(AUTO_PHOTO_SIZE_KEY) === 'true';
}

export function saveAutoPhotoSize(value: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUTO_PHOTO_SIZE_KEY, String(value));
}
