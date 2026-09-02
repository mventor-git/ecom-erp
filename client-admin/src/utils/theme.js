/**
 * Theme utility (mventor-ticket-047) — dark mode for the Admin Panel.
 * Persists the choice in localStorage and toggles the `dark` class on <html>.
 * Tailwind is configured with darkMode: 'class'; index.css adds global dark
 * overrides so every page (even ones without explicit dark: classes) reskins.
 */

const STORAGE_KEY = 'cs-admin-theme';

export function getTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* storage unavailable */ }
  // Default: follow the operating system preference
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(theme) {
  const el = document.documentElement;
  if (theme === 'dark') {
    el.classList.add('dark');
    el.style.colorScheme = 'dark';
  } else {
    el.classList.remove('dark');
    el.style.colorScheme = 'light';
  }
}

export function setTheme(theme) {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  applyTheme(theme);
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** Call once at app startup so there is no light-mode flash. */
export function initTheme() {
  applyTheme(getTheme());
}
