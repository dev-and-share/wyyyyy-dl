import { proxyRequest } from './http';
import type { IMusicFreePlugin, IMusicFreeTrack, IMusicFreeMediaSource } from '../types';

function parseKuwoJson(text: any): any {
  if (text && typeof text === 'object') return text;
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    try {
      const fixed = text.replace(/'/g, '"');
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

/**
 * 🎵 酷我音乐官方原生插件 (Kuwo Official Native Plugin)
 * 100% 直连酷我 AntiServer 与官方接口，支持高保真 MP3/无损流直链
 */
export const kuwoPlugin: IMusicFreePlugin = {
  platform: '酷我音乐 (官方)',
  version: '1.0.0',
  author: 'wyyyyy-dl 官方',
  srcUrl: 'http://www.kuwo.cn/',
  supportedSearchType: ['music'],

  async search(query: string, page = 1, type = 'music') {
    if (type !== 'music') return { isEnd: true, data: [] };
    const url = `http://search.kuwo.cn/r.s?all=${encodeURIComponent(query)}&ft=music&itemset=web_2013&client=kt&pn=${page - 1}&rn=20&rformat=json&encoding=utf8`;
    const res = await proxyRequest<any>(url);
    const parsed = parseKuwoJson(res);
    const list = parsed?.abslist || [];
    const total = parseInt(parsed?.TOTAL || '0', 10);

    const data: IMusicFreeTrack[] = list.map((item: any) => {
      const rid = item.DC_TARGETID || (item.MUSICRID ? String(item.MUSICRID).replace('MUSIC_', '') : '');
      return {
        id: rid,
        title: item.SONGNAME || item.NAME || '未知歌曲',
        artist: item.ARTIST || '未知歌手',
        album: item.ALBUM || '',
        duration: parseInt(item.DURATION || '0', 10) * 1000,
        artwork: item.web_albumpic_short ? `https://img4.kuwo.cn/star/albumcover/${item.web_albumpic_short}` : '',
        raw: item
      };
    });

    return {
      isEnd: page * 20 >= total,
      data
    };
  },

  async getMediaSource(track: any): Promise<IMusicFreeMediaSource> {
    const raw = track.raw || track;
    const rid = raw.DC_TARGETID || (raw.MUSICRID ? String(raw.MUSICRID).replace('MUSIC_', '') : '') || raw.id || track.id;
    if (!rid) {
      throw new Error('[酷我音乐] 缺少歌曲 ID');
    }

    const url = `http://antiserver.kuwo.cn/anti.s?type=convert_url3&rid=${rid}&format=mp3&response=url`;
    const res = await proxyRequest<any>(url);
    const playUrl = res?.url;

    if (!playUrl || !playUrl.startsWith('http')) {
      throw new Error('[酷我音乐] 官方接口未返回有效音频直链');
    }

    return {
      url: playUrl,
      headers: {
        referer: 'http://www.kuwo.cn/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) wyyyyy-dl'
      }
    };
  },

  async getTopLists() {
    const charts = [
      { id: '16', title: '酷我热歌榜', coverImg: 'http://img1.kuwo.cn/star/mboxAlbum/BangPic/small/au_16_30.jpg', description: '整合酷我人气最旺好听单曲' },
      { id: '17', title: '酷我新歌榜', coverImg: 'http://img1.kuwo.cn/star/mboxAlbum/BangPic/small/au_17_30.jpg', description: '最新潮流好歌第一时间掌握' },
      { id: '93', title: '酷我飙升榜', coverImg: 'http://img1.kuwo.cn/star/mboxAlbum/BangPic/small/au_93_30.jpg', description: '播放量飙升最快的热门单曲' },
      { id: '158', title: '抖音热歌榜', coverImg: 'http://img1.kuwo.cn/star/mboxAlbum/BangPic/small/au_158_30.jpg', description: '全网爆款抖音神曲集锦' }
    ];

    return [
      {
        title: '酷我官方排行榜',
        data: charts
      }
    ];
  },

  async getTopListDetail(topListItem: any) {
    const bangId = topListItem.id || '16';
    const url = `http://kbangserver.kuwo.cn/ksong.s?from=pc&fmt=json&type=bang&data=content&id=${bangId}&pn=0&rn=50`;
    const res = await proxyRequest<any>(url);
    const parsed = parseKuwoJson(res);
    const list = parsed?.musiclist || [];

    const musicList: IMusicFreeTrack[] = list.map((item: any) => ({
      id: item.id,
      title: item.name || '未知歌曲',
      artist: item.artist || '未知歌手',
      album: item.album || '',
      artwork: item.pic || '',
      raw: item
    }));

    return {
      ...topListItem,
      musicList
    };
  },

  async getLyric(track: any) {
    const raw = track.raw || track;
    const rid = raw.DC_TARGETID || raw.id || track.id;
    try {
      const url = `http://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${rid}`;
      const res = await proxyRequest<any>(url);
      const lrcList = res?.data?.lrclist;
      if (Array.isArray(lrcList)) {
        const rawLrc = lrcList.map((l: any) => `[${formatLrcTime(l.time)}]${l.lineLyric}`).join('\n');
        return { rawLrc };
      }
    } catch {}
    return {};
  }
};

function formatLrcTime(secStr: string | number): string {
  const total = parseFloat(String(secStr)) || 0;
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const ms = Math.floor((total % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}
