import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import GlobalAudioPlayer from '../../components/GlobalAudioPlayer.svelte';
import { playerStore } from './playerStore.svelte';
import {
  resolveTrackUrl,
  preloadSurroundingTracks,
  interruptionController,
  isTrackUrlExpired,
  markTrackUrlResolved
} from './playerHelper';
import {
  INTERRUPTION_PROBE_DELAYS_MS,
  ONLINE_URL_TTL_MS,
  clearStreamWatchdog,
  clearTrackStreamRetry
} from 'pwa-audio-player';
import {
  clearPreloadedTrackBlob,
  getPreloadedTrackBlobUrl
} from './nextTrackPrecache';
import { cachedSongIdSet } from '../library/pwaCache.svelte';
import { api } from '../api';
import { resolveFallbackFromBuiltins } from '../musicfree/plugins';
import { resetIosF3State } from '../iosF3KeepAlive';
import * as platformModule from '../platform';
import type { Track } from '../types';

vi.mock('../api', () => ({
  api: {
    songV1: vi.fn().mockResolvedValue({ code: '000000', data: {} }),
    downloadSingle: vi.fn().mockResolvedValue({ code: 200 }),
    songStats: vi.fn().mockResolvedValue({ code: 200, data: { commentCount: 0, likedCount: 0 } }),
    scrobble: vi.fn().mockResolvedValue({ code: 200 })
  }
}));

vi.mock('../musicfree/plugins', () => ({
  resolveFallbackFromBuiltins: vi.fn().mockResolvedValue(null),
  builtinPlugins: []
}));

