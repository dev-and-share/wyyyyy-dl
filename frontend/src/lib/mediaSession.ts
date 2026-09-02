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
 */
export function updateMediaSessionPosition(audioEl: HTMLAudioElement | null) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator) || !audioEl) return;
  if (!('setPositionState' in navigator.mediaSession)) return;
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
