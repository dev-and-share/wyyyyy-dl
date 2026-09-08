export type ActiveTab = 'playlist' | 'search' | 'download-mgr';

function getInitialTab(): ActiveTab {
  const raw = typeof window !== 'undefined' ? location.hash.replace('#', '').split('?')[0] : '';
  if (raw === 'playlist' || raw === 'search' || raw === 'download-mgr') return raw;
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('wyyyy_active_tab') : '';
  return (saved === 'playlist' || saved === 'search' || saved === 'download-mgr') ? saved as ActiveTab : 'playlist';
}

function getInitialPlaylistId(): string {
  if (typeof window === 'undefined') return '';
  return location.hash.match(/id=([0-9]+)/)?.[1] || (typeof localStorage !== 'undefined' ? localStorage.getItem('wyyyy_last_playlist_id') || '' : '');
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
  sidebarCollapsed: boolean;
  playlistTrigger: number;
}>({
  tab: getInitialTab(),
  playlistId: getInitialPlaylistId(),
  albumId: '',
  sidebarCollapsed: getInitialSidebarCollapsed(),
  playlistTrigger: 0
});

export function toggleSidebarCollapse(): void {
  routerState.sidebarCollapsed = !routerState.sidebarCollapsed;
  try {
    localStorage.setItem(STORAGE_KEY_SIDEBAR_COLLAPSED, String(routerState.sidebarCollapsed));
  } catch {}
}

export function switchTab(n: ActiveTab): void {
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

export function jumpToAlbum(id: string): void {
  routerState.albumId = id;
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

export function exitPlaylistToGallery(): void {
  routerState.playlistId = '';
  routerState.playlistTrigger = (routerState.playlistTrigger || 0) + 1;
  history.pushState(null, '', '#playlist');
  try {
    localStorage.removeItem('wyyyy_last_playlist_id');
  } catch {}
}

export function initRouter(): () => void {
  const syncRoute = () => {
    const raw = typeof location !== 'undefined' ? location.hash.replace('#', '') : '';
    const m = raw.match(/id=([0-9]+)/);
    if (m?.[1]) {
      routerState.playlistId = m[1];
    } else if (raw.startsWith('playlist')) {
      // 当 URL 是 #playlist 且没有 id 时，回到歌单画廊
      routerState.playlistId = '';
    }
    const h = raw.split('?')[0];
    if (h === 'playlist' || h === 'search' || h === 'download-mgr') {
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
