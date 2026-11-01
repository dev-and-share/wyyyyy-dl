/**
 * 📱 PWA Service Worker 生命周期与自动平滑更新管理
 * 底层逻辑已抽象沉淀至跨端音频引擎 pwa-audio-player (PwaLifecycleManager)
 */

export {
  PwaLifecycleManager,
  type PwaLifecycleOptions,
  registerServiceWorker,
  checkForPwaUpdate,
  isPwaStandalone
} from 'pwa-audio-player';
