import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MyPlaylistsSection from './MyPlaylistsSection.svelte';
import { myPlaylists, recordPlaylistPlay, playlistPlayCounts, loadMyPlaylists, playlistState } from '../lib/playlist.svelte';
import { api } from '../lib/api';

describe('MyPlaylistsSection (SP) Tab Ordering Contracts', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(api, 'myPlaylist').mockResolvedValue({ code: '000000', data: { playlists: [] } } as any);
    myPlaylists.length = 0;
    for (const key of Object.keys(playlistPlayCounts)) {
      delete playlistPlayCounts[key];
    }
    playlistState.filter = 'all';
  });

  it('renders tabs in unified order (All -> Created -> Subscribed) and defaults to All', async () => {
    myPlaylists.push(
      { id: 999, name: '我喜欢的音乐', specialType: 5, trackCount: 50, subscribed: false },
      { id: 101, name: '普通自建歌单', trackCount: 5, subscribed: false },
      { id: 102, name: '热门自建10次', trackCount: 8, subscribed: false },
      { id: 103, name: '热门收藏25次', trackCount: 15, subscribed: true }
    );

    for (let i = 0; i < 10; i++) recordPlaylistPlay(102);
    for (let i = 0; i < 25; i++) recordPlaylistPlay(103);

    const onViewPlaylist = vi.fn();
    const onPlayPlaylist = vi.fn();
    const showToast = vi.fn();

    const { getByText, queryByText, container } = render(MyPlaylistsSection, {
      props: {
        open: true,
        flat: false,
        onViewPlaylist,
        onPlayPlaylist,
        showToast
      }
    });

    // 1. Check tab button order in DOM: All -> Created -> Subscribed
    const tabContainer = container.querySelector('.flex.gap-1\\.5.items-center.flex-wrap');
    expect(tabContainer).not.toBeNull();
    const buttons = tabContainer?.querySelectorAll('button') || [];
    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent).toContain('全部');
    expect(buttons[1].textContent).toContain('创建');
    expect(buttons[2].textContent).toContain('收藏');

    // Default tab is "All" (全部) with ring-2 active class
    expect(buttons[0].className).toContain('ring-2');

    // In All tab, favorite is pinned 1st, then high playCount (103: 25, 102: 10), then unplayed (101)
    const trackTitles = Array.from(container.querySelectorAll('.clickable-track-title')).map(el => el.textContent?.trim());
    expect(trackTitles).toEqual(['我喜欢的音乐', '热门收藏25次', '热门自建10次', '普通自建歌单']);

    // 2. Click "Created" (创建)
    await fireEvent.click(buttons[1]);
    expect(queryByText('热门收藏25次')).toBeNull(); // Subscribed playlist is filtered out
    expect(getByText('我喜欢的音乐')).toBeDefined();
    expect(getByText('热门自建10次')).toBeDefined();
    expect(getByText('普通自建歌单')).toBeDefined();
  });
});
