import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import PlaylistTrackFilter from './PlaylistTrackFilter.svelte';
import {
  allTracks,
  getFilteredTracks,
  getPlaylistSearchKeyword,
  setPlaylistSearchKeyword,
  renderPlaylist
} from '../lib/playlist.svelte';

describe('PlaylistTrackFilter Component', () => {
  beforeEach(() => {
    setPlaylistSearchKeyword('');
    renderPlaylist({
      id: 123,
      name: '测试歌单',
      tracks: [
        { id: 1, name: '晴天', ar: [{ name: '周杰伦' }] },
        { id: 2, name: '七里香', ar: [{ name: '周杰伦' }] },
        { id: 3, name: '十年', ar: [{ name: '陈奕迅' }] },
        { id: 4, name: '红豆', ar: [{ name: '王菲' }] }
      ]
    });
  });

  it('filters tracks by song name and artist correctly', async () => {
    const { getByPlaceholderText, getByText, queryByText, getByTitle } = render(PlaylistTrackFilter);
    const input = getByPlaceholderText('过滤当前歌单歌曲 (匹配歌手、歌名)...') as HTMLInputElement;

    expect(input.type).toBe('search');
    expect(getFilteredTracks().length).toBe(4);

    // 搜索歌名 "晴天"
    await fireEvent.input(input, { target: { value: '晴天' } });
    expect(getPlaylistSearchKeyword()).toBe('晴天');
    expect(getFilteredTracks().length).toBe(1);
    expect(getFilteredTracks()[0].name).toBe('晴天');
    expect(getByText((_, el) => el?.tagName.toLowerCase() === 'span' && (el?.textContent?.includes('匹配 1 / 4 首') ?? false))).toBeInTheDocument();

    // 搜索歌手 "周杰伦"
    await fireEvent.input(input, { target: { value: '周杰伦' } });
    expect(getFilteredTracks().length).toBe(2);
    expect(getByText((_, el) => el?.tagName.toLowerCase() === 'span' && (el?.textContent?.includes('匹配 2 / 4 首') ?? false))).toBeInTheDocument();

    // 点击清除按钮
    const clearBtn = getByTitle('清除筛选');
    await fireEvent.click(clearBtn);
    expect(getPlaylistSearchKeyword()).toBe('');
    expect(getFilteredTracks().length).toBe(4);
    expect(queryByText(/匹配/)).toBeNull();
  });
});
