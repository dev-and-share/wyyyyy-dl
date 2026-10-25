import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RemoveFromPlaylistModal from './RemoveFromPlaylistModal.svelte';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    playlistRemove: vi.fn().mockResolvedValue({ code: '000000', data: { code: 200 } }),
    deleteSongFile: vi.fn().mockResolvedValue({ code: '000000', data: true })
  }
}));

vi.mock('../lib/browserCacheHelper', () => ({
  removeTrackBrowserCache: vi.fn().mockResolvedValue(true)
}));

vi.mock('../lib/playlist.svelte', () => ({
  removeTrackFromCurrentPlaylist: vi.fn()
}));

vi.mock('../lib/trackStatus.svelte', () => ({
  unmarkSongDownloaded: vi.fn()
}));

describe('RemoveFromPlaylistModal', () => {
  const mockSong = { id: 18915, name: '晴天', artist: '周杰伦' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders song name, playlist info and default switches (browserCache ON, serverFile OFF)', () => {
    const { getByText, getByTestId } = render(RemoveFromPlaylistModal, {
      props: {
        song: mockSong,
        playlistId: '998877',
        playlistName: '周杰伦精选集',
        onClose: vi.fn(),
        showToast: vi.fn()
      }
    });

    expect(getByText('晴天')).toBeInTheDocument();
    expect(getByText('从歌单移除歌曲')).toBeInTheDocument();
    expect(getByText(/周杰伦精选集/)).toBeInTheDocument();

    const cacheCheckbox = getByTestId('toggle-delete-browser-cache') as HTMLInputElement;
    const serverCheckbox = getByTestId('toggle-delete-server-file') as HTMLInputElement;

    // 验证默认开关: 浏览器缓存 ON, 服务器文件 OFF
    expect(cacheCheckbox.checked).toBe(true);
    expect(serverCheckbox.checked).toBe(false);
  });

  it('calls onClose when cancel button is clicked', async () => {
    const onClose = vi.fn();
    const { getByText } = render(RemoveFromPlaylistModal, {
      props: {
        song: mockSong,
        playlistId: '998877',
        playlistName: '周杰伦精选集',
        onClose,
        showToast: vi.fn()
      }
    });

    await fireEvent.click(getByText('取消'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('removes from playlist with default switches (clears browser cache, does not delete server file)', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const showToast = vi.fn();

    const { getByTestId } = render(RemoveFromPlaylistModal, {
      props: {
        song: mockSong,
        playlistId: '998877',
        playlistName: '周杰伦精选集',
        onClose,
        onSuccess,
        showToast
      }
    });

    await fireEvent.click(getByTestId('btn-confirm-remove'));
    await new Promise(r => setTimeout(r, 100));

    expect(api.playlistRemove).toHaveBeenCalledWith('998877', '18915');
    expect(api.deleteSongFile).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('已从歌单「周杰伦精选集」移除《晴天》'), 'success');
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      removedFromPlaylist: true,
      removedBrowserCache: true,
      removedServerFile: false
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('deletes server file when server file switch is checked', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const showToast = vi.fn();

    const { getByTestId } = render(RemoveFromPlaylistModal, {
      props: {
        song: mockSong,
        playlistId: '998877',
        playlistName: '周杰伦精选集',
        onClose,
        onSuccess,
        showToast
      }
    });

    const serverCheckbox = getByTestId('toggle-delete-server-file') as HTMLInputElement;
    await fireEvent.click(serverCheckbox);
    expect(serverCheckbox.checked).toBe(true);

    await fireEvent.click(getByTestId('btn-confirm-remove'));
    await new Promise(r => setTimeout(r, 100));

    expect(api.playlistRemove).toHaveBeenCalledWith('998877', '18915');
    expect(api.deleteSongFile).toHaveBeenCalledWith(18915, '晴天', '周杰伦');
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      removedFromPlaylist: true,
      removedBrowserCache: true,
      removedServerFile: true
    }));
  });
});
