const CACHE_NAME = 'netease-dl-v2.9.0';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/css/style.css?v=2.9.0',
  '/js/app.js?v=2.9.0',
  '/js/playlist.js?v=2.9.0',
  '/js/album.js?v=2.9.0',
  '/js/search.js?v=2.9.0',
  '/js/download-mgr.js?v=2.9.0'
];

// 1. 安装 Service Worker 并预缓存基础 App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// 2. 激活并清理旧版本的 Cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] 清除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch 请求拦截策略
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 忽略非 GET 请求或跨域 CDN 请求
  if (event.request.method !== 'GET' || requestUrl.origin !== location.origin) {
    return;
  }

  // 区分音视频流 API 请求 (/v2/stream, /v2/history/stream)
  const isAudioStream = requestUrl.pathname.includes('/v2/stream') || requestUrl.pathname.includes('/v2/history/stream');

  if (isAudioStream) {
    // 音频流：网络优先，网络异常/断网时尝试使用 Cache API 兜底
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          console.log('[SW] 断网降级：从 Cache 读取音频', event.request.url);
          return caches.match(event.request);
        })
    );
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
