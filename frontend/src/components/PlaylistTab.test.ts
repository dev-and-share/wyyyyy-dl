import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PlaylistTab from './PlaylistTab.svelte';
import { routerState, AppRoute, SpecialRouteId } from '../lib/router.svelte';
import { api } from '../lib/api';

describe('PlaylistTab (SP) Routing and URL Sync Contracts', () => {
  beforeEach(() => {
    localStorage.clear();
    location.hash = '';
    routerState.playlistId = '';
    routerState.tab = AppRoute.PLAYLIST;
    vi.spyOn(api, 'myPlaylist').mockResolvedValue({ code: '000000', data: { playlists: [
      { id: 2848981442, name: 'AndyF喜欢的音乐', trackCount: 1661, subscribed: false }
    ] } } as any);
    vi.spyOn(api, 'playlist').mockResolvedValue({ code: '000000', data: { playlist: { id: 2848981442, name: 'AndyF喜欢的音乐', tracks: [] } } } as any);
    vi.spyOn(api, 'recommendSongs').mockResolvedValue({ code: '000000', data: [] } as any);
  });

  it('defaults to "my" tab when URL is #playlist and updates URL when switching subtabs', async () => {
    location.hash = '#playlist';
    const { getByText } = render(PlaylistTab, {
      props: {
        playlistId: '',
        likedSet: new Set<number>(),
        showToast: vi.fn(),
        onToggleLike: vi.fn(),
        onPlayQueue: vi.fn()
      }
    });

    // 1. 初始应在我的歌单 Tab
    expect(location.hash).toBe('#playlist');

    // 2. 点击「每日推荐」
    const recommendTab = getByText('每日推荐');
    await fireEvent.click(recommendTab);

    expect(location.hash).toBe('#playlist?id=daily-recommend');
    expect(routerState.playlistId).toBe(SpecialRouteId.DAILY_RECOMMEND);

    // 3. 点击「我的歌单」
    const myTab = getByText('我的歌单');
    await fireEvent.click(myTab);

    expect(location.hash).toBe('#playlist');
    expect(routerState.playlistId).toBe('');
  });

  it('activates recommend tab directly without polluting pid input when URL has id=daily-recommend', async () => {
    location.hash = '#playlist?id=daily-recommend';
    routerState.playlistId = SpecialRouteId.DAILY_RECOMMEND;

    const { getByPlaceholderText, getByText } = render(PlaylistTab, {
      props: {
        playlistId: SpecialRouteId.DAILY_RECOMMEND,
        likedSet: new Set<number>(),
        showToast: vi.fn(),
        onToggleLike: vi.fn(),
        onPlayQueue: vi.fn()
      }
    });

    // 输入框不应被污染为 'daily-recommend'
    const input = getByPlaceholderText('粘贴歌单链接或输入歌单 ID...') as HTMLInputElement;
    expect(input.value).not.toBe('daily-recommend');

    // 点击「我的歌单」能成功清除 daily-recommend
    const myTab = getByText('我的歌单');
    await fireEvent.click(myTab);

    expect(location.hash).toBe('#playlist');
    expect(routerState.playlistId).toBe('');
  });

  it('updates URL hash to playlist id when viewing a specific playlist from list', async () => {
    location.hash = '#playlist';
    const { findByText } = render(PlaylistTab, {
      props: {
        playlistId: '',
        likedSet: new Set<number>(),
        showToast: vi.fn(),
        onToggleLike: vi.fn(),
        onPlayQueue: vi.fn()
      }
    });

    // 点击歌单“AndyF喜欢的音乐”
    const playlistCard = await findByText('AndyF喜欢的音乐');
    await fireEvent.click(playlistCard);

    expect(location.hash).toBe('#playlist?id=2848981442');
    expect(routerState.playlistId).toBe('2848981442');
  });
});
