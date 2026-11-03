import { proxyRequest } from './http';
import type { IMusicFreePlugin, IMusicFreeTrack, IMusicFreeMediaSource } from '../types';

/**
 * 🐕 酷狗音乐官方原生插件 (Kugou Official Native Plugin)
 * 100% 直连酷狗官方 CDN 与接口，无需任何第三方中转，支持搜索、官方排行榜与全音质直链
 */
export const kugouPlugin: IMusicFreePlugin = {
  platform: '酷狗音乐 (官方)',
  version: '1.0.0',
  author: 'wyyyyy-dl 官方',
  srcUrl: 'https://www.kugou.com/',
  supportedSearchType: ['music'],

  async search(query: string, page = 1, type = 'music') {
    if (type !== 'music') return { isEnd: true, data: [] };
    const url = `http://mobilecdn.kugou.com/api/v3/search/song?keyword=${encodeURIComponent(query)}&page=${page}&pagesize=20`;
    const res = await proxyRequest<any>(url);
    const list = res?.data?.info || [];
    const total = res?.data?.total || 0;

    const data: IMusicFreeTrack[] = list.map((item: any) => {
      const singer = item.singername || (item.authors && item.authors[0]?.author_name) || '未知歌手';
      const hash = item.hash || item['320hash'] || item.sqhash;
      return {
        id: hash,
        title: item.songname || item.filename || '未知曲目',
        artist: singer,
        album: item.album_name || '',
        duration: item.duration ? item.duration * 1000 : 0,
        artwork: item.album_img || item.imgUrl || '',
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
    const hash = raw.hash || raw['320hash'] || raw.sqhash || track.id;
    if (!hash) {
      throw new Error('[酷狗音乐] 缺少歌曲 Hash 标识');
    }

    const url = `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;
    const data = await proxyRequest<any>(url);
    const playUrl = data?.url || (data?.backup_url && data.backup_url[0]);

    if (!playUrl) {
      throw new Error('[酷狗音乐] 官方接口未返回有效音频直链');
    }

    return {
      url: playUrl,
      headers: {
        referer: 'https://www.kugou.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) wyyyyy-dl'
      }
    };
  },

  async getTopLists() {
    const url = 'http://mobilecdnbj.kugou.com/api/v3/rank/list?version=9108&plat=0&showtype=2';
    const res = await proxyRequest<any>(url);
    const list = res?.data?.info || [];

    const charts = list.slice(0, 15).map((item: any) => ({
      id: item.rankid,
      title: item.rankname,
      coverImg: (item.banner_9 || item.album_img_9 || '').replace('{size}', '400'),
      description: item.intro || item.rankname
    }));

    return [
      {
        title: '官方精选榜单',
        data: charts
      }
    ];
  },

  async getTopListDetail(topListItem: any) {
    const rankId = topListItem.id || topListItem.rankid;
    const url = `http://mobilecdnbj.kugou.com/api/v3/rank/song?rankid=${rankId}&page=1&pagesize=50&plat=0&version=9108`;
    const res = await proxyRequest<any>(url);
    const list = res?.data?.info || [];

    const musicList: IMusicFreeTrack[] = list.map((item: any) => {
      const singer = item.author_name || (item.authors && item.authors[0]?.author_name) || '未知歌手';
      const hash = item.hash || item.sqhash;
      return {
        id: hash,
        title: item.songname || '未知曲目',
        artist: singer,
        album: item.album_name || '',
        duration: item.duration ? item.duration * 1000 : 0,
        artwork: item.album_img || '',
        raw: item
      };
    });

    return {
      ...topListItem,
      musicList
    };
  },

  async getLyric(track: any) {
    const raw = track.raw || track;
    const title = track.title || track.name;
    const hash = raw.hash || track.id;
    try {
      const searchUrl = `http://krcs.kugou.com/search?ver=1&man=yes&client=mobi&keyword=${encodeURIComponent(title)}&hash=${hash}`;
      const searchRes = await proxyRequest<any>(searchUrl);
      const candidate = searchRes?.candidates?.[0];
      if (candidate && candidate.id && candidate.accesskey) {
        const dlUrl = `http://krcs.kugou.com/download?ver=1&client=mobi&id=${candidate.id}&accesskey=${candidate.accesskey}&fmt=lrc&charset=utf8`;
        const lrcRes = await proxyRequest<any>(dlUrl);
        if (lrcRes?.content) {
          const decoded = typeof atob !== 'undefined' ? atob(lrcRes.content) : Buffer.from(lrcRes.content, 'base64').toString('utf8');
          return { rawLrc: decoded };
        }
      }
    } catch {}
    return {};
  }
};
