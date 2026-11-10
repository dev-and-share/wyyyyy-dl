/**
 * 核心主路由 Tab 枚举 / 常量
 */
export const AppRoute = {
  PLAYLIST: 'playlist',
  SEARCH: 'search',
  DOWNLOAD_MGR: 'download-mgr',
  MUSICFREE: 'musicfree',
} as const;

export type ActiveTab = typeof AppRoute[keyof typeof AppRoute];

/**
 * 歌单模块子 Tab 枚举
 */
export const PlaylistSubTab = {
  MY: 'my',
  DETAIL: 'detail',
  RECOMMEND: 'recommend',
} as const;

export type PlaylistSubTabType = typeof PlaylistSubTab[keyof typeof PlaylistSubTab];

/**
 * 系统级虚拟路由 ID 常量
 */
export const SpecialRouteId = {
  DAILY_RECOMMEND: 'daily-recommend',
} as const;

/**
 * 统一 LocalStorage 存储键名
 */
export const STORAGE_KEYS = {
  ACTIVE_TAB: 'wyy_active_tab',
  LAST_PLAYLIST_ID: 'wyy_last_playlist_id',
  SIDEBAR_COLLAPSED: 'wyy_sidebar_collapsed',
  PLAYLIST_SUBTAB: 'wyy_pl_subtab',
} as const;

/**
 * 统一路由 URL 构建器（收口所有 Hash 与查询参数组装）
 */
export const RouteUrl = {
  tab: (tab: ActiveTab): string => `#${tab}`,
  playlist: (id?: string): string => {
    const cleanId = String(id || '').trim();
    if (!cleanId) return `#${AppRoute.PLAYLIST}`;
    return `#${AppRoute.PLAYLIST}?id=${cleanId}`;
  },
  playlistSubTab: (subTab: PlaylistSubTabType, pid?: string): string => {
    if (subTab === PlaylistSubTab.MY) {
      return `#${AppRoute.PLAYLIST}`;
    }
    if (subTab === PlaylistSubTab.RECOMMEND) {
      return `#${AppRoute.PLAYLIST}?id=${SpecialRouteId.DAILY_RECOMMEND}`;
    }
    if (subTab === PlaylistSubTab.DETAIL) {
      const cleanPid = String(pid || '').trim();
      return cleanPid && cleanPid !== SpecialRouteId.DAILY_RECOMMEND
        ? `#${AppRoute.PLAYLIST}?id=${cleanPid}`
        : `#${AppRoute.PLAYLIST}?subtab=detail`;
    }
    return `#${AppRoute.PLAYLIST}`;
  },
  dailyRecommend: (): string => `#${AppRoute.PLAYLIST}?id=${SpecialRouteId.DAILY_RECOMMEND}`,
  search: (): string => `#${AppRoute.SEARCH}`,
  downloadMgr: (): string => `#${AppRoute.DOWNLOAD_MGR}`,
  musicFree: (): string => `#${AppRoute.MUSICFREE}`,
} as const;

/**
 * 判断是否为每日推荐路由/虚拟 ID
 */
export function isDailyRecommendRoute(id: string | null | undefined): boolean {
  return String(id || '').trim() === SpecialRouteId.DAILY_RECOMMEND;
}

/**
 * 解析 URL Hash 结构
 */
export function parseRouteFromHash(hashStr: string): {
  tab: ActiveTab;
  playlistId: string;
  subTab?: string;
} {
  const raw = (hashStr || '').replace(/^#/, '');
  const [path, queryString] = raw.split('?');
  const params = new URLSearchParams(queryString || '');

  let tab: ActiveTab = AppRoute.PLAYLIST;
  if (path === AppRoute.SEARCH || path === AppRoute.DOWNLOAD_MGR || path === AppRoute.MUSICFREE) {
    tab = path;
  }

  const playlistId = params.get('id') || '';
  const subTab = params.get('subtab') || undefined;

  return { tab, playlistId, subTab };
}

function getInitialTab(): ActiveTab {
  if (typeof window !== 'undefined') {
    const { tab } = parseRouteFromHash(location.hash);
    if (Object.values(AppRoute).includes(tab)) return tab;
  }
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) : '';
  return Object.values(AppRoute).includes(saved as ActiveTab) ? (saved as ActiveTab) : AppRoute.PLAYLIST;
}

function getInitialPlaylistId(): string {
  if (typeof window === 'undefined') return '';
  return parseRouteFromHash(location.hash).playlistId;
}

function getInitialSidebarCollapsed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
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
  switchTab(AppRoute.SEARCH);
}

export function jumpToDownloadTasks(): void {
  routerState.downloadSubTab = 'tasks';
  routerState.downloadTasksTrigger = (routerState.downloadTasksTrigger || 0) + 1;
  switchTab(AppRoute.DOWNLOAD_MGR);
}

export function toggleSidebarCollapse(): void {
  routerState.sidebarCollapsed = !routerState.sidebarCollapsed;
  try {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(routerState.sidebarCollapsed));
  } catch {}
}

export function scrollToPageTop(): void {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.dispatchEvent(new CustomEvent('wyy:scroll-list-top'));
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
  if (n === AppRoute.PLAYLIST && routerState.playlistId) {
    history.pushState(null, '', RouteUrl.playlist(routerState.playlistId));
  } else {
    history.pushState(null, '', RouteUrl.tab(n));
  }
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, n);
  } catch {}
}

export function jumpToAlbum(id: string, name?: string): void {
  routerState.albumId = String(id || '').trim();
  routerState.albumName = String(name || '').trim();
  routerState.albumTrigger = (routerState.albumTrigger || 0) + 1;
  switchTab(AppRoute.SEARCH);
}

export function jumpToPlaylist(id: string): void {
  const pid = String(id || '').trim();
  routerState.playlistId = pid;
  routerState.playlistTrigger = (routerState.playlistTrigger || 0) + 1;
  routerState.tab = AppRoute.PLAYLIST;
  history.pushState(null, '', RouteUrl.playlist(pid));
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, AppRoute.PLAYLIST);
    if (pid) {
      localStorage.setItem(STORAGE_KEYS.LAST_PLAYLIST_ID, pid);
    }
  } catch {}
}

export function jumpToDailyRecommend(): void {
  jumpToPlaylist(SpecialRouteId.DAILY_RECOMMEND);
}

export function exitPlaylistToGallery(): void {
  routerState.playlistId = '';
  routerState.playlistTrigger = (routerState.playlistTrigger || 0) + 1;
  history.pushState(null, '', RouteUrl.playlist());
  try {
    localStorage.removeItem(STORAGE_KEYS.LAST_PLAYLIST_ID);
  } catch {}
}

export function exitPlaylistToLocalManager(): void {
  routerState.playlistId = '';
  routerState.playlistTrigger = (routerState.playlistTrigger || 0) + 1;
  routerState.downloadSubTab = 'local-playlists';
  switchTab(AppRoute.DOWNLOAD_MGR);
  try {
    localStorage.removeItem(STORAGE_KEYS.LAST_PLAYLIST_ID);
  } catch {}
}

export function initRouter(): () => void {
  const syncRoute = () => {
    if (typeof location === 'undefined') return;
    const parsed = parseRouteFromHash(location.hash);
    routerState.playlistId = parsed.playlistId;
    routerState.tab = parsed.tab;
  };

  syncRoute();
  window.addEventListener('hashchange', syncRoute);
  window.addEventListener('popstate', syncRoute);
  return () => {
    window.removeEventListener('hashchange', syncRoute);
    window.removeEventListener('popstate', syncRoute);
  };
}
