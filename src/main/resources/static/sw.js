const CACHE_NAME = 'wyyyyy-dl-v5.1.5';
const AUDIO_CACHE_NAME = 'netease-music-audio-v1';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.png'
];

// 1. 安装 Service Worker 并预缓存基础 App Shell (弹性容错机制)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'no-cache' });
            if (res.ok) {
              await cache.put(url, res);
            }
          } catch (e) {
            console.warn('[SW] 预缓存资源跳过:', url, e);
          }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// 2. 激活并清理旧版本的静态资源 Cache（保护音频离线缓存不受 SW 升级影响）
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 保护当前版本 assets cache 以及离线曲库永久缓存
          if (cacheName !== CACHE_NAME && cacheName !== AUDIO_CACHE_NAME && cacheName !== 'netease-dl-v3.0.0') {
            console.log('[SW] 清除旧版本静态资源缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. 监听客户端指令（用于发现新版本时立即接管并跳过等待）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 3. Fetch 请求拦截策略
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 忽略非 GET 请求或跨域 CDN 请求
  if (event.request.method !== 'GET' || requestUrl.origin !== location.origin) {
    return;
  }

  // 区分音视频流 API 请求 (/v3/stream, /v3/history/stream)
  const isAudioStream = requestUrl.pathname.includes('/v3/stream') || 
                        requestUrl.pathname.includes('/v3/history/stream');

  if (isAudioStream) {
    // 🎵 音频流处理：优先检查离线 Cache，命中则构造 Range 206 切片响应秒播；未命中回退网络
    event.respondWith((async () => {
      try {
        const cache = await caches.open(AUDIO_CACHE_NAME);
        const songId = requestUrl.searchParams.get('id');
        const canonicalKey = songId ? `/v3/stream?id=${songId}` : null;

        let cachedResponse = await cache.match(event.request);
        if (!cachedResponse) {
          cachedResponse = await cache.match(requestUrl.pathname + requestUrl.search);
        }
        if (!cachedResponse && canonicalKey) {
          cachedResponse = await cache.match(canonicalKey);
        }

        // 🎯 本地缓存命中：支持完整的 Range 206 Partial Content 切片，保障 iOS/Safari 拖拽进度条与离线秒播
        if (cachedResponse) {
          const rangeHeader = event.request.headers.get('Range');
          if (!rangeHeader) {
            return cachedResponse;
          }

          const arrayBuffer = await cachedResponse.arrayBuffer();
          const total = arrayBuffer.byteLength;
          const parts = rangeHeader.replace(/bytes=/, '').split('-');
          const startStr = parts[0];
          const endStr = parts[1];

          let start = parseInt(startStr, 10);
          let end = endStr ? parseInt(endStr, 10) : total - 1;

          if (isNaN(start)) {
            start = total - parseInt(endStr, 10);
            end = total - 1;
          }
          start = Math.max(0, Math.min(start, total - 1));
          end = Math.max(start, Math.min(end, total - 1));

          const chunk = arrayBuffer.slice(start, end + 1);
          const headers = new Headers(cachedResponse.headers);
          headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
          headers.set('Content-Length', String(chunk.byteLength));
          headers.set('Accept-Ranges', 'bytes');
          if (!headers.get('Content-Type')) {
            headers.set('Content-Type', 'audio/mpeg');
          }

          return new Response(chunk, {
            status: 206,
            statusText: 'Partial Content',
            headers
          });
        }
      } catch (cacheErr) {
        console.warn('[SW] 读取离线音频缓存失败:', cacheErr);
      }

      // 未缓存的音频：请求服务端网络
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(AUDIO_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      } catch (err) {
        return new Response('Audio not available offline', { status: 404 });
      }
    })());
    return;
  } else {
    // 静态资源与页面：网络优先，成功则更新 Cache，失败降级 Cache
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
          });
        })
    );
  }
});
