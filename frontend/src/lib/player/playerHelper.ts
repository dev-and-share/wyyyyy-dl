import { api } from '../api';
import type { Track } from '../types';
import { cachedSongIdSet } from '../library/pwaCache.svelte';
import { markSongDownloaded } from './trackStatus.svelte';
import { taskState } from '../taskStore.svelte';
import { recordPlaylistPlay } from '../playlist.svelte';
import { playerStore, type SetQueueOptions } from './playerStore.svelte';
import { platformAdapter } from '../adapters';
import { showToast } from '../toast.svelte';
import { t } from '../i18n';

/**
 * Resolve high quality URL, cover, and lyric for a track in a single optimized request
 */
export async function resolveTrackUrl(track: Track): Promise<string> {
  // 0. 防御：如果传入的 url 是易失的 blob: URL，一律重置避免跨天失效
  if (track.url && track.url.startsWith('blob:')) {
    track.url = track.id ? `/v3/stream?id=${track.id}` : '';
  }

  // 1. 如果已有本地/历史流地址，保留原完整地址（含 historyId 等参数），仅在缺失封面/歌词时静默后台补齐
  if (track.url && track.url.includes('/stream')) {
    track.isLocal = true;
    if (track.id) markSongDownloaded(track.id);
    if (track.id && (!track.cover || track.cover === '/favicon.png' || !track.lyric)) {
      platformAdapter.resolveTrack(track.id, { name: track.name, artist: track.artist }).then((resolved) => {
        if (resolved.cover) track.cover = resolved.cover;
        if (resolved.lyric && !track.lyric) track.lyric = resolved.lyric;
        if (resolved.url && (resolved.url.includes('path=') || resolved.url.includes('historyId='))) {
          track.url = resolved.url;
        }
      }).catch(() => {});
    }
    return track.url;
  }

  // 1.1 🎯 本地落盘直通秒播：若已知在服务器磁盘中已下载或自身已标记为本地，直接使用本地高可靠流通道秒播
  const isServerDownloaded = track.id ? taskState.downloadedSet.has(Number(track.id)) : false;
  if (track.isLocal || isServerDownloaded) {
    track.isLocal = true;
    track.freeTrial = false;
    track.unplayable = false;
    if (track.id) markSongDownloaded(track.id);
    if (!track.url || !track.url.includes('/stream')) {
      track.url = `/v3/stream?id=${track.id}`;
    }
    if (track.id && (!track.cover || track.cover === '/favicon.png' || !track.lyric)) {
      platformAdapter.resolveTrack(track.id, { name: track.name, artist: track.artist }).then((resolved) => {
        if (resolved.cover) track.cover = resolved.cover;
        if (resolved.lyric && !track.lyric) track.lyric = resolved.lyric;
        if (resolved.url && (resolved.url.includes('path=') || resolved.url.includes('historyId='))) {
          track.url = resolved.url;
        }
      }).catch(() => {});
    }
    return track.url;
  }

  // 2. 断网离线状态下，若已在手机浏览器离线缓存中，直接使用标准离线流地址由 SW 拦截秒播
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (isOffline && track.id && cachedSongIdSet.has(Number(track.id))) {
    track.url = `/v3/stream?id=${track.id}`;
    track.isLocal = true;
    return track.url;
  }

  // 3. 在线歌曲：合并为单次请求，一次性拿齐播放 URL、高清封面与歌词
  if (!track.id) return track.url || '';
  try {
    const resolved = await platformAdapter.resolveTrack(track.id, { name: track.name, artist: track.artist });
    if (!resolved.unplayable && resolved.url) {
      track.url = resolved.url;
      track.unplayable = false;
      if (resolved.isLocal) {
        track.isLocal = true;
        track.freeTrial = false;
        track.unplayable = false;
        markSongDownloaded(track.id);
      } else {
        track.freeTrial = resolved.freeTrial === true;
      }
      track.freeTrialDuration = resolved.freeTrialDuration;
      if (resolved.cover) track.cover = resolved.cover;
      if (resolved.lyric && !track.lyric) track.lyric = resolved.lyric;
      return track.url;
    } else {
      track.unplayable = true;
      track.unplayableReason = resolved.unplayableReason || t('player.getInfoFailed');
    }
  } catch {
    track.unplayable = true;
    track.unplayableReason = t('player.networkFailed');
  }
  return track.url || '';
}

