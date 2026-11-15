/**
 * 🎵 播放器核心模块 (Player Core Module)
 * 消费 pwa-audio-player 引擎，管理播放队列、状态机、锁屏保活与睡眠定时器
 */

export * from './playerStore.svelte';
export * from './playerHelper';
export * from './playerStorage';
export * from './trackStatus.svelte';
export * from './mediaSession';
export * from './sleepTimer.svelte';
export * from './lyricParser';
export * from './iosF3KeepAlive';
export * from './peq';
export * from './playbackResilience';
export {
  MIN_VALID_AUDIO_BYTES,
  MIN_FULL_TRACK_BYTES,
  getTrackPreloadKey,
  getPreloadedTrackBlobUrl,
  isPreloadedBlobUrlForTrack,
  clearPreloadedTrackBlob,
  precacheCandidateAudio,
  isCandidateTrackPlayable
} from './nextTrackPrecache';
