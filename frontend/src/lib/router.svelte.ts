export type ActiveTab = 'playlist' | 'search' | 'download-mgr' | 'musicfree';

function getInitialTab(): ActiveTab {
  const raw = typeof window !== 'undefined' ? location.hash.replace('#', '').split('?')[0] : '';
  if (raw === 'playlist' || raw === 'search' || raw === 'download-mgr' || raw === 'musicfree') return raw;
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('wyyyy_active_tab') : '';
  return (saved === 'playlist' || saved === 'search' || saved === 'download-mgr' || saved === 'musicfree') ? saved as ActiveTab : 'playlist';
}

function getInitialPlaylistId(): string {
  if (typeof window === 'undefined') return '';
  return location.hash.match(/id=([0-9a-zA-Z_-]+)/)?.[1] || '';
}

const STORAGE_KEY_SIDEBAR_COLLAPSED = 'wyyyy_sidebar_collapsed';

function getInitialSidebarCollapsed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED) === 'true';
}

export const routerState = $state<{
  tab: ActiveTab;
  playlistId: string;
  albumId: string;
  albumName: string;
  sidebarCollapsed: boolean;
  playlistTrigger: number;
  albumTrigger: number;
  downloadSubTab?: 'local-playlists' | 'history' | 'folder' | 'browser-cache' | 'tasks';
  downloadTasksTrigger: number;
  searchKeyword?: string;
  searchSource?: 'netease' | 'musicfree';
  searchTrigger: number;
}>({
  tab: getInitialTab(),
  playlistId: getInitialPlaylistId(),
  albumId: '',
  albumName: '',
  sidebarCollapsed: getInitialSidebarCollapsed(),
  playlistTrigger: 0,
  albumTrigger: 0,
  downloadSubTab: 'history',
  downloadTasksTrigger: 0,
  searchKeyword: '',
  searchSource: 'netease',
  searchTrigger: 0
});

export function jumpToMusicFreeSearch(keyword: string): void {
  routerState.searchKeyword = keyword.trim();
  routerState.searchSource = 'musicfree';
  routerState.searchTrigger = (routerState.searchTrigger || 0) + 1;
  switchTab('search');
}

export function jumpToDownloadTasks(): void {
  routerState.downloadSubTab = 'tasks';
  routerState.downloadTasksTrigger = (routerState.downloadTasksTrigger || 0) + 1;
  switchTab('download-mgr');
}

export function toggleSidebarCollapse(): void {
  routerState.sidebarCollapsed = !routerState.sidebarCollapsed;
  try {
    localStorage.setItem(STORAGE_KEY_SIDEBAR_COLLAPSED, String(routerState.sidebarCollapsed));
  } catch {}
}

export function scrollToPageTop(): void {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.dispatchEvent(new CustomEvent('wyyyy:scroll-list-top'));
  }
  const mainEl = typeof document !== 'undefined' ? document.querySelector('.app-main-container') : null;
  if (mainEl) {
    mainEl.scrollTo({ top: 0, behavior: 'smooth' });
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch {}
}

export function switchTab(n: ActiveTab): void {
  if (routerState.tab === n) {
    scrollToPageTop();
    return;
  }
  routerState.tab = n;
  if (n === 'playlist' && routerState.playlistId) {
    history.pushState(null, '', `#playlist?id=${routerState.playlistId}`);
  } else {
    history.pushState(null, '', '#' + n);
  }
  try {
    localStorage.setItem('wyyyy_active_tab', n);
  } catch {}
}

export function jumpToAlbum(id: string, name?: string): void {
  routerState.albumId = String(id || '').trim();
  routerState.albumName = String(name || '').trim();
  routerState.albumTrigger = (routerState.albumTrigger || 0) + 1;
  switchTab('search');
}

export function jumpToPlaylist(id: string): void {
  const pid = String(id || '').trim();
  routerState.playlistId = pid;
  routerState.playlistTrigger = (routerState.playlistTrigger || 0) + 1;
  routerState.tab = 'playlist';
  if (pid) {
    history.pushState(null, '', `#playlist?id=${pid}`);
  } else {
    history.pushState(null, '', '#playlist');
  }
  try {
    localStorage.setItem('wyyyy_active_tab', 'playlist');
    if (pid) {
      localStorage.setItem('wyyyy_last_playlist_id', pid);
    }
  } catch {}
}

export function jumpToDailyRecommend(): void {
  jumpToPlaylist('daily-recommend');
}

export function exitPlaylistToGallery(): void {
  routerState.playlistId = '';
  routerState.playlistTrigger = (routerState.playlistTrigger || 0) + 1;
  history.pushState(null, '', '#playlist');
  try {
    localStorage.removeItem('wyyyy_last_playlist_id');
  } catch {}
}

export function exitPlaylistToLocalManager(): void {
  routerState.playlistId = '';
  routerState.playlistTrigger = (routerState.playlistTrigger || 0) + 1;
  routerState.downloadSubTab = 'local-playlists';
  switchTab('download-mgr');
  try {
    localStorage.removeItem('wyyyy_last_playlist_id');
  } catch {}
}

export function initRouter(): () => void {
  const syncRoute = () => {
    const raw = typeof location !== 'undefined' ? location.hash.replace('#', '') : '';
    const m = raw.match(/id=([0-9a-zA-Z_-]+)/);
    if (m?.[1]) {
      routerState.playlistId = m[1];
    } else if (raw.startsWith('playlist')) {
      // 当 URL 是 #playlist 且没有 id 时，回到歌单画廊
      routerState.playlistId = '';
    }
    const h = raw.split('?')[0];
    if (h === 'playlist' || h === 'search' || h === 'download-mgr' || h === 'musicfree') {
      routerState.tab = h as ActiveTab;
    }
  };

  syncRoute();
  window.addEventListener('hashchange', syncRoute);
  window.addEventListener('popstate', syncRoute);
  return () => {
    window.removeEventListener('hashchange', syncRoute);
    window.removeEventListener('popstate', syncRoute);
  };
}
