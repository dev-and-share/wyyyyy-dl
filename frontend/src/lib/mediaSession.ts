import type { Track } from './types';
import { formatArtist, DEFAULT_VINYL_COVER } from './utils';

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

    // iOS 锁屏默认显示 ±10s 快进/快退按钮（seekbackward/seekforward）。
    // 显式设置为 null 可告知系统"本播放器使用曲目导航而非时间跳转"，
    // 从而强制 iOS 锁屏与控制中心显示「上一首/下一首」而非「前进后退10秒」。
    try { navigator.mediaSession.setActionHandler('seekbackward', null); } catch {}
    try { navigator.mediaSession.setActionHandler('seekforward', null); } catch {}

    if (handlers.onSeekTo) {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          handlers.onSeekTo!(details.seekTime);
        }
      });
    }
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
 * 实时同步当前音频进度与总时长至系统锁屏进度条
 * iOS 注意：setPositionState 会触发 iOS 锁屏显示 ±10s 跳秒按钮，
 * 与 seekbackward/seekforward=null 的设置冲突，导致无法显示上一首/下一首。
 * 因此 iOS 上跳过此调用，牺牲锁屏进度条，换取正确的曲目导航按钮。
 */
export function updateMediaSessionPosition(audioEl: HTMLAudioElement | null) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator) || !audioEl) return;
  if (!('setPositionState' in navigator.mediaSession)) return;
  // iOS: 调用 setPositionState 会让系统误判为"可快进内容"，锁屏改显 ±10s 跳秒键
  if (/iP(hone|ad|od)/i.test(navigator.userAgent)) return;
  try {
    const duration = audioEl.duration;
    if (duration && !isNaN(duration) && duration > 0) {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: audioEl.playbackRate || 1.0,
        position: Math.min(Math.max(0, audioEl.currentTime), duration)
      });
    }
  } catch {}
}
