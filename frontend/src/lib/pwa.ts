/**
 * 📱 PWA Service Worker 生命周期与播放安全感知更新管理器
 * 核心法则：正在播放音频时绝对不更新新版本，杜绝打断播放状态与缓存丢失
 */

import { isPwaStandalone, PwaLifecycleManager } from 'pwa-audio-player';

export { isPwaStandalone, PwaLifecycleManager };

export interface PwaLifecycleOptions {
  swUrl?: string;
  updateViaCache?: 'imports' | 'all' | 'none' | any;
  bypassDevPort?: string | number | (string | number)[];
  autoReloadOnControllerChange?: boolean;
  onUpdateFound?: () => void;
  onUpdateWaiting?: (reg: ServiceWorkerRegistration) => void;
  isAudioPlaying?: () => boolean;
}

let pendingWorker: ServiceWorker | null = null;
let pendingRegistration: ServiceWorkerRegistration | null = null;
let activeOptions: PwaLifecycleOptions = {};

/**
 * 检查当前页面是否有任何原生 <audio> 处于发声播放态
 */
export function isAudioCurrentlyPlaying(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const audios = document.querySelectorAll('audio');
    for (const a of audios) {
      if (!a.paused && !a.ended && a.currentTime > 0) return true;
    }
  } catch {}
  return false;
}

/**
 * 是否正在播放中（综合 options.isAudioPlaying 与原生 DOM 音频）
 */
function isPlayingNow(opts: PwaLifecycleOptions = activeOptions): boolean {
  return Boolean(opts.isAudioPlaying?.() || isAudioCurrentlyPlaying());
}

/**
 * 向 Service Worker 实时同步播放状态，通知 Worker 内核协同防守
 */
export function notifyPlaybackStateToSw(isPlaying: boolean): void {
  if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'AUDIO_PLAYBACK_STATE',
        isPlaying
      });
    } catch {}
  }
}

/**
 * 是否有暂存等待激活的 Service Worker 新版本
 */
export function hasPendingPwaUpdate(): boolean {
  return pendingWorker !== null;
}

/**
 * 音频停止后安全激活此前暂存的 Service Worker 新版本
 */
export function applyPendingPwaUpdate(): boolean {
  if (isPlayingNow()) {
    console.log('[PWA] 🛡️ 尝试激活新版本，但当前检测到音频正在播放中，安全抑制');
    return false;
  }
  if (pendingWorker) {
    console.log('[PWA] 🚀 音频已静止，安全向新版本 Service Worker 派发 SKIP_WAITING');
    pendingWorker.postMessage({ type: 'SKIP_WAITING' });
    pendingWorker = null;
    return true;
  }
  return false;
}

/**
 * 尝试激活新版本 Worker：若正在播放则严格阻断并暂存
 */
function tryActivateWorker(worker: ServiceWorker, opts: PwaLifecycleOptions): boolean {
  if (isPlayingNow(opts)) {
    console.log('[PWA] 🛡️ 检测到新版本已就绪，但当前正在播放音频，绝对不更新，暂存至播放停止后激活');
    pendingWorker = worker;
    return false;
  }
  console.log('[PWA] 🚀 音频未播放，立即安全激活新版本');
  worker.postMessage({ type: 'SKIP_WAITING' });
  pendingWorker = null;
  return true;
}

/**
 * 注册具备播放态感知的 Service Worker
 */
export function registerServiceWorker(
  onUpdateFound?: () => void,
  options?: PwaLifecycleOptions
): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const opts: PwaLifecycleOptions = {
    swUrl: '/sw.js',
    updateViaCache: 'none',
    autoReloadOnControllerChange: false,
    ...options
  };
  activeOptions = opts;

  if (opts.autoReloadOnControllerChange) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  const initRegistration = () => {
    navigator.serviceWorker
      .register(opts.swUrl || '/sw.js', { updateViaCache: opts.updateViaCache })
      .then((reg) => {
        pendingRegistration = reg;
        if (reg.waiting) {
          tryActivateWorker(reg.waiting, opts);
          onUpdateFound?.();
          opts.onUpdateWaiting?.(reg);
        }
        reg.onupdatefound = () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.onstatechange = () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              tryActivateWorker(installing, opts);
              onUpdateFound?.();
              opts.onUpdateWaiting?.(reg);
            }
          };
        };

        // 📱 熄屏或切到前台唤醒时检查更新（仅在非播放状态下触发）
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              if (isPlayingNow(opts)) {
                console.log('[PWA] 🛡️ 前台恢复时正在播放音频，安全跳过 Service Worker 检查更新');
                return;
              }
              reg.update().catch(() => {});
            }
          });
        }
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker 注册失败:', err);
      });
  };

  if (document.readyState === 'complete') {
    initRegistration();
  } else {
    window.addEventListener('load', initRegistration, { once: true });
  }
}

/**
 * 手动检查 PWA 更新（下拉刷新或按钮触发），播放中绝对不更新
 */
export async function checkForPwaUpdate(options?: {
  isAudioPlaying?: () => boolean;
  force?: boolean;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;

  const isPlaying = options?.isAudioPlaying?.() ?? isPlayingNow();
  if (isPlaying && !options?.force) {
    console.log('[PWA] 🛡️ 正在播放音频，checkForPwaUpdate 安全拦截，绝不更新');
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const currentWaiting = reg.waiting;
    if (currentWaiting) {
      currentWaiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    }
    await reg.update();
    const newWaiting = (reg as any).waiting as ServiceWorker | null;
    if (newWaiting) {
      newWaiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    }
    return false;
  } catch (e) {
    console.warn('[PWA] Failed to check for update:', e);
    return false;
  }
}

// 🎧 全局 DOM 捕获阶段监听所有原生 <audio> 播放事件，实时通知 Worker 并串联待激活队列
if (typeof window !== 'undefined') {
  window.addEventListener(
    'play',
    (e) => {
      if (e.target instanceof HTMLAudioElement) {
        notifyPlaybackStateToSw(true);
      }
    },
    true
  );
  window.addEventListener(
    'pause',
    (e) => {
      if (e.target instanceof HTMLAudioElement) {
        setTimeout(() => {
          const playing = isPlayingNow();
          notifyPlaybackStateToSw(playing);
          if (!playing) {
            applyPendingPwaUpdate();
          }
        }, 150);
      }
    },
    true
  );
  window.addEventListener(
    'ended',
    (e) => {
      if (e.target instanceof HTMLAudioElement) {
        setTimeout(() => {
          const playing = isPlayingNow();
          notifyPlaybackStateToSw(playing);
          if (!playing) {
            applyPendingPwaUpdate();
          }
        }, 150);
      }
    },
    true
  );
}
