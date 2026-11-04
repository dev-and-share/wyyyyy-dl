import { proxyRequest } from './http';
import type { IMusicFreePlugin, IMusicFreeTrack, IMusicFreeMediaSource } from '../types';

function parseJsonOrJsonp(raw: any): any {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    const clean = raw.trim().replace(/^(\w+\()|\);?$/g, '');
    try {
      return JSON.parse(clean);
    } catch {}
  }
  return null;
}

/**
 * 🐧 QQ 音乐官方原生插件 (QQ Music Official Native Plugin)
 * 100% 直连腾讯官方 u.y.qq.com 与 CDN 接口，本地组织官方 CgiGetVkey 协议
 */
/**
 * 👑 QQ音乐私有 VIP/付费状态判定
 */
export function isQQVip(item: any): boolean {
  if (!item) return false;
  const pay = item.pay || {};
  const action = item.action || {};
  return Boolean(
    pay.payplay === 1 ||
    pay.paydownload === 1 ||
    pay.payinfo === 1 ||
    pay.paytrackmouth === 1 ||
    action.payplay === 1 ||
    action.pay_play === 1 ||
    item.alertid === 2 ||
    item.result === 104003 ||
    item.isvip === 1 ||
    item.isVip === true ||
    item.vip === true ||
    item.fee === 1
  );
}

export const qqPlugin: IMusicFreePlugin = {
  platform: 'QQ音乐 (官方)',
  version: '1.0.0',
  author: 'wyyyyy-dl 官方',
  srcUrl: 'https://y.qq.com/',
  supportedSearchType: ['music'],

  isVip(trackOrItem: any): boolean {
    return isQQVip(trackOrItem?.raw || trackOrItem);
  },

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
        isVip: isQQVip(item),
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
      if (midUrlInfo?.result === 104003 || raw.pay?.payplay === 1) {
        throw new Error('版权付费/VIP歌曲');
      }
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
        isVip: isQQVip(data),
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
  },

  async getRecommendSheetTags() {
    const url = 'https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_tag_conf.fcg?format=json&inCharset=utf8&outCharset=utf-8';
    const raw = await proxyRequest<any>(url, {
      headers: { Referer: 'https://y.qq.com/' }
    });
    const parsed = parseJsonOrJsonp(raw);
    const categories = parsed?.data?.categories || [];
    const groups = categories.slice(1).map((g: any) => ({
      title: g.categoryGroupName,
      data: (g.items || []).map((item: any) => ({
        id: String(item.categoryId),
        title: item.categoryName
      }))
    }));

    const pinned = [
      { id: '10000000', title: '全部' },
      { id: '3317', title: '官方歌单' },
      { id: '165', title: '华语' },
      { id: '167', title: '流行' },
      { id: '168', title: '摇滚' },
      { id: '166', title: '欧美' },
      { id: '170', title: '民谣' },
      { id: '71', title: '治愈' },
      { id: '76', title: '学习' }
    ];

    return {
      pinned,
      data: groups
    };
  },

  async getRecommendSheetsByTag(tag: any, page = 1) {
    const pageSize = 20;
    const categoryId = tag?.id || '10000000';
    const sin = pageSize * (page - 1);
    const ein = page * pageSize - 1;
    const url = `https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg?inCharset=utf8&outCharset=utf-8&sortId=5&categoryId=${categoryId}&sin=${sin}&ein=${ein}`;

    const raw = await proxyRequest<any>(url, {
      headers: { Referer: 'https://y.qq.com/' }
    });
    const parsed = parseJsonOrJsonp(raw);
    const dataObj = parsed?.data || {};
    const list = dataObj.list || [];
    const total = dataObj.sum || 0;

    const sheets = list.map((item: any) => ({
      id: String(item.dissid),
      title: item.dissname,
      artwork: item.imgurl,
      description: item.introduction,
      playCount: item.listennum,
      artist: item.creator?.name || 'QQ音乐官方'
    }));

    return {
      isEnd: page * pageSize >= total,
      data: sheets
    };
  },

  async getMusicSheetInfo(sheet: any) {
    const dissId = sheet.id || sheet.dissid;
    // 1. 优先调用 QQ 音乐官方现代化 Web 歌单接口 (支持全网公开歌单，高可用直连)
    const modernUrl = `https://c.y.qq.com/v8/fcg-bin/fcg_v8_playlist_cp.fcg?id=${dissId}&format=json&newsong=1&platform=yqq`;
    let raw = await proxyRequest<any>(modernUrl, {
      headers: { Referer: 'https://y.qq.com/' },
      timeout: 10000
    });

    let cd = raw?.data?.cdlist?.[0] || raw?.cdlist?.[0];
    let songlist: any[] = cd?.songlist || [];

    // 2. 兜底尝试备用 QZone 歌单接口 (分页轻量拉取，避免 Broken pipe)
    if (!songlist || songlist.length === 0) {
      const fallbackUrl = `http://i.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&utf8=1&disstid=${dissId}&loginUin=0&song_begin=0&song_num=60`;
      raw = await proxyRequest<any>(fallbackUrl, {
        headers: { Referer: 'https://y.qq.com/n/yqq/playlist', Cookie: 'uin=' },
        timeout: 10000
      });
      const parsed = parseJsonOrJsonp(raw);
      cd = parsed?.cdlist?.[0] || parsed?.data?.cdlist?.[0];
      songlist = cd?.songlist || [];
    }

    const musicList: IMusicFreeTrack[] = songlist.map((item: any) => {
      const singer = (item.singer || []).map((s: any) => s.name).join(' / ') || '未知歌手';
      const songmid = item.mid || item.songmid || (typeof item.id === 'string' ? item.id : '');
      const albumObj = item.album || {};
      const albumName = albumObj.name || albumObj.title || item.albumname || '';
      const albummid = albumObj.mid || item.albummid;
      return {
        id: songmid,
        title: item.title || item.songname || item.name || '未知歌曲',
        artist: singer,
        album: albumName,
        duration: item.interval ? item.interval * 1000 : 0,
        artwork: albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg` : (sheet.artwork || ''),
        isVip: isQQVip(item),
        raw: item
      };
    }).filter((m: any) => m && m.id && m.title);

    return {
      ...sheet,
      title: cd?.dissname || sheet.title || sheet.name,
      coverImg: cd?.logo || sheet.artwork || sheet.coverImg,
      description: cd?.desc || sheet.description,
      isEnd: true,
      musicList
    };
  }
};
