import { api } from './api';
import { getApiCache, setApiCache } from './utils';
import { showToast } from './toast.svelte';
import { t } from './i18n';
import { downloadExternalTrack } from './musicfree/downloadHelper';

export const likeState = $state<{
  likedSet: Set<number>;
  likedExtSet: Set<string>;
}>({
  likedSet: new Set<number>(),
  likedExtSet: new Set<string>()
});

/**
 * 判断指定歌曲是否已被收藏（兼容云端数字 ID 与外部复合字符串 ID / 歌名组合键）
 */
export function isTrackLiked(id: number | string | undefined | null, name?: string, artist?: string): boolean {
  if (id == null && !name) return false;
  const num = Number(id);
  const str = String(id ?? '').trim();
  const isNetEaseNum = !isNaN(num) && num > 0 && !str.startsWith('mf_') && !str.startsWith('ext_');
  if (isNetEaseNum && likeState.likedSet.has(num)) return true;
  if (str && str !== 'NaN' && str !== 'undefined' && str !== 'null' && likeState.likedExtSet.has(str)) return true;
  if (name && artist) {
    const combo = `${name.trim()}___${artist.trim()}`;
    if (likeState.likedExtSet.has(combo)) return true;
  }
  return false;
}

/**
 * 初始化并拉取用户收藏的红心歌曲列表（云端 + 本地 SQLite 专属红心歌单）
 */
export async function initLikeList(): Promise<void> {
  const cache = getApiCache('liked_song_ids');
  if (cache?.data && Array.isArray(cache.data)) {
    for (const n of cache.data) {
      likeState.likedSet.add(Number(n));
    }
  }

  // 1. 同步云端官方我喜欢的音乐
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
        if (tr.historyId) likeState.likedExtSet.add(String(tr.historyId));
        if (tr.name && tr.artist) {
          likeState.likedExtSet.add(`${tr.name.trim()}___${tr.artist.trim()}`);
        }
      }
    }
  } catch {}
}

/**
 * 切换歌曲红心收藏状态（乐观更新 + 失败自动回滚 + Toast 提醒）
 * - 云端歌曲：同步至云端「我喜欢的音乐」
 * - 外部歌曲：存入 SQLite 本地内置「❤️ 本地我喜欢的音乐」专属歌单，并联动触发后台落盘
 */
export async function toggleLike(id: number | string, name?: string, artist?: string, extra?: any): Promise<void> {
  const safeName = (name || extra?.name || extra?.songName || '').trim();
  const safeArtist = (artist || extra?.artist || extra?.ar_name || '').trim();
  const strId = String(id || extra?.id || extra?.songId || '').trim();
  const numId = Number(strId);
  const isNetEaseNum = !isNaN(numId) && numId > 0 && !strId.startsWith('mf_') && !strId.startsWith('ext_');
  const comboKey = safeName && safeArtist ? `${safeName}___${safeArtist}` : '';
  const validExtId = strId && strId !== 'NaN' && strId !== 'undefined' && strId !== 'null' ? strId : '';

  const isLiked = isTrackLiked(validExtId || (isNetEaseNum ? numId : undefined), safeName, safeArtist);

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
      if (validExtId) nextExt.delete(validExtId);
      if (comboKey) nextExt.delete(comboKey);
    } else {
      if (validExtId) nextExt.add(validExtId);
      if (comboKey) nextExt.add(comboKey);
    }
    likeState.likedExtSet = nextExt;

    try {
      if (isLiked) {
        await api.localPlaylistRemoveTrack('local_favorites', validExtId, safeName, safeArtist);
        showToast('已从「本地我喜欢的音乐」移除', 'success');
      } else {
        await api.localPlaylistAddTrack('local_favorites', {
          name: safeName || '未知歌曲',
          artist: safeArtist || '未知歌手',
          coverUrl: extra?.cover || extra?.artwork || extra?.picUrl,
          filePath: extra?.filePath
        });
        showToast(`已收藏《${safeName}》到「本地我喜欢的音乐」`, 'success');

        // 联动后台下载落盘
        if (extra?.url || extra?.raw) {
          triggerAutoDownloadForLikedTrack(extra, safeName, safeArtist);
        }
      }
    } catch {
      const rollback = new Set(likeState.likedExtSet);
      if (!isLiked) {
        if (validExtId) rollback.delete(validExtId);
        if (comboKey) rollback.delete(comboKey);
      } else {
        if (validExtId) rollback.add(validExtId);
        if (comboKey) rollback.add(comboKey);
      }
      likeState.likedExtSet = rollback;
      showToast('操作本地收藏失败', 'error');
    }
  }
}

async function triggerAutoDownloadForLikedTrack(extra: any, _songName: string, _artist: string) {
  try {
    const raw = extra?.raw || extra;
    const pluginId = extra?._pluginId || extra?._pluginHash || extra?.pluginHash || extra?.pluginId || raw?._pluginId || raw?.pluginId;
    await downloadExternalTrack(extra, raw, pluginId);
  } catch (err) {
    console.warn('[LikeStore] Auto download failed:', err);
  }
}
