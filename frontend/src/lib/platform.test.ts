import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkIsIOS, checkSupportsCache, checkSupportsMediaSession, getPlatformCapabilities } from './platform';

describe('platform capabilities', () => {
  const originalNavigator = window.navigator;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects iOS user agents correctly', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone'
    });

    expect(checkIsIOS()).toBe(true);
    const caps = getPlatformCapabilities();
    expect(caps.isIOS).toBe(true);
    expect(caps.canAdjustVolume).toBe(false);
    expect(caps.canUseAudioProcessing).toBe(false);
  });

  it('detects non-iOS desktop environments', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      maxTouchPoints: 0
    });

    expect(checkIsIOS()).toBe(false);
    const caps = getPlatformCapabilities();
    expect(caps.isIOS).toBe(false);
    expect(caps.canAdjustVolume).toBe(true);
    expect(caps.canUseAudioProcessing).toBe(true);
  });

  it('checks CacheStorage and MediaSession support', () => {
    expect(typeof checkSupportsCache()).toBe('boolean');
    expect(typeof checkSupportsMediaSession()).toBe('boolean');
  });
});
