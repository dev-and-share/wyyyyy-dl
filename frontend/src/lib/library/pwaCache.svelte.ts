import { api } from '../api';
import { t } from '../i18n';
import { AudioCacheStorage } from 'pwa-audio-player';

export const PWA_CACHE_NAME = 'netease-music-audio-v1';
export const PWA_TRACK_META_KEY = 'pwa_cached_tracks_meta_v1';
export const PWA_AUTO_CACHE_KEY = 'wyy_auto_cache_while_listening';
export const PWA_SONG_PLAY_COUNTS_KEY = 'wyy_song_play_counts';

export const audioCacheStorage = new AudioCacheStorage({
  cacheName: PWA_CACHE_NAME,
  metaStorageKey: PWA_TRACK_META_KEY,
  playCountsStorageKey: PWA_SONG_PLAY_COUNTS_KEY
});

/**
 * 获取边听边存开关配置（默认开启）
 */
export function isAutoCacheEnabled(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return true;
  return localStorage.getItem(PWA_AUTO_CACHE_KEY) !== 'false';
}

/**
 * 全局响应式状态：边听边存开关状态
 */
export const autoCacheState = $state({
  enabled: isAutoCacheEnabled()
});

/**
 * 设置边听边存开关
 */
export function setAutoCacheEnabled(val: boolean) {
  autoCacheState.enabled = val;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PWA_AUTO_CACHE_KEY, String(val));
  }
}

/**
 * 获取指定歌曲的累计播放次数
 */
export function getSongPlayCount(idOrKey: string | number): number {
  return audioCacheStorage.getPlayCount(idOrKey);
}

/**
 * 记录并增加歌曲的播放次数
 */
export function recordSongPlay(idOrKey: string | number): number {
  const count = audioCacheStorage.recordPlayCount(idOrKey);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('wyy:song-play-updated', {
        detail: { id: String(idOrKey), playCount: count }
      })
    );
  }
  return count;
}

/**
 * 从本地存储加载所有已缓存歌曲的 ID 集合
 */
export function loadCachedSongIds(): Set<string | number> {
  const ids = audioCacheStorage.getCachedIds();
  const set = new Set<string | number>();
  for (const id of ids) {
    const num = Number(id);
    if (!isNaN(num) && num > 0) {
      set.add(num);
    }
    set.add(String(id));
  }
  return set;
}

/**
 * 全局响应式状态：手机本地/浏览器离线已缓存的歌曲 ID 集合
 */
export const cachedSongIdSet = $state<Set<string | number>>(loadCachedSongIds());

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
  window.addEventListener('wyy:browser-cache-updated', ((e: CustomEvent) => {
    const id = e?.detail?.id;
    if (id != null) {
      const num = Number(id);
      if (!isNaN(num) && num > 0 && !String(id).startsWith('mf_') && !String(id).startsWith('ext_')) {
        cachedSongIdSet.add(num);
      }
      cachedSongIdSet.add(String(id));
    } else {
      refreshCachedSongIds();
    }
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'REFRESH_AUDIO_CACHE' });
    }
  }) as EventListener);
}

/**
 * 检查指定歌曲 ID 是否已在浏览器离线 Cache 中
 */
export async function isSongCached(id: string | number): Promise<boolean> {
  const num = Number(id);
  const str = String(id).trim();
  if (!isNaN(num) && num > 0 && cachedSongIdSet.has(num)) return true;
  if (str && cachedSongIdSet.has(str)) return true;
  return audioCacheStorage.isCached(id);
}

/**
 * 将指定单曲完整下载并缓存到浏览器 PWA Cache (支持断网纯离线秒播)
 */
