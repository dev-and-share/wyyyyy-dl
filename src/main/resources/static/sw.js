const CACHE_NAME = 'wyy-v5.5.18';
const AUDIO_CACHE_NAME = 'netease-music-audio-v1';
const IMAGE_CACHE_NAME = 'netease-music-image-v1';
const MAX_IMAGE_CACHE_ITEMS = 2000;

const PRECACHE_URLS = [
  '/',
  '/svelte/index.html',
  '/manifest.json',
  '/svelte/manifest.json',
  '/favicon.png',
  '/svelte/favicon.png',
  '/icon-192.png',
  '/svelte/icon-192.png',
  '/icon-512.png',
  '/svelte/icon-512.png',
  '/apple-touch-icon.png',
  '/svelte/apple-touch-icon.png'
];

let isTrimmingImages = false;
let lastImageTrimTime = 0;
let cachedAudioKeys = new Set();

async function syncAudioCacheIndex() {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const keys = await cache.keys();
    const newKeys = new Set();
    for (const req of keys) {
      try {
        const u = new URL(req.url);
        const songId = u.searchParams.get('id');
        if (songId) newKeys.add(songId);
        if (u.search) newKeys.add(u.pathname + u.search);
      } catch {}
    }
    cachedAudioKeys = newKeys;
  } catch {}
}

syncAudioCacheIndex();

async function trimCache(cacheName, maxItems) {
  const now = Date.now();
  if (isTrimmingImages || now - lastImageTrimTime < 30000) return;
  isTrimmingImages = true;
  lastImageTrimTime = now;
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const deleteCount = keys.length - maxItems;
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (e) {
    console.warn('[SW] trimCache 失败:', e);
  } finally {
    isTrimmingImages = false;
  }
}

// 1. 安装 Service Worker 并预缓存基础 App Shell 与产物 (弹性容错机制)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. 预缓存 App Shell 基础静态资源
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

      // 2. 深入预缓存：读取已下载的入口 HTML，自动嗅探并预缓存所有构建产物 (JS/CSS/Chunks)
      try {
        const rootRes = (await cache.match('/')) || (await cache.match('/svelte/index.html'));
        if (rootRes) {
          const htmlText = await rootRes.clone().text();
          const matches = htmlText.matchAll(/["'](\/svelte\/assets\/[^"']+)["']/g);
          const assetUrls = Array.from(new Set(Array.from(matches, (m) => m[1])));
          await Promise.allSettled(
            assetUrls.map(async (assetUrl) => {
              try {
                const aRes = await fetch(assetUrl);
                if (aRes.ok) {
                  await cache.put(assetUrl, aRes);
                }
              } catch (err) {
                console.warn('[SW] 自动预缓存资产跳过:', assetUrl, err);
              }
            })
          );
        }
      } catch (sniffErr) {
        console.warn('[SW] 入口 HTML 产物嗅探跳过:', sniffErr);
      }
    })
  );
});

// 2. 激活并清理旧版本的静态资源 Cache（保护音频离线缓存和封面图片缓存不受 SW 升级影响）
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 保护当前版本 assets cache、音频离线缓存与图片离线缓存
          if (cacheName !== CACHE_NAME && cacheName !== AUDIO_CACHE_NAME && cacheName !== IMAGE_CACHE_NAME && cacheName !== 'netease-dl-v3.0.0') {
            console.log('[SW] 清除旧版本静态资源缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => syncAudioCacheIndex()).then(() => self.clients.claim())
  );
});

// 3. 监听客户端指令（用于发现新版本时立即接管并跳过等待，或清除图片缓存）
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    } else if (event.data.type === 'CLEAR_IMAGE_CACHE') {
      caches.delete(IMAGE_CACHE_NAME).catch(() => {});
    } else if (event.data.type === 'REFRESH_AUDIO_CACHE') {
      syncAudioCacheIndex();
    }
  }
});

