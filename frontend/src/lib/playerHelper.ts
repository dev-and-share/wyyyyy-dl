import { api } from './api';
import type { Track } from './types';

/**
 * Resolve high quality URL, cover, and lyric for a track
 */
export async function resolveTrackUrl(track: Track): Promise<string> {
  if (track.id && (!track.cover || track.cover === '/favicon.png' || !track.lyric)) {
    // 异步抓取网易云真实高清封面与歌词
    api.songV1(String(track.id), 'lossless').then((j: any) => {
      const song = j?.data;
      if (song) {
        const newPic = song.pic || song.picUrl || song.al?.picUrl || song.cover;
        if (newPic) track.cover = newPic;
        if (song.lyric && !track.lyric) track.lyric = song.lyric;
      }
    }).catch(() => {});
  }
  if (track.url && track.url.includes('/stream')) return track.url;
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
