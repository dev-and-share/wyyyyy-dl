/**
 * 锁屏与系统控制中心交互管理系统 (MediaSession Integration)
 * 依托 pwa-audio-player core 的 MediaSessionController 提供跨平台与 iOS 锁屏沉浸歌词映射。
 */

import { MediaSessionController } from 'pwa-audio-player';
import type { Track } from './types';
import { formatArtist, DEFAULT_VINYL_COVER } from './utils';
import { t } from './i18n';

export interface MediaSessionHandlers {
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeekTo?: (time: number) => void;
}

export interface MediaSessionLyricInfo {
  currentText?: string;
  nextText?: string;
}

let activeHandlers: MediaSessionHandlers = {
  onPlay: () => {},
  onPause: () => {},
  onPrev: () => {},
  onNext: () => {}
};

let currentTrackKey: string | number | null = null;
let currentCoverUrl: string | null = null;
let lastPositionSyncedKey: string | number | null = null;

export function getLastPositionSyncedKey(): string | number | null {
  return lastPositionSyncedKey;
}

export function getCurrentTrackKey(): string | number | null {
  return currentTrackKey;
}

const controller = new MediaSessionController({
  onPlay: () => activeHandlers.onPlay(),
  onPause: () => activeHandlers.onPause(),
  onPrev: () => activeHandlers.onPrev(),
  onNext: () => activeHandlers.onNext()
}, true);

export function getMediaSessionController(): MediaSessionController {
  return controller;
}

export function setupMediaSession(handlers: MediaSessionHandlers) {
  activeHandlers = handlers;
  controller.registerHandlers();
}

function formatArtworkUrl(url: string | undefined): string {
  if (!url || url === DEFAULT_VINYL_COVER || url.startsWith('data:image/svg+xml')) {
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

export function updateMediaSessionMetadata(track: Track | null, lyricInfo?: MediaSessionLyricInfo) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
  if (!track) {
    controller.updateMetadata(null);
    currentTrackKey = null;
    currentCoverUrl = null;
    return;
  }

  const coverUrl = formatArtworkUrl(track.cover);
  const trackKey = track.id ?? track.url ?? `${track.name}-${track.artist}`;
  currentTrackKey = trackKey;
  currentCoverUrl = coverUrl;

  const coreTrack: any = {
    id: track.id,
    title: track.name || t('common.unknownSong'),
    artist: formatArtist(track.artist) || t('common.unknownArtist'),
    album: t('common.neteaseCloudMusic'),
    artwork: coverUrl
  };

  controller.updateMetadata(coreTrack, {
    currentText: lyricInfo?.currentText,
    nextText: lyricInfo?.nextText
  });
}

export function updateMediaSessionPlaybackState(playing: boolean) {
  controller.updatePlaybackState(playing ? 'playing' : 'paused');
}

export function clearMediaSessionPosition() {
  lastPositionSyncedKey = null;
  controller.clearPosition();
}

export function updateMediaSessionPosition(
  audioEl: HTMLAudioElement | null,
  overridePosition?: number,
  overrideDuration?: number
) {
  if (!audioEl) return;
  const dur = overrideDuration ?? audioEl.duration;
  if (dur && !isNaN(dur) && isFinite(dur) && dur > 0) {
    const cur = overridePosition ?? (audioEl.currentTime || 0);
    controller.updatePosition(cur, dur, audioEl.playbackRate || 1.0);
    lastPositionSyncedKey = currentTrackKey;
  }
}
