import { getApiCache, setApiCache } from './utils';
import { api } from './api';

export const myPlaylists = $state<any[]>([]);
export const allTracks = $state<any[]>([]);
export const playlistState = $state({
  filter: 'created' as any,
  playlist: null as any,
  curPage: 1,
  loading: false,
  loadingId: ''
});
export const pageSize = 20;
const _paged = $derived(allTracks.slice((playlistState.curPage-1)*pageSize, playlistState.curPage*pageSize));
const _totalPages = $derived(Math.max(1, Math.ceil(allTracks.length/pageSize)));
const _playlist = $derived(playlistState.playlist);
const _playlistFilter = $derived(playlistState.filter);
const _curPage = $derived(playlistState.curPage);
export function getPaged(){ return _paged; }
export function getTotalPages(){ return _totalPages; }
export function getPlaylist(){ return _playlist; }
export function getPlaylistFilter(){ return _playlistFilter; }
export function getCurPage(){ return _curPage; }
export function isPlaylistLoading(): boolean { return playlistState.loading; }
export function getPlaylistLoadingId(): string { return playlistState.loadingId; }
export function setCurPage(v:number){ playlistState.curPage=v; }
export function incPage(d:number){ playlistState.curPage=Math.max(1, Math.min(_totalPages, playlistState.curPage+d)); }

export async function loadMyPlaylists(f:any=playlistState.filter){
  playlistState.filter=f;
  const cached=getApiCache('my_playlists');
  if(cached?.data?.playlists){ myPlaylists.length=0; myPlaylists.push(...cached.data.playlists); }
  try{
    const j=await api.myPlaylist();
    if(j?.code && j.code!=='000000') throw new Error(j.msg);
    const pls=j?.data?.playlists||[];
    if(JSON.stringify(pls)!==JSON.stringify(cached?.data?.playlists||[])){ setApiCache('my_playlists', j.data); myPlaylists.length=0; myPlaylists.push(...pls); }
  }catch(e){ throw e; }
}
export function updatePlaylistTrackCount(playlistId: string | number, deltaOrCount: number, isAbsolute = false) {
  if (!playlistId) return;
  const pidStr = String(playlistId);
  const target = myPlaylists.find(p => String(p.id) === pidStr);
  if (target) {
    if (isAbsolute) {
      target.trackCount = deltaOrCount;
    } else {
      target.trackCount = Math.max(0, (target.trackCount || 0) + deltaOrCount);
    }
  }
  const cached = getApiCache('my_playlists');
  if (cached?.data?.playlists && Array.isArray(cached.data.playlists)) {
    const cachedItem = cached.data.playlists.find((p: any) => String(p.id) === pidStr);
    if (cachedItem) {
      if (isAbsolute) {
        cachedItem.trackCount = deltaOrCount;
      } else {
        cachedItem.trackCount = Math.max(0, (cachedItem.trackCount || 0) + deltaOrCount);
      }
      setApiCache('my_playlists', cached.data);
    }
  }
}

export function addNewPlaylist(pl: any) {
  if (!pl || !pl.id) return;
  const exists = myPlaylists.some(p => String(p.id) === String(pl.id));
  if (!exists) {
    const favIdx = myPlaylists.findIndex(p => isFavoritePlaylist(p));
    if (favIdx !== -1) {
      myPlaylists.splice(favIdx + 1, 0, pl);
    } else {
      myPlaylists.unshift(pl);
    }
    const cached = getApiCache('my_playlists') || { code: '000000', data: { playlists: [] } };
    if (!cached.data) cached.data = { playlists: [] };
    if (!Array.isArray(cached.data.playlists)) cached.data.playlists = [];
    if (!cached.data.playlists.some((p: any) => String(p.id) === String(pl.id))) {
      if (favIdx !== -1) {
        cached.data.playlists.splice(favIdx + 1, 0, pl);
      } else {
        cached.data.playlists.unshift(pl);
      }
      setApiCache('my_playlists', cached.data);
    }
  }
}

export function renderPlaylist(pl:any){
  playlistState.playlist=pl;
  allTracks.length=0; allTracks.push(...(pl.tracks||[]));
  playlistState.curPage=1;
  if (pl?.id && Array.isArray(pl.tracks)) {
    updatePlaylistTrackCount(pl.id, pl.tracks.length, true);
  }
}
let currentLoadRequestId = 0;
let activeTargetPlaylistId = '';

export function getActiveTargetPlaylistId(): string {
  return activeTargetPlaylistId;
}

export function resetActiveTargetPlaylist(): void {
  activeTargetPlaylistId = '';
}

