// 统一封装旧版 axios 契约，返回 {code,msg,data}
async function req(path: string, opts: RequestInit = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { ...(opts.headers || {}), 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  // 后端所有接口均返回 JSON
  const j = await r.json().catch(() => ({ code: '999999', msg: 'invalid json' }));
  return j;
}
async function get(path: string) {
  const r = await fetch(path);
  return r.json();
}
export function postForm(path: string, params: Record<string,string>) {
  return req(path, { method: 'POST', body: new URLSearchParams(params).toString() });
}
export const api = {
  loginStatus: () => get('/login/status'),
  setRepeat: (v:boolean) => get(`/v2/setRepeat?repeat=${v}`),
  getRepeat: () => get('/v2/getRepeat'),
  setCookie: (c:string) => postForm('/setCookie', {cookie:c}),
  myPlaylist: () => postForm('/MyPlaylist', {}),
  playlist: (id:string) => postForm('/Playlist', {id}),
  search: (keywords:string, type:string, limit:string) => postForm('/Search', {keywords, type, limit}),
  songV1: (id:string, level:string) => postForm('/Song_V1', {id, level, type:'json'}),
  album: (id:string) => postForm('/Album', {id}),
  artist: (id:string) => get(`/Artist?id=${encodeURIComponent(id)}`),
  downloadSingle: (id:string) => get(`/v2/single?id=${encodeURIComponent(id)}`),
  downloadPlaylist: (id:string) => get(`/v2/playlist?id=${encodeURIComponent(id)}`),
  downloadAlbum: (id:string) => get(`/v2/album?id=${encodeURIComponent(id)}`),
  tasks: () => get('/v2/tasks'),
  tasksClear: () => req('/v2/tasks/clear', {method:'POST'}),
  historyStats: () => get('/v2/history/stats'),
  historyList: (kw:string, page:number) => get(`/v2/history/list?keyword=${encodeURIComponent(kw)}&page=${page}&pageSize=10`),
  historyScanExternal: () => req('/v2/history/scan_external', {method:'POST'}),
  historyScan: () => req('/v2/history/scan', {method:'POST'}),
  historyImportUntracked: () => req('/v2/history/importUntracked', {method:'POST'}),
  historyCleanMissing: () => req('/v2/history/cleanMissing', {method:'POST'}),
  historyMissing: () => get('/v2/history/missing'),
  historyNonMp3: () => get('/v2/history/non_mp3'),
  historyCleanNonMp3: () => req('/v2/history/cleanNonMp3', {method:'POST'}),
  historyDelete: (id: number|string) => req(`/v2/history/delete?id=${encodeURIComponent(id)}`, {method:'DELETE'}),
  playlistCreate: (name:string, isPrivate:boolean) => postForm('/v2/playlist/create', {name, isPrivate:String(isPrivate)}),
  playlistFork: (name:string, isPrivate:boolean, trackIds:string) => postForm('/v2/playlist/fork', {name, isPrivate:String(isPrivate), trackIds}),
  playlistSubscribe: (id:string, subscribe:boolean) => postForm('/v2/playlist/subscribe', {id, subscribe:String(subscribe)}),
  playlistDelete: (id:string) => postForm('/v2/playlist/delete', {id}),
  playlistAdd: (pid:string, ids:string) => postForm('/v2/playlist/tracks/add', {playlistId:pid, trackIds:ids}),
  playlistRemove: (pid:string, ids:string) => postForm('/v2/playlist/tracks/remove', {playlistId:pid, trackIds:ids}),
  likeList: () => get('/v2/like/list'),
  like: (id:number, like:boolean) => postForm('/v2/like', {id:String(id), like:String(like)}),
  folderRoots: () => get('/v2/folder/roots'),
  folderBrowse: (p:string) => get(`/v2/folder/browse?path=${encodeURIComponent(p)}`),
  folderTracks: (p:string, rec:boolean) => get(`/v2/folder/tracks?path=${encodeURIComponent(p)}&recursive=${rec}`),
  reveal: (params: { id?: string|number; name?: string; artist?: string; path?: string; taskId?: string|number }) => {
    const q = new URLSearchParams();
    if (params.id) q.set('id', String(params.id));
    if (params.name) q.set('name', params.name);
    if (params.artist) q.set('artist', params.artist);
    if (params.path) q.set('path', params.path);
    if (params.taskId) q.set('taskId', String(params.taskId));
    return get(`/v2/reveal?${q.toString()}`);
  }
}
