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
  // 统一 Cookie：ui_mode=legacy，后端读此值决定路由
  document.cookie = 'ui_mode=legacy; path=/; max-age=31536000; SameSite=Lax';
  // Dev 环境 Vite 跑在 5173，后端在 8080，需要明确跳到后端地址
  const port = window.location.port;
  const isDev = port === '5173' || port === '5174';
  const backendOrigin = isDev
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : window.location.origin;
  window.location.href = `${backendOrigin}/`;
}
