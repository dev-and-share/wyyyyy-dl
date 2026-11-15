import type { Track } from '../types';
import { t } from '../i18n';
import { playerStore } from './playerStore.svelte';
import { PWA_CACHE_NAME } from '../library/pwaCache.svelte';
import { isTrackUrlExpired } from './playbackResilience';
import { resolveTrackUrl } from './playerHelper';

/** 有效完整音频流最低字节阈值（200 KB），过滤防盗链 11s 语音提示与损坏空响应 */
export const MIN_VALID_AUDIO_BYTES = 200 * 1024;
/** 试听片段判定阈值（1.25 MB），与 pwaCache.svelte.ts 保持一致 */
export const MIN_FULL_TRACK_BYTES = 1_250_000;
/** 读取本地离线 Cache 时的最小有效字节门槛 */
const MIN_CACHED_BLOB_BYTES = 250_000;

interface PreloadedBlobEntry {
  key: string;
  sourceUrl: string;
  blobUrl: string;
}

let preloadedBlobEntry: PreloadedBlobEntry | null = null;
let retiredPlayingBlobUrl: string | null = null;
let precacheAbortController: AbortController | null = null;

function isBlobUrlStillBoundToAudio(blobUrl: string): boolean {
  if (!blobUrl || typeof document === 'undefined') return false;
  try {
    const audios = document.querySelectorAll('audio');
    for (const a of audios) {
      if (a.src === blobUrl || a.currentSrc === blobUrl) return true;
    }
  } catch {}
  return false;
}

function revokeBlobUrlSafely(blobUrl: string | null | undefined): void {
  if (!blobUrl) return;
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {}
  }
}

function stagePreloadedBlobEntry(key: string, sourceUrl: string, blob: Blob): boolean {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
  const newBlobUrl = URL.createObjectURL(blob);
  const oldEntry = preloadedBlobEntry;
  if (oldEntry && oldEntry.blobUrl !== newBlobUrl) {
    if (isBlobUrlStillBoundToAudio(oldEntry.blobUrl)) {
      if (retiredPlayingBlobUrl && retiredPlayingBlobUrl !== oldEntry.blobUrl && !isBlobUrlStillBoundToAudio(retiredPlayingBlobUrl)) {
        revokeBlobUrlSafely(retiredPlayingBlobUrl);
      }
      retiredPlayingBlobUrl = oldEntry.blobUrl;
    } else {
      revokeBlobUrlSafely(oldEntry.blobUrl);
    }
  }
  preloadedBlobEntry = { key, sourceUrl, blobUrl: newBlobUrl };
  return true;
}

export function getTrackPreloadKey(track: Track | null | undefined): string {
  if (!track) return '';
  if (track.id !== undefined && track.id !== null && track.id !== '') {
    return `id:${String(track.id)}`;
  }
  if (track.filePath) {
    return `path:${track.filePath}`;
  }
  return `meta:${track.name || ''}-${track.artist || ''}`;
}

export function getPreloadedTrackBlobUrl(track: Track | null | undefined): string | null {
  if (!track || !preloadedBlobEntry) return null;
  if (preloadedBlobEntry.key !== getTrackPreloadKey(track)) return null;
  const canonicalUrl = track.id != null && track.id !== '' ? `/v3/stream?id=${String(track.id)}` : '';
  if (track.url && preloadedBlobEntry.sourceUrl !== track.url && track.url !== canonicalUrl) return null;
  return preloadedBlobEntry.blobUrl;
}

export function isPreloadedBlobUrlForTrack(audioSrc: string, track: Track | null | undefined): boolean {
  if (!audioSrc || !audioSrc.startsWith('blob:') || !preloadedBlobEntry) return false;
  return preloadedBlobEntry.blobUrl === audioSrc && preloadedBlobEntry.key === getTrackPreloadKey(track);
}

export function clearPreloadedTrackBlob(): void {
  if (precacheAbortController) {
    try {
      precacheAbortController.abort();
    } catch {}
    precacheAbortController = null;
  }
  if (preloadedBlobEntry) {
    revokeBlobUrlSafely(preloadedBlobEntry.blobUrl);
    preloadedBlobEntry = null;
  }
  if (retiredPlayingBlobUrl) {
    revokeBlobUrlSafely(retiredPlayingBlobUrl);
    retiredPlayingBlobUrl = null;
  }
}

