import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { registerServiceWorker } from './lib/pwa'
import { initLocale } from './lib/i18n/index.svelte'

// 优先确保多语言环境加载就绪（静态载入或从缓存/网络动态拉取字典）再挂载首屏，防止语言包 fallback 导致的中文内容残留
await initLocale().catch((err) => {
  console.warn('[i18n] Failed to initialize locale:', err);
});

// 极客彩蛋: Whatever You Yearn
console.log(
  '%c WYY %c Whatever You Yearn ',
  'background:#3b82f6;color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px 0 0 3px;',
  'background:#1e293b;color:#94a3b8;padding:2px 6px;border-radius:0 3px 3px 0;'
);

const target = document.getElementById('app')!;
// 清理 HTML 首屏内联 splash 占位骨架，立即无缝挂载 Svelte 主应用
target.innerHTML = '';
const app = mount(App, {
  target,
})

// 注册 PWA Service Worker 并监听新版本就绪通知
registerServiceWorker(() => {
  window.dispatchEvent(new CustomEvent('wyy:pwa-update-available'));
})

export default app
