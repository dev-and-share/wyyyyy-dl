import { formatArtist, DEFAULT_VINYL_COVER } from '../utils';
import { t } from '../i18n';
import {
  PWA_TRACK_META_KEY,
  isFallbackTrackLabel,
  refreshCachedSongIds
} from './pwaCache.svelte';
import type { BrowserCacheItem } from './browserCacheHelper';

function parseTimestampMs(raw: unknown): number {
  if (!raw) return 0;
  if (typeof raw === 'number' && !isNaN(raw)) return raw;
  const parsed = Date.parse(String(raw));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * 当本地 CacheStorage 存在音频但 localStorage 元数据缺失时，在线批量向后端查询真实歌名/歌手并回填持久化
 */
export async function healMissingBrowserCacheMetadata(
  missingItems: Array<{ item: BrowserCacheItem; historyId: string | null }>,
  metaMap: Record<string, any>
): Promise<void> {
  if (missingItems.length === 0) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (typeof fetch !== 'function') return;

  const songIds = Array.from(
    new Set(
      missingItems
        .map((entry) => Number(entry.item.id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
  const historyIds = Array.from(
    new Set(
      missingItems
        .map((entry) => Number(entry.historyId))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
  if (songIds.length === 0 && historyIds.length === 0) return;

  const bySongId = new Map<string, any>();
  const byHistoryId = new Map<string, any>();
  const byOnlineSongId = new Map<string, any>();

  const chunkSize = 200;
  const maxLen = Math.max(songIds.length, historyIds.length);
  for (let offset = 0; offset < maxLen; offset += chunkSize) {
    const songChunk = songIds.slice(offset, offset + chunkSize);
    const histChunk = historyIds.slice(offset, offset + chunkSize);
    if (songChunk.length === 0 && histChunk.length === 0) continue;

    try {
      const resp = await fetch('/v3/history/batch_detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(songChunk.length > 0 ? { songIds: songChunk } : {}),
          ...(histChunk.length > 0 ? { historyIds: histChunk } : {})
        })
      });
      if (!resp || !resp.ok) continue;
      const json = await resp.json().catch(() => null);
      const data = json?.data;
      if (!data) continue;

      if (Array.isArray(data.bySongId)) {
        for (const rec of data.bySongId) {
          if (rec?.songId != null) bySongId.set(String(rec.songId), rec);
        }
      }
      if (Array.isArray(data.byHistoryId)) {
        for (const rec of data.byHistoryId) {
          if (rec?.id != null) byHistoryId.set(String(rec.id), rec);
        }
      }
      if (data.byOnlineSongId && typeof data.byOnlineSongId === 'object') {
        for (const [sid, meta] of Object.entries(data.byOnlineSongId)) {
          if (meta) byOnlineSongId.set(String(sid), meta);
        }
      }
    } catch {
      // 网络波动或离线时静默降级，保留占位名称
    }
  }

  let updatedMeta = false;
  for (const { item, historyId } of missingItems) {
    const localMatch =
      (item.id ? bySongId.get(String(item.id)) : null) ||
      (historyId ? byHistoryId.get(String(historyId)) : null);
    const onlineMatch = item.id ? byOnlineSongId.get(String(item.id)) : null;
    const resolved = localMatch || onlineMatch;
    if (!resolved) continue;

    const resolvedName = String(resolved.songName || resolved.name || '').trim();
    if (!resolvedName || isFallbackTrackLabel(resolvedName)) continue;

    const resolvedArtist = formatArtist(resolved.artist) || '';
    const resolvedCover = String(resolved.cover || '').trim();
    const resolvedAlbum = String(resolved.album || '').trim();
    const resolvedSize = Number(resolved.fileSize || item.size || 0);
    const resolvedTime = item.time || parseTimestampMs(resolved.createdAt) || Date.now();

    item.name = resolvedName;
    if (resolvedArtist) {
      item.artist = resolvedArtist;
    }
    if (resolvedCover && (!item.cover || item.cover === DEFAULT_VINYL_COVER)) {
      item.cover = resolvedCover;
    }
    if (!item.size && resolvedSize > 0) {
      item.size = resolvedSize;
    }
    if (!item.time && resolvedTime > 0) {
      item.time = resolvedTime;
    }

    const storageKey = item.relUrl || (item.id ? `/v3/stream?id=${item.id}` : '');
    if (storageKey) {
      metaMap[storageKey] = {
        ...(metaMap[storageKey] || {}),
        id: item.id || '',
        songName: resolvedName,
        artist: resolvedArtist || t('common.unknownArtist'),
        cover: item.cover || '/favicon.png',
        album: resolvedAlbum,
        fileSize: item.size || resolvedSize,
        time: item.time || resolvedTime,
        playCount: item.playCount || 0
      };
      updatedMeta = true;
    }
  }

  if (updatedMeta && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(PWA_TRACK_META_KEY, JSON.stringify(metaMap));
      refreshCachedSongIds();
    } catch {
      // ignore quota errors
    }
  }
}
