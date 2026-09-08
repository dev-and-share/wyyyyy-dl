import { describe, it, expect, beforeEach } from 'vitest';
import { routerState, jumpToPlaylist, exitPlaylistToGallery, switchTab, initRouter } from './router.svelte';

describe('router navigation and URL sync contracts', () => {
  beforeEach(() => {
    localStorage.clear();
    location.hash = '';
    routerState.playlistId = '';
    routerState.tab = 'playlist';
  });

  it('updates URL hash with playlist id when jumpToPlaylist is called', () => {
    jumpToPlaylist('123456');

    expect(routerState.playlistId).toBe('123456');
    expect(routerState.tab).toBe('playlist');
    expect(location.hash).toBe('#playlist?id=123456');
    expect(localStorage.getItem('wyyyy_last_playlist_id')).toBe('123456');
  });

  it('resets URL hash and clears playlistId when exitPlaylistToGallery is called', () => {
    jumpToPlaylist('999');
    expect(location.hash).toBe('#playlist?id=999');

    exitPlaylistToGallery();

    expect(routerState.playlistId).toBe('');
    expect(location.hash).toBe('#playlist');
    expect(localStorage.getItem('wyyyy_last_playlist_id')).toBeNull();
  });

  it('syncs playlistId from URL hash on route change', () => {
    const cleanup = initRouter();

    location.hash = '#playlist?id=88888';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(routerState.playlistId).toBe('88888');
    expect(routerState.tab).toBe('playlist');

    // 回到画廊
    location.hash = '#playlist';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(routerState.playlistId).toBe('');
    expect(routerState.tab).toBe('playlist');

    cleanup();
  });
});
