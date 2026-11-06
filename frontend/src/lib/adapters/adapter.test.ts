import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPlatformAdapter,
  setPlatformAdapter,
  platformAdapter,
  NeteaseAdapter,
  type MusicPlatformAdapter
} from './index';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    songV1: vi.fn(),
    playlist: vi.fn(),
    myPlaylist: vi.fn(),
    search: vi.fn()
  }
}));

describe('MusicPlatformAdapter (Port & Adapter Architecture)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPlatformAdapter(new NeteaseAdapter());
  });

  it('defaults to NeteaseAdapter with proper identity and capabilities', () => {
    const adapter = getPlatformAdapter();
    expect(adapter.id).toBe('netease');
    expect(adapter.name).toBe('NetEase Cloud Music');
    expect(adapter.capabilities.hasDailyRecommend).toBe(true);
    expect(adapter.capabilities.hasLike).toBe(true);
    expect(platformAdapter.id).toBe('netease');
  });

  it('normalizes raw NetEase song objects with ar/al arrays into standard Track', () => {
    const rawSong = {
      id: 123456,
      name: '晴天',
      ar: [{ id: 1, name: '周杰伦' }, { id: 2, name: '合唱' }],
      al: { id: 10, name: '叶惠美', picUrl: 'https://example.com/cover.jpg' },
      freeTrial: false
    };

    const track = platformAdapter.normalizeTrack(rawSong);
    expect(track.id).toBe(123456);
    expect(track.name).toBe('晴天');
    expect(track.artist).toBe('周杰伦/合唱');
    expect(track.cover).toBe('https://example.com/cover.jpg');
    expect(track.freeTrial).toBe(false);
  });

  it('handles empty or malformed track metadata gracefully in normalizeTrack', () => {
    const emptyTrack = platformAdapter.normalizeTrack(null);
    expect(emptyTrack.id).toBe(0);
    expect(emptyTrack.name).toBeDefined();
    expect(emptyTrack.artist).toBeDefined();

    const partial = platformAdapter.normalizeTrack({ songId: 999, songName: '单曲' });
    expect(partial.id).toBe(999);
    expect(partial.name).toBe('单曲');
  });

  it('resolves track playback data through platform adapter', async () => {
    (api.songV1 as any).mockResolvedValueOnce({
      code: '000000',
      data: {
        url: 'https://cdn.example.com/stream.mp3',
        picUrl: 'https://cdn.example.com/cover.jpg',
        lyric: '[00:00.00] 歌词',
        freeTrial: true,
        freeTrialDuration: 30
      }
    });

    const res = await platformAdapter.resolveTrack(101, { name: '晴天', artist: '周杰伦' });
    expect(res.url).toBe('https://cdn.example.com/stream.mp3');
    expect(res.cover).toBe('https://cdn.example.com/cover.jpg');
    expect(res.lyric).toBe('[00:00.00] 歌词');
    expect(res.freeTrial).toBe(true);
    expect(res.freeTrialDuration).toBe(30);
    expect(res.unplayable).toBe(false);
    expect(api.songV1).toHaveBeenCalledWith('101', 'lossless', '晴天', '周杰伦');
  });

  it('supports runtime adapter swapping for multi-source modularity (e.g., Subsonic / Local)', () => {
    const customAdapter: MusicPlatformAdapter = {
      id: 'custom-local',
      name: 'Local Music Server',
      capabilities: { hasPlaylists: false, hasLike: false },
      normalizeTrack: (item) => ({
        id: item.path || 'local',
        name: item.title || 'Local Track',
        artist: item.artist || 'Local Artist',
        cover: '/favicon.png',
        url: item.url || ''
      }),
      resolveTrack: async (id) => ({
        url: `/local/${id}.mp3`,
        unplayable: false
      })
    };

    setPlatformAdapter(customAdapter);
    expect(platformAdapter.id).toBe('custom-local');
    expect(platformAdapter.name).toBe('Local Music Server');

    const normalized = platformAdapter.normalizeTrack({ path: '/music/a.flac', title: 'Song A' });
    expect(normalized.id).toBe('/music/a.flac');
    expect(normalized.name).toBe('Song A');
  });
});
