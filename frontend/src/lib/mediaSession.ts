import type { Track } from './types';
import { formatArtist, DEFAULT_VINYL_COVER, isIOS } from './utils';
import { t } from './i18n';

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

    // Clear backward/forward actions to enforce track navigation instead of 15s skip
    try { navigator.mediaSession.setActionHandler('seekbackward', null); } catch {}
    try { navigator.mediaSession.setActionHandler('seekforward', null); } catch {}
    try { navigator.mediaSession.setActionHandler('seekto', null); } catch {}
  } catch (e) {
    console.warn('[MediaSession] Failed to register action handlers:', e);
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
let currentTrackKey: string | number | null = null;
let currentCoverUrl: string | null = null;
let lastPositionSyncedKey: string | number | null = null;

export function getLastPositionSyncedKey(): string | number | null {
  return lastPositionSyncedKey;
}

export function getCurrentTrackKey(): string | number | null {
  return currentTrackKey;
}

function formatArtworkUrl(url: string | undefined): string {
  if (!url || url === DEFAULT_VINYL_COVER) {
    try {
      return new URL('/favicon.png', window.location.href).href;
    } catch {
      return '/favicon.png';
    }
  }
  if (url.startsWith('data:image/svg+xml')) {
    try {
      return new URL('/favicon.png', window.location.href).href;
    } catch {
      return '/favicon.png';
    }
  }
  const cleanUrl = url.replace(/^http:\/\//i, 'https://');
  try {
    return new URL(cleanUrl, window.location.href).href;
  } catch {
    return cleanUrl;
  }
}

function getArtworkMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function createArtworkList(coverUrl: string) {
  const type = getArtworkMimeType(coverUrl);
  return [
    { src: coverUrl, sizes: '96x96', type },
    { src: coverUrl, sizes: '128x128', type },
    { src: coverUrl, sizes: '192x192', type },
    { src: coverUrl, sizes: '256x256', type },
    { src: coverUrl, sizes: '384x384', type },
    { src: coverUrl, sizes: '512x512', type }
  ];
}

export function updateMediaSessionMetadata(track: Track | null, lyricInfo?: MediaSessionLyricInfo) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
  if (!track) {
    navigator.mediaSession.metadata = null;
    currentTrackKey = null;
    currentCoverUrl = null;
    return;
  }

  // 外部/测试环境重置了 metadata 时同步重置本地缓存标记
  if (!navigator.mediaSession.metadata) {
    currentTrackKey = null;
    currentCoverUrl = null;
  }

  const songName = track.name || t('common.unknownSong');
  const artistName = formatArtist(track.artist) || t('common.unknownArtist');

  const currentText = lyricInfo?.currentText?.trim();
  const nextText = lyricInfo?.nextText?.trim();

  const title = currentText || songName;
  const artist = currentText ? `${songName} · ${artistName}` : artistName;
  const album = nextText ? `⏭ ${nextText}` : (currentText ? songName : t('common.neteaseCloudMusic'));

  const coverUrl = formatArtworkUrl(track.cover);
  const trackKey = track.id ?? track.url ?? `${songName}-${artistName}`;

  if (
    navigator.mediaSession.metadata &&
    currentTrackKey === trackKey &&
    currentCoverUrl === coverUrl
  ) {
    navigator.mediaSession.metadata.title = title;
    navigator.mediaSession.metadata.artist = artist;
    navigator.mediaSession.metadata.album = album;
    return;
  }

  currentTrackKey = trackKey;
  currentCoverUrl = coverUrl;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork: createArtworkList(coverUrl)
    });
  } catch (e) {
    console.warn('[MediaSession] Failed to update metadata:', e);
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
 * 清除系统锁屏上的进度状态（切换曲目时避免旧曲目时间与满格残留）
 */
export function clearMediaSessionPosition() {
  lastPositionSyncedKey = null;
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
  if (!('setPositionState' in navigator.mediaSession)) return;
  try {
    navigator.mediaSession.setPositionState();
  } catch {
    try {
      (navigator.mediaSession.setPositionState as any)(null);
    } catch {}
  }
}

/**
 * 实时同步当前音频进度与总时长至系统锁屏进度条
 *
 * 在起播、加载元数据、seek 以及切歌时调用，告知系统当前曲目时长与进度起点。
 * iOS 会以此为基准由系统时钟平滑推算前进，绝不会出现旧曲目时间凝固残留。
 */
export function updateMediaSessionPosition(
  audioEl: HTMLAudioElement | null,
  overridePosition?: number,
  overrideDuration?: number
) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator) || !audioEl) return;
  if (!('setPositionState' in navigator.mediaSession)) return;

  try {
    const dur = overrideDuration ?? audioEl.duration;
    if (dur && !isNaN(dur) && isFinite(dur) && dur > 0) {
      const cur = overridePosition ?? (audioEl.currentTime || 0);
      const position = Math.min(Math.max(0, cur), dur);
      navigator.mediaSession.setPositionState({
        duration: dur,
        playbackRate: audioEl.playbackRate || 1.0,
        position
      });
      lastPositionSyncedKey = currentTrackKey;
    }
  } catch (e) {
    console.warn('[MediaSession] 同步进度状态失败:', e);
  }
}
