import type { Track } from '../types';
import { t } from '../i18n';
import { playerStore } from './playerStore.svelte';
import { PWA_CACHE_NAME } from '../library/pwaCache.svelte';
import { isTrackUrlExpired, resolveTrackUrl } from './playerHelper';
import {
  MIN_VALID_AUDIO_BYTES,
  MIN_FULL_TRACK_BYTES,
  getTrackPreloadKey,
  NextTrackPrecacheController
} from 'pwa-audio-player';

export { MIN_VALID_AUDIO_BYTES, MIN_FULL_TRACK_BYTES, getTrackPreloadKey };

const corePrecacheController = new NextTrackPrecacheController({
  cacheName: PWA_CACHE_NAME,
  eventName: 'wyy:browser-cache-updated',
  minValidBytes: MIN_VALID_AUDIO_BYTES,
  minFullTrackBytes: MIN_FULL_TRACK_BYTES,
  minCachedBlobBytes: 250_000,
  isLocalUrl: (url) => url.startsWith('/v3/stream') && !url.includes('/v3/stream/online'),
  buildProxyUrl: (rawUrl) => `/v3/stream/online?url=${encodeURIComponent(rawUrl)}`,
  cacheKeyForTrack: (candidate, targetUrl) =>
    candidate.id != null && candidate.id !== '' ? `/v3/stream?id=${String(candidate.id)}` : targetUrl
});

export function getPreloadedTrackBlobUrl(track: Track | null | undefined): string | null {
  return corePrecacheController.getPreloadedBlobUrl(track);
}

export function isPreloadedBlobUrlForTrack(audioSrc: string, track: Track | null | undefined): boolean {
  return corePrecacheController.isPreloadedBlobUrlForTrack(audioSrc, track);
}

export function clearPreloadedTrackBlob(): void {
  corePrecacheController.clear();
}

/**
 * 趁当前曲目播放期间静默预拉取下一首音频真实字节并检验体积、写入 CacheStorage，
 * 并在内存准备零网络延迟的 blob: URL；若真实流失效或实测仅试听短音频则回调继续链式顺延。
 * 核心双槽位防撤销与字节验证逻辑已下沉至 pwa-audio-player NextTrackPrecacheController。
 */
export async function precacheCandidateAudio(
  candidate: Track,
  onInvalidOrFailed: (reason: 'trial' | 'unplayable') => void
): Promise<boolean> {
  return corePrecacheController.precacheCandidateAudio(
    candidate,
    (reason) => {
      if (reason === 'unplayable' && candidate && !candidate.isLocal) {
        candidate.unplayableReason = t('player.audioStreamFailed');
      }
      onInvalidOrFailed(reason);
    },
    { skipTrial: playerStore.autoSkipTrial }
  );
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
