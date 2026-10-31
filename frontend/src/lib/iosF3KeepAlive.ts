/**
 * iOS WebKit PWA 锁屏播放保活 (Mode F3 架构)
 *
 * 核心机制：
 * 1. 永不调用 HTMLMediaElement.pause()：保持硬件 PCM 解码器与 AVAudioSession active，彻底避免硬件死锁；
 * 2. 暂停时无缝换源为 2s 内存短静音 WAV (loop=true)，轻量且不消耗流量；
 * 3. 三重隐形锁定：MediaSession 状态置 paused、保持原曲 Metadata、钉死进度条位置；
 * 4. 智能翻转状态机：应对 AirPods 在有音频输出时默认下发 pause 动作的问题，将其自动翻转为恢复播放；
 * 5. 恢复播放时换回原曲流，play() 成功后精准 seek 至断点；
 * 6. 5 分钟超时保护：超时自动真暂停，节约电量。
 */

import { platform } from './platform';
import type { Track } from './types';
import { updateMediaSessionMetadata, updateMediaSessionPlaybackState } from './mediaSession';

let isF3Holding = false;
let savedPauseTime = 0;
let savedDuration = 0;
let savedSongSrc = '';
let savedTrack: Track | null = null;
let f3TimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let silentWavUrl: string | null = null;

export const STORAGE_KEY_IOS_F3_TIMEOUT = 'wyyyy_ios_f3_timeout_min';
export const DEFAULT_IOS_F3_TIMEOUT_MIN = 5;

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
  } catch {}
}

/** 生成并缓存 2 秒 0 振幅静音 WAV Blob URL */
function getShortSilentWavUrl(): string {
  if (silentWavUrl) return silentWavUrl;
  try {
    const sampleRate = 8000;
    const durationSec = 2;
    const numSamples = sampleRate * durationSec;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeStr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);
    silentWavUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  } catch (e) {
    console.error('[Mode F3] 生成静音 WAV 失败:', e);
  }
  return silentWavUrl || '';
}

/** 检查当前是否正处于 iOS F3 静音保活态 */
export function isIosF3Holding(): boolean {
  return isF3Holding;
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

  // 智能翻转状态机：如果已经在保活态，收到暂停动作（例如 AirPods 在发声时只能发送 pause），直接翻转为恢复播放！
  if (isF3Holding) {
    console.info('[Mode F3] 检测到已处于静音保活态，自动触发【智能翻转】恢复原曲播放');
    handleIosF3Resume(audioEl, onResumeRequested);
    return true;
  }

  const pausePos = curTime || audioEl.currentTime || 0;
  const trackDur = (duration && isFinite(duration) && duration > 0) ? duration : (audioEl.duration || 0);
  const songUrl = currentSrc || audioEl.src;

  if (!songUrl || songUrl === window.location.href || songUrl.startsWith('blob:')) {
    return false;
  }

  savedPauseTime = pausePos;
  savedDuration = trackDur;
  savedSongSrc = songUrl;
  savedTrack = track;
  isF3Holding = true;

  if (f3TimeoutTimer) {
    clearTimeout(f3TimeoutTimer);
    f3TimeoutTimer = null;
  }

  // 单轨换源至 2s 静音 WAV loop 播放，元素绝不 pause()
  const silentUrl = getShortSilentWavUrl();
  audioEl.loop = true;
  audioEl.src = silentUrl;

  audioEl.play().then(() => {
    applyTripleInvisibleLock(savedTrack, savedDuration, savedPauseTime);
  }).catch((err) => {
    console.warn('[Mode F3] 静音 WAV 播放失败，降级为常规 pause:', err);
    resetIosF3State(audioEl);
    try { audioEl.pause(); } catch {}
  });

  // 超时保护：根据用户设置自动真暂停以节约电池（0 表示用户选择永不超时）
  const timeoutMins = getF3TimeoutMinutes();
  if (timeoutMins > 0) {
    f3TimeoutTimer = setTimeout(() => {
      if (isF3Holding) {
        console.info(`[Mode F3] ${timeoutMins}分钟超时保护触发，执行真暂停释放硬件资源`);
        resetIosF3State(audioEl);
        try { audioEl.pause(); } catch {}
      }
    }, timeoutMins * 60 * 1000);
  } else {
    console.info('[Mode F3] 用户配置为永不超时，持续保持静音保活');
  }

  return true;
}

/**
 * 处理恢复播放意图
 * @returns true 表示成功恢复，调用方切勿重复调用 audioEl.play()！
 */
export function handleIosF3Resume(
  audioEl: HTMLAudioElement,
  onPlaySuccess?: () => void
): boolean {
  if (!isF3Holding) return false;

  if (f3TimeoutTimer) {
    clearTimeout(f3TimeoutTimer);
    f3TimeoutTimer = null;
  }

  const targetTime = savedPauseTime;
  const songSrc = savedSongSrc;
  const track = savedTrack;

  isF3Holding = false;
  audioEl.loop = false;

  if (!songSrc || songSrc === window.location.href) {
    return false;
  }

  // 换回原曲流并恢复播放
  audioEl.src = songSrc;

  audioEl.play().then(() => {
    updateMediaSessionPlaybackState(true);
    if (track) updateMediaSessionMetadata(track);

    const doSeek = () => {
      try {
        if (targetTime > 0) {
          audioEl.currentTime = targetTime;
        }
      } catch (e) {
        console.warn('[Mode F3] Seek back to break-point failed:', e);
      }
      if (onPlaySuccess) onPlaySuccess();
    };

    if (audioEl.readyState >= 1 && audioEl.duration > 0) {
      setTimeout(doSeek, 50);
    } else {
      const onMeta = () => {
        audioEl.removeEventListener('loadedmetadata', onMeta);
        setTimeout(doSeek, 50);
      };
      audioEl.addEventListener('loadedmetadata', onMeta);
    }
  }).catch((err) => {
    console.error('[Mode F3] 原曲恢复播放失败:', err);
    isF3Holding = false;
    audioEl.loop = false;
  });

  return true;
}

/** 在 F3 保活暂停期间同步更新用户拖动进度条的目标断点时间 */
export function updateIosF3SavedTime(newTime: number): void {
  if (!isF3Holding) return;
  savedPauseTime = Math.max(0, savedDuration > 0 ? Math.min(newTime, savedDuration) : newTime);
  applyTripleInvisibleLock(savedTrack, savedDuration, savedPauseTime);
}

/** 切歌、清空队列或退出时强制重置保活状态 */
export function resetIosF3State(audioEl?: HTMLAudioElement | null): void {
  if (f3TimeoutTimer) {
    clearTimeout(f3TimeoutTimer);
    f3TimeoutTimer = null;
  }
  isF3Holding = false;
  savedPauseTime = 0;
  savedDuration = 0;
  savedSongSrc = '';
  savedTrack = null;
  if (audioEl) {
    audioEl.loop = false;
  }
}

