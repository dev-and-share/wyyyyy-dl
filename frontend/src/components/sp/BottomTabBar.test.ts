import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import BottomTabBar from './BottomTabBar.svelte';

describe('BottomTabBar Component', () => {
  it('renders all 4 tabs including Discover (MusicFree)', () => {
    const { getByTestId, getByText } = render(BottomTabBar, {
      props: {
        tab: 'playlist',
        onSwitchTab: () => {}
      }
    });

    expect(getByTestId('bottom-tab-playlist')).toBeDefined();
    expect(getByTestId('bottom-tab-search')).toBeDefined();
    expect(getByTestId('bottom-tab-musicfree')).toBeDefined();
    expect(getByTestId('bottom-tab-download-mgr')).toBeDefined();

    expect(getByText('歌单')).toBeDefined();
    expect(getByText('搜索')).toBeDefined();
    expect(getByText('发现')).toBeDefined();
    expect(getByText('本地')).toBeDefined();
  });

  it('triggers onSwitchTab with musicfree when clicking Discover tab', async () => {
    const onSwitchTab = vi.fn();
    const { getByTestId } = render(BottomTabBar, {
      props: {
        tab: 'playlist',
        onSwitchTab
      }
    });

    const discoverBtn = getByTestId('bottom-tab-musicfree');
    await fireEvent.click(discoverBtn);
    expect(onSwitchTab).toHaveBeenCalledWith('musicfree');
  });

  it('highlights the active tab accordingly', () => {
    const { getByTestId } = render(BottomTabBar, {
      props: {
        tab: 'musicfree',
        onSwitchTab: () => {}
      }
    });

    const discoverBtn = getByTestId('bottom-tab-musicfree');
    expect(discoverBtn.className).toContain('font-bold');
    expect(discoverBtn.className).toContain('scale-105');
  });
});
