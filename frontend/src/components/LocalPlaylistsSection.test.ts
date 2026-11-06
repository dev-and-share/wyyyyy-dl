import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LocalPlaylistsSection from './LocalPlaylistsSection.svelte';
import { localPlaylistState } from '../lib/localPlaylistStore.svelte';
import { api } from '../lib/api';

describe('LocalPlaylistsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localPlaylistState.playlists = [
      { id: 'local_1', name: '我的摇滚', trackCount: 5, isLocal: true },
      { id: 'local_2', name: '民谣集', trackCount: 12, isLocal: true }
    ];
  });

  it('renders local playlist list and song counts', () => {
    const { getByText } = render(LocalPlaylistsSection, {
      props: {
        showToast: vi.fn()
      }
    });

    expect(getByText('我的摇滚')).toBeDefined();
    expect(getByText('5 首曲目')).toBeDefined();
    expect(getByText('民谣集')).toBeDefined();
    expect(getByText('12 首曲目')).toBeDefined();
  });

  it('filters local playlists by keyword', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(LocalPlaylistsSection, {
      props: {
        showToast: vi.fn()
      }
    });

    const searchInput = getByPlaceholderText('搜索本地歌单...');
    await fireEvent.input(searchInput, { target: { value: '摇滚' } });

    expect(getByText('我的摇滚')).toBeDefined();
    expect(queryByText('民谣集')).toBeNull();
  });

  it('calls onViewPlaylist when clicking a playlist card or view button', async () => {
    const onViewPlaylist = vi.fn();
    const { getByText } = render(LocalPlaylistsSection, {
      props: {
        onViewPlaylist,
        showToast: vi.fn()
      }
    });

    await fireEvent.click(getByText('我的摇滚'));
    expect(onViewPlaylist).toHaveBeenCalledWith('local_1');
  });
});