export async function loadPlaylistDetail(playlistId: string, force = false){
  if(!playlistId) throw new Error('请输入歌单 ID');
  const pidStr = String(playlistId).trim();
  const key = 'playlist_' + pidStr;

  activeTargetPlaylistId = pidStr;
  const requestId = ++currentLoadRequestId;

  const cached = getApiCache(key);
  const hasCache = !!(cached?.data?.playlist?.tracks?.length);

  // 1. Cache First: 若已有缓存且非强制刷新，立即秒显数据，无任何 loading UI！
  if (hasCache && !force) {
    renderPlaylist(cached.data.playlist);
    // 后台静默调用 API 进行 Revalidate，更新最新数据与本地缓存
    api.playlist(pidStr).then((j) => {
      if (j?.code === '000000' && j?.data?.playlist?.tracks?.length) {
        setApiCache(key, j.data);
        // 关键防竞态：仅当当前用户依然停留在本歌单，且当前请求为最新请求时才更新 UI
        if (activeTargetPlaylistId === pidStr && requestId === currentLoadRequestId) {
          renderPlaylist(j.data.playlist);
        }
      }
    }).catch(() => {});
    return cached.data.playlist;
  }

  // 2. Cache Miss: 无本地缓存时，才激活 loading UI 并在前台并发拉取
  playlistState.loading = true;
  playlistState.loadingId = pidStr;

  try {
    if (playlistState.playlist && String(playlistState.playlist.id) !== pidStr) {
      playlistState.playlist = null;
      allTracks.length = 0;
    }
    const j = await api.playlist(pidStr);
    if(j?.code && j.code!=='000000') throw new Error(j.msg || '获取失败');
    const pl = j?.data?.playlist;
    if(!pl?.tracks?.length) throw new Error('未找到歌单或为空');
    setApiCache(key, j.data);
    if (activeTargetPlaylistId === pidStr && requestId === currentLoadRequestId) {
      renderPlaylist(pl);
    }
    return pl;
  } finally {
    if (requestId === currentLoadRequestId) {
      playlistState.loading = false;
      playlistState.loadingId = '';
    }
  }
}

const STORAGE_KEY_PLAYLIST_PLAY_COUNTS = 'wyyyy_playlist_play_counts';

function loadPlayCounts(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLAYLIST_PLAY_COUNTS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export const playlistPlayCounts = $state<Record<string, number>>(loadPlayCounts());

export function recordPlaylistPlay(playlistId: string | number) {
  if (!playlistId) return;
  const idStr = String(playlistId);
  const current = playlistPlayCounts[idStr] || 0;
  const next = current + 1;
  playlistPlayCounts[idStr] = next;
  try {
    localStorage.setItem(STORAGE_KEY_PLAYLIST_PLAY_COUNTS, JSON.stringify($state.snapshot(playlistPlayCounts)));
  } catch {}
}

export function getPlaylistPlayCount(playlistId: string | number): number {
  return playlistPlayCounts[String(playlistId)] || 0;
}

// 唯一不可删除的系统级“我喜欢的音乐”歌单 ID
export function getSystemFavoritePlaylistId(): string | null {
  const bySpecial = myPlaylists.find(p => p && p.specialType === 5 && !p.subscribed);
  if (bySpecial) return String(bySpecial.id);
  const firstCreated = myPlaylists.find(p => p && !p.subscribed);
  return firstCreated ? String(firstCreated.id) : null;
}

export function isFavoritePlaylist(pl: any): boolean {
  if (!pl) return false;
  const sysId = getSystemFavoritePlaylistId();
  if (sysId && String(pl.id) === sysId) return true;
  return Boolean(pl.specialType === 5 && !pl.subscribed);
}

export function sortPlaylistsByPlayCount(list: any[]): any[] {
  if (!Array.isArray(list) || list.length <= 1) return list;
  return list
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => {
      const isFavA = isFavoritePlaylist(a.item);
      const isFavB = isFavoritePlaylist(b.item);
      // 喜欢的歌单永远置顶最前 (喜欢的除外)
      if (isFavA && !isFavB) return -1;
      if (!isFavA && isFavB) return 1;
      if (isFavA && isFavB) return a.originalIndex - b.originalIndex;

      // 其余歌单按播放次数降序排序：播放越多越靠前
      const countA = getPlaylistPlayCount(a.item.id);
      const countB = getPlaylistPlayCount(b.item.id);

      if (countB !== countA) {
        return countB - countA;
      }
      return a.originalIndex - b.originalIndex;
    })
    .map(wrapper => wrapper.item);
}

const STORAGE_KEY_LAST_BACKUP_PLAYLIST = 'wyyyy_last_backup_playlist';

export function getLastBackupPlaylist(): { id: string; name: string } | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_BACKUP_PLAYLIST);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setLastBackupPlaylist(id: string | number, name: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_LAST_BACKUP_PLAYLIST, JSON.stringify({ id: String(id), name }));
  } catch {}
}
