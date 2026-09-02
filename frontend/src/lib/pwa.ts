/**
 * PWA Service Worker 注册与热更新自动接管
 */

let refreshing = false;

// 🚀 当新版本 Service Worker 激活并调用 clients.claim() 后，自动刷新页面应用最新代码
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    console.log('[PWA] 新版本 Service Worker 已激活并接管，立即重载页面以生效最新版本');
    window.location.reload();
  });
}

export function registerServiceWorker(onUpdateFound?: () => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // 生产环境或同域下注册根目录 sw.js，设置 updateViaCache: 'none' 确保穿透 HTTP 缓存
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        console.log('[PWA] Service Worker 注册成功，Scope:', reg.scope);

        // 如果注册时已经有 waiting 中的 worker，直接通知其激活
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          onUpdateFound?.();
        }

        // 监听新 worker 安装并就绪
        reg.onupdatefound = () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.onstatechange = () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] 发现新版本 Service Worker，请求立即接管');
              installing.postMessage({ type: 'SKIP_WAITING' });
              onUpdateFound?.();
            }
          };
        };

        // 📱 当 PWA 从后台切回前台（如锁屏唤醒/多任务切换回桌面应用），自动探测一次更新
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {});
          }
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker 注册被跳过或失败:', err);
      });
  });
}

/**
 * 手动检查并拉取最新 Service Worker (用于下拉刷新触发)
 * 若有新版本，会自动触发 SKIP_WAITING 与 controllerchange 刷新
 */
export async function checkForPwaUpdate(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;

    // 如果已经有 waiting 的 worker，直接激活
    const currentWaiting = reg.waiting;
    if (currentWaiting) {
      currentWaiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    }

    // 触发检查
    await reg.update();
    const newWaiting = reg.waiting as ServiceWorker | null;
    if (newWaiting) {
      newWaiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    }
    return false;
  } catch (e) {
    console.warn('[PWA] 检查更新失败:', e);
    return false;
  }
}

