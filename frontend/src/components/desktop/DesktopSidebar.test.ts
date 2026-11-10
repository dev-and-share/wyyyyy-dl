import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tick } from 'svelte';
import DesktopSidebar from './DesktopSidebar.svelte';
import { myPlaylists, recordPlaylistPlay, playlistPlayCounts } from '../../lib/playlist.svelte';
import { geoProxyState, updateGeoProxyState } from '../../lib/geoProxyStore.svelte';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    getGeoProxyConfig: vi.fn().mockResolvedValue({ code: '000000', data: {} }),
    testGeoProxy: vi.fn().mockResolvedValue({
      code: '000000',
      data: {
        success: true,
        proxy: '112.5.6.7:8080',
        location: '中国 广东 广州',
        latencyMs: 88,
        isFastestWinner: true
      }
    }),
    refreshGeoProxyPool: vi.fn().mockResolvedValue({ code: '000000' })
  }
}));

describe('DesktopSidebar', () => {
  beforeEach(() => {
    myPlaylists.length = 0;
    for (const key of Object.keys(playlistPlayCounts)) {
      delete playlistPlayCounts[key];
    }
    updateGeoProxyState({
      enabled: false,
      loaded: true,
      activeProxy: '',
      activeLocation: '',
      activeLatencyMs: null,
      fallbackDirect: false
    });
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

    const musicfreeBtn = getByTestId('sidebar-tab-musicfree');
    await fireEvent.click(musicfreeBtn);
    expect(onSwitchTab).toHaveBeenCalledWith('musicfree');
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

    const allShadow = getByTestId('sidebar-all-scroll-shadow');
    expect(allShadow).toBeDefined();

    // Simulate scroll overflow on all playlists
    const allContainer = allShadow.previousElementSibling as HTMLElement;
    Object.defineProperty(allContainer, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(allContainer, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(allContainer, 'scrollTop', { configurable: true, value: 0 });

    await fireEvent.scroll(allContainer);
    await tick();

    // Should show gradient shadow when there is more content below
    expect(allShadow.className).toContain('opacity-100');

    // Scroll to the bottom
    Object.defineProperty(allContainer, 'scrollTop', { configurable: true, value: 300 });
    await fireEvent.scroll(allContainer);
    await tick();

    // Should fade out shadow when scrolled to bottom
    expect(allShadow.className).toContain('opacity-0');
  });

  it('hides proxy network icon when proxy is not enabled', () => {
    updateGeoProxyState({ enabled: false, loaded: true });
    const { queryByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        onSwitchTab: vi.fn(),
        onToggleCollapse: vi.fn()
      }
    });

    expect(queryByTestId('sidebar-geo-proxy-icon')).toBeNull();
  });

  it('shows proxy network icon and details tooltip when proxy is enabled', () => {
    updateGeoProxyState({
      enabled: true,
      loaded: true,
      activeProxy: '120.232.115.57:3128',
      activeLocation: '中国 广东 佛山',
      activeLatencyMs: 274,
      fallbackDirect: false,
      mode: 'pool'
    });

    const { getByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        onSwitchTab: vi.fn(),
        onToggleCollapse: vi.fn()
      }
    });

    const icon = getByTestId('sidebar-geo-proxy-icon');
    expect(icon).toBeDefined();
    expect(icon.getAttribute('title')).toContain('120.232.115.57:3128');
    expect(icon.getAttribute('title')).toContain('中国 广东 佛山');
    expect(icon.getAttribute('title')).toContain('274ms');

    const tooltip = getByTestId('sidebar-proxy-tooltip');
    expect(tooltip).toBeDefined();
    expect(tooltip.textContent).toContain('120.232.115.57:3128');
    expect(tooltip.textContent).toContain('中国 广东 佛山');
    expect(tooltip.textContent).toContain('274 ms');
  });

  it('triggers proxy refresh when clicking proxy network icon', async () => {
    updateGeoProxyState({
      enabled: true,
      loaded: true,
      activeProxy: '120.232.115.57:3128',
      fallbackDirect: true,
      mode: 'pool'
    });

    const showToast = vi.fn();
    const { getByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        onSwitchTab: vi.fn(),
        onToggleCollapse: vi.fn(),
        showToast
      }
    });

    const icon = getByTestId('sidebar-geo-proxy-icon');
    expect(icon).toBeDefined();

    await fireEvent.click(icon);
    await tick();

    expect(api.testGeoProxy).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalled();
  });

  it('renders local playlist tab in sidebar and switches to local playlists', async () => {
    myPlaylists.push(
      { id: 101, name: '云端歌单', trackCount: 5, subscribed: false }
    );
    const { localPlaylistState } = await import('../../lib/localPlaylistStore.svelte');
    localPlaylistState.playlists = [
      { id: 'local_fav_123', name: '本地我喜欢的音乐', trackCount: 3, isLocal: true },
      { id: 'local_rock', name: '本地摇滚歌单', trackCount: 8, isLocal: true }
    ];

    const onPlaylistClick = vi.fn();
    const { getByTestId, getByText, queryByText } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        onSwitchTab: vi.fn(),
        onToggleCollapse: vi.fn(),
        onViewPlaylist: onPlaylistClick
      }
    });

    const localFilterBtn = getByTestId('sidebar-filter-local');
    expect(localFilterBtn).toBeDefined();
    expect(localFilterBtn.textContent).toContain('本地');

    // In All tab, both cloud and local playlists are visible
    expect(getByText('云端歌单')).toBeDefined();
    expect(getByText('本地摇滚歌单')).toBeDefined();

    // Click Local tab
    await fireEvent.click(localFilterBtn);
    await tick();

    // Now only local playlists are displayed
    expect(getByText('本地摇滚歌单')).toBeDefined();
    expect(queryByText('云端歌单')).toBeNull();

    // Click local playlist item
    const localItemBtn = getByText('本地摇滚歌单').closest('button');
    expect(localItemBtn).not.toBeNull();
    await fireEvent.click(localItemBtn!);
    expect(onPlaylistClick).toHaveBeenCalledWith('local_rock');
  });

  it('renders clean vertical layout in collapsed mode without duplicate folder shortcut', () => {
    updateGeoProxyState({
      enabled: true,
      loaded: true,
      activeProxy: '120.232.115.57:3128',
      fallbackDirect: false,
      mode: 'pool'
    });

    const onToggleCollapse = vi.fn();
    const { getByTestId, queryByText } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: true,
        onSwitchTab: vi.fn(),
        onToggleCollapse
      }
    });

    // 1. Unified center expand button exists with note icon and right arrow hint
    const toggleBtn = getByTestId('btn-toggle-sidebar');
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn.textContent).toContain('🎵');
    expect(toggleBtn.textContent).toContain('»');

    // 2. Click center button triggers toggle collapse
    fireEvent.click(toggleBtn);
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);

    // 3. Redundant folder button 📂 should not exist in collapsed mode
    expect(queryByText('📂')).toBeNull();

    // 4. Proxy icon and version info exist
    const proxyIcon = getByTestId('sidebar-geo-proxy-icon');
    expect(proxyIcon).toBeDefined();

    const versionInfo = getByTestId('sidebar-version-info');
    expect(versionInfo.textContent).toContain('v');
  });

  it('embeds playlist total count dynamically into search input placeholder without separate sticky count header', async () => {
    myPlaylists.push(
      { id: 101, name: '流行热歌', subscribed: false } as any,
      { id: 102, name: '轻音乐', subscribed: true } as any
    );

    const { container, getByTestId, queryByText } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        onSwitchTab: vi.fn(),
        onToggleCollapse: vi.fn()
      }
    });

    await tick();
    const input = container.querySelector('input');
    // 1. All mode: includes all cloud + local playlists
    expect(input?.placeholder).toContain('搜索全部');
    expect(input?.placeholder).toContain('个歌单...');

    // 2. Switch to created playlists filter
    const createdFilterBtn = getByTestId('sidebar-filter-created');
    await fireEvent.click(createdFilterBtn);
    await tick();
    expect(input?.placeholder).toBe('搜索 1 个自建歌单...');

    // 3. Switch to saved playlists filter
    const subscribedFilterBtn = getByTestId('sidebar-filter-subscribed');
    await fireEvent.click(subscribedFilterBtn);
    await tick();
    expect(input?.placeholder).toBe('搜索 1 个收藏歌单...');

    // 4. Playlists render directly, without separate sticky header block
    expect(queryByText('全部 4')).toBeNull();
  });
});