/**
 * 🚀 静默预解析周边曲目（下一首与上一首）的播放 URL
 * 保障 iOS 锁屏、后台与 AirPods 双击/三击切歌零延迟，避免手势上下文过期
 */
export function preloadSurroundingTracks(queue: Track[], curIndex: number, playMode: string) {
  if (!queue || queue.length <= 1) return;

  // 1. 优先从 playerStore 获取经过模式与过滤校验的确定性下一首（WYSIWYG 100% 命中）
  let nextTrack = playerStore.queue.length > 0 ? playerStore.getNextTrack() : null;
  if (!nextTrack) {
    const nextIdx = (curIndex + 1) % queue.length;
    nextTrack = queue[nextIdx];
  }
  if (nextTrack && !nextTrack.url && !nextTrack.unplayable) {
    resolveTrackUrl(nextTrack).catch(() => {});
  }

  // 2. 紧接着预解析确定性上一首（保障锁屏点击「上一首」/ AirPods 三击同样零延迟、手势不断链）
  let prevTrack = playerStore.queue.length > 0 ? playerStore.getPrevTrack() : null;
  if (!prevTrack) {
    const prevIdx = (curIndex - 1 + queue.length) % queue.length;
    prevTrack = queue[prevIdx];
  }
  if (prevTrack && prevTrack !== nextTrack && !prevTrack.url && !prevTrack.unplayable) {
    resolveTrackUrl(prevTrack).catch(() => {});
  }
}

/**
 * 🚀 静默预解析下一首曲目的播放 URL（兼容接口，自动升级为周边双向预热）
 */
export function preloadNextTrack(queue: Track[], curIndex: number, playMode: string) {
  preloadSurroundingTracks(queue, curIndex, playMode);
}

/**
 * 🎵 解析歌单曲目并加入播放队列立即起播
 */
export async function playPlaylistTracks(
  playlistId: string,
  playlistName: string,
  onPlayQueue: (tracks: Track[], optionsOrIdx?: number | SetQueueOptions, maybePlaylistId?: string | number | null) => void,
  showToast: (m: string, t?: string, d?: number) => void
) {
  // 🛡️ 同歌单防误触保护快速通道
  if (
    playerStore.playlistId &&
    String(playerStore.playlistId) === String(playlistId) &&
    playerStore.queue.length > 0
  ) {
    if (playerStore.playing) {
      showToast(t('player.nowPlayingPlaylist', { name: playlistName }), 'info', 1500);
      return;
    } else {
      showToast(t('player.continuePlayingPlaylist', { name: playlistName }), 'info', 1500);
      playerStore.playing = true;
      return;
    }
  }

  try {
    showToast(t('player.loadingPlaylist', { name: playlistName }), 'info', 1500);
    const res = await (platformAdapter.getPlaylist ? platformAdapter.getPlaylist(playlistId) : api.playlist(playlistId));
    const tracks = res?.data?.playlist?.tracks || res?.data?.tracks || [];
    if (tracks && tracks.length > 0) {
      recordPlaylistPlay(playlistId);
      onPlayQueue(tracks.map((t: any) => toPlayerTrack(t)), {
        startIndex: 0,
        playlistId,
        isExplicitTrack: false
      });
      showToast(t('player.startPlayingPlaylistCount', { name: playlistName, count: tracks.length }), 'success', 2000);
    } else {
      showToast(t('player.emptyPlaylistNotice'), 'warning');
    }
  } catch (e: any) {
    showToast(t('player.playFailed') + ': ' + (e?.message || e), 'error');
  }
}

/**
 * Normalize raw metadata into Player Track (delegated to Platform Adapter)
 */
export function toPlayerTrack(item: any, overrides?: Partial<Track>): Track {
  return platformAdapter.normalizeTrack(item, overrides);
}

/**
 * 校验 DOM audio 当前 src 与目标 url 是否指代同一音频源
 */
