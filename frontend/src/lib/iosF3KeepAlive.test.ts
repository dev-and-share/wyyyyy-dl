import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isIosF3Holding,
  handleIosF3Pause,
  handleIosF3Resume,
  resetIosF3State
} from './iosF3KeepAlive';
import * as platformModule from './platform';

describe('iOS Mode F3 KeepAlive State Machine', () => {
  let mockAudio: any;

  beforeEach(() => {
    mockAudio = {
      src: 'https://example.com/song.mp3',
      currentTime: 42.5,
      duration: 180,
      loop: false,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    resetIosF3State(mockAudio);
  });

  afterEach(() => {
    resetIosF3State(mockAudio);
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

  it('activates F3 silent hold on iOS when paused', async () => {
    // @ts-ignore
    platformModule.platform.isIOS = true;

    const track = { id: 123, name: 'Test Song', artist: 'Test Artist' } as any;
    const handled = handleIosF3Pause(mockAudio, track, 42.5, 180, mockAudio.src);

    expect(handled).toBe(true);
    expect(isIosF3Holding()).toBe(true);
    expect(mockAudio.loop).toBe(true);
    expect(mockAudio.src).toMatch(/^blob:/);
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('triggers flip-flop toggle when receiving pause while already in silent hold', () => {
    // @ts-ignore
    platformModule.platform.isIOS = true;

    const track = { id: 123, name: 'Test Song', artist: 'Test Artist' } as any;
    handleIosF3Pause(mockAudio, track, 42.5, 180, mockAudio.src);
    expect(isIosF3Holding()).toBe(true);

    const onResumeRequested = vi.fn();
    // Simulate AirPods sending another pause action
    const handledAgain = handleIosF3Pause(mockAudio, track, 0, 180, mockAudio.src, onResumeRequested);

    expect(handledAgain).toBe(true);
    // Should have initiated resume
    expect(mockAudio.loop).toBe(false);
    expect(mockAudio.src).toBe('https://example.com/song.mp3');
  });

  it('resumes song and restores source and loop state', async () => {
    // @ts-ignore
    platformModule.platform.isIOS = true;

    const track = { id: 123, name: 'Test Song', artist: 'Test Artist' } as any;
    handleIosF3Pause(mockAudio, track, 42.5, 180, mockAudio.src);

    const onPlaySuccess = vi.fn();
    const resumed = handleIosF3Resume(mockAudio, onPlaySuccess);

    expect(resumed).toBe(true);
    expect(isIosF3Holding()).toBe(false);
    expect(mockAudio.loop).toBe(false);
    expect(mockAudio.src).toBe('https://example.com/song.mp3');
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('resets state completely on resetIosF3State', () => {
    // @ts-ignore
    platformModule.platform.isIOS = true;

    handleIosF3Pause(mockAudio, null, 42.5, 180, mockAudio.src);
    expect(isIosF3Holding()).toBe(true);

    resetIosF3State(mockAudio);
    expect(isIosF3Holding()).toBe(false);
    expect(mockAudio.loop).toBe(false);
  });

  it('manages configurable timeout minutes via localStorage', async () => {
    const { getF3TimeoutMinutes, setF3TimeoutMinutes } = await import('./iosF3KeepAlive');
    expect(getF3TimeoutMinutes()).toBe(5);

    setF3TimeoutMinutes(15);
    expect(getF3TimeoutMinutes()).toBe(15);

    setF3TimeoutMinutes(0); // 0 means never
    expect(getF3TimeoutMinutes()).toBe(0);

    setF3TimeoutMinutes(5); // reset back
  });
});