// 4. Fetch 请求拦截策略
self.addEventListener('fetch', (event) => {
  // 忽略非 GET 请求
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // 🧪 极简锁屏播放测试页直接放行，零 Service Worker 介入
  if (requestUrl.pathname === '/minimal-player.html') {
    return;
  }

  // 🎵 分支 A：区分音视频流 API 请求 (/v3/stream, /v3/history/stream)
  const isAudioStream = requestUrl.origin === location.origin &&
                        (requestUrl.pathname.includes('/v3/stream') || requestUrl.pathname.includes('/v3/history/stream'));

  if (isAudioStream) {
    const isOnline = typeof self.navigator === 'undefined' || self.navigator.onLine !== false;

    // 🛡️ 大道至简（Pitfall #08 & #10）：
    // 在线状态下，所有音频流请求（含初始 GET 与锁屏暂停恢复的 Range 206 续传请求）
    // 100% 直接 return 放行，完全交由 iOS AVPlayer 原生网络栈 (mediaserverd) 直连服务端，
    // 仅在断网离线状态 (!isOnline) 下才由 Service Worker 读取离线 Cache 响应。
    if (isOnline) {
      return;
    }

    const songId = requestUrl.searchParams.get('id') || requestUrl.searchParams.get('songId');
    const isCachedLocally = (songId && cachedAudioKeys.has(songId)) ||
                            cachedAudioKeys.has(requestUrl.pathname + requestUrl.search);

    if (!isCachedLocally) {
      return;
    }

    // 🎵 离线缓存音频流处理：优先检查离线 Cache，使用零拷贝 Blob.slice 构造 Range 206 响应
    event.respondWith((async () => {
      try {
        const cache = await caches.open(AUDIO_CACHE_NAME);
        const canonicalKey = songId ? `/v3/stream?id=${songId}` : null;

        let cachedResponse = await cache.match(event.request);
        if (!cachedResponse) {
          cachedResponse = await cache.match(requestUrl.pathname + requestUrl.search);
        }
        if (!cachedResponse && canonicalKey) {
          cachedResponse = await cache.match(canonicalKey);
        }

        // 🎯 本地缓存命中：使用零拷贝 Blob.slice 支持完整的 Range 206 Partial Content 切片
        if (cachedResponse) {
          const rangeHeader = event.request.headers.get('Range');
          if (!rangeHeader) {
            return cachedResponse;
          }

          const blob = await cachedResponse.blob();
          const total = blob.size;
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

          const chunk = blob.slice(start, end + 1);
          const headers = new Headers(cachedResponse.headers);
          headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
          headers.set('Content-Length', String(chunk.size));
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
        const fetchTarget = (typeof Request !== 'undefined' && event.request instanceof Request) ? event.request : (event.request.url || event.request);
      const networkResponse = await fetch(fetchTarget);
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(AUDIO_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).then(() => syncAudioCacheIndex());
          });
        }
        return networkResponse;
      } catch (err) {
        return new Response('Audio not available offline', { status: 404 });
      }
    })());
    return;
  }

  // 🖼️ 分支 B：网易云 CDN 封面图片 / 图片资源请求 (Cache First + 异步写入缓存)
  const isCdnImage = requestUrl.hostname.includes('126.net') ||
                     requestUrl.hostname.includes('music.163.com') ||
                     event.request.destination === 'image';

  if (isCdnImage) {
    event.respondWith((async () => {
      try {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Cache 未命中，向网络拉取
        const fetchTarget = (typeof Request !== 'undefined' && event.request instanceof Request) ? event.request : (event.request.url || event.request);
      const networkResponse = await fetch(fetchTarget);
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          cache.put(event.request, responseToCache).then(() => {
            trimCache(IMAGE_CACHE_NAME, MAX_IMAGE_CACHE_ITEMS);
          }).catch((err) => {
            console.warn('[SW] 图片存入 Cache 异常:', err);
          });
        }
        return networkResponse;
      } catch (err) {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        return new Response('', { status: 408, statusText: 'Image unavailable offline' });
      }
    })());
    return;
  }

  // 忽略非同源跨域请求
  if (requestUrl.origin !== location.origin) {
    return;
  }

  // ⚡ 动态后端 API 请求 (/v3/* 除已处理的音频流外)：直接放行走原生网络，不污染静态资源 Cache
  if (requestUrl.pathname.startsWith('/v3/')) {
    return;
  }

  // 📦 分支 C：带 Hash 的前端构建资产及脚本、样式 (Cache First 优先)
  // Vite 构建出的 JS、CSS、字体等资源自带内容指纹，永不原地变更，直接命中本地 Cache 瞬时返回 (0ms)
  const isHashedAsset = requestUrl.pathname.startsWith('/svelte/assets/') ||
                        requestUrl.pathname.startsWith('/assets/') ||
                        requestUrl.pathname.endsWith('.js') ||
                        requestUrl.pathname.endsWith('.css') ||
                        requestUrl.pathname.endsWith('.woff2') ||
                        requestUrl.pathname.endsWith('.woff');

  if (isHashedAsset) {
    event.respondWith((async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Cache 未命中，向网络拉取并写入 Cache
        const fetchTarget = (typeof Request !== 'undefined' && event.request instanceof Request) ? event.request : (event.request.url || event.request);
        const networkResponse = await fetch(fetchTarget);
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          cache.put(event.request, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      } catch (err) {
        // 网络失败或离线时，尝试从任意现有缓存匹配
        const fallback = await caches.match(event.request);
        if (fallback) return fallback;
        throw err;
      }
    })());
    return;
  }

  // 📱 分支 D：入口 HTML 与路由导航 (Stale-While-Revalidate，本地秒开 + 后台静默校验)
  // 彻底消灭移动端 4G / 弱网下等待网络响应导致的开屏白屏，有缓存立即秒开 (0ms)
  const isNavigation = event.request.mode === 'navigate' ||
                       requestUrl.pathname === '/' ||
                       requestUrl.pathname === '/home' ||
                       requestUrl.pathname === '/index.html' ||
                       requestUrl.pathname === '/svelte/index.html' ||
                       requestUrl.pathname.endsWith('.html');

  if (isNavigation) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      // 优先从缓存获取已就绪的 App Shell HTML
      let cachedResponse = await cache.match(event.request);
      if (!cachedResponse) {
        cachedResponse = (await cache.match('/')) || (await cache.match('/svelte/index.html'));
      }

      // 后台发起网络拉取以获取最新版本 (Stale-While-Revalidate)
      const fetchTarget = (typeof Request !== 'undefined' && event.request instanceof Request) ? event.request : (event.request.url || event.request);
      const networkFetch = fetch(fetchTarget).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const toCache = networkResponse.clone();
          cache.put(event.request, toCache).catch(() => {});
          cache.put('/', networkResponse.clone()).catch(() => {});
          cache.put('/svelte/index.html', networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      }).catch((err) => {
        console.warn('[SW] 后台拉取最新 HTML 失败 (可能离线):', err);
        return null;
      });

      // 🎯 只要本地有缓存，立即返回，0ms 白屏！
      if (cachedResponse) {
        event.waitUntil(networkFetch);
        return cachedResponse;
      }

      // 首次未缓存时，等待网络返回
      const networkResponse = await networkFetch;
      if (networkResponse) {
        return networkResponse;
      }
      return (await caches.match('/')) || (await caches.match('/svelte/index.html')) || new Response('Offline', { status: 503 });
    })());
    return;
  }

  // 📦 分支 E：其他静态同源杂项资源 (manifest, favicon, icons, app-icon 等): Cache First 优先
  event.respondWith((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      const fetchTarget = (typeof Request !== 'undefined' && event.request instanceof Request) ? event.request : (event.request.url || event.request);
      const networkResponse = await fetch(fetchTarget);
      if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
        cache.put(event.request, networkResponse.clone()).catch(() => {});
      }
      return networkResponse;
    } catch {
      return (await caches.match(event.request)) || new Response('', { status: 404 });
    }
  })());
});
