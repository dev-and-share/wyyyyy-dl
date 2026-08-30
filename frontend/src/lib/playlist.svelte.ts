import { getApiCache, setApiCache } from './utils';
import { api } from './api';

export let myPlaylists = $state<any[]>([]);
export let playlistFilter = $state<'created'|'subscribed'|'all'>('created');
export let playlist = $state<any|null>(null);
export let allTracks = $state<any[]>([]);
export let curPage = $state(1);
export const pageSize = 10;
export const paged = $derived(allTracks.slice((curPage-1)*pageSize, curPage*pageSize));
export const totalPages = $derived(Math.max(1, Math.ceil(allTracks.length/pageSize)));

export async function loadMyPlaylists(f:any=playlistFilter){
  playlistFilter=f;
  const cached=getApiCache('my_playlists');
  if(cached?.data?.playlists) myPlaylists=cached.data.playlists;
  try{
    const j=await api.myPlaylist();
    if(j?.code && j.code!=='000000') throw new Error(j.msg);
    const pls=j?.data?.playlists||[];
    if(JSON.stringify(pls)!==JSON.stringify(cached?.data?.playlists||[])){ setApiCache('my_playlists', j.data); myPlaylists=pls; }
  }catch(e){ /* keep cache */ throw e; }
}
export function renderPlaylist(pl:any){
  playlist=pl; allTracks=pl.tracks||[]; curPage=1;
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
