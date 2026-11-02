import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isIosF3Holding,
  handleIosF3Pause,
  handleIosF3Resume,
  resetIosF3State,
  updateIosF3SavedTime,
  getF3TimeoutMinutes,
  setF3TimeoutMinutes
} from './iosF3KeepAlive';
import * as platformModule from './platform';

class MockMediaMetadata {
  title: string;
  artist: string;
  album: string;
  artwork: Array<{ src: string; sizes?: string }>;
  constructor(init?: any) {
    this.title = init?.title || '';
    this.artist = init?.artist || '';
    this.album = init?.album || '';
    this.artwork = init?.artwork || [];
  }
}
globalThis.MediaMetadata = MockMediaMetadata as any;

describe('iOS Mode F3 KeepAlive State Machine & Contracts', () => {
  let mockAudio: any;
  let listeners: Record<string, Function[]>;
  let mockSetPositionState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listeners = {};
    mockSetPositionState = vi.fn();

    Object.defineProperty(navigator, 'mediaSession', {
      value: {
        setActionHandler: vi.fn(),
        setPositionState: mockSetPositionState,
        metadata: null,
        playbackState: 'none'
      },
      writable: true,
      configurable: true
    });

    mockAudio = {
      src: 'https://example.com/song.mp3',
      currentTime: 42.5,
      duration: 180,
      readyState: 4,
      loop: false,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      addEventListener: vi.fn((evt: string, fn: Function) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(fn);
      }),
      removeEventListener: vi.fn((evt: string, fn: Function) => {
        if (listeners[evt]) {
          listeners[evt] = listeners[evt].filter((f) => f !== fn);
        }
      })
    };
    setF3TimeoutMinutes(5);
    resetIosF3State(mockAudio);
  });

  afterEach(() => {
    resetIosF3State(mockAudio);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('bypasses F3 keep-alive in non-iOS environments', () => {
    vi.spyOn(platformModule, 'checkIsIOS').mockReturnValue(false);
    // @ts-ignore
    platformModule.platform.isIOS = false;

    const res = handleIosF3Pause(mockAudio, null, 42.5, 180, mockAudio.src);
    expect(res).toBe(false);
    expect(isIosF3Holding()).toBe(false);
  });

  it('activates F3 silent hold on iOS and applies Triple Invisible Lock after play resolves', async () => {
    // @ts-ignore
    platformModule.platform.isIOS = true;

    const track = { id: 123, name: '七里香', artist: '周杰伦', cover: 'https://example.com/c.jpg' } as any;
    const handled = handleIosF3Pause(mockAudio, track, 42.5, 180, mockAudio.src);

    expect(handled).toBe(true);
    expect(isIosF3Holding()).toBe(true);
    expect(mockAudio.loop).toBe(true);
    expect(mockAudio.src).toMatch(/^blob:/);
    expect(mockAudio.play).toHaveBeenCalledTimes(1);
    expect(mockAudio.pause).not.toHaveBeenCalled();

    // Flush play().then() microtask
    await Promise.resolve();

    // Verify Triple Invisible Lock:
    // 1. playbackState locked to paused
    expect(navigator.mediaSession.playbackState).toBe('paused');
    // 2. metadata preserved as original track
    expect(navigator.mediaSession.metadata?.title).toBe('七里香');
    expect(navigator.mediaSession.metadata?.artist).toBe('周杰伦');
    // 3. setPositionState pinned at exact break-point (42.5s / 180s)
    expect(mockSetPositionState).toHaveBeenCalledWith({
      duration: 180,
      playbackRate: 1,
      position: 42.5
    });
  });

  it('rejects pause takeover if current src is empty or already a blob: URL (prevents overwriting original song URL)', () => {
    // @ts-ignore
    platformModule.platform.isIOS = true;

    mockAudio.src = 'blob:https://example.com/silent-wav-uuid';
    const handled = handleIosF3Pause(mockAudio, null, 10, 180, mockAudio.src);
    expect(handled).toBe(false);
    expect(isIosF3Holding()).toBe(false);
  });

  it('triggers flip-flop toggle when receiving pause while already in silent hold (AirPods press compatibility)', () => {
    // @ts-ignore
    platformModule.platform.isIOS = true;

    const track = { id: 123, name: 'Test Song', artist: 'Test Artist' } as any;
    handleIosF3Pause(mockAudio, track, 42.5, 180, mockAudio.src);
    expect(isIosF3Holding()).toBe(true);

    const onResumeRequested = vi.fn();
    // Simulate AirPods sending another pause action while 2s silent WAV is playing
    const handledAgain = handleIosF3Pause(mockAudio, track, 0.8, 2, mockAudio.src, onResumeRequested);

    expect(handledAgain).toBe(true);
    expect(isIosF3Holding()).toBe(false);
    expect(mockAudio.loop).toBe(false);
    expect(mockAudio.src).toBe('https://example.com/song.mp3');
  });

  it('resumes song and seeks back via loadedmetadata when readyState is 0 (slow network / unbuffered stream)', async () => {
    vi.useFakeTimers();
    // @ts-ignore
    platformModule.platform.isIOS = true;

    const track = { id: 123, name: 'Test Song', artist: 'Test Artist' } as any;
    handleIosF3Pause(mockAudio, track, 88.4, 240, mockAudio.src);

    // Simulate stream needing network buffer after restoring src
    mockAudio.readyState = 0;
    mockAudio.duration = 0;
    mockAudio.currentTime = 0;

    const onPlaySuccess = vi.fn();
    const resumed = handleIosF3Resume(mockAudio, onPlaySuccess);
    expect(resumed).toBe(true);

    await Promise.resolve();
    // Should wait for loadedmetadata before seeking
    expect(listeners['loadedmetadata']?.length).toBe(1);
    expect(mockAudio.currentTime).toBe(0);

    // Fire loadedmetadata
    mockAudio.readyState = 1;
    mockAudio.duration = 240;
    listeners['loadedmetadata'][0]();
    expect(listeners['loadedmetadata']?.length).toBe(0);

    vi.advanceTimersByTime(60);
    expect(mockAudio.currentTime).toBe(88.4);
    expect(onPlaySuccess).toHaveBeenCalledTimes(1);
  });

  it('falls back to native pause and resets F3 state if silent WAV play() is rejected', async () => {
    // @ts-ignore
    platformModule.platform.isIOS = true;
    mockAudio.play = vi.fn().mockRejectedValue(new Error('NotAllowedError'));

    const track = { id: 123, name: 'Test Song', artist: 'Test Artist' } as any;
    handleIosF3Pause(mockAudio, track, 42.5, 180, mockAudio.src);

    await Promise.resolve();
    await Promise.resolve();

    expect(isIosF3Holding()).toBe(false);
    expect(mockAudio.loop).toBe(false);
    expect(mockAudio.pause).toHaveBeenCalledTimes(1);
  });

  it('triggers hard-pause after configured timeout minutes to save battery, and never times out when set to 0', () => {
    vi.useFakeTimers();
    // @ts-ignore
    platformModule.platform.isIOS = true;

    // 1. Test 5-minute timeout
    setF3TimeoutMinutes(5);
    handleIosF3Pause(mockAudio, null, 30, 180, 'https://example.com/song.mp3');
    expect(isIosF3Holding()).toBe(true);

    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(isIosF3Holding()).toBe(true);
    expect(mockAudio.pause).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60 * 1000 + 100);
    expect(isIosF3Holding()).toBe(false);
    expect(mockAudio.loop).toBe(false);
    expect(mockAudio.pause).toHaveBeenCalledTimes(1);

    // 2. Test 0-minute (never timeout)
    mockAudio.pause.mockClear();
    mockAudio.src = 'https://example.com/song.mp3';
    setF3TimeoutMinutes(0);
    handleIosF3Pause(mockAudio, null, 30, 180, mockAudio.src);
    expect(isIosF3Holding()).toBe(true);

    vi.advanceTimersByTime(60 * 60 * 1000); // 1 hour
    expect(isIosF3Holding()).toBe(true);
    expect(mockAudio.pause).not.toHaveBeenCalled();
  });

  it('updates saved pause time and re-locks position during F3 hold when user seeks', async () => {
    vi.useFakeTimers();
    // @ts-ignore
    platformModule.platform.isIOS = true;

    const track = { id: 123, name: 'Test Song', artist: 'Test Artist' } as any;
    handleIosF3Pause(mockAudio, track, 42.5, 180, mockAudio.src);
    expect(isIosF3Holding()).toBe(true);

    updateIosF3SavedTime(95.0);
    expect(mockSetPositionState).toHaveBeenLastCalledWith({
      duration: 180,
      playbackRate: 1,
      position: 95.0
    });

    mockAudio.readyState = 2;
    handleIosF3Resume(mockAudio);
    await Promise.resolve();
    vi.advanceTimersByTime(60);
    expect(mockAudio.currentTime).toBe(95.0);
  });
});
