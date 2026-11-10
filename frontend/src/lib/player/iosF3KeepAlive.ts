/**
 * iOS WebKit PWA 锁屏播放保活 (Mode F3 架构)
 * 依托 pwa-audio-player core 的 SilentHoldKeeper 提供单轨静音波形保活机制与超时节电。
 */

import { SilentHoldKeeper, getSilentWavUrl } from 'pwa-audio-player';
export { getSilentWavUrl };
import { platform } from '../platform';
import type { Track } from '../types';
import { updateMediaSessionMetadata, updateMediaSessionPlaybackState } from './mediaSession';

export const STORAGE_KEY_IOS_F3_TIMEOUT = 'wyy_ios_f3_timeout_min';
export const DEFAULT_IOS_F3_TIMEOUT_MIN = 5;

let currentKeeper: SilentHoldKeeper | null = null;
let currentAudioEl: HTMLAudioElement | null = null;
let savedTrack: Track | null = null;
let savedDuration = 0;

/** 读取用户配置的锁屏暂停保活时长（分钟，0 表示永不超时） */
export function getF3TimeoutMinutes(): number {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_IOS_F3_TIMEOUT_MIN;
  try {
    const val = localStorage.getItem(STORAGE_KEY_IOS_F3_TIMEOUT);
    if (val !== null) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch {}
  return DEFAULT_IOS_F3_TIMEOUT_MIN;
}

/** 保存用户配置的锁屏暂停保活时长（分钟，0 表示永不超时） */
export function setF3TimeoutMinutes(minutes: number): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY_IOS_F3_TIMEOUT, String(Math.max(0, minutes)));
    if (currentKeeper) {
      currentKeeper.setHardPauseTimeoutMs(minutes > 0 ? minutes * 60 * 1000 : 0);
    }
  } catch {}
}

/** 施加三重隐形锁定：playbackState + metadata + setPositionState */
function applyTripleInvisibleLock(track: Track | null, duration: number, position: number) {
  // 1. 锁屏状态置为 paused（显示 ▶️ 播放图标，停止系统推算假走针）
  updateMediaSessionPlaybackState(false);

  // 2. 牢牢钉死原曲 metadata，防止被静音 WAV 冲刷
  if (track) {
    updateMediaSessionMetadata(track);
  }

  // 3. 钉死锁屏进度条在当前断点毫秒位置
  if (typeof window !== 'undefined' && 'mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
    try {
      if (duration > 0) {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: Math.min(Math.max(0, position), duration)
        });
      }
    } catch (e) {
      console.warn('[Mode F3] setPositionState lock failed:', e);
    }
  }
}

function getKeeper(audioEl: HTMLAudioElement): SilentHoldKeeper {
  if (currentKeeper && currentAudioEl === audioEl) {
    return currentKeeper;
  }
  currentAudioEl = audioEl;
  const timeoutMins = getF3TimeoutMinutes();
  currentKeeper = new SilentHoldKeeper(
    audioEl,
    {
      strategy: platform.isIOS ? 'silent-hold' : 'native',
      hardPauseTimeoutMs: timeoutMins > 0 ? timeoutMins * 60 * 1000 : 0
    },
    {
      onKeepAliveEnter: () => {
        applyTripleInvisibleLock(savedTrack, savedDuration, currentKeeper?.getSavedPauseTime() || 0);
      },
      onKeepAliveExit: () => {
        updateMediaSessionPlaybackState(true);
        if (savedTrack) updateMediaSessionMetadata(savedTrack);
      },
      onHardPauseTimeout: () => {
        resetIosF3State(audioEl);
      }
    }
  );
  return currentKeeper;
}

/** 检查当前是否正处于 iOS F3 静音保活态 */
export function isIosF3Holding(): boolean {
  return currentKeeper ? currentKeeper.isHolding() : false;
}

/**
 * 处理暂停意图
 * @returns true 表示已由 iOS F3 换源保活接管，调用方切勿调用 audioEl.pause()！
 */
export function handleIosF3Pause(
  audioEl: HTMLAudioElement,
  track: Track | null,
  curTime: number,
  duration: number,
  currentSrc: string,
  onResumeRequested?: () => void
): boolean {
  if (!platform.isIOS) return false;

  const keeper = getKeeper(audioEl);
  const timeoutMins = getF3TimeoutMinutes();
  keeper.setHardPauseTimeoutMs(timeoutMins > 0 ? timeoutMins * 60 * 1000 : 0);

  savedTrack = track;
  savedDuration = (duration && isFinite(duration) && duration > 0) ? duration : (audioEl.duration || 0);

  const wasHolding = keeper.isHolding();
  const handled = keeper.handlePause(track as any, curTime, duration, currentSrc);

  // 如果原本处于 holding 状态，触发了 AirPods Flip-Flop 翻转为恢复播放
  if (wasHolding && !keeper.isHolding() && onResumeRequested) {
    onResumeRequested();
  }

  return handled;
}

/**
 * 处理恢复播放意图
 * @returns true 表示成功恢复，调用方切勿重复调用 audioEl.play()！
 */
export function handleIosF3Resume(
  audioEl: HTMLAudioElement,
  onPlaySuccess?: () => void
): boolean {
  const keeper = getKeeper(audioEl);
  if (!keeper.isHolding()) return false;
  return keeper.handleResume(onPlaySuccess);
}

/** 在 F3 保活暂停期间同步更新用户拖动进度条的目标断点时间 */
export function updateIosF3SavedTime(newTime: number): void {
  if (!isIosF3Holding() || !currentKeeper) return;
  currentKeeper.updateSavedPauseTime(newTime);
  applyTripleInvisibleLock(savedTrack, savedDuration, currentKeeper.getSavedPauseTime());
}

/** 切歌、清空队列或退出时强制重置保活状态 */
export function resetIosF3State(audioEl?: HTMLAudioElement | null): void {
  if (currentKeeper) {
    currentKeeper.reset();
  }
  currentKeeper = null;
  currentAudioEl = null;
  savedTrack = null;
  savedDuration = 0;
  if (audioEl) {
    try {
      audioEl.loop = false;
    } catch {}
  }
}

/**
 * 🛡️ 异步切歌/解析期间的过渡保活 (基于 pwa-player core SilentHoldKeeper 机制)
 * iOS WebKit 锁屏切歌时若音频中断超过 3 秒会被系统看门狗杀死，因此播放无声波形循环保活；
 * 非 iOS 环境立即 pause() 旧音频，避免旧曲继续发声。
 */
export function holdTransitionKeepAlive(audioEl: HTMLAudioElement | null): void {
  if (!audioEl) return;
  if (platform.isIOS) {
    try {
      audioEl.loop = true;
      audioEl.src = getSilentWavUrl();
      audioEl.play().catch(() => {});
    } catch {}
  } else {
    try {
      audioEl.pause();
    } catch {}
  }
}
