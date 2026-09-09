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
      url: '/v3/stream?id=101',
      cover: '/cover.png',
      lyric: '[00:00.00]一群嗜血的蚂蚁',
      isLocal: true
    };

    const url = await resolveTrackUrl(localTrack);

    expect(url).toBe('/v3/stream?id=101');
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

  it('toPlayerTrack normalizes metadata and preserves isLocal/freeTrial contracts (DRY)', async () => {
    const { toPlayerTrack } = await import('./playerHelper');

    // 1. 空输入兜底
    expect(toPlayerTrack(null)).toMatchObject({ id: 0, name: '未知曲目' });

    // 2. 带有本地 stream URL 的曲目自动标记 isLocal=true
    const songWithStream = {
      id: 190596,
      name: '爱到这样',
      ar_name: '张宇',
      url: '/v3/stream?id=0&historyId=1304',
      pic: 'http://pic.jpg',
      freeTrial: false
    };
    const track1 = toPlayerTrack(songWithStream);
    expect(track1.isLocal).toBe(true);
    expect(track1.freeTrial).toBe(false);
    expect(track1.name).toBe('爱到这样');
    expect(track1.artist).toBe('张宇');

    // 3. 试听曲目保留 freeTrial=true
    const trialSong = {
      id: 999,
      name: '试听曲',
      artist: '某歌手',
      url: 'http://trial.mp3',
      freeTrial: true,
      freeTrialDuration: 30
    };
    const track2 = toPlayerTrack(trialSong);
    expect(track2.isLocal).toBe(false);
    expect(track2.freeTrial).toBe(true);
    expect(track2.freeTrialDuration).toBe(30);
  });

  it('getTrackPlayActionLabel generates correct label across modes and variants (DRY)', async () => {
    const { getTrackPlayActionLabel } = await import('./trackStatus.svelte');

    // 播放中状态
    expect(getTrackPlayActionLabel({ isPlaying: true, isLocal: true, variant: 'short' })).toBe('⏸ 播放中');
    expect(getTrackPlayActionLabel({ isPlaying: true, isLocal: false, variant: 'desktop' })).toBe('⏸ 暂停');

    // 本地 vs 试听 - short 模式
    expect(getTrackPlayActionLabel({ isPlaying: false, isLocal: true, variant: 'short' })).toBe('▶️ 播放');
    expect(getTrackPlayActionLabel({ isPlaying: false, isLocal: false, variant: 'short' })).toBe('▶️ 试听');

    // 本地 vs 试听 - desktop 模式
    expect(getTrackPlayActionLabel({ isPlaying: false, isLocal: true, variant: 'desktop' })).toBe('▶ 本地');
    expect(getTrackPlayActionLabel({ isPlaying: false, isLocal: false, variant: 'desktop' })).toBe('▶ 试听');

    // 本地 vs 试听 - full 模式
    expect(getTrackPlayActionLabel({ isPlaying: false, isLocal: true, variant: 'full' })).toBe('▶️ 播放本地音频');
    expect(getTrackPlayActionLabel({ isPlaying: false, isLocal: false, variant: 'full' })).toBe('▶️ 试听在线歌曲');
  });
});
