export type ThemeMode = 'dark' | 'light' | 'auto';

export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  let eff = mode;
  if (mode === 'auto') {
    eff = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (eff === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
  try {
    localStorage.setItem('theme_mode', mode);
  } catch {}
}

export function getInitialTheme(): ThemeMode {
  if (typeof localStorage !== 'undefined') {
    const s = localStorage.getItem('theme_mode');
    if (s === 'light' || s === 'dark' || s === 'auto') return s;
  }
  return 'dark';
}

export function switchToLegacy() {
  document.cookie = 'ui_version=legacy; path=/; max-age=31536000';
  localStorage.setItem('wyyyy_ui_version', 'legacy');
  window.location.href = '/?v=legacy';
}
