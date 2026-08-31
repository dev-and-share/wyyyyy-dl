import { getApiCache, setApiCache } from './utils';
import { api } from './api';

export const myPlaylists = $state<any[]>([]);
export const allTracks = $state<any[]>([]);
export const playlistState = $state({ filter: 'created' as any, playlist: null as any, curPage: 1 });
export const pageSize = 10;
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
export function renderPlaylist(pl:any){
  playlistState.playlist=pl;
  allTracks.length=0; allTracks.push(...(pl.tracks||[]));
  playlistState.curPage=1;
}
export async function loadPlaylistDetail(playlistId:string){
  if(!playlistId) throw new Error('请输入歌单 ID');
  const key='playlist_'+playlistId;
  const cached=getApiCache(key);
  if(cached?.data?.playlist?.tracks?.length) renderPlaylist(cached.data.playlist);
  const j=await api.playlist(playlistId);
  if(j?.code && j.code!=='000000') throw new Error(j.msg || '获取失败');
  const pl=j?.data?.playlist;
  if(!pl?.tracks?.length) throw new Error('未找到歌单或为空');
  setApiCache(key, j.data); renderPlaylist(pl); return pl;
}
