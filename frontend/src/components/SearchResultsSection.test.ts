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

  it('renders track search results and includes add to playlist and view song detail in sheet', async () => {
    const onSong = vi.fn();
    const onPlayQueue = vi.fn();
    const tracks = [
      {
        id: 186016,
        name: '晴天',
        artists: [{ name: '周杰伦' }],
        picUrl: 'https://example.com/cover.jpg'
      }
    ];

    const { getByText, getAllByRole } = render(SearchResultsSection, {
      props: {
        sResults: tracks,
        sType: '1',
        searchLoading: false,
        hasSearched: true,
        onPlaylist: vi.fn(),
        onAlbum: vi.fn(),
        onPlayQueue,
        onSong,
        onViewArtist: vi.fn(),
        handlePlayPlaylist: vi.fn(),
        handleDownloadPlaylist: vi.fn(),
        showToast: vi.fn()
      }
    });

    const songTitleBtn = getByText(/晴天/i);
    expect(songTitleBtn).toBeInTheDocument();
    expect(getByText(/周杰伦/i)).toBeInTheDocument();

    // 点击歌曲标题触发 onSong
    await fireEvent.click(songTitleBtn);
    expect(onSong).toHaveBeenCalledWith('186016');

    // 移动端点击 ... 更多操作触发 openSheet
    const moreActionsBtns = getAllByRole('button', { name: /更多操作/i });
    expect(moreActionsBtns.length).toBeGreaterThan(0);
    await fireEvent.click(moreActionsBtns[0]);

    // 验证 sheet 参数中包含“➕ 收藏到歌单”与“🎧 查看单曲详情 / 下载”
    expect(uiModule.openSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '晴天',
        subtitle: '周杰伦',
        actions: expect.arrayContaining([
          expect.objectContaining({ label: '➕ 收藏到歌单' }),
          expect.objectContaining({ label: '🎧 查看单曲详情 / 下载' })
        ])
      })
    );
  });

  it('distinguishes songs with the same title strictly by ID, preventing duplicate playing states', async () => {
    const tracks = [
      { id: 2045007194, name: '幸福的滋味', artists: [{ name: '徐宝琪' }] },
      { id: 1985096971, name: '幸福的滋味', artists: [{ name: '陈盈洁' }] },
      { id: 190310, name: '幸福的滋味', artists: [{ name: '张宇' }] }
    ];

    const curTrack = {
      id: 2045007194,
      name: '幸福的滋味',
      artist: '徐宝琪'
    };

    const { getAllByText, container } = render(SearchResultsSection, {
      props: {
        sResults: tracks,
        sType: '1',
        searchLoading: false,
        hasSearched: true,
        curTrack,
        playing: true,
        onPlaylist: vi.fn(),
        onAlbum: vi.fn(),
        onPlayQueue: vi.fn(),
        onSong: vi.fn(),
        onViewArtist: vi.fn(),
        handlePlayPlaylist: vi.fn(),
        handleDownloadPlaylist: vi.fn(),
        showToast: vi.fn()
      }
    });

    // 只有 1 个条目（徐宝琪）应该具有 is-active-playing 高亮类，同名不同 ID 条目绝不高亮
    const activeItems = container.querySelectorAll('.is-active-playing');
    expect(activeItems.length).toBe(1);

    // 只有 1 个曲目显示播放中按钮（PC + SP 响应式各 1 个，共 2 个）
    const playingButtons = getAllByText(/播放中/);
    expect(playingButtons.length).toBe(2);

    // 其余 2 个未播放曲目各渲染 2 个试听按钮（PC + SP），共 4 个
    const trialButtons = getAllByText(/试听/);
    expect(trialButtons.length).toBe(4);
  });
});

