export type CameraPreference = 'system' | 'direct';

const CAMERA_PREFERENCE_KEY = 'foodsnap:camera-preference';

export function loadCameraPreference(): CameraPreference {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const stored = window.localStorage.getItem(CAMERA_PREFERENCE_KEY);
  return stored === 'direct' ? 'direct' : 'system';
}

export function saveCameraPreference(preference: CameraPreference) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CAMERA_PREFERENCE_KEY, preference);
}
