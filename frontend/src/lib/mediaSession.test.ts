import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupMediaSession, updateMediaSessionPosition, updateMediaSessionMetadata } from './mediaSession';
import type { Track } from './types';

// Mock MediaMetadata for jsdom environment
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

describe('mediaSession iOS contracts', () => {
  let actionHandlers: Record<string, Function | null>;
  let mockSetPositionState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    actionHandlers = {};
    mockSetPositionState = vi.fn();

    // Mock global navigator.mediaSession
    Object.defineProperty(navigator, 'mediaSession', {
      value: {
        setActionHandler: vi.fn((action: string, handler: Function | null) => {
          actionHandlers[action] = handler;
        }),
        setPositionState: mockSetPositionState,
        metadata: null,
        playbackState: 'none'
      },
      writable: true,
      configurable: true
    });
  });

  it('setupMediaSession must explicitly set seekbackward and seekforward to null to force iOS prev/next buttons', () => {
    setupMediaSession({
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onPrev: vi.fn(),
      onNext: vi.fn()
    });

    expect(actionHandlers['play']).toBeTypeOf('function');
    expect(actionHandlers['pause']).toBeTypeOf('function');
    expect(actionHandlers['previoustrack']).toBeTypeOf('function');
    expect(actionHandlers['nexttrack']).toBeTypeOf('function');

    // 关键契约：必须显式设为 null，否则 iOS 会退回到 ±10s 跳秒按键
    expect(actionHandlers['seekbackward']).toBeNull();
    expect(actionHandlers['seekforward']).toBeNull();
    expect(actionHandlers['seekto']).toBeNull();
  });

  it('setupMediaSession disables seekto on iOS so the lock screen keeps prev/next controls', () => {
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true
    });

    setupMediaSession({
      onPlay: vi.fn(), onPause: vi.fn(), onPrev: vi.fn(), onNext: vi.fn(), onSeekTo: vi.fn()
    });

    expect(actionHandlers['previoustrack']).toBeTypeOf('function');
    expect(actionHandlers['nexttrack']).toBeTypeOf('function');
    expect(actionHandlers['seekto']).toBeNull();

    Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
  });

  it('updateMediaSessionPosition correctly invokes setPositionState with duration, playbackRate and clamped position', () => {
    const mockAudio = {
      duration: 200,
      currentTime: 45,
      playbackRate: 1.25
    } as unknown as HTMLAudioElement;

    updateMediaSessionPosition(mockAudio);

    expect(mockSetPositionState).toHaveBeenCalledWith({
      duration: 200,
      playbackRate: 1.25,
      position: 45
    });
  });

  it('updateMediaSessionPosition clamps currentTime within [0, duration]', () => {
    const mockAudio = {
      duration: 100,
      currentTime: 150,
      playbackRate: 1
    } as unknown as HTMLAudioElement;

    updateMediaSessionPosition(mockAudio);

    expect(mockSetPositionState).toHaveBeenCalledWith({
      duration: 100,
      playbackRate: 1,
      position: 100
    });
  });

  it('updateMediaSessionPosition safely handles null audio or invalid duration', () => {
    updateMediaSessionPosition(null);
    expect(mockSetPositionState).not.toHaveBeenCalled();

    const invalidAudio = {
      duration: NaN,
      currentTime: 0,
      playbackRate: 1
    } as unknown as HTMLAudioElement;

    updateMediaSessionPosition(invalidAudio);
    expect(mockSetPositionState).not.toHaveBeenCalled();
  });

  it('updateMediaSessionMetadata formats artist and sets fallback artwork safely', () => {
    const track: Track = {
      id: 123,
      name: '七里香',
      artist: '周杰伦',
      cover: ''
    };

    updateMediaSessionMetadata(track);

    expect(navigator.mediaSession.metadata).not.toBeNull();
    expect(navigator.mediaSession.metadata?.title).toBe('七里香');
    expect(navigator.mediaSession.metadata?.artist).toBe('周杰伦');
    // 封面为空时兜底到 /favicon.png
    expect(navigator.mediaSession.metadata?.artwork[0].src).toContain('/favicon.png');
  });
});
