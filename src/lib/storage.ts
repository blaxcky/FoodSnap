import type { PersistedAppState } from './types';

const STORAGE_KEY = 'foodsnap:v1';

export const defaultAppState: PersistedAppState = {
  version: 1,
  foods: [],
  currentSession: [],
  exportFormat: 'simple',
  exportLeadIn: ''
};

export function loadAppState(): PersistedAppState {
  if (typeof window === 'undefined') {
    return defaultAppState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultAppState;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;

    return {
      version: 1,
      foods: Array.isArray(parsed.foods) ? parsed.foods : [],
      currentSession: Array.isArray(parsed.currentSession) ? parsed.currentSession : [],
      exportFormat: parsed.exportFormat === 'raw' ? 'raw' : 'simple',
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
