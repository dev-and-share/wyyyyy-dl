import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import DesktopSidebar from './DesktopSidebar.svelte';

describe('DesktopSidebar', () => {
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
});
