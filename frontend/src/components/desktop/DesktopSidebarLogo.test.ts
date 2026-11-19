import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import DesktopSidebar from './DesktopSidebar.svelte';

vi.mock('../../lib/api', () => ({
  api: {
    getGeoProxyConfig: vi.fn().mockResolvedValue({ code: '000000', data: {} }),
    testGeoProxy: vi.fn().mockResolvedValue({ code: '000000', data: { success: true } }),
    refreshGeoProxyPool: vi.fn().mockResolvedValue({ code: '000000' })
  }
}));

describe('DesktopSidebar Logo navigation', () => {
  it('navigates back to playlist when clicking logo from other tabs', async () => {
    const onSwitchTab = vi.fn();
    const onViewPlaylist = vi.fn();
    const { getByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'search',
        collapsed: false,
        onSwitchTab,
        onViewPlaylist,
        onToggleCollapse: vi.fn()
      }
    });

    const logo = getByTestId('wyy-logo');
    await fireEvent.click(logo);
    expect(onViewPlaylist).toHaveBeenCalledWith('');
    expect(onSwitchTab).toHaveBeenCalledWith('playlist');
  });

  it('resets playlist detail back to gallery when clicking logo while viewing a playlist', async () => {
    const onSwitchTab = vi.fn();
    const onViewPlaylist = vi.fn();
    const { getByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        currentPlaylistId: '123456',
        collapsed: false,
        onSwitchTab,
        onViewPlaylist,
        onToggleCollapse: vi.fn()
      }
    });

    const logo = getByTestId('wyy-logo');
    await fireEvent.click(logo);
    expect(onViewPlaylist).toHaveBeenCalledWith('');
    expect(onSwitchTab).toHaveBeenCalledWith('playlist');
  });
});
