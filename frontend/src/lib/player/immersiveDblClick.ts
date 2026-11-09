import { playerStore } from './playerStore.svelte';
import { showToast } from '../toast.svelte';
import { t } from '../i18n/index.svelte';

let lastToggleTime = 0;

/**
 * 仅用于单元测试重置防抖时间戳
 */
export function _resetToggleTimeForTesting() {
  lastToggleTime = 0;
}

/**
 * 🎯 判定点击/触控目标是否落在具体的可交互元素上
 * 确保仅在纯净“空白区域”（背景、空白留白区、无事件舞台边缘等）双击才响应切换
 */
export function isInteractiveTarget(target: HTMLElement | null): boolean {
  if (!target) return false;

  // 1. 标准交互控件与表单输入控件
  if (target.closest('button, a, input, textarea, select, [contenteditable="true"]')) {
    return true;
  }

  // 2. 具备 ARIA 交互角色或通用交互类标记
  if (target.closest('[role="button"], [role="link"], [role="slider"], [role="progressbar"], [role="menuitem"], [role="tab"], [role="switch"], [role="checkbox"], .interactive-el')) {
    return true;
  }

  // 3. 歌曲列表条目（双击可能为行选操作，隔离避免误切）
  if (target.closest('.track-row, [data-track-row], [data-testid="track-row"], [data-track-id]')) {
    return true;
  }

  // 4. 浮层/抽屉/对话框内容区（如设置、队列抽屉、PEQ 等，避免在这些工具面板内双击误触）
  if (target.closest('[role="dialog"], [data-testid="playlist-drawer"], [data-testid="settings-drawer"], [data-testid="peq-drawer"], [data-testid="sheet-drawer"]')) {
    return true;
  }

  // 5. 沉浸大屏内部的具体控制条、迷你控制台及单行歌词
  if (target.closest('[data-testid="immersive-mini-player-container"], [data-testid="immersive-bottom-controls"], [data-testid="immersive-bottom-progress-trigger"], [id^="sv-lrc-"]')) {
    return true;
  }

  return false;
}

/**
 * 🌌 切换沉浸模式（全屏黑胶大屏）：
 * - 防抖保护：350ms 内只响应一次，彻底杜绝触屏 touch + 合成 dblclick 双重触发导致的进出振荡
 * - 若未在沉浸大屏：打开大屏（若有歌曲则打开，若无正在播放但队列有歌则自动就绪）
 * - 若已在沉浸大屏：退出大屏
 */
export function triggerToggleImmersive(): boolean {
  const now = Date.now();
  if (now - lastToggleTime < 350) return false;
  lastToggleTime = now;

  if (typeof window === 'undefined') return false;

  // 若当前无激活曲目，但队列有歌曲，自动选定第 0 首
  if (!playerStore.activeTrack && playerStore.queue.length > 0) {
    playerStore.qIndex = 0;
  }

  if (playerStore.activeTrack) {
    window.dispatchEvent(new CustomEvent('wyy:toggle-lyric-modal'));
    return true;
  }

  showToast(t('player.noTrackPlaying') || '暂无播放歌曲', 'info');
  return false;
}

/**
 * 🖱️ 注册全局双击空白切换沉浸模式监听器
 * 同时兼容桌面端 dblclick 事件与移动端 touch 快速双击手势
 */
export function setupImmersiveDblClick(targetWin: Window = window): () => void {
  if (typeof targetWin === 'undefined') return () => {};

  // 1. 桌面端鼠标 / 触控板双击
  const onDblClick = (e: MouseEvent) => {
    const el = e.target as HTMLElement | null;
    if (isInteractiveTarget(el)) return;

    e.preventDefault();
    try {
      if (targetWin.getSelection) {
        targetWin.getSelection()?.removeAllRanges();
      }
    } catch {}

    triggerToggleImmersive();
  };

  // 2. 移动端触屏快速双击手势检测
  let lastTouchTime = 0;
  let lastTouchX = 0;
  let lastTouchY = 0;

  const onTouchEnd = (e: TouchEvent) => {
    if (e.changedTouches.length !== 1) return;
    const touch = e.changedTouches[0];
    const now = Date.now();
    const timeDiff = now - lastTouchTime;
    const dx = Math.abs(touch.clientX - lastTouchX);
    const dy = Math.abs(touch.clientY - lastTouchY);

    if (timeDiff > 40 && timeDiff < 320 && dx < 24 && dy < 24) {
      const el = e.target as HTMLElement | null;
      if (!isInteractiveTarget(el)) {
        e.preventDefault();
        try {
          if (targetWin.getSelection) {
            targetWin.getSelection()?.removeAllRanges();
          }
        } catch {}
        triggerToggleImmersive();
        lastTouchTime = 0;
        return;
      }
    }

    lastTouchTime = now;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
  };

  targetWin.addEventListener('dblclick', onDblClick);
  targetWin.addEventListener('touchend', onTouchEnd, { passive: false });

  return () => {
    targetWin.removeEventListener('dblclick', onDblClick);
    targetWin.removeEventListener('touchend', onTouchEnd);
  };
}
