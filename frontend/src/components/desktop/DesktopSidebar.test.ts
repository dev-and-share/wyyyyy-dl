import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import DesktopSidebar from './DesktopSidebar.svelte';

describe('DesktopSidebar', () => {
  it('renders navigation tabs and triggers onSwitchTab', async () => {
    const onSwitchTab = vi.fn();
    const onToggleCollapse = vi.fn();
    const onSwitchToLegacyTabs = vi.fn();

    const { getByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        downloadingCount: 3,
        onSwitchTab,
        onToggleCollapse,
        onSwitchToLegacyTabs
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
        onToggleCollapse,
        onSwitchToLegacyTabs: vi.fn()
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
        onToggleCollapse: vi.fn(),
        onSwitchToLegacyTabs: vi.fn()
      }
    });

    const sidebar = getByTestId('desktop-sidebar');
    expect(sidebar).toBeDefined();
  });
});
