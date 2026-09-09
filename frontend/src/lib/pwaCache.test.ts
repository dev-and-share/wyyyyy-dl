import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isAutoCacheEnabled,
  setAutoCacheEnabled,
  autoCacheState,
  getSongPlayCount,
  recordSongPlay,
  PWA_AUTO_CACHE_KEY,
  PWA_SONG_PLAY_COUNTS_KEY,
  PWA_TRACK_META_KEY,
  cacheTrackToBrowser
} from './pwaCache.svelte';
import {
  formatCacheDate,
  scanBrowserCache,
  clearLowPlayCountCacheEntries,
  type BrowserCacheItem
} from './browserCacheHelper';

describe('PWA Cache & Auto-cache Contracts', () => {
  beforeEach(() => {
    localStorage.clear();
    setAutoCacheEnabled(true);
  });

  it('isAutoCacheEnabled defaults to true when localStorage is empty', () => {
    expect(isAutoCacheEnabled()).toBe(true);
    expect(autoCacheState.enabled).toBe(true);
  });

  it('setAutoCacheEnabled toggles state and persists to localStorage', () => {
    setAutoCacheEnabled(false);
    expect(isAutoCacheEnabled()).toBe(false);
    expect(autoCacheState.enabled).toBe(false);
    expect(localStorage.getItem(PWA_AUTO_CACHE_KEY)).toBe('false');

    setAutoCacheEnabled(true);
    expect(isAutoCacheEnabled()).toBe(true);
    expect(autoCacheState.enabled).toBe(true);
    expect(localStorage.getItem(PWA_AUTO_CACHE_KEY)).toBe('true');
  });

  it('recordSongPlay increments play count and updates metadata', () => {
    expect(getSongPlayCount('101')).toBe(0);

    const c1 = recordSongPlay('101');
    expect(c1).toBe(1);
    expect(getSongPlayCount('101')).toBe(1);

    const c2 = recordSongPlay('101');
    expect(c2).toBe(2);
    expect(getSongPlayCount('101')).toBe(2);

    // 验证同步到已存在于 metaMap 中的条目
    const metaMap = {
      '/v3/stream?id=101': { id: '101', songName: '测试歌曲', playCount: 0 }
    };
    localStorage.setItem(PWA_TRACK_META_KEY, JSON.stringify(metaMap));

    recordSongPlay('101');
    const updatedMeta = JSON.parse(localStorage.getItem(PWA_TRACK_META_KEY) || '{}');
    expect(updatedMeta['/v3/stream?id=101'].playCount).toBe(3);
  });

  it('formatCacheDate formats timestamp correctly', () => {
    expect(formatCacheDate(0)).toBe('');
    const d = new Date(2026, 8, 9, 17, 30); // 2026-09-09 17:30
    const str = formatCacheDate(d.getTime());
    expect(str).toBe('09-09 17:30');
  });

  it('cacheTrackToBrowser skips trial tracks when skipTrial is true', async () => {
    const res = await cacheTrackToBrowser(
      { id: 999, name: 'VIP试听片段', freeTrial: true },
      { skipTrial: true }
    );
    expect(res.success).toBe(false);
    expect(res.isTrial).toBe(true);
    expect(res.msg).toContain('试听片段');
  });

  it('scanBrowserCache sorts by playCount DESC then time DESC', async () => {
    // 模拟 window.caches
    const mockAudioData = [
      { url: 'http://localhost/v3/stream?id=1', id: '1', name: 'Song 1', count: 1, time: 1000 },
      { url: 'http://localhost/v3/stream?id=2', id: '2', name: 'Song 2', count: 10, time: 2000 },
      { url: 'http://localhost/v3/stream?id=3', id: '3', name: 'Song 3', count: 10, time: 5000 },
      { url: 'http://localhost/v3/stream?id=4', id: '4', name: 'Song 4', count: 0, time: 3000 }
    ];

    const metaMap: Record<string, any> = {};
    const playCounts: Record<string, number> = {};

    for (const item of mockAudioData) {
      metaMap[`/v3/stream?id=${item.id}`] = {
        id: item.id,
        songName: item.name,
        artist: 'Artist',
        fileSize: 1000,
        time: item.time
      };
      playCounts[item.id] = item.count;
    }

    localStorage.setItem(PWA_TRACK_META_KEY, JSON.stringify(metaMap));
    localStorage.setItem(PWA_SONG_PLAY_COUNTS_KEY, JSON.stringify(playCounts));

    const mockCache = {
      keys: vi.fn().mockResolvedValue(mockAudioData.map(d => ({ url: d.url }))),
      match: vi.fn().mockResolvedValue({
        headers: { get: () => '1000' }
      }),
      delete: vi.fn().mockResolvedValue(true)
    };

    (window as any).caches = {
      keys: vi.fn().mockResolvedValue(['audio-cache-v1']),
      open: vi.fn().mockResolvedValue(mockCache)
    };

    const result = await scanBrowserCache();
    expect(result.list.length).toBe(4);

    // 复合排序断言：
    // 1. Song 3 (count=10, time=5000)
    // 2. Song 2 (count=10, time=2000)
    // 3. Song 1 (count=1, time=1000)
    // 4. Song 4 (count=0, time=3000)
    expect(result.list[0].id).toBe('3');
    expect(result.list[1].id).toBe('2');
    expect(result.list[2].id).toBe('1');
    expect(result.list[3].id).toBe('4');
  });

  it('clearLowPlayCountCacheEntries deletes matching low play count tracks and frees space', async () => {
    const metaMap: Record<string, any> = {
      '/v3/stream?id=1': { id: '1', songName: 'Song 1', fileSize: 2000 },
      '/v3/stream?id=2': { id: '2', songName: 'Song 2', fileSize: 3000 }
    };
    localStorage.setItem(PWA_TRACK_META_KEY, JSON.stringify(metaMap));

    const mockDelete = vi.fn().mockResolvedValue(true);
    const mockCache = {
      delete: mockDelete
    };
    (window as any).caches = {
      keys: vi.fn().mockResolvedValue(['audio-cache-v1']),
      open: vi.fn().mockResolvedValue(mockCache)
    };

    const lowItems: BrowserCacheItem[] = [
      {
        key: 'song_1',
        id: '1',
        urls: ['http://localhost/v3/stream?id=1'],
        relUrls: ['/v3/stream?id=1'],
        relUrl: '/v3/stream?id=1',
        name: 'Song 1',
        artist: 'Artist',
        size: 2000,
        time: 1000,
        playCount: 1
      }
    ];

    const freed = await clearLowPlayCountCacheEntries(lowItems);
    expect(freed).toBe(2000);
    expect(mockDelete).toHaveBeenCalledWith('http://localhost/v3/stream?id=1');

    const updatedMeta = JSON.parse(localStorage.getItem(PWA_TRACK_META_KEY) || '{}');
    expect(updatedMeta['/v3/stream?id=1']).toBeUndefined();
    expect(updatedMeta['/v3/stream?id=2']).toBeDefined();
  });
});
