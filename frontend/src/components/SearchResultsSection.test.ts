import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import SearchResultsSection from './SearchResultsSection.svelte';
import * as uiModule from '../lib/ui.svelte';

vi.mock('../lib/ui.svelte', () => ({
  openSheet: vi.fn(),
  closeSheet: vi.fn()
}));

describe('SearchResultsSection Component', () => {
  it('renders playlist results with cover, track count and triggers callbacks', async () => {
    const onPlaylist = vi.fn();
    const handlePlayPlaylist = vi.fn();
    const handleDownloadPlaylist = vi.fn();
    const showToast = vi.fn();

    const playlists = [
      {
        id: 17671713562,
        name: 'Jolin 蔡依林 经典全集',
        coverImgUrl: 'https://example.com/cover.jpg',
        trackCount: 120,
        creator: { nickname: '华语乐迷' }
      }
    ];

    const { getByText, getAllByRole } = render(SearchResultsSection, {
      props: {
        sResults: playlists,
        sType: '1000',
        searchLoading: false,
        hasSearched: true,
        onPlaylist,
        onAlbum: vi.fn(),
        onPlayQueue: vi.fn(),
        onViewArtist: vi.fn(),
        handlePlayPlaylist,
        handleDownloadPlaylist,
        showToast
      }
    });

    // 验证歌单名称与封面
    const titleBtn = getByText(/Jolin 蔡依林 经典全集/i);
    expect(titleBtn).toBeInTheDocument();
    expect(getByText(/共 120 首/i)).toBeInTheDocument();
    expect(getByText(/ID:17671713562/i)).toBeInTheDocument();

    // 点击歌单名称触发跳转
    await fireEvent.click(titleBtn);
    expect(onPlaylist).toHaveBeenCalledWith('17671713562');

    // 点击播放整单按钮
    const playBtns = getAllByRole('button', { name: /▶ 播放/i });
    expect(playBtns.length).toBeGreaterThan(0);
    await fireEvent.click(playBtns[0]);
    expect(handlePlayPlaylist).toHaveBeenCalledWith('17671713562', 'Jolin 蔡依林 经典全集');

    // 点击移动端更多操作按钮呼出 openSheet
    const moreActionsBtns = getAllByRole('button', { name: /更多操作/i });
    expect(moreActionsBtns.length).toBeGreaterThan(0);
    await fireEvent.click(moreActionsBtns[0]);
    expect(uiModule.openSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Jolin 蔡依林 经典全集',
        subtitle: expect.stringContaining('共 120 首')
      })
    );
  });

  it('renders album results and handles view album', async () => {
    const onAlbum = vi.fn();
    const albums = [
      {
        id: 12345,
        name: 'Ugly Beauty',
        picUrl: 'https://example.com/album.jpg',
        size: 11,
        artist: { name: '蔡依林' }
      }
    ];

    const { getByText } = render(SearchResultsSection, {
      props: {
        sResults: albums,
        sType: '10',
        searchLoading: false,
        hasSearched: true,
        onPlaylist: vi.fn(),
        onAlbum,
        onViewArtist: vi.fn(),
        handlePlayPlaylist: vi.fn(),
        handleDownloadPlaylist: vi.fn(),
        showToast: vi.fn()
      }
    });

    const albumTitle = getByText(/Ugly Beauty/i);
    expect(albumTitle).toBeInTheDocument();
    expect(getByText(/蔡依林/i)).toBeInTheDocument();
    expect(getByText(/11 首歌/i)).toBeInTheDocument();

    await fireEvent.click(albumTitle);
    expect(onAlbum).toHaveBeenCalledWith('12345');
  });

  it('renders artist results and handles view artist', async () => {
    const onViewArtist = vi.fn();
    const artists = [
      {
        id: 6452,
        name: '蔡依林',
        picUrl: 'https://example.com/artist.jpg'
      }
    ];

    const { getByText } = render(SearchResultsSection, {
      props: {
        sResults: artists,
        sType: '100',
        searchLoading: false,
        hasSearched: true,
        onPlaylist: vi.fn(),
        onAlbum: vi.fn(),
        onViewArtist,
        handlePlayPlaylist: vi.fn(),
        handleDownloadPlaylist: vi.fn(),
        showToast: vi.fn()
      }
    });

    const artistName = getByText(/蔡依林/i);
    expect(artistName).toBeInTheDocument();
    await fireEvent.click(artistName);
    expect(onViewArtist).toHaveBeenCalledWith('6452');
  });
});
