import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { readFileSync, existsSync, createReadStream } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

/**
 * 🛠️ 开发环境根路径静态资源直通插件 (Root Public Dev Plugin)
 * 解决 base: '/svelte/' 下，根路径直接请求 /favicon.png, /manifest.json, /icon-*.png 找不到本地 public 文件的问题，
 * 无需依赖后端 8080 代理，本地 Vite 服务器直接极速响应，消灭 404。
 */
function rootPublicDevPlugin(): Plugin {
  return {
    name: 'vite-plugin-root-public-dev',
    configureServer(server) {
      const publicDir = resolve(__dirname, 'public')
      server.middlewares.use((req, res, next) => {
        if (!req.url || (req.method !== 'GET' && req.method !== 'HEAD')) return next()
        const pathname = req.url.split('?')[0]
        if (pathname.startsWith('/svelte/') || pathname.startsWith('/v3/') || pathname.startsWith('/@')) {
          return next()
        }
        const filePath = join(publicDir, pathname)
        if (existsSync(filePath) && !filePath.endsWith('/')) {
          const contentType =
            pathname.endsWith('.png') ? 'image/png' :
            pathname.endsWith('.svg') ? 'image/svg+xml' :
            pathname.endsWith('.ico') ? 'image/x-icon' :
            pathname.endsWith('.json') || pathname.endsWith('.webmanifest') ? 'application/manifest+json' :
            pathname.endsWith('.js') ? 'application/javascript' : undefined
          if (contentType) {
            res.setHeader('Content-Type', contentType)
          }
          if (req.method === 'HEAD') {
            res.end()
            return
          }
          createReadStream(filePath).pipe(res)
          return
        }
        next()
      })
    }
  }
}

// https://vite.dev/config/
// 纯净 Svelte 5 架构：前端产物输出至 ../src/main/resources/static/svelte
export default defineConfig({
  plugins: [svelte(), tailwindcss(), rootPublicDevPlugin()],
  base: '/svelte/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  server: {
    port: 5173,
    proxy: {
      '/v3': 'http://localhost:8080',
      '/sw.js': 'http://localhost:8080'
    }
  },
  build: {
    outDir: '../src/main/resources/static/svelte',
    emptyOutDir: true,
    manifest: false
  }
})