async function tryStageFromCacheStorage(candidate: Track, key: string, targetUrl: string): Promise<boolean> {
  try {
    const cache = await caches.open(PWA_CACHE_NAME);
    const idKey = candidate.id != null && candidate.id !== '' ? `/v3/stream?id=${String(candidate.id)}` : null;
    const match = (idKey ? await cache.match(idKey) : undefined) || (await cache.match(targetUrl));
    if (!match) return false;
    const blob = await match.blob();
    if (blob && blob.size >= MIN_CACHED_BLOB_BYTES) {
      return stagePreloadedBlobEntry(key, targetUrl, blob);
    }
  } catch {}
  return false;
}

/**
 * 趁当前曲目播放期间静默预拉取下一首音频真实字节并检验体积、写入 CacheStorage，
 * 并在内存准备零网络延迟的 blob: URL；若真实流失效或实测仅试听短音频则回调继续链式顺延
 */
export async function precacheCandidateAudio(
  candidate: Track,
  onInvalidOrFailed: (reason: 'trial' | 'unplayable') => void
): Promise<boolean> {
  if (!candidate || !candidate.url) return false;
  if (typeof window === 'undefined' || !('caches' in window) || typeof fetch !== 'function') {
    return true;
  }
  if (candidate.url.startsWith('blob:')) return true;
  if (getPreloadedTrackBlobUrl(candidate)) return true;

  const key = getTrackPreloadKey(candidate);
  const targetUrl = candidate.url;

  if (await tryStageFromCacheStorage(candidate, key, targetUrl)) {
    return true;
  }

  if (precacheAbortController) {
    try {
      precacheAbortController.abort();
    } catch {}
  }
  const controller = new AbortController();
  precacheAbortController = controller;

  try {
    let resp: Response;
    try {
      resp = await fetch(targetUrl, { signal: controller.signal });
      if (!resp.ok && !targetUrl.startsWith('/v3/stream')) {
        throw new Error(`HTTP ${resp.status}`);
      }
    } catch (directErr: any) {
      if (directErr?.name === 'AbortError' || controller.signal.aborted) return false;
      if (targetUrl.startsWith('/v3/stream')) {
        if (!candidate.isLocal) {
          candidate.unplayable = true;
          candidate.unplayableReason = t('player.audioStreamFailed');
          onInvalidOrFailed('unplayable');
        }
        return false;
      }
      resp = await fetch(`/v3/stream/online?url=${encodeURIComponent(targetUrl)}`, { signal: controller.signal });
    }

    if (controller.signal.aborted) return false;
    if (!resp.ok) {
      candidate.unplayable = true;
      candidate.unplayableReason = t('player.audioStreamFailed');
      onInvalidOrFailed('unplayable');
      return false;
    }

    const blob = await resp.blob();
    if (controller.signal.aborted) return false;

    if (blob.size === 0 || (!candidate.isLocal && blob.size < MIN_VALID_AUDIO_BYTES)) {
      candidate.unplayable = true;
      candidate.unplayableReason = t('player.audioStreamFailed');
      onInvalidOrFailed('unplayable');
      return false;
    }

    if (!candidate.isLocal && playerStore.autoSkipTrial && !candidate.allowTrial && blob.size < MIN_FULL_TRACK_BYTES) {
      candidate.freeTrial = true;
      onInvalidOrFailed('trial');
      return false;
    }

    try {
      const cache = await caches.open(PWA_CACHE_NAME);
      const cacheKey = candidate.id != null && candidate.id !== '' ? `/v3/stream?id=${String(candidate.id)}` : targetUrl;
      const headers = typeof Headers !== 'undefined' ? new Headers(resp.headers || undefined) : undefined;
      if (headers && !headers.get('Content-Type')) headers.set('Content-Type', blob.type || 'audio/mpeg');
      await cache.put(cacheKey, new Response(blob, { status: 200, ...(headers ? { headers } : {}) }));
      if (candidate.id != null && candidate.id !== '') {
        window.dispatchEvent(new CustomEvent('wyy:browser-cache-updated', { detail: { id: String(candidate.id) } }));
      }
    } catch {}

    stagePreloadedBlobEntry(key, targetUrl, blob);
    return true;
  } catch (err: any) {
    if (err?.name === 'AbortError' || controller.signal.aborted) return false;
    if (!candidate.isLocal) {
      candidate.unplayable = true;
      candidate.unplayableReason = t('player.audioStreamFailed');
      onInvalidOrFailed('unplayable');
    }
    return false;
  } finally {
    if (precacheAbortController === controller) {
      precacheAbortController = null;
    }
  }
}

