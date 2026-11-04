import { api } from './api';
import { getApiCache, setApiCache, extractRawAudioUrl } from './utils';
import { showToast } from './toast.svelte';
import { t } from './i18n';

export const likeState = $state<{
  likedSet: Set<number>;
  likedExtSet: Set<string>;
}>({
  likedSet: new Set<number>(),
  likedExtSet: new Set<string>()
});

/**
 * 判断指定歌曲是否已被收藏（兼容网易云数字 ID 与外部复合字符串 ID / 歌名组合键）
 */
export function isTrackLiked(id: number | string | undefined | null, name?: string, artist?: string): boolean {
  if (id == null) return false;
  const num = Number(id);
  const str = String(id).trim();
  const isNetEaseNum = !isNaN(num) && num > 0 && !str.startsWith('mf_') && !str.startsWith('ext_');
  if (isNetEaseNum && likeState.likedSet.has(num)) return true;
  if (str && likeState.likedExtSet.has(str)) return true;
  if (name && artist) {
    const combo = `${name.trim()}___${artist.trim()}`;
    if (likeState.likedExtSet.has(combo)) return true;
  }
  return false;
}

/**
 * 初始化并拉取用户收藏的红心歌曲列表（网易云云端 + 本地 SQLite 专属红心歌单）
 */
export async function initLikeList(): Promise<void> {
  const cache = getApiCache('liked_song_ids');
  if (cache?.data && Array.isArray(cache.data)) {
    for (const n of cache.data) {
      likeState.likedSet.add(Number(n));
    }
  }

  // 1. 同步网易云官方云端我喜欢的音乐
  try {
    const j = await api.likeList();
    if (j?.code === '000000' && Array.isArray(j.data)) {
      for (const n of j.data) {
        likeState.likedSet.add(Number(n));
      }
      setApiCache('liked_song_ids', j.data);
    }
  } catch {}

  // 2. 同步本地专属「❤️ 本地我喜欢的音乐」SQLite 歌单曲目
  try {
    const localFav = await api.localPlaylistDetail('local_favorites');
    if (localFav?.code === '000000' && Array.isArray(localFav.data?.tracks)) {
      for (const tr of localFav.data.tracks) {
        if (tr.id) likeState.likedExtSet.add(String(tr.id));
        if (tr.name && tr.artist) {
          likeState.likedExtSet.add(`${tr.name.trim()}___${tr.artist.trim()}`);
        }
      }
    }
  } catch {}
}

/**
 * 切换歌曲红心收藏状态（乐观更新 + 失败自动回滚 + Toast 提醒）
 * - 网易云歌曲：同步至网易云云端「我喜欢的音乐」
 * - 外部歌曲：存入 SQLite 本地内置「❤️ 本地我喜欢的音乐」专属歌单，并联动触发后台落盘
 */
export async function toggleLike(id: number | string, name?: string, artist?: string, extra?: any): Promise<void> {
  const strId = String(id || '').trim();
  const numId = Number(id);
  const isNetEaseNum = !isNaN(numId) && numId > 0 && !strId.startsWith('mf_') && !strId.startsWith('ext_');
  const safeName = (name || '').trim();
  const safeArtist = (artist || '').trim();
  const comboKey = safeName && safeArtist ? `${safeName}___${safeArtist}` : '';

  const isLiked = isTrackLiked(id, safeName, safeArtist);

  if (isNetEaseNum) {
    const nextSet = new Set(likeState.likedSet);
    if (isLiked) nextSet.delete(numId);
    else nextSet.add(numId);
    likeState.likedSet = nextSet;
    setApiCache('liked_song_ids', Array.from(nextSet));

    try {
      await api.like(numId, !isLiked);
      showToast(isLiked ? t('toast.like.removed') : t('toast.like.added', { name: safeName }), 'success');
    } catch {
      const rollback = new Set(likeState.likedSet);
      if (!isLiked) rollback.delete(numId);
      else rollback.add(numId);
      likeState.likedSet = rollback;
      showToast(t('toast.like.failed'), 'error');
    }
  } else {
    // 🌟 外部歌曲 / MusicFree 音源：存入本地专属系统歌单 (❤️ 本地我喜欢的音乐)
    const nextExt = new Set(likeState.likedExtSet);
    if (isLiked) {
      if (strId) nextExt.delete(strId);
      if (comboKey) nextExt.delete(comboKey);
    } else {
      if (strId) nextExt.add(strId);
      if (comboKey) nextExt.add(comboKey);
    }
    likeState.likedExtSet = nextExt;

    try {
      if (isLiked) {
        await api.localPlaylistRemoveTrack('local_favorites', strId);
        showToast('已从「❤️ 本地我喜欢的音乐」移除', 'success');
      } else {
        await api.localPlaylistAddTrack('local_favorites', {
          name: safeName || '未知歌曲',
          artist: safeArtist || '未知歌手',
          coverUrl: extra?.cover || extra?.artwork || extra?.picUrl,
          filePath: extra?.filePath
        });
        showToast(`已收藏《${safeName}》到「❤️ 本地我喜欢的音乐」`, 'success');

        // 联动后台下载落盘
        if (extra?.url || extra?.raw) {
          triggerAutoDownloadForLikedTrack(extra, safeName, safeArtist);
        }
      }
    } catch {
      const rollback = new Set(likeState.likedExtSet);
      if (!isLiked) {
        if (strId) rollback.delete(strId);
        if (comboKey) rollback.delete(comboKey);
      } else {
        if (strId) rollback.add(strId);
        if (comboKey) rollback.add(comboKey);
      }
      likeState.likedExtSet = rollback;
      showToast('操作本地收藏失败', 'error');
    }
  }
}

async function triggerAutoDownloadForLikedTrack(extra: any, songName: string, artist: string) {
  try {
    const raw = extra.raw || extra;
    let url = extra.url;
    let headers = extra.headers;
    const pluginId = extra._pluginId || extra.pluginHash || extra.pluginId;
    if (!url && pluginId) {
      const { musicFreeStore } = await import('./musicfree/musicFreeStore.svelte');
      const media = await musicFreeStore.resolveMediaSource(pluginId, raw);
      url = media?.url;
      headers = media?.headers;
    }
    const cleanUrl = extractRawAudioUrl(url);
    if (cleanUrl) {
      await api.downloadCustom({
        id: extra.id,
        name: songName,
        artist,
        album: extra.album,
        url: cleanUrl,
        coverUrl: extra.cover || extra.artwork || extra.picUrl,
        headers
      });
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    }
  } catch {}
}
