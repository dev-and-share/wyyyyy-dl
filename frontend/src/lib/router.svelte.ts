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

export const routerState = $state<{
  tab: ActiveTab;
  playlistId: string;
  albumId: string;
}>({
  tab: getInitialTab(),
  playlistId: getInitialPlaylistId(),
  albumId: ''
});

export function switchTab(n: ActiveTab): void {
  routerState.tab = n;
  history.pushState(null, '', '#' + n);
  try {
    localStorage.setItem('wyyyy_active_tab', n);
  } catch {}
}

export function jumpToAlbum(id: string): void {
  routerState.albumId = id;
  switchTab('search');
}

export function jumpToPlaylist(id: string): void {
  routerState.playlistId = id;
  switchTab('playlist');
}

export function initRouter(): () => void {
  const syncRoute = () => {
    const m = location.hash.match(/id=([0-9]+)/);
    if (m?.[1]) routerState.playlistId = m[1];
    const h = location.hash.replace('#', '').split('?')[0];
    if (h === 'playlist' || h === 'search' || h === 'download-mgr') {
      routerState.tab = h as ActiveTab;
    }
  };

  syncRoute();
  window.addEventListener('hashchange', syncRoute);
  return () => window.removeEventListener('hashchange', syncRoute);
}
