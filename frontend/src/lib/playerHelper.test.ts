import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTrackUrl, preloadNextTrack } from './playerHelper';
import { api } from './api';
import type { Track } from './types';

vi.mock('./api', () => ({
  api: {
    songV1: vi.fn().mockResolvedValue({ code: '000000', data: {} })
  }
}));

describe('playerHelper URL resolution & preload contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.songV1 as any).mockResolvedValue({ code: '000000', data: {} });
  });

  it('immediately returns local stream URL without blocking network call', async () => {
    const localTrack: Track = {
      id: 101,
      name: '夜曲',
      artist: '周杰伦',
      url: '/v2/stream?id=101',
      cover: '/cover.png',
      lyric: '[00:00.00]一群嗜血的蚂蚁',
      isLocal: true
    };

    const url = await resolveTrackUrl(localTrack);

    expect(url).toBe('/v2/stream?id=101');
    // 如果封面和歌词均完整，绝不对外发起线上网络解析
    expect(api.songV1).not.toHaveBeenCalled();
  });

  it('resolves online track URL, cover, and lyric in a single request', async () => {
    const onlineTrack: Track = {
      id: 202,
      name: '告白气球',
      artist: '周杰伦'
    };

    (api.songV1 as any).mockResolvedValueOnce({
      code: '000000',
      data: {
        url: 'http://m701.music.126.net/test.mp3',
        pic: 'http://p1.music.126.net/cover.jpg',
        lyric: '[00:00.00]塞纳河畔'
      }
    });

    const url = await resolveTrackUrl(onlineTrack);

    expect(api.songV1).toHaveBeenCalledWith('202', 'lossless');
    expect(url).toBe('http://m701.music.126.net/test.mp3');
    expect(onlineTrack.url).toBe('http://m701.music.126.net/test.mp3');
    expect(onlineTrack.cover).toBe('http://p1.music.126.net/cover.jpg');
    expect(onlineTrack.lyric).toBe('[00:00.00]塞纳河畔');
  });

  it('preloadNextTrack triggers pre-resolution for the next track in queue', () => {
    const queue: Track[] = [
      { id: 1, name: '曲目1', artist: '歌手1', url: 'http://test/1.mp3' },
      { id: 2, name: '曲目2', artist: '歌手2' } // 无 url，需静默预加载
    ];

    preloadNextTrack(queue, 0, 'list');

    // 下一首（index=1）应该立即被触发静默解析
    expect(api.songV1).toHaveBeenCalledWith('2', 'lossless');
  });
});
