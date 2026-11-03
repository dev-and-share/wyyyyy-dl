import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isLocalPlaylist,
  localPlaylistState,
  loadLocalPlaylists,
  createLocalPlaylist,
  deleteLocalPlaylist,
  addTrackToLocalPlaylist,
  removeTrackFromLocalPlaylist
} from './localPlaylistStore.svelte';
import { api } from './api';

describe('localPlaylistStore contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localPlaylistState.playlists = [];
    localPlaylistState.loading = false;
  });

  it('correctly identifies local playlist IDs', () => {
    expect(isLocalPlaylist('local_12345678')).toBe(true);
    expect(isLocalPlaylist('123456')).toBe(false);
    expect(isLocalPlaylist(null)).toBe(false);
    expect(isLocalPlaylist(undefined)).toBe(false);
  });

  it('loads local playlists from api', async () => {
    const mockList = [
      { id: 'local_1', name: '我的摇滚', trackCount: 5, isLocal: true },
      { id: 'local_2', name: '车载无损', trackCount: 12, isLocal: true }
    ];
    vi.spyOn(api, 'localPlaylistList').mockResolvedValue({
      code: '000000',
      data: mockList
    } as any);

    const res = await loadLocalPlaylists();
    expect(res).toHaveLength(2);
    expect(localPlaylistState.playlists).toHaveLength(2);
    expect(localPlaylistState.playlists[0].name).toBe('我的摇滚');
  });

  it('creates new local playlist and reloads', async () => {
    vi.spyOn(api, 'localPlaylistCreate').mockResolvedValue({
      code: '000000',
      data: { id: 'local_new', name: '新歌单', trackCount: 0, isLocal: true }
    } as any);
    vi.spyOn(api, 'localPlaylistList').mockResolvedValue({
      code: '000000',
      data: [{ id: 'local_new', name: '新歌单', trackCount: 0, isLocal: true }]
    } as any);

    const res = await createLocalPlaylist('新歌单');
    expect(res.success).toBe(true);
    expect(res.data?.id).toBe('local_new');
    expect(localPlaylistState.playlists).toHaveLength(1);
  });

  it('prevents creating playlist with empty name', async () => {
    const res = await createLocalPlaylist('   ');
    expect(res.success).toBe(false);
  });

  it('adds track to local playlist and increments trackCount', async () => {
    localPlaylistState.playlists = [
      { id: 'local_1', name: '车载无损', trackCount: 3, isLocal: true }
    ];
    vi.spyOn(api, 'localPlaylistAddTrack').mockResolvedValue({
      code: '000000',
      msg: '添加成功'
    } as any);

    const res = await addTrackToLocalPlaylist('local_1', {
      name: '富士山下',
      artist: '陈奕迅'
    });
    expect(res.success).toBe(true);
    expect(localPlaylistState.playlists[0].trackCount).toBe(4);
  });

  it('removes track from local playlist and decrements trackCount', async () => {
    localPlaylistState.playlists = [
      { id: 'local_1', name: '车载无损', trackCount: 3, isLocal: true }
    ];
    vi.spyOn(api, 'localPlaylistRemoveTrack').mockResolvedValue({
      code: '000000',
      msg: '已移除'
    } as any);

    const res = await removeTrackFromLocalPlaylist('local_1', 101);
    expect(res.success).toBe(true);
    expect(localPlaylistState.playlists[0].trackCount).toBe(2);
  });

  it('deletes local playlist', async () => {
    localPlaylistState.playlists = [
      { id: 'local_1', name: '车载无损', trackCount: 3, isLocal: true }
    ];
    vi.spyOn(api, 'localPlaylistDelete').mockResolvedValue({
      code: '000000',
      msg: '删除成功'
    } as any);

    const res = await deleteLocalPlaylist('local_1');
    expect(res.success).toBe(true);
    expect(localPlaylistState.playlists).toHaveLength(0);
  });
});
