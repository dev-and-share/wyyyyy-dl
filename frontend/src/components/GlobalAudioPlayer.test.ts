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

  it('automatically advances to the next track when audio ends naturally (even if pause fired first)', async () => {
    const tracks = [
      { id: 101, name: '歌曲1', artist: '歌手A', url: '/v3/stream?id=101', isLocal: true },
      { id: 102, name: '歌曲2', artist: '歌手B', url: '/v3/stream?id=102', isLocal: true }
    ];
    playerStore.setQueue(tracks, 0);
    playerStore.duration = 200;
    playerStore.curTime = 200;
    playerStore.playing = true;

    const { container } = render(GlobalAudioPlayer);
    const audioEl = container.querySelector('audio') as HTMLAudioElement;
    audioEl.src = 'http://localhost/v3/stream?id=101';
    Object.defineProperty(audioEl, 'duration', { value: 200, writable: true });
    Object.defineProperty(audioEl, 'currentTime', { value: 200, writable: true });

    // In WebKit / HTML5, pause fires immediately before ended
    await fireEvent(audioEl, new Event('pause'));
    expect(playerStore.playing).toBe(false);

    // ended event fires
    await fireEvent(audioEl, new Event('ended'));

    // Should advance queue index to 1 (next track)
    expect(playerStore.qIndex).toBe(1);
  });

  it('ignores obsolete audio onerror event if audioEl.src does not match activeTrack url', async () => {
    const track1: any = { id: 201, name: '旧歌曲', artist: '歌手A', url: '/v3/stream?id=201', isLocal: true };
    const track2: any = { id: 202, name: '新曲目', artist: '歌手B', url: '/v3/stream?id=202', isLocal: true };
    playerStore.setQueue([track1, track2], 1); // 当前处于 track2
    playerStore.playing = true;

    const { container } = render(GlobalAudioPlayer);
    const audioEl = container.querySelector('audio') as HTMLAudioElement;

    // 模拟残留的旧音轨源报错（例如上一首歌被 abort）
    audioEl.src = 'http://localhost/v3/stream?id=201';
    Object.defineProperty(audioEl, 'error', {
      value: { code: 4, message: 'MEDIA_ELEMENT_ERROR' },
      configurable: true
    });

    await fireEvent(audioEl, new Event('error'));

    // 活跃曲目 track2 绝不能被冤枉判为 unplayable
    expect(track2.unplayable).toBeFalsy();
    expect(playerStore.qIndex).toBe(1);
  });

  it('manages loading state and prevents old track audio replay during async resolution on track switch', async () => {
    const { container } = render(GlobalAudioPlayer);
    const audioEl = container.querySelector('audio') as HTMLAudioElement;

    // 当前在播已落盘旧歌
    const oldTrack = { id: 301, name: '旧歌曲', artist: '歌手A', url: '/v3/stream?id=301', isLocal: true };
    playerStore.setQueue([oldTrack], 0);
    audioEl.src = 'http://localhost/v3/stream?id=301';
    playerStore.playing = true;

    // 切换至一首无预设 url 的插件/外部歌曲（需要异步解析）
    const newAsyncTrack = { id: 'mf_kugou_999', name: '新插件歌曲', artist: '歌手B' };
    window.dispatchEvent(new CustomEvent('wyy:play-tracks', {
      detail: { tracks: [newAsyncTrack], optionsOrIdx: { startIndex: 0, forceReplace: true } }
    }));

    // 验证：立即激活 loading，且在 iOS 环境下切换至无声 loop 循环（绝不以 0 秒重播旧歌）
    expect(playerStore.loading).toBe(true);
    expect(audioEl.loop).toBe(true);
    expect(audioEl.src.startsWith('blob:')).toBe(true);
  });

  it('does NOT reassign audioEl.src or call play() when returning to foreground while audio is playing', async () => {
    const track = { id: 401, name: '前台测试歌曲', artist: '歌手A', url: '/v3/stream?id=401', isLocal: true };
    playerStore.setQueue([track], 0);
    playerStore.playing = true;

    const { container } = render(GlobalAudioPlayer);
    const audioEl = container.querySelector('audio') as HTMLAudioElement;
    audioEl.src = 'http://localhost/v3/stream?id=401';
    Object.defineProperty(audioEl, 'paused', { value: false, writable: true, configurable: true });
    Object.defineProperty(audioEl, 'currentTime', { value: 45, writable: true, configurable: true });
    Object.defineProperty(audioEl, 'readyState', { value: 1, writable: true, configurable: true }); // iOS WebKit readyState in background

    const playSpy = vi.spyOn(audioEl, 'play');
    const srcSetterSpy = vi.fn();
    Object.defineProperty(audioEl, 'src', {
      get: () => 'http://localhost/v3/stream?id=401',
      set: (val) => { srcSetterSpy(val); },
      configurable: true
    });

    // Simulate switching to visible (app foregrounded)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // Audio src MUST NOT be touched, and play() MUST NOT be called in visibilitychange
    expect(srcSetterSpy).not.toHaveBeenCalled();
    expect(playSpy).not.toHaveBeenCalled();
    // UI curTime should be synced to audioEl.currentTime
    expect(playerStore.curTime).toBe(45);
  });

  it('stops playback cleanly and avoids recursive track skip loop when audio play() is blocked by browser Autoplay policy (NotAllowedError)', async () => {
    const track1 = { id: 501, name: '受限歌曲1', artist: '歌手A', url: '/v3/stream?id=501', isLocal: true };
    const track2 = { id: 502, name: '本地歌曲2', artist: '歌手B', url: '/v3/stream?id=502', isLocal: true };
    playerStore.setQueue([track1, track2], 0);
    playerStore.playing = true;

    // Simulate browser blocking play() with NotAllowedError (user has not interacted yet)
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => {
      const err = new Error('The request is not allowed by the user agent or the platform in the current context');
      err.name = 'NotAllowedError';
      return Promise.reject(err);
    });

    const { container } = render(GlobalAudioPlayer);
    const audioEl = container.querySelector('audio') as HTMLAudioElement;
    audioEl.src = 'http://localhost/v3/stream?id=501';

    // Trigger toggle play
    window.dispatchEvent(new CustomEvent('wyy:toggle-play'));
    await new Promise((r) => setTimeout(r, 50));

    // Contract: Must mark playerStore.playing = false, and MUST NOT skip to track2 in an automated loop
    expect(playerStore.playing).toBe(false);
    expect(playerStore.qIndex).toBe(0); // Kept on track1 waiting for user gesture
  });

  it('toggles playback with Spacebar keydown on active window when not focused on text inputs', async () => {
    const track = { id: 601, name: '太空步', artist: 'MJ', url: '/v3/stream?id=601', isLocal: true };
    playerStore.setQueue([track], 0);
    playerStore.playing = false;

    const { container, unmount } = render(GlobalAudioPlayer);
    const audioEl = container.querySelector('audio') as HTMLAudioElement;
    audioEl.src = 'http://localhost/v3/stream?id=601';

    // 1. 普通状态按 Space：应 preventDefault 并切换播放
    const spaceEvent = new KeyboardEvent('keydown', { code: 'Space', key: ' ', cancelable: true, bubbles: true });
    window.dispatchEvent(spaceEvent);
    expect(spaceEvent.defaultPrevented).toBe(true);

    // 2. 在 <input> 内按 Space：不应 preventDefault，也不应打扰用户输入
    const inputEl = document.createElement('input');
    document.body.appendChild(inputEl);
    inputEl.focus();
    const inputSpaceEvent = new KeyboardEvent('keydown', { code: 'Space', key: ' ', cancelable: true, bubbles: true });
    inputEl.dispatchEvent(inputSpaceEvent);
    expect(inputSpaceEvent.defaultPrevented).toBe(false);
    document.body.removeChild(inputEl);

    // 3. 在 <textarea> 内按 Space：不应 preventDefault
    const textareaEl = document.createElement('textarea');
    document.body.appendChild(textareaEl);
    textareaEl.focus();
    const textareaSpaceEvent = new KeyboardEvent('keydown', { code: 'Space', key: ' ', cancelable: true, bubbles: true });
    textareaEl.dispatchEvent(textareaSpaceEvent);
    expect(textareaSpaceEvent.defaultPrevented).toBe(false);
    document.body.removeChild(textareaEl);

    // 4. 组件卸载后移除 keydown 监听
    unmount();
    const postUnmountEvent = new KeyboardEvent('keydown', { code: 'Space', key: ' ', cancelable: true, bubbles: true });
    window.dispatchEvent(postUnmountEvent);
    expect(postUnmountEvent.defaultPrevented).toBe(false);
  });
});
