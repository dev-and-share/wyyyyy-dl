import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tick } from 'svelte';
import DesktopSidebar from './DesktopSidebar.svelte';
import { myPlaylists, recordPlaylistPlay, playlistPlayCounts } from '../../lib/playlist.svelte';

describe('DesktopSidebar', () => {
  beforeEach(() => {
    myPlaylists.length = 0;
    for (const key of Object.keys(playlistPlayCounts)) {
      delete playlistPlayCounts[key];
    }
  });
  it('renders navigation tabs and triggers onSwitchTab', async () => {
    const onSwitchTab = vi.fn();
    const onToggleCollapse = vi.fn();

    const { getByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        downloadingCount: 3,
        onSwitchTab,
        onToggleCollapse
      }
    });

    const searchBtn = getByTestId('sidebar-tab-search');
    await fireEvent.click(searchBtn);
    expect(onSwitchTab).toHaveBeenCalledWith('search');

    const downloadBtn = getByTestId('sidebar-tab-download-mgr');
    await fireEvent.click(downloadBtn);
    expect(onSwitchTab).toHaveBeenCalledWith('download-mgr');
  });

  it('triggers onOpenDownloadTasks only when clicking the downloading badge', async () => {
    const onSwitchTab = vi.fn();
    const onOpenDownloadTasks = vi.fn();

    const { getByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        downloadingCount: 271,
        onSwitchTab,
        onOpenDownloadTasks,
        onToggleCollapse: vi.fn()
      }
    });

    const badge = getByTestId('sidebar-downloading-badge');
    expect(badge.textContent?.trim()).toBe('271');
    await fireEvent.click(badge);
    expect(onOpenDownloadTasks).toHaveBeenCalledTimes(1);
  });

  it('handles toggle collapse action', async () => {
    const onToggleCollapse = vi.fn();

    const { getByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        onSwitchTab: vi.fn(),
        onToggleCollapse
      }
    });

    const toggleBtn = getByTestId('btn-toggle-sidebar');
    expect(toggleBtn.textContent?.trim()).toBe('«');
    await fireEvent.click(toggleBtn);
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('renders sidebar container correctly', async () => {
    const { getByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        onSwitchTab: vi.fn(),
        onToggleCollapse: vi.fn()
      }
    });

    const sidebar = getByTestId('desktop-sidebar');
    expect(sidebar).toBeDefined();

    const versionInfo = getByTestId('sidebar-version-info');
    expect(versionInfo).toBeDefined();
  });

  it('handles daily recommend navigation click and active states', async () => {
    const onViewPlaylist = vi.fn();
    const onSwitchTab = vi.fn();

    const { getByTestId, rerender } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        currentPlaylistId: '',
        collapsed: false,
        onSwitchTab,
        onViewPlaylist,
        onToggleCollapse: vi.fn()
      }
    });

    const recommendBtn = getByTestId('sidebar-tab-recommend');
    expect(recommendBtn).toBeDefined();
    await fireEvent.click(recommendBtn);
    expect(onViewPlaylist).toHaveBeenCalledWith('daily-recommend');

    // 重新传入 currentPlaylistId: 'daily-recommend'
    await rerender({
      tab: 'playlist',
      currentPlaylistId: 'daily-recommend',
      collapsed: false,
      onSwitchTab,
      onViewPlaylist,
      onToggleCollapse: vi.fn()
    });

    const playlistBtn = getByTestId('sidebar-tab-playlist');
    const updatedRecommendBtn = getByTestId('sidebar-tab-recommend');

    expect(updatedRecommendBtn.className).toContain('bg-[var(--nav-tab-active-bg)]');
    expect(playlistBtn.className).not.toContain('bg-[var(--nav-tab-active-bg)]');
  });

  it('renders fire play count badge in sidebar when playCount > 0 and supports direct playback', async () => {
    myPlaylists.push(
      { id: 101, name: '童一首歌', trackCount: 8, subscribed: false },
      { id: 102, name: '收藏古典', trackCount: 50, subscribed: true }
    );

    recordPlaylistPlay(101);
    recordPlaylistPlay(101);
    recordPlaylistPlay(101); // 3 次
    recordPlaylistPlay(102); // 1 次

    const onPlayPlaylist = vi.fn();

    const { getByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        onSwitchTab: vi.fn(),
        onToggleCollapse: vi.fn(),
        onPlayPlaylist
      }
    });

    const fireCreated = getByTestId('sidebar-playcount-101');
    expect(fireCreated).toBeDefined();
    expect(fireCreated.textContent).toContain('🔥 3');

    const fireSubscribed = getByTestId('sidebar-playcount-102');
    expect(fireSubscribed).toBeDefined();
    expect(fireSubscribed.textContent).toContain('🔥 1');

    const playBtn = getByTestId('sidebar-playbtn-101');
    expect(playBtn).toBeDefined();
    await fireEvent.click(playBtn);
    expect(onPlayPlaylist).toHaveBeenCalledWith('101', '童一首歌');
  });

  it('preserves sidebar order without jitter when play count updates in current session', async () => {
    myPlaylists.push(
      { id: 999, name: '我喜欢的音乐', specialType: 5, subscribed: false },
      { id: 201, name: '歌单 A', trackCount: 10, subscribed: false },
      { id: 202, name: '歌单 B', trackCount: 20, subscribed: false }
    );

    for (let i = 0; i < 5; i++) recordPlaylistPlay(201);
    for (let i = 0; i < 3; i++) recordPlaylistPlay(202);

    const { getByTestId, container } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        onSwitchTab: vi.fn(),
        onToggleCollapse: vi.fn()
      }
    });

    // Check initial order: 201 has 5 plays, 202 has 3 plays
    let countSpans = container.querySelectorAll('[data-testid^="sidebar-playcount-2"]');
    expect(countSpans[0].getAttribute('data-testid')).toBe('sidebar-playcount-201');
    expect(countSpans[1].getAttribute('data-testid')).toBe('sidebar-playcount-202');

    // 202 is played multiple times, reaching 8 plays (> 5)
    for (let i = 0; i < 5; i++) recordPlaylistPlay(202);
    await tick();

    // 1. Badge updates immediately: 202 now shows 🔥 8
    expect(getByTestId('sidebar-playcount-202').textContent).toContain('🔥 8');

    // 2. Sidebar order is preserved (session freeze, no jump)
    countSpans = container.querySelectorAll('[data-testid^="sidebar-playcount-2"]');
    expect(countSpans[0].getAttribute('data-testid')).toBe('sidebar-playcount-201');
    expect(countSpans[1].getAttribute('data-testid')).toBe('sidebar-playcount-202');
  });

  it('renders bottom scroll shadow indicators and responds to scroll overflow', async () => {
    myPlaylists.push(
      { id: 301, name: '自建歌单 1', trackCount: 10, subscribed: false },
      { id: 302, name: '自建歌单 2', trackCount: 10, subscribed: false },
      { id: 401, name: '收藏歌单 1', trackCount: 15, subscribed: true },
      { id: 402, name: '收藏歌单 2', trackCount: 15, subscribed: true }
    );

    const { getByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        onSwitchTab: vi.fn(),
        onToggleCollapse: vi.fn()
      }
    });

    const createdShadow = getByTestId('sidebar-created-scroll-shadow');
    const subscribedShadow = getByTestId('sidebar-subscribed-scroll-shadow');

    expect(createdShadow).toBeDefined();
    expect(subscribedShadow).toBeDefined();

    // Verify subscribed playlist scroll container does not have pt-0.5 which causes gap bug
    const subscribedContainer = subscribedShadow.previousElementSibling as HTMLElement;
    expect(subscribedContainer).toBeDefined();
    expect(subscribedContainer.className).not.toContain('pt-0.5');

    // Simulate scroll overflow on created playlists
    const createdContainer = createdShadow.previousElementSibling as HTMLElement;
    Object.defineProperty(createdContainer, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(createdContainer, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(createdContainer, 'scrollTop', { configurable: true, value: 0 });

    await fireEvent.scroll(createdContainer);
    await tick();

    // Should show gradient shadow when there is more content below
    expect(createdShadow.className).toContain('opacity-100');

    // Scroll to the bottom
    Object.defineProperty(createdContainer, 'scrollTop', { configurable: true, value: 300 });
    await fireEvent.scroll(createdContainer);
    await tick();

    // Should fade out shadow when scrolled to bottom
    expect(createdShadow.className).toContain('opacity-0');
  });
});
