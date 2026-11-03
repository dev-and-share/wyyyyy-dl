import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AddToPlaylistModal from './AddToPlaylistModal.svelte';
import { api } from '../lib/api';
import { localPlaylistState } from '../lib/localPlaylistStore.svelte';
import { taskState } from '../lib/taskStore.svelte';
import { myPlaylists } from '../lib/playlist.svelte';

describe('AddToPlaylistModal hybrid contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localPlaylistState.playlists = [
      { id: 'local_1', name: '我的本地车载', trackCount: 3, isLocal: true }
    ];
    myPlaylists.length = 0;
    myPlaylists.push({ id: 1001, name: '网易云自建歌单', trackCount: 10, subscribed: false });
    taskState.downloadedSet = new Set();
    taskState.downloadedCustomSet = new Set();
  });

  it('renders standard NetEase song with both cloud and local playlist tabs', async () => {
    const { getByText, findByText } = render(AddToPlaylistModal, {
      props: {
        song: { id: 186016, name: '晴天', artist: '周杰伦' },
        onClose: vi.fn(),
        showToast: vi.fn()
      }
    });

    expect(getByText('☁️ 网易云歌单')).toBeInTheDocument();
    expect(getByText('🖥️ 本地专属歌单 (零污染云端)')).toBeInTheDocument();
    expect(await findByText('网易云自建歌单')).toBeInTheDocument();
  });

  it('shows warning and blocks adding when external MusicFree song is NOT downloaded or cached', async () => {
    const { getByText, queryByText } = render(AddToPlaylistModal, {
      props: {
        song: { id: 'mf_hash_123', name: '富士山下 (DJ版)', artist: '陈奕迅', _isMusicFree: true },
        onClose: vi.fn(),
        showToast: vi.fn()
      }
    });

    // 应该只展示本地专属歌单，不展示网易云歌单选项卡，防止污染云端
    expect(queryByText('☁️ 网易云歌单')).toBeNull();
    expect(getByText('外部音源需先下载或缓存')).toBeInTheDocument();
  });

  it('allows adding to local playlist when external MusicFree song is downloaded locally', async () => {
    const trackId = 'mf_hash_123';
    taskState.downloadedCustomSet.add(trackId);

    const showToast = vi.fn();
    const onClose = vi.fn();
    vi.spyOn(api, 'localPlaylistAddTrack').mockResolvedValue({
      code: '000000',
      msg: '成功'
    } as any);

    const { findByText } = render(AddToPlaylistModal, {
      props: {
        song: { id: trackId, name: '富士山下 (DJ版)', artist: '陈奕迅', _isMusicFree: true, isLocal: true },
        onClose,
        showToast
      }
    });

    const targetPl = await findByText('我的本地车载');
    expect(targetPl).toBeInTheDocument();
    const addBtn = await findByText('➕ 加入本地');
    await fireEvent.click(addBtn);

    expect(api.localPlaylistAddTrack).toHaveBeenCalledWith(
      'local_1',
      expect.objectContaining({
        name: '富士山下 (DJ版)',
        artist: '陈奕迅'
      })
    );
    expect(onClose).toHaveBeenCalled();
  });
});
