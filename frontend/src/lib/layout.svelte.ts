/**
 * 布局状态管理 (Layout State)
 * 纯粹响应式：宽屏 (>= 1024px) 桌面侧边栏模式，窄屏 (< 1024px) 移动端优化模式
 * 🪟 原生级 Window Controls Overlay (WCO) 与 PWA 独立沉浸窗口适配
 */

function checkIsDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 1024;
}

export const layoutState = $state<{
  isDesktop: boolean;
  isStandalone: boolean;
  wco: {
    visible: boolean;
    height: number;
    left: number;
    right: number;
  };
}>({
  isDesktop: checkIsDesktop(),
  isStandalone: false,
  wco: {
    visible: false,
    height: 0,
    left: 0,
    right: 0
  }
});

export function syncWcoCssVariables(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as any)?.standalone === true;

  layoutState.isStandalone = isStandalone;

  const wco = (navigator as any)?.windowControlsOverlay;
  const isWcoMatchMedia = window.matchMedia('(display-mode: window-controls-overlay)').matches;
  const isWcoOverlayMode = (wco?.visible === true) || isWcoMatchMedia;
  layoutState.wco.visible = isWcoOverlayMode;

  const isMac = /Macintosh|Mac OS X/i.test(navigator.userAgent) || (navigator.platform && navigator.platform.includes('Mac'));

  if (isWcoOverlayMode && typeof wco?.getTitlebarAreaRect === 'function') {
    const rect = wco.getTitlebarAreaRect();
    const height = Math.round(rect.height);
    const left = Math.round(rect.x);
    const right = Math.max(0, Math.round(window.innerWidth - (rect.x + rect.width)));

    layoutState.wco.height = height;
    layoutState.wco.left = left;
    layoutState.wco.right = right;

    document.documentElement.style.setProperty('--wco-height', `${height}px`);
    document.documentElement.style.setProperty('--wco-left', `${left}px`);
    document.documentElement.style.setProperty('--wco-right', `${right}px`);
  } else if (isWcoOverlayMode) {
    // 处于 window-controls-overlay 沉浸模式但缺少 getTitlebarAreaRect 时的兜底保护
    const height = 38;
    const left = isMac ? 80 : 0;
    const right = isMac ? 112 : 138;

    layoutState.wco.height = height;
    layoutState.wco.left = left;
    layoutState.wco.right = right;

    document.documentElement.style.setProperty('--wco-height', `${height}px`);
    document.documentElement.style.setProperty('--wco-left', `${left}px`);
    document.documentElement.style.setProperty('--wco-right', `${right}px`);
  } else {
    // 普通浏览器标签页访问，或未收起系统标题栏的普通 standalone PWA（系统自带完整独立标题栏），零多余占位与边距
    layoutState.wco.height = 0;
    layoutState.wco.left = 0;
    layoutState.wco.right = 0;

    document.documentElement.style.setProperty('--wco-height', '0px');
    document.documentElement.style.setProperty('--wco-left', '0px');
    document.documentElement.style.setProperty('--wco-right', '0px');
  }
}

export function initLayoutWatcher(): () => void {
  if (typeof window === 'undefined') return () => {};

  syncWcoCssVariables();

  const handleResize = () => {
    layoutState.isDesktop = window.innerWidth >= 1024;
    syncWcoCssVariables();
  };

  window.addEventListener('resize', handleResize);

  const wco = (navigator as any)?.windowControlsOverlay;
  if (wco && typeof wco.addEventListener === 'function') {
    wco.addEventListener('geometrychange', syncWcoCssVariables);
  }

  const wcoMediaQuery = window.matchMedia('(display-mode: window-controls-overlay)');
  if (wcoMediaQuery && typeof wcoMediaQuery.addEventListener === 'function') {
    wcoMediaQuery.addEventListener('change', syncWcoCssVariables);
  }

  return () => {
    window.removeEventListener('resize', handleResize);
    if (wco && typeof wco.removeEventListener === 'function') {
      wco.removeEventListener('geometrychange', syncWcoCssVariables);
    }
    if (wcoMediaQuery && typeof wcoMediaQuery.removeEventListener === 'function') {
      wcoMediaQuery.removeEventListener('change', syncWcoCssVariables);
    }
  };
}
