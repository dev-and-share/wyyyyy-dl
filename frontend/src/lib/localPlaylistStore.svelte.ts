import { api } from './api';
import { t } from './i18n';

export interface LocalPlaylist {
  id: string;
  name: string;
  coverImgUrl?: string;
  trackCount: number;
  isLocal: boolean;
  subscribed?: boolean;
  createdAt?: string;
  tracks?: any[];
}

export const localPlaylistState = $state<{
  playlists: LocalPlaylist[];
  loading: boolean;
}>({
  playlists: [],
  loading: false
});

export const SYSTEM_FAVORITES_PLAYLIST_ID = 'local_favorites';

/**
 * 判断指定歌单是否为系统内置的「❤️ 本地我喜欢的音乐」专属歌单
 */
export function isSystemFavoritesPlaylist(id: string | number | undefined | null): boolean {
  return String(id) === SYSTEM_FAVORITES_PLAYLIST_ID;
}

/**
 * 判断指定歌单是否为本地专属歌单 (SQLite 隔离存储)
 */
export function isLocalPlaylist(playlistId: string | number | undefined | null): boolean {
  if (!playlistId) return false;
  return String(playlistId).startsWith('local_');
}

/**
 * 加载所有本地自建歌单
 */
export async function loadLocalPlaylists(): Promise<LocalPlaylist[]> {
  localPlaylistState.loading = true;
  try {
    if (typeof api?.localPlaylistList === 'function') {
      const res = await api.localPlaylistList();
      if (res?.code === '000000' && Array.isArray(res.data)) {
        localPlaylistState.playlists = res.data;
        return res.data;
      }
    }
  } catch (e) {
    // 静默降级，避免测试环境与离线环境下控制台噪音
  } finally {
    localPlaylistState.loading = false;
  }
  return localPlaylistState.playlists;
}

/**
 * 创建新本地歌单
 */
export async function createLocalPlaylist(name: string, coverUrl?: string): Promise<{ success: boolean; data?: LocalPlaylist; msg?: string }> {
  const trimmed = name?.trim();
  if (!trimmed) {
    return { success: false, msg: t('playlist.enterNamePrompt') || '歌单名称不能为空' };
  }
  try {
    const res = await api.localPlaylistCreate(trimmed, coverUrl);
    if (res?.code === '000000' && res.data) {
      await loadLocalPlaylists();
      return { success: true, data: res.data };
    }
    return { success: false, msg: res?.msg || '创建失败' };
  } catch (e: any) {
    return { success: false, msg: e?.message || '创建异常' };
  }
}

/**
 * 删除本地歌单
 */
export async function deleteLocalPlaylist(id: string): Promise<{ success: boolean; msg?: string }> {
  if (id === SYSTEM_FAVORITES_PLAYLIST_ID) {
    return { success: false, msg: '系统内置专属歌单不支持删除' };
  }
  try {
    const res = await api.localPlaylistDelete(id);
    if (res?.code === '000000') {
      localPlaylistState.playlists = localPlaylistState.playlists.filter(p => p.id !== id);
      return { success: true };
    }
    return { success: false, msg: res?.msg || '删除失败' };
  } catch (e: any) {
    return { success: false, msg: e?.message || '删除异常' };
  }
}

/**
 * 向本地歌单添加歌曲 (歌曲必须已在本地磁盘落盘)
 */
export async function addTrackToLocalPlaylist(
  playlistId: string,
  track: {
    historyId?: number;
    name: string;
    artist?: string;
    filePath?: string;
    coverUrl?: string;
  }
): Promise<{ success: boolean; msg?: string }> {
  try {
    const res = await api.localPlaylistAddTrack(playlistId, {
      historyId: track.historyId,
      name: track.name,
      artist: track.artist || '未知歌手',
      filePath: track.filePath,
      coverUrl: track.coverUrl
    });
    if (res?.code === '000000') {
      const pl = localPlaylistState.playlists.find(p => p.id === playlistId);
      if (pl) pl.trackCount = (pl.trackCount || 0) + 1;
      return { success: true, msg: res?.msg || '已成功加入本地歌单' };
    }
    return { success: false, msg: res?.msg || '添加失败' };
  } catch (e: any) {
    return { success: false, msg: e?.message || '添加异常' };
  }
}

/**
 * 从本地歌单移除歌曲
 */
export async function removeTrackFromLocalPlaylist(
  playlistId: string,
  trackId: number | string
): Promise<{ success: boolean; msg?: string }> {
  try {
    const res = await api.localPlaylistRemoveTrack(playlistId, trackId);
    if (res?.code === '000000') {
      const pl = localPlaylistState.playlists.find(p => p.id === playlistId);
      if (pl && pl.trackCount > 0) pl.trackCount -= 1;
      return { success: true, msg: res?.msg || '已移除' };
    }
    return { success: false, msg: res?.msg || '移除失败' };
  } catch (e: any) {
    return { success: false, msg: e?.message || '移除异常' };
  }
}
