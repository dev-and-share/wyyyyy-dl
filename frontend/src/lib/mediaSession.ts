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
 * 实时同步当前音频进度与总时长至系统锁屏进度条
 *
 * 关键性能与系统协同规范：
 * 1. 锁屏进度条依托 W3C MediaSession positionState（duration, playbackRate, position）。
 * 2. 严禁在 `timeupdate`（每秒 4 次）等高频轮询中调用！高频 IPC 会导致 WebKit/MediaRemote 状态抖动并重置回系统默认跳秒。
 * 3. 仅在低频事件点触发：loadedmetadata、play、pause、seeked。
 * 4. 系统底层会根据上报的 position 与 playbackRate 自动平滑走针，无需前端轮询。
 */
export function updateMediaSessionPosition(audioEl: HTMLAudioElement | null) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator) || !audioEl) return;
  if (!('setPositionState' in navigator.mediaSession)) return;

  try {
    const duration = audioEl.duration;
    if (duration && !isNaN(duration) && isFinite(duration) && duration > 0) {
      const position = Math.min(Math.max(0, audioEl.currentTime || 0), duration);
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: audioEl.playbackRate || 1.0,
        position
      });
    }
  } catch (e) {
    console.warn('[MediaSession] 同步进度状态失败:', e);
  }
}
