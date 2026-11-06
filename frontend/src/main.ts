import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { registerServiceWorker } from './lib/pwa'
import { initLocale } from './lib/i18n/index.svelte'

// 初始化多语言环境
await initLocale();

// 极客彩蛋: Whatever You Yearn
console.log(
  '%c WYY %c Whatever You Yearn ',
  'background:#3b82f6;color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px 0 0 3px;',
  'background:#1e293b;color:#94a3b8;padding:2px 6px;border-radius:0 3px 3px 0;'
);

const app = mount(App, {
  target: document.getElementById('app')!,
})

// 注册 PWA Service Worker 并监听新版本就绪通知
registerServiceWorker(() => {
  window.dispatchEvent(new CustomEvent('wyy:pwa-update-available'));
})

export default app