export function isSameAudioSource(src: string, url: string): boolean {
  if (!src || !url) return false;
  if (src === url) return true;
  try {
    return new URL(src, window.location.href).href === new URL(url, window.location.href).href;
  } catch {
    return src.endsWith(url);
  }
}

/**
 * 延时或等待元数据加载后安全应用音频 seek
 */
export function applySeekToAudio(audioEl: HTMLAudioElement | null, target: number) {
  if (!audioEl || target <= 0) return;
  setTimeout(() => {
    if (!audioEl) return;
    try {
      if (audioEl.duration && !isNaN(audioEl.duration) && isFinite(audioEl.duration)) {
        if (target < audioEl.duration) audioEl.currentTime = target;
      } else {
        const onMeta = () => {
          try { if (audioEl && audioEl.duration && target < audioEl.duration) audioEl.currentTime = target; } catch {}
          audioEl?.removeEventListener('loadedmetadata', onMeta);
        };
        audioEl.addEventListener('loadedmetadata', onMeta);
      }
    } catch {}
  }, 60);
}

/**
 * 将文件夹自定义事件中的原生文件列表转换为标准 Track 数组
 */
export function parseFolderTracks(tracks: any[]): Track[] {
  if (!tracks?.length) return [];
  return tracks.map((item: any, i: number) => ({
    id: item.songId || item.id || `local_${Date.now()}_${i}`,
    name: item.songName || item.name || t('common.unknownTrack'),
    artist: item.artist || t('common.unknownArtist'),
    cover: item.cover || '/favicon.png',
    isLocal: true,
    url: item.url || (item.relativePath ? `/v3/history/stream?path=${encodeURIComponent(item.relativePath)}` : item.filePath ? `/v3/history/stream?path=${encodeURIComponent(item.filePath)}` : item.streamUrl || '')
  }));
}

export interface SkipTrackDecision {
  hasNext: boolean;
  nextCount: number;
}

/**
 * ⏭️ 核心跳歌与选歌逻辑：方案 1 优先自然顺次下一首；连续在线失败达阈值时，方案 2 兜底切换本地已下载曲目
 */
export function computeNextTrackOnSkip(
  failedTrack: Track,
  reason: string,
  currentSkipCount: number,
  isTrial = false
): SkipTrackDecision {
  const nextCount = currentSkipCount + 1;
  const MAX_CONSECUTIVE_SKIPS = 15;
  const ONLINE_FAIL_FALLBACK_THRESHOLD = 3;

  // 🛡️ 方案 2 兜底：若连续跳过在线歌曲达到阈值，且队列中存在本地/电脑已下载歌曲，直接优先切换至本地歌曲
  if (nextCount >= ONLINE_FAIL_FALLBACK_THRESHOLD) {
    const nextLocalIdx = playerStore.getNextLocalTrackIndex();
    if (nextLocalIdx >= 0 && nextLocalIdx !== playerStore.qIndex) {
      showToast(
        isTrial ? t('player.skippedTrialTrack', { name: failedTrack.name }) : t('player.autoPlayNextReason', { name: failedTrack.name, reason }),
        isTrial ? 'info' : 'warning',
        2000
      );
      playerStore.qIndex = nextLocalIdx;
      playerStore.curTime = 0;
      playerStore.save();
      return { hasNext: true, nextCount };
    }
  }

  // 🎯 方案 1 优先：正常获取下一首有效曲目
  const nextIdx = playerStore.getNextTrackIndex();
  if (nextIdx < 0 || nextIdx === playerStore.qIndex || nextCount > MAX_CONSECUTIVE_SKIPS) {
    playerStore.playing = false;
    showToast(isTrial ? t('player.trialNoMoreCompleteTracks', { name: failedTrack.name }) : t('player.noMorePlayableTracks'), 'warning', 2500);
    return { hasNext: false, nextCount: 0 };
  }

  showToast(isTrial ? t('player.skippedTrialTrack', { name: failedTrack.name }) : t('player.autoPlayNextReason', { name: failedTrack.name, reason }), isTrial ? 'info' : 'warning', 2000);
  playerStore.qIndex = nextIdx;
  playerStore.curTime = 0;
  playerStore.save();
  return { hasNext: true, nextCount };
}


