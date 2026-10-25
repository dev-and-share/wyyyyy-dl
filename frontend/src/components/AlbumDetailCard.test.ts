import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import AlbumDetailCard from './AlbumDetailCard.svelte';

describe('AlbumDetailCard Component', () => {
  it('renders album details correctly with nested album and songs data structure', () => {
    const mockAlbumData = {
      album: {
        id: 19228,
        name: '不甘寂寞',
        artist: '张宇',
        coverImgUrl: 'https://example.com/cover.jpg',
        publishTime: 1079625600000
      },
      songs: [
        {
          id: 190289,
          name: '最勇敢的季节',
          artists: '张宇',
          album: '不甘寂寞'
        }
      ]
    };

    const { getByText } = render(AlbumDetailCard, {
      props: {
        album: mockAlbumData,
        currentAlbumId: '19228',
        open: true,
        onLoadAlbum: vi.fn(),
        onDownloadFullAlbum: vi.fn(),
        onPlayFullAlbum: vi.fn(),
        onDownloadSingleTrack: vi.fn()
      }
    });

    // 验证专辑标题渲染
    expect(getByText('不甘寂寞')).toBeInTheDocument();
    // 验证歌手与格式化后的发行时间
    expect(getByText(/歌手：张宇/)).toBeInTheDocument();
    expect(getByText(/2004-03-/)).toBeInTheDocument();
    // 验证曲目数量
    expect(getByText(/共包含 1 首曲目/)).toBeInTheDocument();
    // 验证曲目列表渲染
    expect(getByText(/最勇敢的季节/)).toBeInTheDocument();
  });

  it('triggers onLoadAlbum on enter key in input', async () => {
    const onLoadAlbum = vi.fn();
    const { getByPlaceholderText } = render(AlbumDetailCard, {
      props: {
        album: null,
        currentAlbumId: '19228',
        open: true,
        onLoadAlbum,
        onDownloadFullAlbum: vi.fn(),
        onPlayFullAlbum: vi.fn(),
        onDownloadSingleTrack: vi.fn()
      }
    });

    const input = getByPlaceholderText(/输入专辑 ID/);
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onLoadAlbum).toHaveBeenCalled();
  });
});
