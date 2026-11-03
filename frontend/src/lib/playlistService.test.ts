import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playlistService, LocalPlaylistProvider, NeteasePlaylistProvider } from './playlistService';
import { api } from './api';

describe('PlaylistService & Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes local playlist IDs to LocalPlaylistProvider', async () => {
    const provider = playlistService.getProvider('local_123456');
    expect(provider.type).toBe('local');

    vi.spyOn(api, 'localPlaylistDetail').mockResolvedValue({
      code: '000000',
      data: { id: 'local_123456', name: '本地精选', tracks: [{ id: 1, name: '本地曲' }] }
    });

    const detail = await playlistService.getDetail('local_123456');
    expect(api.localPlaylistDetail).toHaveBeenCalledWith('local_123456');
    expect(detail.name).toBe('本地精选');

    const tracks = await playlistService.getTracks('local_123456');
    expect(tracks).toHaveLength(1);
    expect(tracks[0].name).toBe('本地曲');
  });

  it('routes online playlist IDs to NeteasePlaylistProvider', async () => {
    const provider = playlistService.getProvider('10086');
    expect(provider.type).toBe('netease');

    vi.spyOn(api, 'playlist').mockResolvedValue({
      code: '000000',
      data: { playlist: { id: '10086', name: '云端歌单', tracks: [{ id: 101, name: '晴天' }] } }
    });

    const detail = await playlistService.getDetail('10086');
    expect(api.playlist).toHaveBeenCalledWith('10086');
    expect(detail.name).toBe('云端歌单');

    const tracks = await playlistService.getTracks('10086');
    expect(tracks).toHaveLength(1);
    expect(tracks[0].name).toBe('晴天');
  });

  it('dispatches delete request to corresponding provider cleanly', async () => {
    vi.spyOn(api, 'localPlaylistDelete').mockResolvedValue({ code: '000000', data: 'ok' });
    vi.spyOn(api, 'playlistDelete').mockResolvedValue({ code: '000000', data: 'ok' });

    const localRes = await playlistService.deletePlaylist('local_888');
    expect(api.localPlaylistDelete).toHaveBeenCalledWith('local_888');
    expect(localRes).toBe(true);

    const neteaseRes = await playlistService.deletePlaylist('9999');
    expect(api.playlistDelete).toHaveBeenCalledWith('9999');
    expect(neteaseRes).toBe(true);
  });
});
