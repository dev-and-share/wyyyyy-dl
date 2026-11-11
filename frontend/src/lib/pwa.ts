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
  onUpdateFound?: (version?: string) => void;
  onUpdateWaiting?: (reg: ServiceWorkerRegistration, version?: string) => void;
  isAudioPlaying?: () => boolean;
}

let pendingWorker: ServiceWorker | null = null;
let pendingRegistration: ServiceWorkerRegistration | null = null;
let pendingVersion: string | null = null;
let activeOptions: PwaLifecycleOptions = {};

/**
 * 获取当前已探查到的待更新版本号 (e.g. 'v5.5.38')
 */
export function getPendingUpdateVersion(): string | null {
  return pendingVersion;
}

/**
 * 探查目标 Service Worker 的版本号（优先读取 /sw.js 的 CACHE_NAME，离线保底向 Worker 发送 GET_VERSION）
 */
export async function getWorkerVersion(worker?: ServiceWorker | null): Promise<string | null> {
  // 1. 优先读取 /sw.js 的 CACHE_NAME（极速无损、即时获取最新部署版本；加入时间戳避免 CDN/浏览器强缓存）
  if (typeof fetch !== 'undefined') {
    try {
      const res = await fetch(`/sw.js?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        const match = text.match(/CACHE_NAME\s*=\s*['"]wyy-([^'"]+)['"]/);
        if (match && match[1]) {
          const v = match[1];
          return v.startsWith('v') ? v : `v${v}`;
        }
      }
    } catch {}
  }

  // 2. 离线保底方案：向目标 Worker 发送 GET_VERSION 查询
  if (worker && typeof MessageChannel !== 'undefined') {
    try {
      const channel = new MessageChannel();
      const versionPromise = new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 300);
        channel.port1.onmessage = (e) => {
          clearTimeout(timer);
          if (e.data?.version) resolve(e.data.version);
          else resolve(null);
        };
      });
      worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
      const v = await versionPromise;
      if (v) return v.startsWith('v') ? v : `v${v}`;
    } catch {}
  }

  return null;
}

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
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  try {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'AUDIO_PLAYBACK_STATE',
        isPlaying
      });
    }
  } catch {}
  try {
    navigator.serviceWorker.getRegistration?.()?.then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({
          type: 'AUDIO_PLAYBACK_STATE',
          isPlaying
        });
      }
      if (reg?.installing) {
        reg.installing.postMessage({
          type: 'AUDIO_PLAYBACK_STATE',
          isPlaying
        });
      }
    }).catch(() => {});
  } catch {}
}

/**
 * 是否有暂存等待激活的 Service Worker 新版本
 */
export function hasPendingPwaUpdate(): boolean {
  return pendingWorker !== null;
}

/**
 * 手动激活此前暂存的 Service Worker 新版本（仅限用户主动触发或测试调用，严禁自动触发）
 */
export function applyPendingPwaUpdate(options?: { force?: boolean }): boolean {
  if (isPlayingNow() && !options?.force) {
    console.log('[PWA] 🛡️ 尝试激活新版本，但当前检测到音频正在播放中，安全抑制');
    return false;
  }
  if (pendingWorker) {
    console.log('[PWA] 🚀 用户确认更新，向新版本 Service Worker 派发 SKIP_WAITING');
    pendingWorker.postMessage({
      type: 'SKIP_WAITING',
      isPlaying: false,
      force: Boolean(options?.force)
    });
    pendingWorker = null;
    return true;
  }
  return false;
}

/**
 * 仅探查是否存在等待中或服务端已发布的新版本（绝不自动发送 SKIP_WAITING，绝不自动刷新页面）
 */
export async function probeForPwaUpdate(options?: {
  isAudioPlaying?: () => boolean;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const currentVersion =
    typeof __APP_VERSION__ !== 'undefined'
      ? String(__APP_VERSION__).startsWith('v')
        ? String(__APP_VERSION__)
        : `v${__APP_VERSION__}`
      : null;

  try {
    // 1. 快速主动向服务端探查最新 /sw.js 的版本号（秒级响应，无需苦等 Worker 安装）
    const serverVer = await getWorkerVersion(null);
    if (serverVer && currentVersion && serverVer !== currentVersion) {
      pendingVersion = serverVer;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('wyy:pwa-update-available', {
            detail: { version: pendingVersion }
          })
        );
      }
      // 触发后台 sw 下载
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration?.().then((reg) => {
          if (reg && typeof reg.update === 'function') {
            const isPlaying = options?.isAudioPlaying?.() ?? isPlayingNow();
            if (!isPlaying) reg.update().catch(() => {});
          }
        }).catch(() => {});
      }
      return true;
    }

    // 2. 检查是否有已就绪或处于 waiting 状态的 Service Worker
    if ('serviceWorker' in navigator) {
      const reg = (await navigator.serviceWorker.getRegistration?.()) || pendingRegistration;
      if (reg) {
        const notifyWaiting = async (worker: ServiceWorker) => {
          pendingWorker = worker;
          const ver = await getWorkerVersion(worker);
          if (ver) pendingVersion = ver;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('wyy:pwa-update-available', {
                detail: { version: pendingVersion || undefined }
              })
            );
          }
        };

        if (reg.waiting) {
          await notifyWaiting(reg.waiting);
          return true;
        }

        const isPlaying = options?.isAudioPlaying?.() ?? isPlayingNow();
        if (!isPlaying && typeof reg.update === 'function') {
          await reg.update().catch(() => {});
          const newWaiting = (reg as any).waiting as ServiceWorker | null;
          if (newWaiting) {
            await notifyWaiting(newWaiting);
            return true;
          }
          if (reg.installing) {
            reg.installing.addEventListener(
              'statechange',
              () => {
                if (reg.installing?.state === 'installed' && (reg as any).waiting) {
                  notifyWaiting((reg as any).waiting);
                }
              },
              { once: true }
            );
          }
        }
      }
    }

    return hasPendingPwaUpdate();
  } catch {
    return hasPendingPwaUpdate();
  }
}

/**
 * 用户在设置菜单顶部手动点击「新版本更新」按钮时触发：
 * 激活 waiting Service Worker 并在接管后刷新页面进入新版本
 */
export async function triggerManualPwaUpdate(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    let targetWorker = pendingWorker;
    if (!targetWorker && 'serviceWorker' in navigator) {
      const reg = (await navigator.serviceWorker.getRegistration?.()) || pendingRegistration;
      targetWorker = reg?.waiting || null;
      if (!targetWorker && reg?.installing) {
        targetWorker = reg.installing;
      }
    }

    let reloaded = false;
    const doReload = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    if (targetWorker) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener?.('controllerchange', doReload, { once: true } as any);
      }
      targetWorker.postMessage({ type: 'SKIP_WAITING', isPlaying: false, force: true });
      pendingWorker = null;

      setTimeout(doReload, 450);
      return true;
    }

    // 保底：若无 worker 实例（如本地直连、无 sw 缓存或纯页面差异），直接刷新
    doReload();
    return true;
  } catch (e) {
    console.warn('[PWA] Manual update failed:', e);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
    return false;
  }
}

/**
 * 注册具备播放态感知的 Service Worker
 * 🛡️ 核心铁律：发现新版本时仅记录 pendingWorker 与版本号并通知设置菜单展示更新按钮，
 * 严禁在后台或暂停时擅自发送 SKIP_WAITING 或擅自刷新页面！
 */
export function registerServiceWorker(
  onUpdateFound?: (version?: string) => void,
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

  const initRegistration = () => {
    navigator.serviceWorker
      .register(opts.swUrl || '/sw.js', { updateViaCache: opts.updateViaCache })
      .then((reg) => {
        pendingRegistration = reg;
        const handleFoundWorker = (worker: ServiceWorker) => {
          // 🛡️ 严禁擅自调用 SKIP_WAITING！仅暂存 waiting worker 并在设置顶部高亮提示用户手动点击更新
          pendingWorker = worker;
          getWorkerVersion(worker).then((ver) => {
            if (ver) pendingVersion = ver;
            onUpdateFound?.(ver || undefined);
            opts.onUpdateWaiting?.(reg, ver || undefined);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('wyy:pwa-update-available', {
                  detail: { version: pendingVersion || undefined }
                })
              );
            }
          }).catch(() => {
            onUpdateFound?.();
            opts.onUpdateWaiting?.(reg);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('wyy:pwa-update-available', {
                  detail: { version: pendingVersion || undefined }
                })
              );
            }
          });
        };

        if (reg.waiting) {
          handleFoundWorker(reg.waiting);
        }
        reg.onupdatefound = () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.onstatechange = () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              handleFoundWorker(installing);
            }
          };
        };

        // 📱 熄屏或切到前台唤醒时仅静默检查是否有新版本文件（仅在非播放状态下触发，且绝不自动激活）
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              if (isPlayingNow(opts)) {
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
 * 检查并（在非 probeOnly 模式下）激活 PWA 更新，播放中绝对不更新
 */
export async function checkForPwaUpdate(options?: {
  isAudioPlaying?: () => boolean;
  force?: boolean;
  probeOnly?: boolean;
}): Promise<boolean> {
  if (options?.probeOnly) {
    return probeForPwaUpdate(options);
  }
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
      pendingWorker = currentWaiting;
      pendingVersion = await getWorkerVersion(currentWaiting);
      currentWaiting.postMessage({ type: 'SKIP_WAITING', isPlaying: false, force: Boolean(options?.force) });
      pendingWorker = null;
      return true;
    }
    await reg.update();
    const newWaiting = (reg as any).waiting as ServiceWorker | null;
    if (newWaiting) {
      pendingWorker = newWaiting;
      pendingVersion = await getWorkerVersion(newWaiting);
      newWaiting.postMessage({ type: 'SKIP_WAITING', isPlaying: false, force: Boolean(options?.force) });
      pendingWorker = null;
      return true;
    }
    return false;
  } catch (e) {
    console.warn('[PWA] Failed to check for update:', e);
    return false;
  }
}

// 🎧 全局 DOM 捕获阶段监听所有原生 <audio> 播放事件，实时向 Worker 同步播放状态（绝不自动触发更新或刷新）
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
        }, 150);
      }
    },
    true
  );
}
