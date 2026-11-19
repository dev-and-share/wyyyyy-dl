import { describe, it, expect, beforeEach } from 'vitest';
import {
  routerState,
  jumpToPlaylist,
  jumpToDailyRecommend,
  exitPlaylistToGallery,
  exitPlaylistToLocalManager,
  switchTab,
  initRouter,
  AppRoute,
  PlaylistSubTab,
  SpecialRouteId,
  RouteUrl,
  isDailyRecommendRoute,
  parseRouteFromHash,
  STORAGE_KEYS
} from './router.svelte';

describe('router navigation, URL sync contracts & route enums', () => {
  beforeEach(() => {
    localStorage.clear();
    location.hash = '';
    routerState.playlistId = '';
    routerState.tab = AppRoute.PLAYLIST;
  });

  it('provides type-safe RouteUrl builder', () => {
    expect(RouteUrl.tab(AppRoute.SEARCH)).toBe('#search');
    expect(RouteUrl.playlist()).toBe('#playlist');
    expect(RouteUrl.playlist('123456')).toBe('#playlist?id=123456');
    expect(RouteUrl.dailyRecommend()).toBe('#playlist?id=daily-recommend');
    expect(RouteUrl.playlistSubTab(PlaylistSubTab.MY)).toBe('#playlist');
    expect(RouteUrl.playlistSubTab(PlaylistSubTab.RECOMMEND)).toBe('#playlist?id=daily-recommend');
    expect(RouteUrl.playlistSubTab(PlaylistSubTab.DETAIL, '999')).toBe('#playlist?id=999');
    expect(RouteUrl.playlistSubTab(PlaylistSubTab.DETAIL)).toBe('#playlist?subtab=detail');
  });

  it('correctly identifies daily-recommend route via isDailyRecommendRoute', () => {
    expect(isDailyRecommendRoute(SpecialRouteId.DAILY_RECOMMEND)).toBe(true);
    expect(isDailyRecommendRoute('daily-recommend')).toBe(true);
    expect(isDailyRecommendRoute('123456')).toBe(false);
    expect(isDailyRecommendRoute('')).toBe(false);
    expect(isDailyRecommendRoute(null)).toBe(false);
  });

  it('parses hash accurately via parseRouteFromHash', () => {
    expect(parseRouteFromHash('#playlist?id=daily-recommend')).toEqual({
      tab: AppRoute.PLAYLIST,
      playlistId: 'daily-recommend',
      subTab: undefined
    });
    expect(parseRouteFromHash('#playlist?subtab=detail')).toEqual({
      tab: AppRoute.PLAYLIST,
      playlistId: '',
      subTab: 'detail'
    });
    expect(parseRouteFromHash('#search')).toEqual({
      tab: AppRoute.SEARCH,
      playlistId: '',
      subTab: undefined
    });
  });

  it('updates URL hash with playlist id when jumpToPlaylist is called', () => {
    jumpToPlaylist('123456');

    expect(routerState.playlistId).toBe('123456');
    expect(routerState.tab).toBe(AppRoute.PLAYLIST);
    expect(location.hash).toBe('#playlist?id=123456');
    expect(localStorage.getItem(STORAGE_KEYS.LAST_PLAYLIST_ID)).toBe('123456');
  });

  it('navigates to daily recommend via jumpToDailyRecommend', () => {
    jumpToDailyRecommend();

    expect(routerState.playlistId).toBe(SpecialRouteId.DAILY_RECOMMEND);
    expect(location.hash).toBe('#playlist?id=daily-recommend');
  });

  it('resets URL hash and clears playlistId when exitPlaylistToGallery is called', () => {
    jumpToPlaylist('999');
    expect(location.hash).toBe('#playlist?id=999');

    exitPlaylistToGallery();

    expect(routerState.playlistId).toBe('');
    expect(location.hash).toBe('#playlist');
    expect(localStorage.getItem(STORAGE_KEYS.LAST_PLAYLIST_ID)).toBeNull();
  });

  it('resets URL hash and switches to download-mgr with local-playlists subtab when exitPlaylistToLocalManager is called', () => {
    jumpToPlaylist('local_favorites');
    expect(location.hash).toBe('#playlist?id=local_favorites');

    exitPlaylistToLocalManager();

    expect(routerState.playlistId).toBe('');
    expect(routerState.tab).toBe(AppRoute.DOWNLOAD_MGR);
    expect(routerState.downloadSubTab).toBe('local-playlists');
    expect(location.hash).toBe('#download-mgr');
    expect(localStorage.getItem(STORAGE_KEYS.LAST_PLAYLIST_ID)).toBeNull();
  });

  it('syncs playlistId from URL hash on route change', () => {
    const cleanup = initRouter();

    location.hash = '#playlist?id=88888';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(routerState.playlistId).toBe('88888');
    expect(routerState.tab).toBe(AppRoute.PLAYLIST);

    // 回到画廊
    location.hash = '#playlist';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(routerState.playlistId).toBe('');
    expect(routerState.tab).toBe(AppRoute.PLAYLIST);

    cleanup();
  });

  it('updates routerState when jumpToAlbum is called with id and name', async () => {
    const { jumpToAlbum } = await import('./router.svelte');
    jumpToAlbum('5566', 'Fantasy');

    expect(routerState.albumId).toBe('5566');
    expect(routerState.albumName).toBe('Fantasy');
    expect(routerState.albumTrigger).toBeGreaterThan(0);
    expect(routerState.tab).toBe(AppRoute.SEARCH);
    expect(location.hash).toBe('#search');
  });
});
