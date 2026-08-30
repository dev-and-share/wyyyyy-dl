import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// 双版并存：产物隔离至 ../src/main/resources/static/svelte，不覆盖 static/js|css|sw.js
export default defineConfig({
  plugins: [svelte()],
  base: '/svelte/',
  server: {
    port: 5173,
    proxy: {
      '/MyPlaylist': 'http://localhost:8080',
      '/Playlist': 'http://localhost:8080',
      '/v2': 'http://localhost:8080',
      '/login': 'http://localhost:8080',
      '/qr': 'http://localhost:8080'
    }
  },
  build: {
    outDir: '../src/main/resources/static/svelte',
    emptyOutDir: true,
    manifest: false
  }
})
