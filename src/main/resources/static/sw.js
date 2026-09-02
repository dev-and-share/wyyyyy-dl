const CACHE_NAME = 'netease-dl-v4.6.13';
const AUDIO_CACHE_NAME = 'netease-music-audio-v1';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.png'
];

// 1. 安装 Service Worker 并预缓存基础 App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
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

  // 区分音视频流 API 请求 (/v2/stream, /v2/history/stream)
  const isAudioStream = requestUrl.pathname.includes('/v2/stream') || requestUrl.pathname.includes('/v2/history/stream');

  if (isAudioStream) {
    // 音频流：网络优先，网络异常/断网时尝试使用 Cache API 兜底
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(AUDIO_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          console.log('[SW] 断网降级：从 Cache 读取音频', event.request.url);
          return caches.open(AUDIO_CACHE_NAME).then(c => c.match(event.request)).then(res => {
            return res || caches.match(event.request);
          });
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
