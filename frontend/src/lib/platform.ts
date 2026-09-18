/**
 * 平台与设备能力守卫系统 (Platform Capabilities System)
 * 遵循 DRY 原则，统一收敛管理全平台兼容性、硬件控制与环境差异检测。
 */

export function checkIsIOS(): boolean {
  if (typeof window === 'undefined' || !window.navigator) return false;
  return (
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  );
}

export function checkSupportsCache(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

export function checkSupportsMediaSession(): boolean {
  return typeof window !== 'undefined' && 'mediaSession' in navigator;
}

export interface PlatformCapabilities {
  /** 是否为 iOS / iPadOS 设备 */
  readonly isIOS: boolean;
  /** 是否支持软音量调节（iOS 系统强制只读，无法通过 JS 控制音量） */
  readonly canAdjustVolume: boolean;
  /**
   * 是否支持高级 Web Audio 音频处理（如 PEQ 均衡器）
   * ⚠️ 关键防护：iOS WebKit 在锁屏/切后台时会强制冻结 AudioContext，接入 Web Audio 会导致音频断流。
   */
  readonly canUseAudioProcessing: boolean;
  /** 是否支持浏览器离线缓存 (CacheStorage) */
  readonly supportsCache: boolean;
  /** 是否支持 MediaSession 锁屏与系统控制中心交互 */
  readonly supportsMediaSession: boolean;
}

export function getPlatformCapabilities(): PlatformCapabilities {
  const isIOS = checkIsIOS();
  return {
    isIOS,
    canAdjustVolume: !isIOS,
    canUseAudioProcessing: !isIOS,
    supportsCache: checkSupportsCache(),
    supportsMediaSession: checkSupportsMediaSession()
  };
}

/** 全局平台能力单例 */
export const platform: PlatformCapabilities = getPlatformCapabilities();
