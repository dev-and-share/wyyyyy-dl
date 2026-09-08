// 统一封装 Axios 兼容契约，返回 {code,msg,data} (全面基于 /v3/ RESTful 规范)
async function req(path: string, opts: RequestInit = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { ...(opts.headers || {}), 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  // 后端所有接口均返回统一 JSON 结构
  const j = await r.json().catch(() => ({ code: '999999', msg: 'invalid json' }));
  return j;
}

async function get(path: string) {
  const r = await fetch(path);
  return r.json();
}

export function postForm(path: string, params: Record<string, string>) {
  return req(path, { method: 'POST', body: new URLSearchParams(params).toString() });
}

export const api = {
  // 🔐 认证与状态
  loginStatus: () => get('/v3/auth/status'),
  qrStatus: (unikey: string) => get(`/v3/auth/qr/status?unikey=${encodeURIComponent(unikey)}`),
  setCookie: (c: string) => postForm('/v3/cookie', { cookie: c }),

  // 🎵 核心解析
  songV1: (id: string, level: string) => postForm('/v3/song', { id, level, type: 'json' }),
  playlist: (id: string) => postForm('/v3/playlist', { id }),
  album: (id: string) => postForm('/v3/album', { id }),
  artist: (id: string) => get(`/v3/artist?id=${encodeURIComponent(id)}`),
  search: (keywords: string, type: string, limit: string) => postForm('/v3/search', { keywords, type, limit }),
  myPlaylist: () => postForm('/v3/my_playlists', {}),

  // ❤️ 红心与歌单操作
  likeList: () => get('/v3/like/list'),
  like: (id: number, like: boolean, name?: string, artist?: string) => postForm('/v3/like', { id: String(id), like: String(like), name: name || '', artist: artist || '' }),
  playlistCreate: (name: string, isPrivate: boolean) => postForm('/v3/playlist/create', { name, isPrivate: String(isPrivate) }),
  playlistFork: (name: string, isPrivate: boolean, trackIds: string) => postForm('/v3/playlist/fork', { name, isPrivate: String(isPrivate), trackIds }),
  playlistSubscribe: (id: string, subscribe: boolean) => postForm('/v3/playlist/subscribe', { id, subscribe: String(subscribe) }),
  playlistDelete: (id: string) => postForm('/v3/playlist/delete', { id }),
  playlistAdd: (pid: string, ids: string) => postForm('/v3/playlist/tracks/add', { playlistId: pid, trackIds: ids }),
  playlistRemove: (pid: string, ids: string) => postForm('/v3/playlist/tracks/remove', { playlistId: pid, trackIds: ids }),

  // 📥 下载调度
  setRepeat: (v: boolean) => get(`/v3/download/setRepeat?repeat=${v}`),
  getRepeat: () => get('/v3/download/getRepeat'),
  downloadSingle: (id: string) => get(`/v3/download/single?id=${encodeURIComponent(id)}`),
  downloadPlaylist: (id: string) => get(`/v3/download/playlist?id=${encodeURIComponent(id)}`),
  downloadAlbum: (id: string) => get(`/v3/download/album?id=${encodeURIComponent(id)}`),
  tasks: () => get('/v3/download/tasks'),
  tasksClear: () => req('/v3/download/tasks/clear', { method: 'POST' }),

  // 📜 本地历史管理
  historyList: (kw: string, page: number) => get(`/v3/history/list?keyword=${encodeURIComponent(kw)}&page=${page}&pageSize=10`),
  historyIds: () => get('/v3/history/ids'),
  historyStats: () => get('/v3/history/stats'),
  historyScan: () => req('/v3/history/scan', { method: 'POST' }),
  historyScanExternal: () => req('/v3/history/scan_external', { method: 'POST' }),
  historyImportUntracked: () => req('/v3/history/importUntracked', { method: 'POST' }),
  historyMissing: () => get('/v3/history/missing'),
  historyCleanMissing: () => req('/v3/history/cleanMissing', { method: 'POST' }),
  historyNonMp3: () => get('/v3/history/non_mp3'),
  historyCleanNonMp3: () => req('/v3/history/cleanNonMp3', { method: 'POST' }),
  historyDelete: (id: number | string) => req(`/v3/history/delete?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // 📁 本地目录浏览器
  folderRoots: () => get('/v3/folder/roots'),
  folderBrowse: (p: string) => get(`/v3/folder/browse?path=${encodeURIComponent(p)}`),
  folderTracks: (p: string, rec: boolean) => get(`/v3/folder/tracks?path=${encodeURIComponent(p)}&recursive=${rec}`),

  // 🎯 系统文件定位
  reveal: (params: { id?: string | number; name?: string; artist?: string; path?: string; taskId?: string | number }) => {
    const q = new URLSearchParams();
    if (params.id) q.set('id', String(params.id));
    if (params.name) q.set('name', params.name);
    if (params.artist) q.set('artist', params.artist);
    if (params.path) q.set('path', params.path);
    if (params.taskId) q.set('taskId', String(params.taskId));
    return get(`/v3/reveal?${q.toString()}`);
  }
};
