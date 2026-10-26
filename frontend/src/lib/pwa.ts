/**
 * PWA Service Worker registration and auto-update management
 */

let refreshing = false;

// When new Service Worker activates and calls clients.claim(), reload page to apply updates
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    console.log('[PWA] New Service Worker activated, reloading page to apply updates');
    window.location.reload();
  });
}

export function registerServiceWorker(onUpdateFound?: () => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // Skip registration in local dev (port 5173) to protect Vite HMR
  if (window.location?.port === '5173') {
    if (navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) reg.unregister();
      }).catch(() => {});
    }
    console.log('[PWA] Skipping Service Worker registration in local dev environment');
    return;
  }

  // Register sw.js with updateViaCache: 'none'
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        console.log('[PWA] Service Worker registered successfully, scope:', reg.scope);

        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          onUpdateFound?.();
        }

        reg.onupdatefound = () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.onstatechange = () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New Service Worker found, requesting skip waiting');
              installing.postMessage({ type: 'SKIP_WAITING' });
              onUpdateFound?.();
            }
          };
        };

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {});
          }
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration skipped or failed:', err);
      });
  });
}

/**
 * Manually check for PWA update (e.g. pull to refresh)
 */
export async function checkForPwaUpdate(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;

    const currentWaiting = reg.waiting;
    if (currentWaiting) {
      currentWaiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    }

    await reg.update();
    const newWaiting = reg.waiting as ServiceWorker | null;
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

