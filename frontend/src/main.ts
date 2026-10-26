import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { registerServiceWorker } from './lib/pwa'
import { initLocale } from './lib/i18n/index.svelte'

// 初始化多语言环境
await initLocale();

const app = mount(App, {
  target: document.getElementById('app')!,
})

// 注册 PWA Service Worker 并监听新版本就绪通知
registerServiceWorker(() => {
  window.dispatchEvent(new CustomEvent('wyyyy:pwa-update-available'));
})

export default app