export function isCandidateTrackPlayable(track: Track | null | undefined): boolean {
  if (!track) return false;
  if (track.allowTrial && track.unplayable !== true) return true;
  return playerStore.isValidTrack(track);
}

function findNextPreloadIndex(list: Track[], baseIdx: number, fromIdx: number, visited: Set<number>): number {
  if (!list || list.length <= 1) return -1;
  if (visited.size === 0 && playerStore.queue.length > 0) {
    const idx = playerStore.getNextTrackIndex();
    if (idx >= 0 && idx < list.length && idx !== baseIdx && !visited.has(idx)) return idx;
  }
  let attempts = 0;
  let idx = fromIdx;
  while (attempts < list.length) {
    idx = (idx + 1) % list.length;
    attempts++;
    if (idx !== baseIdx && !visited.has(idx) && isCandidateTrackPlayable(list[idx])) return idx;
  }
  return -1;
}

function preloadNextWithChain(
  list: Track[],
  baseIdx: number,
  fromIdx: number,
  playMode: string,
  hopsLeft = 4,
  visited = new Set<number>()
): Track | null {
  if (!list || list.length <= 1 || hopsLeft <= 0 || playMode === 'single') return null;

  const idx = findNextPreloadIndex(list, baseIdx, fromIdx, visited);
  if (idx < 0) return null;
  visited.add(idx);

  const candidate = list[idx];
  if (!candidate) return null;
  if (candidate.url && !candidate.isLocal && isTrackUrlExpired(candidate)) {
    candidate.url = '';
  }

  const triggerChainFallback = () => {
    if (hopsLeft > 1) {
      preloadNextWithChain(list, baseIdx, idx, playMode, hopsLeft - 1, visited);
    }
  };

  if (!candidate.url && !candidate.unplayable) {
    resolveTrackUrl(candidate)
      .then(() => {
        if (!isCandidateTrackPlayable(candidate) || !candidate.url) {
          triggerChainFallback();
          return;
        }
        precacheCandidateAudio(candidate, triggerChainFallback).catch(() => {});
      })
      .catch(() => {});
  } else if (!isCandidateTrackPlayable(candidate) && hopsLeft > 1) {
    return preloadNextWithChain(list, baseIdx, idx, playMode, hopsLeft - 1, visited);
  } else if (candidate.url && isCandidateTrackPlayable(candidate)) {
    precacheCandidateAudio(candidate, triggerChainFallback).catch(() => {});
  }
  return candidate;
}

/**
 * 🚀 静默预解析并预缓存周边曲目：优先将下一首完整音频预下载并校验入库，遇失效/试听自动顺延最多 4 首
 */
export function preloadSurroundingTracks(queue: Track[], curIndex: number, playMode: string): void {
  const activeQueue = playerStore.queue.length > 0 ? playerStore.queue : queue;
  const activeIdx = playerStore.queue.length > 0 ? playerStore.qIndex : curIndex;
  if (!activeQueue || activeQueue.length <= 1) return;

  const nextTrack = preloadNextWithChain(activeQueue, activeIdx, activeIdx, playMode, 4);

  let prevTrack = playerStore.queue.length > 0 ? playerStore.getPrevTrack() : null;
  if (!prevTrack) {
    const prevIdx = (activeIdx - 1 + activeQueue.length) % activeQueue.length;
    prevTrack = activeQueue[prevIdx];
  }
  if (prevTrack && prevTrack !== nextTrack) {
    if (prevTrack.url && !prevTrack.isLocal && isTrackUrlExpired(prevTrack)) {
      prevTrack.url = '';
    }
    if (!prevTrack.url && !prevTrack.unplayable) {
      resolveTrackUrl(prevTrack).catch(() => {});
    }
  }
}

/**
 * 🚀 静默预解析下一首曲目的播放 URL（兼容接口，自动升级为预解析与音频字节预缓存）
 */
export function preloadNextTrack(queue: Track[], curIndex: number, playMode: string): void {
  preloadSurroundingTracks(queue, curIndex, playMode);
}
