import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vite.dev/config/
// 纯净 Svelte 5 架构：前端产物输出至 ../src/main/resources/static/svelte
export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  base: '/svelte/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  server: {
    port: 5173,
    proxy: {
      '/v3': 'http://localhost:8080',
      '/sw.js': 'http://localhost:8080',
      '/manifest.json': 'http://localhost:8080',
      '/favicon.png': 'http://localhost:8080',
      '/favicon.ico': 'http://localhost:8080'
    }
  },
  build: {
    outDir: '../src/main/resources/static/svelte',
    emptyOutDir: true,
    manifest: false
  }
})
