import { api } from './api';
import type { Track } from './types';

/**
 * Resolve high quality URL, cover, and lyric for a track in a single optimized request
 */
export async function resolveTrackUrl(track: Track): Promise<string> {
  // 1. 如果已有本地/历史流地址，仅在缺失封面/歌词时静默后台补齐
  if (track.url && track.url.includes('/stream')) {
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

  // 2. 在线歌曲：合并为单次请求，一次性拿齐播放 URL、高清封面与歌词
  if (!track.id) return track.url || '';
  try {
    const j = await api.songV1(String(track.id), 'lossless');
    const song = j?.data;
    if (song) {
      if (song.url) track.url = song.url;
      const newPic = song.pic || song.picUrl || song.al?.picUrl || song.cover;
      if (newPic) track.cover = newPic;
      if (song.lyric && !track.lyric) track.lyric = song.lyric;
      return song.url || track.url || '';
    }
  } catch {}
  return track.url || '';
}
