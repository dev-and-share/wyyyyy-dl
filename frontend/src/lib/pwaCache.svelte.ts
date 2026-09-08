import { api } from './api';

export const PWA_CACHE_NAME = 'netease-music-audio-v1';
export const PWA_TRACK_META_KEY = 'pwa_cached_tracks_meta_v1';

/**
 * 从本地存储加载所有已缓存歌曲的 ID 集合
 */
export function loadCachedSongIds(): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const metaMap = JSON.parse(localStorage.getItem(PWA_TRACK_META_KEY) || '{}');
    const set = new Set<number>();
    for (const key of Object.keys(metaMap)) {
      const item = metaMap[key];
      if (item?.id) {
        set.add(Number(item.id));
      }
      const match = key.match(/[?&]id=(\d+)/);
      if (match && match[1]) {
        set.add(Number(match[1]));
      }
    }
    return set;
  } catch {
    return new Set();
  }
}

/**
 * 全局响应式状态：手机本地/浏览器离线已缓存的歌曲 ID 集合
 */
export const cachedSongIdSet = $state<Set<number>>(loadCachedSongIds());

/**
 * 刷新全局缓存集合
 */
export function refreshCachedSongIds() {
  const latest = loadCachedSongIds();
  cachedSongIdSet.clear();
  for (const id of latest) {
    cachedSongIdSet.add(id);
  }
}

// 自动响应离线缓存更新/删除事件
if (typeof window !== 'undefined') {
  window.addEventListener('wyyyy:browser-cache-updated', ((e: CustomEvent) => {
    const id = e?.detail?.id;
    if (id) {
      cachedSongIdSet.add(Number(id));
    } else {
      refreshCachedSongIds();
    }
  }) as EventListener);
}

/**
 * 检查指定歌曲 ID 是否已在浏览器离线 Cache 中
 */
export async function isSongCached(id: string | number): Promise<boolean> {
  if (cachedSongIdSet.has(Number(id))) return true;
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    const metaMap = JSON.parse(localStorage.getItem(PWA_TRACK_META_KEY) || '{}');
    const canonicalUrl = `/v3/stream?id=${id}`;
    if (metaMap[canonicalUrl]) return true;
    const cache = await caches.open(PWA_CACHE_NAME);
    const match = await cache.match(canonicalUrl);
    return !!match;
  } catch {
    return false;
  }
}

/**
 * 将指定单曲完整下载并缓存到浏览器 PWA Cache (支持断网纯离线秒播)
 */
export async function cacheTrackToBrowser(track: {
  id: string | number;
  name: string;
  artist?: string;
  cover?: string;
  album?: string;
}): Promise<{ success: boolean; msg: string; isTrial?: boolean }> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { success: false, msg: '当前浏览器不支持 Cache API 或未在安全环境(HTTPS/Localhost)运行' };
  }
  const id = String(track.id);
  try {
    const resp = await api.songV1(id, 'lossless');
    let audioUrl = resp?.data?.url;
    const songData = resp?.data || {};

    if (!audioUrl) {
      // 触发一次服务端兜底解析
      await api.downloadSingle(id).catch(() => {});
      const retry = await api.songV1(id, 'lossless');
      audioUrl = retry?.data?.url;
    }

    if (!audioUrl) {
      return { success: false, msg: '无法获取歌曲音频播放流（可能需要网易云 VIP 或当前无版权）' };
    }

    const streamResp = await fetch(audioUrl);
    if (!streamResp.ok) {
      return { success: false, msg: `音频流拉取失败 (HTTP ${streamResp.status})` };
    }

    const blob = await streamResp.blob();
    const isTrial = blob.size < 1250000 || Boolean(songData.freeTrial);

    const cache = await caches.open(PWA_CACHE_NAME);
    const validResponse = new Response(blob, {
      status: streamResp.status,
      statusText: streamResp.statusText,
      headers: streamResp.headers
    });

    // 🎯 规范化唯一缓存键：统一只存储一份标准 URL (/v3/stream?id=...)，彻底消除重复 Blob 存储
    const canonicalUrl = `/v3/stream?id=${id}`;
    await cache.put(canonicalUrl, validResponse);
    if (audioUrl && audioUrl !== canonicalUrl) {
      await cache.delete(audioUrl).catch(() => {});
    }

    // 写入本地离线曲库元数据供断网渲染与播放器读取
    const metaMap = JSON.parse(localStorage.getItem(PWA_TRACK_META_KEY) || '{}');
    const sName = songData.name || track.name || '未知歌曲';
    const sArtist = songData.ar_name || track.artist || '未知歌手';
    const sCover = songData.al_pic_url || track.cover || '/favicon.png';
    const sAlbum = songData.al_name || track.album || '';

    const meta = {
      id,
      songName: sName,
      artist: sArtist,
      cover: sCover,
      album: sAlbum,
      fileSize: blob.size,
      time: Date.now()
    };
    metaMap[canonicalUrl] = meta;
    if (audioUrl && audioUrl !== canonicalUrl) {
      delete metaMap[audioUrl];
    }
    localStorage.setItem(PWA_TRACK_META_KEY, JSON.stringify(metaMap));

    // 派发全局缓存变更事件，通知离线曲库列表实时刷新
    window.dispatchEvent(new CustomEvent('wyyyy:browser-cache-updated', { detail: { id, meta } }));

    if (isTrial) {
      return { success: true, isTrial: true, msg: `已缓存《${sName}》(⚠️ 提示: 此曲为 VIP 试听片段)` };
    }
    return { success: true, msg: `已成功离线缓存《${sName}》，断网可直接秒播！` };
  } catch (e: any) {
    return { success: false, msg: '离线缓存异常: ' + (e.message || e) };
  }
}
