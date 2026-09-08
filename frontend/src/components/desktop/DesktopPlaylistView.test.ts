import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import DesktopPlaylistView from './DesktopPlaylistView.svelte';

vi.mock('../../lib/api', () => ({
  api: {
    myPlaylist: vi.fn().mockResolvedValue({
      code: '000000',
      data: {
        playlists: [
          { id: '101', name: '周杰伦经典', trackCount: 20, coverImgUrl: '/test.png', subscribed: false }
        ]
      }
    }),
    playlist: vi.fn().mockResolvedValue({
      code: '000000',
      data: {
        playlist: {
          id: '101',
          name: '周杰伦经典',
          creator: 'Tester',
          tracks: [
            { id: 1, name: '晴天', ar: [{ name: '周杰伦' }], al: { name: '叶惠美', picUrl: '/cover.png' } }
          ]
        }
      }
    }),
    downloadSingle: vi.fn().mockResolvedValue({ code: '000000', data: { status: 'SUCCESS', name: '晴天' } }),
    downloadPlaylist: vi.fn().mockResolvedValue({ code: '000000' })
  }
}));

describe('DesktopPlaylistView', () => {
  it('renders gallery view initially when playlistId is empty', async () => {
    const { getByTestId, queryByTestId } = render(DesktopPlaylistView, {
      props: {
        playlistId: '',
        likedSet: new Set<number>(),
        onToggleLike: vi.fn(),
        onPlayQueue: vi.fn(),
        showToast: vi.fn()
      }
    });

    expect(getByTestId('desktop-playlist-gallery')).toBeInTheDocument();
    expect(queryByTestId('desktop-playlist-detail')).toBeNull();
  });

  it('renders detail view when playlistId is set and can return to gallery', async () => {
    const { getByTestId, queryByTestId } = render(DesktopPlaylistView, {
      props: {
        playlistId: '101',
        likedSet: new Set<number>(),
        onToggleLike: vi.fn(),
        onPlayQueue: vi.fn(),
        showToast: vi.fn()
      }
    });

    expect(getByTestId('desktop-playlist-detail')).toBeInTheDocument();

    const backBtn = getByTestId('btn-back-gallery');
    await fireEvent.click(backBtn);

    expect(getByTestId('desktop-playlist-gallery')).toBeInTheDocument();
  });

  it('does NOT show "未找到歌单信息" while loading or on initial render', async () => {
    const { queryByText } = render(DesktopPlaylistView, {
      props: {
        playlistId: '999999',
        likedSet: new Set<number>(),
        onToggleLike: vi.fn(),
        onPlayQueue: vi.fn(),
        showToast: vi.fn()
      }
    });

    expect(queryByText('未找到歌单信息')).toBeNull();
  });
});
