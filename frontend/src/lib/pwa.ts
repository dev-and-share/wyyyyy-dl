/**
 * PWA Service Worker 注册与更新管理
 */

let registration: ServiceWorkerRegistration | null = null;

export function registerServiceWorker(onUpdateFound?: () => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // 生产环境或同域下注册根目录 sw.js
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg;
        console.log('[PWA] Service Worker 注册成功，Scope:', reg.scope);

        // 监听更新就绪
        reg.onupdatefound = () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.onstatechange = () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] 发现新版本 Service Worker');
              onUpdateFound?.();
            }
          };
        };
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker 注册被跳过或失败:', err);
      });
  });
}

/**
 * 手动检查并拉取最新 Service Worker (用于下拉刷新触发)
 */
export async function checkForPwaUpdate(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    let updated = false;
    for (const reg of regs) {
      await reg.update();
      updated = true;
    }
    return updated;
  } catch (e) {
    console.warn('[PWA] 检查更新失败:', e);
    return false;
  }
}
