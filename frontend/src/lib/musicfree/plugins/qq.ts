import { proxyRequest } from './http';
import type { IMusicFreePlugin, IMusicFreeTrack, IMusicFreeMediaSource } from '../types';

/**
 * 🐧 QQ 音乐官方原生插件 (QQ Music Official Native Plugin)
 * 100% 直连腾讯官方 u.y.qq.com 与 CDN 接口，本地组织官方 CgiGetVkey 协议
 */
export const qqPlugin: IMusicFreePlugin = {
  platform: 'QQ音乐 (官方)',
  version: '1.0.0',
  author: 'wyyyyy-dl 官方',
  srcUrl: 'https://y.qq.com/',
  supportedSearchType: ['music'],

  async search(query: string, page = 1, type = 'music') {
    if (type !== 'music') return { isEnd: true, data: [] };
    const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=${page}&n=20&w=${encodeURIComponent(query)}&format=json`;
    const res = await proxyRequest<any>(url, {
      headers: { Referer: 'https://y.qq.com/' }
    });

    const songData = res?.data?.song;
    const list = songData?.list || [];
    const total = songData?.totalnum || 0;

    const data: IMusicFreeTrack[] = list.map((item: any) => {
      const singer = (item.singer || []).map((s: any) => s.name).join(' / ') || '未知歌手';
      const songmid = item.songmid || item.mid;
      const albummid = item.albummid || item.album?.mid;
      return {
        id: songmid,
        title: item.songname || item.name || '未知歌曲',
        artist: singer,
        album: item.albumname || item.album?.name || '',
        duration: item.interval ? item.interval * 1000 : 0,
        artwork: albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg` : '',
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
    const songmid = raw.songmid || raw.mid || track.id;
    if (!songmid) {
      throw new Error('[QQ音乐] 缺少 songmid 标识');
    }

    const payload = {
      req_1: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param: {
          guid: '10000',
          songmid: [songmid],
          songtype: [0],
          uin: '0',
          loginflag: 1,
          platform: '20'
        }
      },
      comm: {
        uin: '0',
        format: 'json',
        ct: 24,
        cv: 0
      }
    };

    const res = await proxyRequest<any>('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST',
      data: payload,
      headers: {
        Referer: 'https://y.qq.com/',
        Origin: 'https://y.qq.com'
      }
    });

    const reqData = res?.req_1?.data;
    const midUrlInfo = reqData?.midurlinfo?.[0];
    const sip = reqData?.sip?.[0] || 'http://ws.stream.qqmusic.qq.com/';
    const purl = midUrlInfo?.purl;

    if (!purl) {
      throw new Error('[QQ音乐] 官方接口未返回音频流地址 (可能为 VIP 限制)');
    }

    const playUrl = purl.startsWith('http') ? purl : `${sip}${purl}`;

    return {
      url: playUrl,
      headers: {
        referer: 'https://y.qq.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) wyyyyy-dl'
      }
    };
  },

  async getTopLists() {
    const charts = [
      { id: '26', title: '热歌榜', coverImg: 'https://y.gtimg.cn/music/photo_new/T003R300x300M000000GiuSS1qZtNW.jpg', description: 'QQ音乐站内播放热度前300首' },
      { id: '27', title: '新歌榜', coverImg: 'https://y.gtimg.cn/music/photo_new/T003R300x300M000002qvL5n3e0q1v.jpg', description: '最新潮流好歌第一时间掌握' },
      { id: '62', title: '飙升榜', coverImg: 'https://y.gtimg.cn/music/photo_new/T003R300x300M000001ZkW4N2bhJu1.jpg', description: '播放量飙升最快的热门单曲' },
      { id: '4', title: '流行指数榜', coverImg: 'https://y.gtimg.cn/music/photo_new/T003R300x300M000002Ntkwo0ffupY.jpg', description: '全网当红单曲综合指数排行' }
    ];

    return [
      {
        title: 'QQ音乐官方排行榜',
        data: charts
      }
    ];
  },

  async getTopListDetail(topListItem: any) {
    const topId = topListItem.id || '26';
    const url = `https://c.y.qq.com/v8/fcg-bin/fcg_v8_toplist_cp.fcg?topid=${topId}&n=50&page=detail&format=json`;
    const res = await proxyRequest<any>(url, {
      headers: { Referer: 'https://y.qq.com/' }
    });

    const list = res?.songlist || [];
    const musicList: IMusicFreeTrack[] = list.map((item: any) => {
      const data = item.data || item;
      const singer = (data.singer || []).map((s: any) => s.name).join(' / ') || '未知歌手';
      const songmid = data.songmid || data.mid;
      const albummid = data.albummid || data.album?.mid;
      return {
        id: songmid,
        title: data.songname || data.name || '未知歌曲',
        artist: singer,
        album: data.albumname || data.album?.name || '',
        duration: data.interval ? data.interval * 1000 : 0,
        artwork: albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg` : '',
        raw: data
      };
    });

    return {
      ...topListItem,
      musicList
    };
  },

  async getLyric() {
    return {};
  }
};