export async function cacheTrackToBrowser(
  track: {
    id: string | number;
    name: string;
    artist?: string;
    cover?: string;
    album?: string;
    url?: string;
    freeTrial?: boolean;
  },
  options?: { skipTrial?: boolean; silent?: boolean }
): Promise<{ success: boolean; msg: string; isTrial?: boolean }> {
  // 1. Skip trial if configured
  if (options?.skipTrial && track.freeTrial === true) {
    return { success: false, isTrial: true, msg: t('cache.vipTrialSkip') };
  }

  if (typeof window === 'undefined' || !('caches' in window)) {
    return { success: false, msg: t('cache.unsupportedEnv') };
  }

  const id = String(track.id);
  try {
    let audioUrl = track.url;
    let songData: any = {};

    if (!audioUrl || !audioUrl.includes('/stream')) {
      if (id.startsWith('mf_') || (track as any)._isMusicFree) {
        const { resolveTrackUrl } = await import('../player/playerHelper');
        const resolved = await resolveTrackUrl(track as any);
        if (resolved) audioUrl = resolved;
      } else {
        const resp = await api.songV1(id, 'lossless');
        audioUrl = resp?.data?.url || audioUrl;
        songData = resp?.data || {};

        if (!audioUrl) {
          // trigger fallback download
          await api.downloadSingle(id).catch(() => {});
          const retry = await api.songV1(id, 'lossless');
          audioUrl = retry?.data?.url;
          songData = retry?.data || {};
        }
      }
    }

    if (!audioUrl) {
      return { success: false, msg: t('cache.cannotGetAudioStream') };
    }

    let streamResp: Response;
    try {
      streamResp = await fetch(audioUrl);
      if (!streamResp.ok) {
        throw new Error(`HTTP ${streamResp.status}`);
      }
    } catch {
      // 跨域或直连失败，自动回退走后端流代理
      const proxyUrl = `/v3/stream/online?url=${encodeURIComponent(audioUrl)}`;
      streamResp = await fetch(proxyUrl);
    }

    if (!streamResp.ok) {
      return { success: false, msg: t('cache.streamFetchFailed', { status: streamResp.status }) };
    }

    const blob = await streamResp.blob();
    const isTrial = blob.size < 1250000 || Boolean(songData.freeTrial) || Boolean(track.freeTrial);

    if (options?.skipTrial && isTrial) {
      return { success: false, isTrial: true, msg: t('cache.detectedTrialSkip') };
    }

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
    const sName = songData.name || track.name || t('common.unknownSong');
    const sArtist = songData.ar_name || track.artist || t('common.unknownArtist');
    const sCover = songData.al_pic_url || track.cover || '/favicon.png';
    const sAlbum = songData.al_name || track.album || '';
    const currentPlayCount = getSongPlayCount(id);

    const meta = {
      id,
      songName: sName,
      artist: sArtist,
      cover: sCover,
      album: sAlbum,
      fileSize: blob.size,
      time: Date.now(),
      playCount: currentPlayCount
    };
    metaMap[canonicalUrl] = meta;
    if (audioUrl && audioUrl !== canonicalUrl) {
      delete metaMap[audioUrl];
    }
    localStorage.setItem(PWA_TRACK_META_KEY, JSON.stringify(metaMap));

    // Dispatch global event to notify offline track list
    window.dispatchEvent(new CustomEvent('wyy:browser-cache-updated', { detail: { id, meta } }));

    if (isTrial) {
      return { success: true, isTrial: true, msg: t('cache.cachedTrialNotice', { name: sName }) };
    }
    return { success: true, msg: t('cache.cachedSuccessOfflineReady', { name: sName }) };
  } catch (e: any) {
    return { success: false, msg: t('cache.cacheException', { error: e.message || e }) };
  }
}

// ---------- 边听边存播放监听状态机 ----------
let currentPlayingTrackId: string | number | null = null;
let autoCacheTimer: any = null;

let activeBlobUrl: string | null = null;

/**
 * 释放当前已创建的离线 Blob URL 内存
 */
export function revokeActiveBlobUrl() {
  if (activeBlobUrl) {
    try {
      URL.revokeObjectURL(activeBlobUrl);
    } catch {}
    activeBlobUrl = null;
  }
}

/**
 * 从浏览器 Cache Storage 直接提取已缓存音频并生成本地零网络 Blob URL 秒播
 */
export async function getCachedAudioBlobUrl(idOrUrl: string | number): Promise<string | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await caches.open(PWA_CACHE_NAME);
    const id = String(idOrUrl);
    const canonicalUrl = `/v3/stream?id=${id}`;
    let match = await cache.match(canonicalUrl);
    if (!match && typeof idOrUrl === 'string' && idOrUrl.includes('/stream')) {
      match = await cache.match(idOrUrl);
    }
    if (match) {
      const blob = await match.blob();
      if (blob && blob.size > 0) {
        revokeActiveBlobUrl();
        activeBlobUrl = URL.createObjectURL(blob);
        return activeBlobUrl;
      }
    }
  } catch (err) {
    console.warn('[PWA] Failed to extract offline audio blob url:', err);
  }
  return null;
}

/**
 * 重置当前播放歌曲标记（在切歌、播放列表清空或播放结束时调用）
 */
export function resetTrackPlayback() {
  currentPlayingTrackId = null;
  revokeActiveBlobUrl();
  if (autoCacheTimer) {
    clearTimeout(autoCacheTimer);
    autoCacheTimer = null;
  }
}

/**
 * 监听曲目开始播放：记录播放次数，并在非试听曲目正常持续播放 2.5 秒后静默触发边听边存
 */
export function handleTrackPlayback(track: any, isStillPlaying?: () => boolean) {
  if (!track || !track.id) return;
  const songId = String(track.id);
  if (currentPlayingTrackId === songId) return;
  currentPlayingTrackId = songId;

  // 1. 累加并记录播放次数
  recordSongPlay(songId);

  // 2. 边听边存调度
  if (autoCacheTimer) {
    clearTimeout(autoCacheTimer);
    autoCacheTimer = null;
  }

  if (!autoCacheState.enabled) return;
  if (track.freeTrial === true) return;
  if (cachedSongIdSet.has(Number(songId))) return;

  autoCacheTimer = setTimeout(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (isStillPlaying && !isStillPlaying()) return;
    if (currentPlayingTrackId !== songId) return;
    if (track.freeTrial === true) return;
    if (cachedSongIdSet.has(Number(songId))) return;

    try {
      await cacheTrackToBrowser(track, { skipTrial: true, silent: true });
    } catch (err) {
      console.warn('[AutoCache] Failed to auto cache track:', err);
    }
  }, 2500);
}
