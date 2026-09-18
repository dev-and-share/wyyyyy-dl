export type ThemeMode = 'dark' | 'light' | 'auto';

let mediaListenerBound = false;

function onSystemThemeChange() {
  if (typeof document === 'undefined') return;
  if (getInitialTheme() === 'auto') {
    // 重新应用自动主题，跟随系统最新状态
    applyTheme('auto');
  }
}

export function _resetThemeListenerForTest() {
  mediaListenerBound = false;
}

export function ensureSystemThemeListener() {
  if (mediaListenerBound || typeof window === 'undefined' || !window.matchMedia) return;
  try {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onSystemThemeChange);
    } else if (typeof (media as any).addListener === 'function') {
      (media as any).addListener(onSystemThemeChange);
    }
    mediaListenerBound = true;
  } catch {}
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  let eff = mode;

  if (mode === 'auto') {
    ensureSystemThemeListener();
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


