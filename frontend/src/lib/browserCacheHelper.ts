import { formatArtist } from './utils';
import {
  PWA_CACHE_NAME,
  PWA_TRACK_META_KEY,
  getSongPlayCount,
  refreshCachedSongIds
} from './pwaCache.svelte';

export type BrowserCacheItem = {
  key: string;
  id: string | null;
  urls: string[];
  relUrls: string[];
  relUrl: string;
  name: string;
  artist: string;
  size: number;
  time: number;
  playCount: number;
};

export function isAudioCacheUrl(url: string) {
  return url.includes('/v3/stream') || url.includes('/v3/history/stream');
}

export function readCachedTrackMeta(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem(PWA_TRACK_META_KEY) || '{}');
  } catch {
    return {};
  }
}

export function formatCacheDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}-${day} ${h}:${min}`;
}

/**
 * 扫描并获取所有手机离线音乐缓存，按「播放次数 ↓ > 缓存时间 ↓」复合排序
 */
export async function scanBrowserCache(): Promise<{ list: BrowserCacheItem[]; totalBytes: number }> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { list: [], totalBytes: 0 };
  }

  const metaMap = readCachedTrackMeta();
  const byKey = new Map<string, BrowserCacheItem>();

  for (const cacheName of await caches.keys()) {
    const cache = await caches.open(cacheName);
    for (const request of await cache.keys()) {
      if (!isAudioCacheUrl(request.url)) continue;
      const relUrl = request.url.startsWith('http')
        ? (new URL(request.url).pathname + new URL(request.url).search)
        : request.url;
      const meta = metaMap[relUrl] || metaMap[request.url] || {};
      const response = await cache.match(request);
      const size = Number(response?.headers.get('content-length') || meta.fileSize || 0);

      // 提取真实歌曲 ID 与历史记录 ID
      const urlIdMatch = relUrl.match(/[?&]id=([1-9]\d*)/);
      const urlHistMatch = relUrl.match(/[?&]historyId=(\d+)/);
      const songId = meta.id && String(meta.id) !== '0' ? String(meta.id) : (urlIdMatch ? urlIdMatch[1] : null);

      const songName = (meta.songName || '').trim();
      const songArtist = formatArtist(meta.artist) || '';

      // 🎵 逻辑唯一键：优先真实歌曲 ID (song_xxx)，其次标准化歌名+歌手 (meta_name_artist)，兜底 relUrl
      const uniqueKey = songId
        ? `song_${songId}`
        : (songName ? `meta_${songName}_${songArtist}` : relUrl);

      const itemTime = Number(meta.time || meta.cachedAt || 0);
      const itemPlayCount = songId ? getSongPlayCount(songId) : (meta.playCount || getSongPlayCount(uniqueKey) || 0);

      if (byKey.has(uniqueKey)) {
        const existing = byKey.get(uniqueKey)!;
        const isCurrentCanonical = urlIdMatch && !relUrl.includes('historyId=');
        const isExistingCanonical = existing.relUrl.match(/[?&]id=([1-9]\d*)/) && !existing.relUrl.includes('historyId=');

        if (isCurrentCanonical && !isExistingCanonical) {
          for (const oldUrl of existing.urls) {
            await cache.delete(oldUrl).catch(() => {});
          }
          existing.urls = [request.url];
          existing.relUrls = [relUrl];
          existing.relUrl = relUrl;
        } else if (isExistingCanonical && !isCurrentCanonical) {
          await cache.delete(request).catch(() => {});
        } else {
          if (!existing.urls.includes(request.url)) existing.urls.push(request.url);
          if (!existing.relUrls.includes(relUrl)) existing.relUrls.push(relUrl);
        }
        existing.size = Math.max(existing.size, size);
        existing.time = Math.max(existing.time, itemTime);
        existing.playCount = Math.max(existing.playCount, itemPlayCount);
      } else {
        byKey.set(uniqueKey, {
          key: uniqueKey,
          id: songId,
          urls: [request.url],
          relUrls: [relUrl],
          relUrl,
          name: songName || (songId ? `离线音轨 #${songId}` : (urlHistMatch ? `本地音轨 #${urlHistMatch[1]}` : '本地缓存音频')),
          artist: songArtist || '浏览器已离线',
          size,
          time: itemTime,
          playCount: itemPlayCount
        });
      }
    }
  }

  // 🎯 复合排序规则：播放次数多优先 (降序) > 缓存时间新优先 (降序)
  const list = [...byKey.values()].sort((a, b) => {
    if (b.playCount !== a.playCount) {
      return b.playCount - a.playCount;
    }
    if (b.time !== a.time) {
      return b.time - a.time;
    }
    return a.name.localeCompare(b.name);
  });

  const totalBytes = list.reduce((total, item) => total + item.size, 0);
  return { list, totalBytes };
}

/**
 * 删除单首离线歌曲缓存
 */
export async function deleteBrowserCacheEntry(item: BrowserCacheItem): Promise<void> {
  const metaMap = readCachedTrackMeta();
  for (const cacheName of await caches.keys()) {
    const cache = await caches.open(cacheName);
    for (const url of item.urls) {
      await cache.delete(url).catch(() => {});
    }
  }
  for (const rUrl of item.relUrls) {
    delete metaMap[rUrl];
  }
  for (const fUrl of item.urls) {
    delete metaMap[fUrl];
  }
  localStorage.setItem(PWA_TRACK_META_KEY, JSON.stringify(metaMap));
  refreshCachedSongIds();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wyyyy:browser-cache-updated'));
  }
}

/**
 * 批量清除播放少于阈值的低频离线歌曲
 */
export async function clearLowPlayCountCacheEntries(items: BrowserCacheItem[]): Promise<number> {
  const metaMap = readCachedTrackMeta();
  let freedBytes = 0;

  for (const cacheName of await caches.keys()) {
    const cache = await caches.open(cacheName);
    for (const item of items) {
      for (const url of item.urls) {
        await cache.delete(url).catch(() => {});
      }
    }
  }

  for (const item of items) {
    freedBytes += item.size;
    for (const rUrl of item.relUrls) {
      delete metaMap[rUrl];
    }
    for (const fUrl of item.urls) {
      delete metaMap[fUrl];
    }
  }

  localStorage.setItem(PWA_TRACK_META_KEY, JSON.stringify(metaMap));
  refreshCachedSongIds();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wyyyy:browser-cache-updated'));
  }
  return freedBytes;
}

/**
 * 清空当前设备上的所有离线音乐缓存
 */
export async function clearAllBrowserAudioCache(): Promise<void> {
  for (const cacheName of await caches.keys()) {
    const cache = await caches.open(cacheName);
    for (const request of await cache.keys()) {
      if (isAudioCacheUrl(request.url)) {
        await cache.delete(request).catch(() => {});
      }
    }
  }
  localStorage.removeItem(PWA_TRACK_META_KEY);
  refreshCachedSongIds();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wyyyy:browser-cache-updated'));
  }
}
