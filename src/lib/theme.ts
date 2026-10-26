/**
 * Light and dark themes. The server always renders light (the default); an
 * inline script in the root layout applies a saved choice to <html
 * data-theme> before first paint, and globals.css redefines the colour tokens
 * under [data-theme="dark"]. "system" follows the operating system and is only
 * used when the visitor picks it.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'lgu-tracker:theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Runs in <head> before the body is parsed; must stay dependency-free ES5. */
export const themeInitScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=p==="dark"||(p==="system"&&window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(saved) ? saved : 'light';
  } catch {
    return 'light';
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/** Applies and remembers a choice. Storage failures (private mode) only lose persistence. */
export function setThemePreference(preference: ThemePreference): void {
  document.documentElement.setAttribute('data-theme', resolveTheme(preference));
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Keep the theme for this page view.
  }
  window.dispatchEvent(new CustomEvent('lgu-theme-change', { detail: preference }));
}

/** Follows the operating system while the preference is "system". Returns a cleanup. */
export function watchSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
