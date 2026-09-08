import { api } from './api';
import type { Track } from './types';
import { cachedSongIdSet } from './pwaCache.svelte';
import { markSongDownloaded, getTrackSourceStatus } from './trackStatus.svelte';
import { formatArtist, DEFAULT_VINYL_COVER } from './utils';
import { recordPlaylistPlay } from './playlist.svelte';

/**
 * Resolve high quality URL, cover, and lyric for a track in a single optimized request
 */
export async function resolveTrackUrl(track: Track): Promise<string> {
  // 1. 如果已有本地/历史流地址，仅在缺失封面/歌词时静默后台补齐
  if (track.url && track.url.includes('/stream')) {
    track.isLocal = true;
    if (track.id) markSongDownloaded(track.id);
    if (track.id && (!track.cover || track.cover === '/favicon.png' || !track.lyric)) {
      api.songV1(String(track.id), 'lossless').then((j: any) => {
        const song = j?.data;
        if (song) {
          const newPic = song.pic || song.picUrl || song.al?.picUrl || song.cover;
          if (newPic) track.cover = newPic;
          if (song.lyric && !track.lyric) track.lyric = song.lyric;
        }
      }).catch(() => {});
    }
    return track.url;
  }

  // 2. 如果已在手机浏览器离线缓存中，直接使用标准离线流地址秒播 (无需联网)
  if (track.id && cachedSongIdSet.has(Number(track.id))) {
    track.url = `/v3/stream?id=${track.id}`;
    track.isLocal = true;
    return track.url;
  }

  // 3. 在线歌曲：合并为单次请求，一次性拿齐播放 URL、高清封面与歌词
  if (!track.id) return track.url || '';
  try {
    const j = await api.songV1(String(track.id), 'lossless');
    const song = j?.data;
    if (song) {
      if (song.url) track.url = song.url;
      const isServerLocal = song.isLocal === true || (song.url && song.url.includes('/v3/stream'));
      if (isServerLocal) {
        track.isLocal = true;
        markSongDownloaded(track.id);
      }
      track.freeTrial = song.freeTrial === true;
      track.freeTrialDuration = song.freeTrialDuration;
      const newPic = song.pic || song.picUrl || song.al?.picUrl || song.cover;
      if (newPic) track.cover = newPic;
      if (song.lyric && !track.lyric) track.lyric = song.lyric;
      return song.url || track.url || '';
    }
  } catch {}
  return track.url || '';
}

/**
 * 🚀 静默预解析周边曲目（下一首与上一首）的播放 URL
 * 保障 iOS 锁屏、后台与 AirPods 双击/三击切歌零延迟，避免手势上下文过期
 */
export function preloadSurroundingTracks(queue: Track[], curIndex: number, playMode: string) {
  if (!queue || queue.length <= 1) return;

  // 1. 优先预解析下一首（最高频切歌路径）
  const nextIdx = (curIndex + 1) % queue.length;
  const nextTrack = queue[nextIdx];
  if (nextTrack && !nextTrack.url) {
    resolveTrackUrl(nextTrack).catch(() => {});
  }

  // 2. 紧接着预解析上一首（保障锁屏点击「上一首」同样零延迟、手势不断链）
  const prevIdx = (curIndex - 1 + queue.length) % queue.length;
  if (prevIdx !== nextIdx) {
    const prevTrack = queue[prevIdx];
    if (prevTrack && !prevTrack.url) {
      resolveTrackUrl(prevTrack).catch(() => {});
    }
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
  onPlayQueue: (tracks: Track[], idx?: number) => void,
  showToast: (m: string, t?: string, d?: number) => void
) {
  try {
    showToast(`正在载入《${playlistName}》...`, 'info', 1500);
    const res = await api.playlist(playlistId);
    const tracks = res?.data?.playlist?.tracks || res?.data?.tracks || [];
    if (tracks && tracks.length > 0) {
      recordPlaylistPlay(playlistId);
      onPlayQueue(tracks.map((t: any) => ({
        id: t.id,
        name: t.name,
        artist: formatArtist(t),
        cover: t.picUrl || t.al?.picUrl || DEFAULT_VINYL_COVER,
        isLocal: getTrackSourceStatus(t.id, t.isLocal).isLocal
      })), 0);
      showToast(`已开始播放《${playlistName}》(${tracks.length} 首)`, 'success', 2000);
    } else {
      showToast('歌单内暂无曲目', 'warning');
    }
  } catch (e: any) {
    showToast('播放失败: ' + (e?.message || e), 'error');
  }
}


