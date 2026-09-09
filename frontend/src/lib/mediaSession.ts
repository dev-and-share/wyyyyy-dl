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

export interface MediaSessionLyricInfo {
  currentText?: string;
  nextText?: string;
}

/**
 * 实时同步当前曲目元信息至系统锁屏界面、Apple Watch 与蓝牙设备
 *
 * 🎵 锁屏沉浸歌词映射：
 * - Title（锁屏居中大字）：有歌词时显示当前句（极佳清晰度）；无歌词/前奏时回退到曲目名称。
 * - Artist（副标题）：有歌词时显示 "曲名 · 歌手"；无歌词时显示纯歌手名。
 * - Album（第三行）：有下一句时显示 "⏭ [下一句预告]"，若为最后一句显示曲目名，无歌词显示 "网易云音乐"。
 */
export function updateMediaSessionMetadata(track: Track | null, lyricInfo?: MediaSessionLyricInfo) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
  if (!track) {
    navigator.mediaSession.metadata = null;
    return;
  }

  const coverSrc = track.cover && track.cover !== DEFAULT_VINYL_COVER ? track.cover : '/favicon.png';
  const songName = track.name || '未知歌曲';
  const artistName = formatArtist(track.artist) || '未知歌手';

  const currentText = lyricInfo?.currentText?.trim();
  const nextText = lyricInfo?.nextText?.trim();

  const title = currentText || songName;
  const artist = currentText ? `${songName} · ${artistName}` : artistName;
  const album = nextText ? `⏭ ${nextText}` : (currentText ? songName : '网易云音乐');

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
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
 * 🛡️ 架构防御契约（iOS WebKit 避坑）：
 * 1. 绝不上报 setPositionState，保持完全空实现。
 * 2. 根因剖析：
 *    - 假走针与断流：iOS 熄屏状态下无用户前台手势令牌，后台网络处于深度节流。一旦上报 setPositionState
 *      或响应锁屏 seek，用户在锁屏拖拽会导致音频 Range 拉流挂死静音，而系统 NowPlaying 却以 1.0 倍速独立空转（假走针），
 *      直到用户重新点亮屏幕打开 App，音频才被迫从 0 秒重新拉流起播。
 *    - 播客模式降级：向苹果 WebKit 暴露时间轴进度或跳转意图，会导致系统强行将【⏮ 播放/暂停 ⏭】
 *      降级为【↺15 播放/暂停 ↻15】跳秒按钮。
 * 3. 锁屏歌词解耦：锁屏动态歌词（Title / Artist / Album 映射）与进度条完全独立，绝不受此影响。
 * 4. 结论：锁屏进度条保持静默，进度调节完全收拢在 App 内部，换取 100% 稳定的熄屏后台连续播放与曲目导航。
 */
export function updateMediaSessionPosition(_audioEl: HTMLAudioElement | null) {
  // 保持完全空实现：彻底杜绝锁屏假走针、后台断流静音以及退化为 15s 跳秒
  // 原始实现保留备查（供非 iOS 平台或未来系统策略更新时参考）：
  // if (typeof window === 'undefined' || !('mediaSession' in navigator) || !_audioEl) return;
  // if (!('setPositionState' in navigator.mediaSession)) return;
  // try {
  //   const duration = _audioEl.duration;
  //   if (duration && !isNaN(duration) && isFinite(duration) && duration > 0) {
  //     const position = Math.min(Math.max(0, _audioEl.currentTime || 0), duration);
  //     navigator.mediaSession.setPositionState({
  //       duration,
  //       playbackRate: _audioEl.playbackRate || 1.0,
  //       position
  //     });
  //   }
  // } catch (e) {
  //   console.warn('[MediaSession] 同步进度状态失败:', e);
  // }
  return;
}
