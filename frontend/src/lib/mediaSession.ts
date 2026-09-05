import type { Track } from './types';
import { formatArtist, DEFAULT_VINYL_COVER, isIOS } from './utils';

export interface MediaSessionHandlers {
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeekTo?: (time: number) => void;
}

/**
 * 初始化并向系统注册 MediaSession 硬件与系统控制中心交互监听
 * 支持 iOS 锁屏、控制中心、AirPods 双击/按压切歌与蓝牙车载控制
 */
export function setupMediaSession(handlers: MediaSessionHandlers) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

  try {
    navigator.mediaSession.setActionHandler('play', () => handlers.onPlay());
    navigator.mediaSession.setActionHandler('pause', () => handlers.onPause());
    navigator.mediaSession.setActionHandler('previoustrack', () => handlers.onPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => handlers.onNext());

    // 彻底清除并禁用所有时间快进/快退/时间跳转动作，
    // 强制锁定系统控制中心与锁屏为【曲目导航（⏮ ⏯ ⏭）】而非【跳秒快进（↺15 ↻15）】
    try { navigator.mediaSession.setActionHandler('seekbackward', null); } catch {}
    try { navigator.mediaSession.setActionHandler('seekforward', null); } catch {}
    try { navigator.mediaSession.setActionHandler('seekto', null); } catch {}
  } catch (e) {
    console.warn('[MediaSession] 注册动作监听失败:', e);
  }
}

/**
 * 实时同步当前曲目元信息至系统锁屏界面、Apple Watch 与蓝牙设备
 */
export function updateMediaSessionMetadata(track: Track | null) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
  if (!track) {
    navigator.mediaSession.metadata = null;
    return;
  }

  const coverSrc = track.cover && track.cover !== DEFAULT_VINYL_COVER ? track.cover : '/favicon.png';
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name || '未知歌曲',
      artist: formatArtist(track.artist) || '未知歌手',
      album: '网易云音乐',
      artwork: [
        { src: coverSrc, sizes: '96x96' },
        { src: coverSrc, sizes: '128x128' },
        { src: coverSrc, sizes: '192x192' },
        { src: coverSrc, sizes: '256x256' },
        { src: coverSrc, sizes: '384x384' },
        { src: coverSrc, sizes: '512x512' }
      ]
    });
  } catch (e) {
    console.warn('[MediaSession] 更新曲目元数据失败:', e);
  }
}

/**
 * 实时同步当前播放状态（playing / paused）
 */
export function updateMediaSessionPlaybackState(playing: boolean) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  } catch {}
}

/**
 * 锁屏/控制中心进度同步
 * 注意：在 WebKit / Apple 生态（iOS / iPadOS / macOS）中，调用 setPositionState 会触发系统判定为"可快进长音频"，
 * 从而强行将左右按钮替换为 ↺15 和 ↻15 跳秒键。
 * 彻底跳过此调用，以换取系统控制中心与锁屏常驻纯正的【上一首 / 播放-暂停 / 下一首】音乐播放器布局。
 */
export function updateMediaSessionPosition(_audioEl: HTMLAudioElement | null) {
  // 保持空实现，确保系统无论何时都不会将播控小组件判定为快进快退
  return;
}
