import type { PersistedAppState, PhotoItem, SessionEntry } from './types';

const STORAGE_KEY = 'foodsnap:v1';

export const defaultAppState: PersistedAppState = {
  version: 2,
  foods: [],
  currentSession: [],
  photoItems: [],
  exportLeadIn: ''
};

function isSessionEntry(value: unknown): value is SessionEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Record<string, unknown>;

  return (
    typeof entry.id === 'string' &&
    typeof entry.foodId === 'string' &&
    typeof entry.foodName === 'string' &&
    (entry.sourcePhotoId == null || typeof entry.sourcePhotoId === 'string') &&
    (entry.mode === 'direct' || entry.mode === 'difference') &&
    typeof entry.amount === 'number' &&
    (entry.unit === 'g' || entry.unit === 'pcs') &&
    typeof entry.note === 'string' &&
    typeof entry.createdAt === 'string' &&
    typeof entry.updatedAt === 'string'
  );
}

function isPhotoItem(value: unknown): value is PhotoItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const photo = value as Record<string, unknown>;

  return (
    typeof photo.id === 'string' &&
    (photo.status === 'pending' || photo.status === 'archived') &&
    typeof photo.createdAt === 'string' &&
    typeof photo.updatedAt === 'string' &&
    (photo.completedAt == null || typeof photo.completedAt === 'string') &&
    (photo.foodName == null || typeof photo.foodName === 'string') &&
    (photo.weightGrams == null || typeof photo.weightGrams === 'number') &&
    (photo.linkedEntryId == null || typeof photo.linkedEntryId === 'string')
  );
}

export function loadAppState(): PersistedAppState {
  if (typeof window === 'undefined') {
    return defaultAppState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultAppState;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedAppState> & {
      version?: number;
      photoItems?: unknown;
      currentSession?: unknown;
    };

    return {
      version: 2,
      foods: Array.isArray(parsed.foods) ? parsed.foods : [],
      currentSession: Array.isArray(parsed.currentSession)
        ? parsed.currentSession.filter(isSessionEntry)
        : [],
      photoItems: Array.isArray(parsed.photoItems) ? parsed.photoItems.filter(isPhotoItem) : [],
      exportLeadIn: typeof parsed.exportLeadIn === 'string' ? parsed.exportLeadIn : ''
    };
  } catch {
    return defaultAppState;
  }
}

export function saveAppState(state: PersistedAppState) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
