export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'foodsnap:theme';

const META_COLORS: Record<'light' | 'dark', string> = {
  dark: '#0c0c0f',
  light: '#ffffff'
};

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  return preference === 'system' ? getSystemTheme() : preference;
}

export function loadThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }

  return 'system';
}

export function saveThemePreference(preference: ThemePreference) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(THEME_KEY, preference);
}

export function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference);
  document.documentElement.setAttribute('data-theme', resolved);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', META_COLORS[resolved]);
  }
}

export function listenForSystemThemeChange(
  preference: ThemePreference,
  callback: () => void
): (() => void) | undefined {
  if (preference !== 'system' || typeof window === 'undefined') {
    return undefined;
  }

  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => callback();
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}
