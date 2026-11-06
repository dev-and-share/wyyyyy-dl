import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadExternalTrack } from './downloadHelper';
import { api } from '../api';
import { musicFreeStore } from './musicFreeStore.svelte';

describe('downloadExternalTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits custom download task with resolved direct media url', async () => {
    vi.spyOn(musicFreeStore, 'resolveMediaSource').mockResolvedValue({
      url: 'http://test.audio/sample.mp3',
      headers: { Referer: 'https://qq.com' }
    });
    const spyDownload = vi.spyOn(api, 'downloadCustom').mockResolvedValue({ code: '000000', data: {} } as any);

    const track = {
      id: 'mf_qq_123',
      title: '测试歌曲',
      artist: '测试歌手',
      album: '测试专辑'
    };

    const res = await downloadExternalTrack(track, track, 'plugin_qq');
    expect(res).toBe(true);
    expect(spyDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '测试歌曲',
        artist: '测试歌手',
        url: 'http://test.audio/sample.mp3'
      })
    );
  });

  it('unwraps online stream proxy url to direct url before downloading', async () => {
    const spyDownload = vi.spyOn(api, 'downloadCustom').mockResolvedValue({ code: '000000', data: {} } as any);

    const track = {
      id: 'mf_kugou_456',
      name: '代理歌曲',
      artist: '歌手',
      url: '/v3/stream/online?url=https%3A%2F%2Fcdn.kugou.com%2Fsong.mp3'
    };

    const res = await downloadExternalTrack(track);
    expect(res).toBe(true);
    expect(spyDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '代理歌曲',
        url: 'https://cdn.kugou.com/song.mp3'
      })
    );
  });
});
