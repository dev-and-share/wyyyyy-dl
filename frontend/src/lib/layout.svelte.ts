/**
 * 布局状态管理 (Layout State)
 * 纯粹响应式：宽屏 (>= 1024px) 桌面侧边栏模式，窄屏 (< 1024px) 移动端优化模式
 * 🪟 原生级 Window Controls Overlay (WCO) 与 PWA 独立沉浸窗口适配
 */

import { getWcoGeometry, syncWcoGeometryCssVars } from 'pwa-audio-player';

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

  // 委托 pwa-audio-player 统一计算 WCO 矩形区域与 CSS 安全区变量
  const geometry = getWcoGeometry();
  layoutState.wco.visible = geometry.visible;
  layoutState.wco.height = geometry.height;
  layoutState.wco.left = geometry.left;
  layoutState.wco.right = geometry.right;
  syncWcoGeometryCssVars(geometry);
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