describe('Playback Resilience & External Interruption Recovery Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    playerStore.clearQueue();
    playerStore.playMode = 'list';
    playerStore.autoSkipTrial = true;
    resetIosF3State(null);
    interruptionController.cancelRecovery();
    interruptionController.clearIntentionalPause();
    clearStreamWatchdog();
    clearTrackStreamRetry();
    clearPreloadedTrackBlob();
    cachedSongIdSet.clear();
    // @ts-ignore
    platformModule.platform.isIOS = true;
    (api.songV1 as any).mockResolvedValue({ code: '000000', data: {} });
    (resolveFallbackFromBuiltins as any).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    interruptionController.cancelRecovery();
    interruptionController.clearIntentionalPause();
    clearStreamWatchdog();
    clearTrackStreamRetry();
    clearPreloadedTrackBlob();
    cachedSongIdSet.clear();
    resetIosF3State(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if ('caches' in window) delete (window as any).caches;
  });

  it('retries broken next track once after natural end, then skips to track 3 without getting stuck at 00:00', async () => {
    const track1: Track = { id: 1, name: 'Song 1', artist: 'A', url: 'https://cdn.example/t1.mp3', isLocal: false };
    const track2: Track = { id: 2, name: 'Song 2', artist: 'B', url: 'https://cdn.example/t2-stale.mp3', isLocal: false };
    const track3: Track = { id: 3, name: 'Song 3', artist: 'C', url: 'https://cdn.example/t3.mp3', isLocal: false };

    let playCalls: string[] = [];
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      const src = this.src || '';
      playCalls.push(src);
      if (src.includes('t2-')) {
        return Promise.reject(Object.assign(new Error('Format error'), { name: 'NotSupportedError' }));
      }
      return Promise.resolve();
    });
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

    (api.songV1 as any).mockImplementation(async (id: string) => {
      if (id === '2') {
        return { code: '000000', data: { url: 'https://cdn.example/t2-fresh.mp3' } };
      }
      return { code: '000000', data: {} };
    });

    playerStore.setQueue([track1, track2, track3], 0);
    playerStore.playing = true;
    playerStore.duration = 200;

    const { container } = render(GlobalAudioPlayer);
    const audioEl = container.querySelector('audio') as HTMLAudioElement;
    audioEl.src = 'https://cdn.example/t1.mp3';
    Object.defineProperty(audioEl, 'currentTime', { value: 200, writable: true, configurable: true });
    Object.defineProperty(audioEl, 'duration', { value: 200, writable: true, configurable: true });

    // iOS WebKit frequently emits pause right before ended
    await fireEvent(audioEl, new Event('pause'));
    expect(playerStore.playing).toBe(false);
    await fireEvent(audioEl, new Event('ended'));

    await vi.waitFor(() => {
      expect(playerStore.qIndex).toBe(2);
      expect(playerStore.playing).toBe(true);
    });

    // Track 2 attempted stale URL, refreshed once via songV1, tried fresh URL, marked unplayable, then jumped to Track 3
    expect(api.songV1).toHaveBeenCalledWith('2', 'lossless', 'Song 2', 'B');
    expect(playCalls.some((u) => u.includes('t2-stale.mp3'))).toBe(true);
    expect(playCalls.some((u) => u.includes('t2-fresh.mp3'))).toBe(true);
    expect(playCalls.some((u) => u.includes('t3.mp3'))).toBe(true);
    expect(playerStore.queue[1].unplayable).toBe(true);
    expect(playSpy).toHaveBeenCalled();
  });

  it('also recovers via retry and skip if native audio error fires right after stream swap while loading/desired', async () => {
    const track1: Track = { id: 11, name: 'Local 1', artist: 'A', url: '/v3/stream?id=11', isLocal: true };
    const track2: Track = { id: 12, name: 'Broken 2', artist: 'B', url: 'https://cdn.example/broken-2.mp3', isLocal: false };
    const track3: Track = { id: 13, name: 'Healthy 3', artist: 'C', url: 'https://cdn.example/ok-3.mp3', isLocal: false };

    let triggerFirstPending: (() => void) | null = null;
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      if (this.src.includes('broken-2.mp3')) {
        return new Promise<void>((_, reject) => {
          triggerFirstPending = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        });
      }
      if (this.src.includes('retry-2.mp3')) {
        return Promise.reject(Object.assign(new Error('Decode error'), { name: 'NotSupportedError' }));
      }
      return Promise.resolve();
    });
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

    (api.songV1 as any).mockResolvedValue({
      code: '000000',
      data: { url: 'https://cdn.example/retry-2.mp3' }
    });

    playerStore.setQueue([track1, track2, track3], 0);
    playerStore.playing = true;
    const { container } = render(GlobalAudioPlayer);
    const audioEl = container.querySelector('audio') as HTMLAudioElement;
    audioEl.src = 'http://localhost/v3/stream?id=11';
    Object.defineProperty(audioEl, 'currentTime', { value: 180, writable: true, configurable: true });
    Object.defineProperty(audioEl, 'duration', { value: 180, writable: true, configurable: true });

    await fireEvent(audioEl, new Event('ended'));
    await vi.waitFor(() => expect(audioEl.src).toContain('broken-2.mp3'));

    // Simulate OS/network raising <audio error> while broken-2 is still buffering
    await fireEvent(audioEl, new Event('error'));
    (triggerFirstPending as (() => void) | null)?.();

    await vi.waitFor(() => {
      expect(playerStore.qIndex).toBe(2);
      expect(audioEl.src).toContain('ok-3.mp3');
    });
    expect(api.songV1).toHaveBeenCalledWith('12', 'lossless', 'Broken 2', 'B');
  });

  it('chains preloadSurroundingTracks up to 4 hops forward when immediate next tracks are freeTrial or unplayable', async () => {
    const t0: Track = { id: 100, name: 'Playing', artist: 'A', url: '/v3/stream?id=100', isLocal: true };
    const t1Trial: Track = { id: 101, name: 'Trial Song', artist: 'B' };
    const t2Unplayable: Track = { id: 102, name: 'No Copy Song', artist: 'C' };
    const t3Playable: Track = { id: 103, name: 'Playable Next', artist: 'D' };
    const t4Prev: Track = { id: 104, name: 'Prev Local', artist: 'E', url: '/v3/stream?id=104', isLocal: true };

    (api.songV1 as any).mockImplementation(async (id: string) => {
      if (id === '101') {
        return { code: '000000', data: { url: 'https://cdn.example/trial.mp3', freeTrial: true, freeTrialDuration: 30 } };
      }
      if (id === '102') {
        return { code: '000000', data: { url: '', status: 404 } };
      }
      if (id === '103') {
        return { code: '000000', data: { url: 'https://cdn.example/full-103.mp3' } };
      }
      return { code: '000000', data: {} };
    });

    playerStore.setQueue([t0, t1Trial, t2Unplayable, t3Playable, t4Prev], 0);
    preloadSurroundingTracks(playerStore.queue, 0, 'list');

    await vi.waitFor(() => {
      expect(playerStore.queue[3].url).toBe('https://cdn.example/full-103.mp3');
    });
    expect(playerStore.queue[1].freeTrial).toBe(true);
    expect(playerStore.queue[2].unplayable).toBe(true);
    expect(api.songV1).toHaveBeenCalledWith('101', 'lossless', 'Trial Song', 'B');
    expect(api.songV1).toHaveBeenCalledWith('102', 'lossless', 'No Copy Song', 'C');
    expect(api.songV1).toHaveBeenCalledWith('103', 'lossless', 'Playable Next', 'D');
  });

  it('falls back to builtin sources for unplayable or freeTrial NetEase tracks and wraps with /v3/stream/online proxy', async () => {
    const neteaseTrack: Track = {
      id: 201,
      name: '七里香',
      artist: '周杰伦',
      isLocal: false
    };

    (api.songV1 as any).mockResolvedValueOnce({
      code: '000000',
      data: { url: 'https://cdn.example/30s-trial.mp3', freeTrial: true, freeTrialDuration: 30 }
    });
    (resolveFallbackFromBuiltins as any).mockResolvedValueOnce({
      url: 'http://example.com/fallback.mp3',
      headers: { Referer: 'https://y.qq.com/' }
    });

    const resolvedUrl = await resolveTrackUrl(neteaseTrack);

    expect(resolveFallbackFromBuiltins).toHaveBeenCalledWith(neteaseTrack);
    expect(resolvedUrl.startsWith('/v3/stream/online?')).toBe(true);
    const params = new URLSearchParams(resolvedUrl.split('?')[1]);
    expect(params.get('url')).toBe('http://example.com/fallback.mp3');
    expect(params.get('referer')).toBe('https://y.qq.com/');
    expect(neteaseTrack.freeTrial).toBe(false);
    expect(neteaseTrack.unplayable).toBe(false);
  });

  it('detects expired online URLs after TTL while keeping local URLs immortal', () => {
    const online: Track = { id: 301, name: 'Online', artist: 'X', url: 'https://cdn.example/x.mp3', isLocal: false };
    const local: Track = { id: 302, name: 'Local', artist: 'Y', url: '/v3/stream?id=302', isLocal: true };
    const t0 = 1_000_000;

    markTrackUrlResolved(online, t0);
    markTrackUrlResolved(local, t0);

    expect(isTrackUrlExpired(online, t0 + ONLINE_URL_TTL_MS - 1000)).toBe(false);
    expect(isTrackUrlExpired(online, t0 + ONLINE_URL_TTL_MS + 1000)).toBe(true);
    expect(isTrackUrlExpired(local, t0 + ONLINE_URL_TTL_MS * 10)).toBe(false);
  });

  it('recovers short navigation voice interruption via stepped probes (1s -> 2.2s -> 3.8s) and restores resumeTime', async () => {
    vi.useFakeTimers();

    const audio = document.createElement('audio');
    Object.defineProperty(audio, 'paused', { value: true, writable: true, configurable: true });
    Object.defineProperty(audio, 'currentTime', { value: 0, writable: true, configurable: true });
    Object.defineProperty(audio, 'duration', { value: 240, writable: true, configurable: true });

    let attempt = 0;
    audio.play = vi.fn().mockImplementation(() => {
      attempt++;
      if (attempt < 3) {
        return Promise.reject(Object.assign(new Error('AudioSession interrupted'), { name: 'NotAllowedError' }));
      }
      Object.defineProperty(audio, 'paused', { value: false, writable: true, configurable: true });
      return Promise.resolve();
    });

    const onRecovered = vi.fn();
    const onGiveUp = vi.fn();
    const onSyncPaused = vi.fn();

    interruptionController.dispatchPauseEvent({
      audioEl: audio,
      wasPlaying: true,
      curTime: 86.5,
      trackId: 501,
      onSyncPaused,
      onRecovered,
      onGiveUp
    });

    expect(onSyncPaused).not.toHaveBeenCalled();
    expect(interruptionController.isInterrupted()).toBe(true);

    // Probe 1 at 1000ms -> rejected
    await vi.advanceTimersByTimeAsync(1000);
    expect(attempt).toBe(1);
    expect(onRecovered).not.toHaveBeenCalled();

    // Probe 2 at 2200ms -> rejected
    await vi.advanceTimersByTimeAsync(1200);
    expect(attempt).toBe(2);
    expect(onRecovered).not.toHaveBeenCalled();

    // Probe 3 at 3800ms -> navigation prompt finished, audio.play() resolves!
    await vi.advanceTimersByTimeAsync(1600);
    expect(attempt).toBe(3);
    expect(onRecovered).toHaveBeenCalledTimes(1);
    expect(onGiveUp).not.toHaveBeenCalled();
    expect(interruptionController.isInterrupted()).toBe(false);
    expect(audio.currentTime).toBe(86.5);

    // Advancing past remaining delays does not fire extra probes
    await vi.advanceTimersByTimeAsync(35000);
    expect(attempt).toBe(3);
  });

  it('auto-resumes long FaceTime/phone call interruption when user returns to foreground or focuses window', async () => {
    vi.useFakeTimers();

    const audio = document.createElement('audio');
    Object.defineProperty(audio, 'paused', { value: true, writable: true, configurable: true });
    Object.defineProperty(audio, 'currentTime', { value: 0, writable: true, configurable: true });
    Object.defineProperty(audio, 'duration', { value: 210, writable: true, configurable: true });
    Object.defineProperty(audio, 'readyState', { value: 0, writable: true, configurable: true });

    let callActive = true;
    audio.play = vi.fn().mockImplementation(() => {
      if (callActive) {
        return Promise.reject(Object.assign(new Error('Phone call active'), { name: 'NotAllowedError' }));
      }
      Object.defineProperty(audio, 'paused', { value: false, writable: true, configurable: true });
      return Promise.resolve();
    });

    const onRecovered = vi.fn();
    const onGiveUp = vi.fn();

    interruptionController.handleUnexpectedPause(audio, 123.4, 601, onRecovered, onGiveUp);

    // Exhaust all stepped probes up to 30000ms while call is active
    const lastDelay = INTERRUPTION_PROBE_DELAYS_MS[INTERRUPTION_PROBE_DELAYS_MS.length - 1];
    await vi.advanceTimersByTimeAsync(lastDelay + 50);

    expect(onGiveUp).toHaveBeenCalledTimes(1);
    expect(onRecovered).not.toHaveBeenCalled();
    // Crucial: interrupted state persists so foreground wake can still resume!
    expect(interruptionController.isInterrupted()).toBe(true);

    // Call ends and user returns app to foreground
    callActive = false;
    const onPendingSeek = vi.fn();
    const onClearedReload = vi.fn();
    const onFallbackPlay = vi.fn();

    const track: Track = { id: 601, name: 'Resumed Song', artist: 'Z', url: 'https://cdn.example/601.mp3', isLocal: false };
    markTrackUrlResolved(track, Date.now());

    const started = interruptionController.executeForegroundResume({
      audioEl: audio,
      track,
      curTime: 123.4,
      needsReload: true,
      onPendingSeek,
      onClearedReload,
      onRecovered,
      onFallbackPlay
    });
    await vi.advanceTimersByTimeAsync(10);

    expect(started).toBe(true);
    expect(onPendingSeek).toHaveBeenCalledWith(123.4);
    expect(onClearedReload).toHaveBeenCalledTimes(1);
    expect(onRecovered).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(123.4);
    expect(interruptionController.isInterrupted()).toBe(false);
  });

  it('precaches next track full Blob into CacheStorage during playback and switches audio.src directly to blob: URL on ended', async () => {
    const cacheMap = new Map<string, Response>();
    (window as any).caches = {
      open: vi.fn().mockResolvedValue({
        match: vi.fn(async (key: string) => cacheMap.get(key)),
        put: vi.fn(async (key: string, res: Response) => { cacheMap.set(key, res); })
      })
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'audio/mpeg' }),
      blob: async () => new Blob([new Uint8Array(1_400_000)], { type: 'audio/mpeg' })
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/precached-702');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

    const t1: Track = { id: 701, name: 'Playing 1', artist: 'A', url: '/v3/stream?id=701', isLocal: true };
    const t2: Track = { id: 702, name: 'Online Next 2', artist: 'B', url: 'https://cdn.example/online-702.mp3', isLocal: false };
    const t3: Track = { id: 703, name: 'Prev Local 3', artist: 'C', url: '/v3/stream?id=703', isLocal: true };

    playerStore.setQueue([t1, t2, t3], 0);
    playerStore.playing = true;
    const { container } = render(GlobalAudioPlayer);
    const audioEl = container.querySelector('audio') as HTMLAudioElement;
    audioEl.src = 'http://localhost/v3/stream?id=701';
    Object.defineProperty(audioEl, 'currentTime', { value: 190, writable: true, configurable: true });
    Object.defineProperty(audioEl, 'duration', { value: 190, writable: true, configurable: true });

    await fireEvent(audioEl, new Event('play'));

    await vi.waitFor(() => {
      expect(getPreloadedTrackBlobUrl(playerStore.queue[1])).toBe('blob:http://localhost/precached-702');
    });
    expect(cacheMap.has('/v3/stream?id=702')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://cdn.example/online-702.mp3', expect.any(Object));

    await fireEvent(audioEl, new Event('ended'));

    await vi.waitFor(() => {
      expect(playerStore.qIndex).toBe(1);
      expect(audioEl.src).toBe('blob:http://localhost/precached-702');
    });
  });

  it('rejects 403 or <200KB anti-leech audio streams during background precaching and chains forward to next valid full track', async () => {
    const cacheMap = new Map<string, Response>();
    (window as any).caches = {
      open: vi.fn().mockResolvedValue({
        match: vi.fn(async (key: string) => cacheMap.get(key)),
        put: vi.fn(async (key: string, res: Response) => { cacheMap.set(key, res); })
      })
    };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('forbidden-801')) {
        return { ok: false, status: 403, headers: new Headers(), blob: async () => new Blob([]) };
      }
      if (url.includes('tiny-802')) {
        return { ok: true, status: 200, headers: new Headers(), blob: async () => new Blob([new Uint8Array(150_000)]) };
      }
      return { ok: true, status: 200, headers: new Headers({ 'Content-Type': 'audio/mpeg' }), blob: async () => new Blob([new Uint8Array(1_350_000)]) };
    }));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/precached-803');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    (api.songV1 as any).mockImplementation(async (id: string) => {
      if (id === '801') return { code: '000000', data: { url: 'https://cdn.example/forbidden-801.mp3' } };
      if (id === '802') return { code: '000000', data: { url: 'https://cdn.example/tiny-802.mp3' } };
      if (id === '803') return { code: '000000', data: { url: 'https://cdn.example/full-803.mp3' } };
      return { code: '000000', data: {} };
    });

    const t0: Track = { id: 800, name: 'Playing', artist: 'A', url: '/v3/stream?id=800', isLocal: true };
    const t1: Track = { id: 801, name: 'Forbidden 801', artist: 'B' };
    const t2: Track = { id: 802, name: 'Tiny 802', artist: 'C' };
    const t3: Track = { id: 803, name: 'Valid 803', artist: 'D' };
    const t4: Track = { id: 804, name: 'Prev Local', artist: 'E', url: '/v3/stream?id=804', isLocal: true };

    playerStore.setQueue([t0, t1, t2, t3, t4], 0);
    preloadSurroundingTracks(playerStore.queue, 0, 'list');

    await vi.waitFor(() => {
      expect(getPreloadedTrackBlobUrl(playerStore.queue[3])).toBe('blob:http://localhost/precached-803');
    });
    expect(playerStore.queue[1].unplayable).toBe(true);
    expect(playerStore.queue[2].unplayable).toBe(true);
    expect(cacheMap.has('/v3/stream?id=803')).toBe(true);
  });
});
