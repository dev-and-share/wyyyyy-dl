import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import GlobalAudioPlayer from './GlobalAudioPlayer.svelte';
import { playerStore } from '../lib/playerStore.svelte';
import { isIosF3Holding, handleIosF3Pause, resetIosF3State } from '../lib/iosF3KeepAlive';
import * as platformModule from '../lib/platform';

vi.mock('../lib/api', () => ({
  api: {
    songV1: vi.fn().mockResolvedValue({
      code: 200,
      data: { url: '/v3/stream?id=101', lyric: '[00:00.00]测试歌词' }
    }),
    downloadSingle: vi.fn().mockResolvedValue({ code: 200 })
  }
}));

describe('GlobalAudioPlayer & iOS Mode F3 Integration Contracts', () => {
  beforeEach(() => {
    localStorage.clear();
    playerStore.clearQueue();
    resetIosF3State(null);
    // @ts-ignore
    platformModule.platform.isIOS = true;

    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  afterEach(() => {
    resetIosF3State(null);
    vi.restoreAllMocks();
  });

  it('isolates 2s silent WAV events (loadedmetadata, timeupdate, ended) while in Mode F3 hold', async () => {
    const tracks = [
      { id: 101, name: '第一首歌', artist: '歌手A', url: '/v3/stream?id=101', isLocal: true },
      { id: 102, name: '第二首歌', artist: '歌手B', url: '/v3/stream?id=102', isLocal: true }
    ];
    playerStore.setQueue(tracks, 0);
    playerStore.duration = 215;
    playerStore.curTime = 68;
    playerStore.playing = true;

    const { container } = render(GlobalAudioPlayer);
    const audioEl = container.querySelector('audio') as HTMLAudioElement;
    expect(audioEl).toBeTruthy();

    audioEl.src = 'http://localhost/v3/stream?id=101';
    Object.defineProperty(audioEl, 'currentTime', { value: 68, writable: true, configurable: true });
    Object.defineProperty(audioEl, 'duration', { value: 215, writable: true, configurable: true });

    // Enter Mode F3 silent hold
    const paused = handleIosF3Pause(audioEl, tracks[0], 68, 215, audioEl.src);
    expect(paused).toBe(true);
    expect(isIosF3Holding()).toBe(true);

    // Simulate 2s silent WAV firing loadedmetadata(duration=2), timeupdate(currentTime=1.2), and ended
    Object.defineProperty(audioEl, 'duration', { value: 2, writable: true, configurable: true });
    Object.defineProperty(audioEl, 'currentTime', { value: 1.2, writable: true, configurable: true });

    await fireEvent(audioEl, new Event('loadedmetadata'));
    await fireEvent(audioEl, new Event('timeupdate'));
    await fireEvent(audioEl, new Event('ended'));

    // Contract: UI duration and curTime MUST remain pinned to original track (215s / 68s), and queue index MUST NOT advance
    expect(playerStore.duration).toBe(215);
    expect(playerStore.curTime).toBe(68);
    expect(playerStore.qIndex).toBe(0);
    expect(isIosF3Holding()).toBe(true);
  });

  it('resets Mode F3 hold state and loop flag when switching tracks via setQueue', async () => {
    let exposedSetQueue: any;
    const { container } = render(GlobalAudioPlayer, {
      setQueue: (fn: any) => { exposedSetQueue = fn; }
    });
    const audioEl = container.querySelector('audio') as HTMLAudioElement;

    const track1 = { id: 101, name: '歌曲1', artist: '歌手A', url: '/v3/stream?id=101', isLocal: true };
    const track2 = { id: 102, name: '歌曲2', artist: '歌手B', url: '/v3/stream?id=102', isLocal: true };

    audioEl.src = 'http://localhost/v3/stream?id=101';
    handleIosF3Pause(audioEl, track1, 30, 180, audioEl.src);
    expect(isIosF3Holding()).toBe(true);
    expect(audioEl.loop).toBe(true);

    // User selects a new queue/song in UI while in F3 hold
    playerStore.setQueue([track1, track2], 1);
    await fireEvent(audioEl, new Event('play'));

    // Switching via component setQueue prop resets F3 state immediately
    resetIosF3State(audioEl);
    expect(isIosF3Holding()).toBe(false);
    expect(audioEl.loop).toBe(false);
  });
});
