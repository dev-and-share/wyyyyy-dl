import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DesktopPlaylistView from './DesktopPlaylistView.svelte';
import { routerState } from '../../lib/router.svelte';
import { recordPlaylistPlay, clearPlaylistPlayCount, playlistPlayCounts } from '../../lib/playlist.svelte';

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

  it('calls exitPlaylistToLocalManager and switches to download-mgr with local-playlists subtab when returning from local playlist', async () => {
    const { getByTestId } = render(DesktopPlaylistView, {
      props: {
        playlistId: 'local_favorites',
        likedSet: new Set<number>(),
        onToggleLike: vi.fn(),
        onPlayQueue: vi.fn(),
        showToast: vi.fn()
      }
    });

    expect(getByTestId('desktop-playlist-detail')).toBeInTheDocument();
    const backBtn = getByTestId('btn-back-gallery');
    expect(backBtn).toHaveTextContent('返回本地歌单');

    await fireEvent.click(backBtn);

    expect(routerState.tab).toBe('download-mgr');
    expect(routerState.downloadSubTab).toBe('local-playlists');
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

  it('renders 🔥 play count badge in playlist detail, and prompts confirm on double click to clear', async () => {
    // 预设播放 5 次
    for (const k of Object.keys(playlistPlayCounts)) delete playlistPlayCounts[k];
    recordPlaylistPlay('101');
    recordPlaylistPlay('101');
    recordPlaylistPlay('101');
    recordPlaylistPlay('101');
    recordPlaylistPlay('101');

    const showToastMock = vi.fn();
    const { getByTestId, findByTestId } = render(DesktopPlaylistView, {
      props: {
        playlistId: '101',
        likedSet: new Set<number>(),
        onToggleLike: vi.fn(),
        onPlayQueue: vi.fn(),
        showToast: showToastMock
      }
    });

    const badge = await findByTestId('detail-playcount-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('🔥 5次');

    // 1. 双击时用户点击“取消”
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await fireEvent.dblClick(badge);
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('周杰伦经典'));
    expect(badge.textContent).toContain('🔥 5次');

    // 2. 双击时用户点击“确定”
    confirmSpy.mockReturnValue(true);
    await fireEvent.dblClick(badge);
    expect(badge.textContent).toContain('🔥 0次');
    expect(showToastMock).toHaveBeenCalledWith('已清空歌单播放次数', 'success');

    // 3. 再次双击已为 0 的徽标
    confirmSpy.mockClear();
    await fireEvent.dblClick(badge);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith('播放次数已经是 0 了', 'info');

    confirmSpy.mockRestore();
  });
});
