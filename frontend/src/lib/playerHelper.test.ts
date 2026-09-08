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

  it('records freeTrial flags accurately when resolving trial track', async () => {
    const trialTrack: Track = {
      id: 303,
      name: 'VIP试听曲目',
      artist: '某歌手'
    };

    (api.songV1 as any).mockResolvedValueOnce({
      code: '000000',
      data: {
        url: 'http://m701.music.126.net/trial.mp3',
        freeTrial: true,
        freeTrialDuration: 30
      }
    });

    await resolveTrackUrl(trialTrack);

    expect(trialTrack.freeTrial).toBe(true);
    expect(trialTrack.freeTrialDuration).toBe(30);
  });

  it('preloadSurroundingTracks triggers pre-resolution for both next and previous tracks in queue', () => {
    const queue: Track[] = [
      { id: 1, name: '曲目1', artist: '歌手1' }, // prev of index 1
      { id: 2, name: '曲目2', artist: '歌手2', url: 'http://test/2.mp3' }, // current
      { id: 3, name: '曲目3', artist: '歌手3' }  // next of index 1
    ];

    preloadNextTrack(queue, 1, 'list');

    // 下一首（id: 3）与上一首（id: 1）均应被静默预热
    expect(api.songV1).toHaveBeenCalledWith('3', 'lossless');
    expect(api.songV1).toHaveBeenCalledWith('1', 'lossless');
  });

  it('playPlaylistTracks safely handles string artists, ar array, and artist properties without throwing .map errors', async () => {
    const { playPlaylistTracks } = await import('./playerHelper');
    const mockOnPlayQueue = vi.fn();
    const mockShowToast = vi.fn();

    (api as any).playlist = vi.fn().mockResolvedValue({
      code: '000000',
      data: {
        playlist: {
          id: '12345',
          name: '我的歌单',
          tracks: [
            { id: 101, name: '晴天', artists: '周杰伦', picUrl: '/pic1.png' },
            { id: 102, name: '枫', ar: [{ name: '周杰伦' }], al: { picUrl: '/pic2.png' } },
            { id: 103, name: '七里香', artist: '周杰伦' },
            { id: 104, name: '纯音乐', artists: null }
          ]
        }
      }
    });

    await playPlaylistTracks('12345', '我的歌单', mockOnPlayQueue, mockShowToast);

    expect(mockOnPlayQueue).toHaveBeenCalledTimes(1);
    const queued = mockOnPlayQueue.mock.calls[0][0];
    expect(queued).toHaveLength(4);
    expect(queued[0]).toMatchObject({ id: 101, name: '晴天', artist: '周杰伦', cover: '/pic1.png' });
    expect(queued[1]).toMatchObject({ id: 102, name: '枫', artist: '周杰伦', cover: '/pic2.png' });
    expect(queued[2]).toMatchObject({ id: 103, name: '七里香', artist: '周杰伦' });
    expect(queued[3]).toMatchObject({ id: 104, name: '纯音乐', artist: '' });
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('已开始播放《我的歌单》'), 'success', 2000);
  });
});
