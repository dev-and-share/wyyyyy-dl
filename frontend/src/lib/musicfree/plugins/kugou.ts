import { proxyRequest } from './http';
import type { IMusicFreePlugin, IMusicFreeTrack, IMusicFreeMediaSource } from '../types';

function decodeBase64ToUtf8(base64Str: string): string {
  try {
    const binStr = typeof atob !== 'undefined' ? atob(base64Str) : Buffer.from(base64Str, 'base64').toString('latin1');
    const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0) & 0xff);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    try {
      return Buffer.from(base64Str, 'base64').toString('utf8');
    } catch {
      return '';
    }
  }
}

/**
 * 👑 酷狗音乐私有 VIP/付费状态判定
 */
export function isKugouVip(item: any): boolean {
  if (!item) return false;
  return Boolean(
    (typeof item.privilege === 'number' && item.privilege >= 8) ||
    (typeof item.sqprivilege === 'number' && item.sqprivilege >= 8) ||
    (typeof item['320privilege'] === 'number' && item['320privilege'] >= 8) ||
    (typeof item.highprivilege === 'number' && item.highprivilege >= 8) ||
    (typeof item['128privilege'] === 'number' && item['128privilege'] >= 8) ||
    (typeof item.pay_type === 'number' && item.pay_type > 0) ||
    (typeof item.pay_type_sq === 'number' && item.pay_type_sq > 0) ||
    (typeof item.pay_type_320 === 'number' && item.pay_type_320 > 0) ||
    item.fail_process === 4 ||
    item.fail_process === 12 ||
    item.fail_process_320 === 4 ||
    item.fail_process_sq === 4 ||
    (typeof item.pkg_price === 'number' && item.pkg_price > 0) ||
    (typeof item.pkg_price_sq === 'number' && item.pkg_price_sq > 0) ||
    (typeof item.pkg_price_320 === 'number' && item.pkg_price_320 > 0) ||
    (typeof item.price === 'number' && item.price > 0) ||
    (typeof item.price_sq === 'number' && item.price_sq > 0) ||
    (typeof item.price_320 === 'number' && item.price_320 > 0) ||
    item.old_cpy === 1 ||
    item.feetype > 0 ||
    item.error === '需要付费'
  );
}

/**
 * 🐕 酷狗音乐官方原生插件 (Kugou Official Native Plugin)
 * 100% 直连酷狗官方 CDN 与接口，无需任何第三方中转，支持搜索、官方排行榜与全音质直链
 */
export const kugouPlugin: IMusicFreePlugin = {
  platform: '酷狗音乐 (官方)',
  version: '1.0.0',
  author: 'WYY 官方',
  srcUrl: 'https://www.kugou.com/',
  supportedSearchType: ['music'],

  isVip(trackOrItem: any): boolean {
    return isKugouVip(trackOrItem?.raw || trackOrItem);
  },

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
        isVip: isKugouVip(item),
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
      if (data?.error === '需要付费' || data?.privilege === 10 || data?.pay_type > 0) {
        throw new Error('版权付费/VIP歌曲');
      }
      throw new Error('[酷狗音乐] 官方接口未返回有效音频直链');
    }

    return {
      url: playUrl,
      headers: {
        referer: 'https://www.kugou.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WYY'
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
        isVip: isKugouVip(item),
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
          const decoded = decodeBase64ToUtf8(lrcRes.content);
          return { rawLrc: decoded };
        }
      }
    } catch {}
    return {};
  },

  async getRecommendSheetTags() {
    const pinned = [
      { id: '热门', title: '热门精选' },
      { id: '流行', title: '流行' },
      { id: '抖音', title: '热歌爆款' },
      { id: '治愈', title: '治愈放松' },
      { id: '车载', title: '车载重低音' },
      { id: '经典', title: '华语经典' },
      { id: '民谣', title: '民谣' },
      { id: '摇滚', title: '摇滚' },
      { id: '古风', title: '国风古典' },
      { id: '电音', title: '潮流电音' }
    ];
    return {
      pinned,
      data: [
        {
          title: '精选主题',
          data: pinned
        }
      ]
    };
  },

  async getRecommendSheetsByTag(tag: any, page = 1) {
    const pageSize = 20;
    const keyword = (tag?.id || tag?.title || '热门').replace('全部', '热门');
    const url = `http://mobilecdn.kugou.com/api/v3/search/special?format=json&keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${pageSize}&showtype=1`;
    const res = await proxyRequest<any>(url);
    const info = res?.data?.info || [];
    const total = res?.data?.total || 0;

    const sheets = info.map((item: any) => ({
      id: String(item.specialid),
      title: item.specialname,
      artwork: (item.imgurl || '').replace('{size}', '400'),
      description: item.intro || item.specialname,
      playCount: item.playcount || 0,
      artist: item.nickname || '酷狗音乐官方'
    }));

    return {
      isEnd: page * pageSize >= total,
      data: sheets
    };
  },

  async getMusicSheetInfo(sheet: any, page = 1) {
    const specialId = sheet.id || sheet.specialid;
    const url = `http://mobilecdn.kugou.com/api/v3/special/song?specialid=${specialId}&page=${page}&pagesize=50&plat=0&version=9108`;
    const res = await proxyRequest<any>(url, { timeout: 10000 });
    const list = res?.data?.info || [];

    const musicList: IMusicFreeTrack[] = list.map((item: any) => {
      let singer = item.author_name || (item.authors && item.authors[0]?.author_name) || '';
      let songTitle = item.songname || '';
      if (!songTitle && item.filename) {
        const parts = item.filename.split(' - ');
        if (parts.length > 1) {
          singer = singer || parts[0].trim();
          songTitle = parts.slice(1).join(' - ').trim();
        } else {
          songTitle = item.filename;
        }
      }
      const hash = item.hash || item.sqhash;
      return {
        id: hash,
        title: songTitle || '未知曲目',
        artist: singer || '未知歌手',
        album: item.album_name || '',
        duration: item.duration ? item.duration * 1000 : 0,
        artwork: item.album_img || sheet.artwork || '',
        isVip: isKugouVip(item),
        raw: item
      };
    });

    return {
      ...sheet,
      isEnd: true,
      musicList
    };
  }
};
