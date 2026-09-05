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

  it('updateMediaSessionPosition must skip setPositionState on iOS devices to prevent lock screen switching to skip buttons', () => {
    // 模拟 iPhone UA
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true
    });

    const mockAudio = {
      duration: 200,
      currentTime: 45,
      playbackRate: 1
    } as unknown as HTMLAudioElement;

    updateMediaSessionPosition(mockAudio);

    // 关键契约：iOS 设备上绝对禁止调用 setPositionState
    expect(mockSetPositionState).not.toHaveBeenCalled();

    // 恢复 UA
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true
    });
  });

  it('updateMediaSessionPosition must also skip setPositionState on iPadOS touch devices', () => {
    const originalPlatform = navigator.platform;
    const originalMaxTouchPoints = navigator.maxTouchPoints;

    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });

    const mockAudio = {
      duration: 180,
      currentTime: 30,
      playbackRate: 1
    } as unknown as HTMLAudioElement;

    updateMediaSessionPosition(mockAudio);

    expect(mockSetPositionState).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'platform', { value: originalPlatform, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: originalMaxTouchPoints, configurable: true });
  });

  it('updateMediaSessionPosition must never invoke setPositionState to guarantee track navigation controls', () => {
    const mockAudio = {
      duration: 200,
      currentTime: 45,
      playbackRate: 1
    } as unknown as HTMLAudioElement;

    updateMediaSessionPosition(mockAudio);

    // 关键契约：无论任何平台，绝对禁止调用 setPositionState，彻底杜绝系统显示跳秒按键
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
