import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'

import { registerServiceWorker } from './lib/pwa'

const app = mount(App, {
  target: document.getElementById('app')!,
})

// 注册 PWA Service Worker 并监听新版本就绪通知
registerServiceWorker(() => {
  window.dispatchEvent(new CustomEvent('wyyyy:pwa-update-available'));
})

export default app
