import { api } from './api';
import { t } from './i18n';
import { isSongCached } from './library/pwaCache.svelte';

export type RevealResult = {
  path: string;
  msg: string;
  songId?: string | number | null;
  songName?: string;
  isServer?: boolean;
  isPhone?: boolean;
};

export async function executeReveal(item: any): Promise<RevealResult> {
  const rawPath = item.path || item.filePath || '';
  const isOnlineUrl = rawPath.startsWith('http://') || rawPath.startsWith('https://') || rawPath.startsWith('/v3/stream');
  const cleanPath = isOnlineUrl ? '' : rawPath;
  const songId = item.songId || item.id;
  const songName = item.name || item.songName || '';
  const artist = item.artist || item.ar_name || '';

  // 1. 尝试向后端请求定位物理文件
  try {
    const j = await api.reveal({
      id: songId,
      name: songName,
      artist: artist,
      path: cleanPath,
      taskId: item.taskId
    });

    if (j?.code === '000000' && j.data) {
      return {
        path: j.data,
        msg: t('reveal.successMsg'),
        songId,
        songName,
        isServer: true,
        isPhone: Boolean(item.isPhone)
      };
    }
  } catch {
    // 后端定位物理文件失败，继续探查浏览器缓存
  }

  // 2. 检查是否在浏览器离线缓存中（支持纯手机/浏览器离线缓存曲目打开定位 Modal）
  const cachedInBrowser = songId ? await isSongCached(songId) : false;
  if (item.isPhone || cachedInBrowser) {
    return {
      path: '',
      msg: t('reveal.browserOnlyNotice'),
      songId,
      songName,
      isServer: false,
      isPhone: true
    };
  }

  throw new Error(t('reveal.notFoundMsg'));
}

