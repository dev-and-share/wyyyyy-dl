import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isAutoCacheEnabled,
  setAutoCacheEnabled,
  autoCacheState,
  getSongPlayCount,
  recordSongPlay,
  PWA_AUTO_CACHE_KEY,
  PWA_SONG_PLAY_COUNTS_KEY,
  PWA_TRACK_META_KEY,
  cacheTrackToBrowser,
  handleTrackPlayback,
  resetTrackPlayback,
  cachedSongIdSet,
  ensureCachedTrackMeta,
  isFallbackTrackLabel
} from './pwaCache.svelte';
import { precacheCandidateAudio } from '../player/nextTrackPrecache';
import {
  formatCacheDate,
  scanBrowserCache,
  clearLowPlayCountCacheEntries,
  toBrowserTrack,
  filterCacheByMinPlayCount,
  type BrowserCacheItem
} from './browserCacheHelper';

describe('PWA Cache & Auto-cache Contracts', () => {
  beforeEach(() => {
    localStorage.clear();
    setAutoCacheEnabled(true);
    resetTrackPlayback();
    cachedSongIdSet.clear();
  });

  afterEach(() => {
    resetTrackPlayback();
    vi.useRealTimers();
    vi.restoreAllMocks();
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
    const d = new Date(2026, 8, 9, 17, 30);
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

  it('handleTrackPlayback blocks background fetch when document.visibilityState is hidden (Lock Screen bandwidth guard)', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true
    });

    handleTrackPlayback({ id: 555, name: '后台播放歌曲', url: '/v3/stream?id=555' }, () => true);

    // Play count is recorded immediately
    expect(getSongPlayCount(555)).toBe(1);

    // Advance past 2.5s auto-cache debounce window
    await vi.advanceTimersByTimeAsync(3000);

    // Must NOT initiate full-track background fetch while screen is locked/hidden
    expect(fetchSpy).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true
    });
  });

  it('handleTrackPlayback cancels auto-cache timer on fast track skip (< 2.5s) or when paused', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true
    });

    // Case 1: Reset before 2.5s
    handleTrackPlayback({ id: 666, name: '切歌测试', url: '/v3/stream?id=666' }, () => true);
    await vi.advanceTimersByTimeAsync(1200);
    resetTrackPlayback();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Case 2: Paused before 2.5s (isStillPlaying returns false)
    handleTrackPlayback({ id: 777, name: '暂停测试', url: '/v3/stream?id=777' }, () => false);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('scanBrowserCache sorts by playCount DESC then time DESC', async () => {
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

  it('toBrowserTrack converts BrowserCacheItem to playable Track object', () => {
    const item: BrowserCacheItem = {
      key: 'song_123',
      id: '123',
      urls: ['http://localhost/v3/stream?id=123'],
      relUrls: ['/v3/stream?id=123'],
      relUrl: '/v3/stream?id=123',
      name: '七里香',
      artist: '周杰伦',
      cover: 'https://example.com/cover.jpg',
      size: 1024,
      time: 123456,
      playCount: 5
    };

    const track = toBrowserTrack(item);
    expect(track.id).toBe('123');
    expect(track.name).toBe('七里香');
    expect(track.artist).toBe('周杰伦');
    expect(track.cover).toBe('https://example.com/cover.jpg');
    expect(track.url).toBe('/v3/stream?id=123');
    expect(track.isLocal).toBe(true);
  });

  it('filterCacheByMinPlayCount filters items with playCount >= threshold', () => {
    const list: BrowserCacheItem[] = [
      { key: '1', id: '1', urls: [], relUrls: [], relUrl: '/1', name: 'A', artist: 'Art', size: 10, time: 1, playCount: 0 },
      { key: '2', id: '2', urls: [], relUrls: [], relUrl: '/2', name: 'B', artist: 'Art', size: 20, time: 2, playCount: 1 },
      { key: '3', id: '3', urls: [], relUrls: [], relUrl: '/3', name: 'C', artist: 'Art', size: 30, time: 3, playCount: 3 },
      { key: '4', id: '4', urls: [], relUrls: [], relUrl: '/4', name: 'D', artist: 'Art', size: 40, time: 4, playCount: 10 }
    ];

    expect(filterCacheByMinPlayCount(list, 0).length).toBe(4);
    expect(filterCacheByMinPlayCount(list, 1).map(i => i.id)).toEqual(['2', '3', '4']);
    expect(filterCacheByMinPlayCount(list, 3).map(i => i.id)).toEqual(['3', '4']);
    expect(filterCacheByMinPlayCount(list, 5).map(i => i.id)).toEqual(['4']);
    expect(filterCacheByMinPlayCount(list, 99).length).toBe(0);
    expect(filterCacheByMinPlayCount(list, -1).length).toBe(4);
    expect(filterCacheByMinPlayCount(list, NaN).length).toBe(4);
  });

  it('ensureCachedTrackMeta ignores fallback placeholder names and writes real metadata', () => {
    expect(isFallbackTrackLabel('离线音轨 #1961264465')).toBe(true);
    expect(isFallbackTrackLabel('浏览器已离线')).toBe(true);
    expect(isFallbackTrackLabel('七里香')).toBe(false);

    // Must refuse persisting fallback labels
    expect(
      ensureCachedTrackMeta({ id: '888', name: '离线音轨 #888', artist: '浏览器已离线' }, '/v3/stream?id=888', 5000)
    ).toBe(false);
    expect(localStorage.getItem(PWA_TRACK_META_KEY)).toBeNull();

    // Must persist real metadata
    expect(
      ensureCachedTrackMeta(
        { id: '888', name: '夜曲', artist: '周杰伦', cover: 'https://p1.music.126.net/cover.jpg' },
        '/v3/stream?id=888',
        5242880
      )
    ).toBe(true);

    const stored = JSON.parse(localStorage.getItem(PWA_TRACK_META_KEY) || '{}');
    expect(stored['/v3/stream?id=888']).toMatchObject({
      id: '888',
      songName: '夜曲',
      artist: '周杰伦',
      cover: 'https://p1.music.126.net/cover.jpg',
      fileSize: 5242880
    });
  });

  it('precacheCandidateAudio persists track metadata to localStorage alongside CacheStorage', async () => {
    const fakeBlob = new Blob([new Uint8Array(1_400_000)], { type: 'audio/mpeg' });
    const putSpy = vi.fn().mockResolvedValue(undefined);
    const mockCache = {
      match: vi.fn().mockImplementation(async (req: string) => {
        if (putSpy.mock.calls.length > 0 && req === '/v3/stream?id=40404') {
          return {
            headers: { get: (h: string) => (h.toLowerCase() === 'content-length' ? String(fakeBlob.size) : null) }
          };
        }
        return undefined;
      }),
      put: putSpy
    };
    (window as any).caches = {
      keys: vi.fn().mockResolvedValue(['netease-music-audio-v1']),
      open: vi.fn().mockResolvedValue(mockCache)
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'audio/mpeg', 'Content-Length': String(fakeBlob.size) }),
        blob: async () => fakeBlob
      })
    );

    const ok = await precacheCandidateAudio(
      {
        id: 40404,
        name: '稻香',
        artist: '周杰伦',
        cover: 'https://p1.music.126.net/daoxiang.jpg',
        url: 'https://cdn.example/daoxiang.mp3'
      },
      () => {}
    );

    expect(ok).toBe(true);
    expect(putSpy).toHaveBeenCalled();

    const stored = JSON.parse(localStorage.getItem(PWA_TRACK_META_KEY) || '{}');
    expect(stored['/v3/stream?id=40404']).toMatchObject({
      id: '40404',
      songName: '稻香',
      artist: '周杰伦',
      cover: 'https://p1.music.126.net/daoxiang.jpg',
      fileSize: fakeBlob.size
    });
  });

  it('scanBrowserCache auto-heals missing metadata via /v3/history/batch_detail and degrades gracefully offline', async () => {
    const mockCache = {
      keys: vi.fn().mockResolvedValue([
        { url: 'http://localhost/v3/stream?id=100' },
        { url: 'http://localhost/v3/stream?id=200' }
      ]),
      match: vi.fn().mockResolvedValue({
        headers: { get: () => '4096000' }
      }),
      delete: vi.fn().mockResolvedValue(true)
    };
    (window as any).caches = {
      keys: vi.fn().mockResolvedValue(['netease-music-audio-v1']),
      open: vi.fn().mockResolvedValue(mockCache)
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '000000',
        data: {
          bySongId: [{ songId: 100, songName: '晴天', artist: '周杰伦', fileSize: 4096000 }],
          byOnlineSongId: {
            '200': {
              songId: 200,
              songName: '七里香',
              artist: '周杰伦',
              cover: 'https://p1.music.126.net/qlx.jpg'
            }
          }
        }
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    const healed = await scanBrowserCache();
    expect(fetchMock).toHaveBeenCalledWith(
      '/v3/history/batch_detail',
      expect.objectContaining({ method: 'POST' })
    );

    const byId = Object.fromEntries(healed.list.map((i) => [i.id, i]));
    expect(byId['100'].name).toBe('晴天');
    expect(byId['100'].artist).toBe('周杰伦');
    expect(byId['200'].name).toBe('七里香');
    expect(byId['200'].cover).toBe('https://p1.music.126.net/qlx.jpg');

    const stored = JSON.parse(localStorage.getItem(PWA_TRACK_META_KEY) || '{}');
    expect(stored['/v3/stream?id=100']?.songName).toBe('晴天');
    expect(stored['/v3/stream?id=200']?.songName).toBe('七里香');

    // Verify graceful fallback when metadata is empty and network fails
    localStorage.clear();
    fetchMock.mockRejectedValueOnce(new Error('Offline'));
    const fallbackRes = await scanBrowserCache();
    expect(fallbackRes.list.map((i) => i.name).sort()).toEqual(['离线音轨 #100', '离线音轨 #200']);
  });
});
