import type { Track } from '../types';
import { isLocalStreamUrl } from '../utils';
import { isSameAudioSource } from './playerHelper';

/** 在线音频直链安全保鲜期（12 分钟），超时后切歌前主动重解析防止 CDN 403 断流 */
export const ONLINE_URL_TTL_MS = 12 * 60 * 1000;

/** 外部音频打断后阶梯式探测恢复时间轴（覆盖 1~30 秒导航单句/多句播报与 Siri 短交互） */
export const INTERRUPTION_PROBE_DELAYS_MS = [1000, 2200, 3800, 5800, 8500, 12000, 16000, 22000, 30000];

/**
 * 标记在线曲目 URL 的解析时间戳，用于过期检测
 */
export function markTrackUrlResolved(track: Track | null | undefined, now = Date.now()): void {
  if (!track || !track.url) return;
  if (track.isLocal || isLocalStreamUrl(track.url)) {
    delete track._resolvedAt;
    return;
  }
  track._resolvedAt = now;
}

/**
 * 判断曲目的在线流地址是否已超过保鲜期
 */
export function isTrackUrlExpired(track: Track | null | undefined, now = Date.now()): boolean {
  if (!track || !track.url) return false;
  if (track.isLocal || isLocalStreamUrl(track.url)) return false;
  if (typeof track._resolvedAt !== 'number') return false;
  return now - track._resolvedAt > ONLINE_URL_TTL_MS;
}

/**
 * 将跨源兜底音源（QQ/酷狗等直链）统一包装为服务端 Range 代理流地址，附带防盗链头
 */
export function formatFallbackStreamUrl(source: { url: string; headers?: Record<string, string> }): string {
  const rawUrl = source?.url || '';
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    const q = new URLSearchParams({ url: rawUrl });
    const ref = source.headers?.referer || source.headers?.Referer;
    const ua = source.headers?.['user-agent'] || source.headers?.['User-Agent'];
    if (ref) q.set('referer', ref);
    if (ua) q.set('ua', ua);
    return `/v3/stream/online?${q.toString()}`;
  }
  return rawUrl;
}

/**
 * 为异步音源解析增加超时保护，防止弱网或基站切换时 TCP 挂起导致加载无限卡死
 */
export function withResolveTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  if (ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Resolve timeout after ${ms}ms`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// ===== 流启动看门狗与单次重刷控制 =====

const retriedSessionTracks = new Set<string>();
let streamWatchdogTimer: ReturnType<typeof setTimeout> | null = null;

function getTrackRetryKey(track: Track): string {
  if (track.id !== undefined && track.id !== null && track.id !== '') {
    return `id:${String(track.id)}`;
  }
  if (track.filePath) {
    return `path:${track.filePath}`;
  }
  return `meta:${track.name || ''}-${track.artist || ''}`;
}

export function canRetryTrackStream(track: Track | null | undefined): boolean {
  if (!track || track.isLocal) return false;
  return !retriedSessionTracks.has(getTrackRetryKey(track));
}

export function markTrackStreamRetried(track: Track | null | undefined): void {
  if (!track) return;
  retriedSessionTracks.add(getTrackRetryKey(track));
}

export function clearTrackStreamRetry(track?: Track | null): void {
  if (!track) {
    retriedSessionTracks.clear();
    return;
  }
  retriedSessionTracks.delete(getTrackRetryKey(track));
}

export function startStreamWatchdog(callback: () => void, timeoutMs = 12000): void {
  clearStreamWatchdog();
  streamWatchdogTimer = setTimeout(() => {
    streamWatchdogTimer = null;
    callback();
  }, timeoutMs);
}

export function clearStreamWatchdog(): void {
  if (streamWatchdogTimer !== null) {
    clearTimeout(streamWatchdogTimer);
    streamWatchdogTimer = null;
  }
}

/** 统一归类 audio.play() Promise 拒绝原因，避免各处重复判断 */
export function classifyPlayRejection(err: any): 'abort' | 'not_allowed' | 'stream_error' {
  const name = err?.name || '';
  if (name === 'AbortError') return 'abort';
  if (name === 'NotAllowedError') return 'not_allowed';
  return 'stream_error';
}

export interface BindAndPlayOptions {
  audioEl: HTMLAudioElement;
  track: Track;
  url: string;
  session: number;
  getCurrentSession: () => number;
  resetTime: boolean;
  onMetadataSync: () => void;
  onResetTimeApplied: () => void;
  onWatchdogTimeout: () => void;
  onPlaySuccess: () => void;
  onNotAllowed: () => void;
  onStreamError: () => void;
}

/**
 * 统一绑定音频源、重置起播断点、启动 12 秒缓冲看门狗并执行播放与异常分流
 */
export function bindAndPlayWithWatchdog(opts: BindAndPlayOptions): void {
  const {
    audioEl, track, url, session, getCurrentSession, resetTime,
    onMetadataSync, onResetTimeApplied, onWatchdogTimeout, onPlaySuccess, onNotAllowed, onStreamError
  } = opts;
  try { audioEl.loop = false; } catch {}
  if (!isSameAudioSource(audioEl.src, url)) {
    onMetadataSync();
    audioEl.src = url;
    if (resetTime) { try { audioEl.currentTime = 0; } catch {} }
  }
  if (resetTime) {
    onResetTimeApplied();
    const onMeta = () => {
      try { audioEl.currentTime = 0; } catch {}
      audioEl.removeEventListener('loadedmetadata', onMeta);
    };
    audioEl.addEventListener('loadedmetadata', onMeta);
  }
  startStreamWatchdog(() => {
    if (session === getCurrentSession() && (audioEl.currentTime || 0) === 0 && audioEl.readyState < 3) {
      onWatchdogTimeout();
    }
  }, 12000);
  const p = audioEl.play();
  if (p !== undefined) {
    p.then(() => {
      if (session !== getCurrentSession()) return;
      clearStreamWatchdog();
      clearTrackStreamRetry(track);
      onPlaySuccess();
    }).catch((err: any) => {
      if (session !== getCurrentSession()) return;
      clearStreamWatchdog();
      const kind = classifyPlayRejection(err);
      if (kind === 'abort') return;
      if (kind === 'not_allowed') { onNotAllowed(); return; }
      onStreamError();
    });
  }
}

// ===== 外部音频打断（导航播报 / Siri / 通话）自愈控制器 =====

export interface InterruptedState {
  active: boolean;
  resumeTime: number;
  trackId: string | number | null;
}

export class InterruptionRecoveryController {
  private intentionalPause = false;
  private interruptedState: InterruptedState = {
    active: false,
    resumeTime: 0,
    trackId: null
  };
  private probeTimers: Array<ReturnType<typeof setTimeout>> = [];
  private foregroundResuming = false;

  /** 标记接下来发生的是用户/定时器主动暂停，不触发打断恢复 */
  markIntentionalPause(): void {
    this.intentionalPause = true;
  }

  /** 清除主动暂停标记 */
  clearIntentionalPause(): void {
    this.intentionalPause = false;
  }

  /** 消费并复位主动暂停标记 */
  consumeIntentionalPause(): boolean {
    const val = this.intentionalPause;
    this.intentionalPause = false;
    return val;
  }

  isInterrupted(): boolean {
    return this.interruptedState.active;
  }

  getResumeTime(): number {
    return this.interruptedState.resumeTime;
  }

  /**
   * 仅清空后台探测定时器，保留 interruptedState（用于长期通话探针超时后等待前台切回继续恢复）
   */
  private clearProbeTimers(): void {
    for (const timer of this.probeTimers) {
      clearTimeout(timer);
    }
    this.probeTimers = [];
  }

  /**
   * 彻底取消打断恢复状态与所有定时器（用于用户主动干预、切歌或已恢复起播）
   */
  cancelRecovery(): void {
    this.clearProbeTimers();
    this.foregroundResuming = false;
    this.interruptedState = {
      active: false,
      resumeTime: 0,
      trackId: null
    };
  }

  /**
   * 若在打断恢复期间系统已自动拉起 onplay，检查是否需要补回被 WebKit 归零的播放进度
   */
  consumePendingResumePosition(audioEl: HTMLAudioElement | null, activeTrackId: string | number | null | undefined): void {
    if (!this.interruptedState.active || !audioEl) return;
    const sameTrack =
      this.interruptedState.trackId == null ||
      activeTrackId == null ||
      String(this.interruptedState.trackId) === String(activeTrackId);
    const saved = this.interruptedState.resumeTime;
    this.cancelRecovery();
    if (sameTrack && saved > 1 && (audioEl.currentTime || 0) < 1) {
      this.restorePositionIfNeeded(audioEl, saved);
    }
  }

  private restorePositionIfNeeded(audioEl: HTMLAudioElement, resumeTime: number): void {
    if (resumeTime <= 0) return;
    const cur = audioEl.currentTime || 0;
    if (Math.abs(cur - resumeTime) <= 1.5) return;
    try {
      const dur = audioEl.duration;
      if (!dur || isNaN(dur) || !isFinite(dur) || resumeTime < dur) {
        audioEl.currentTime = resumeTime;
      }
    } catch {}
  }

  /**
   * 检测到非主动触发的意外暂停（导航语音播报 / 来电 / FaceTime）时启动阶梯式自动续播探针
   */
  handleUnexpectedPause(
    audioEl: HTMLAudioElement | null,
    curTime: number,
    trackId: string | number | null | undefined,
    onRecovered: () => void,
    onGiveUp: () => void
  ): void {
    if (!audioEl) return;
    this.clearProbeTimers();
    this.foregroundResuming = false;
    this.interruptedState = {
      active: true,
      resumeTime: curTime > 0 ? curTime : (audioEl.currentTime || 0),
      trackId: trackId ?? null
    };

    const capturedTrackId = this.interruptedState.trackId;
    const total = INTERRUPTION_PROBE_DELAYS_MS.length;

    INTERRUPTION_PROBE_DELAYS_MS.forEach((delay, idx) => {
      const timer = setTimeout(() => {
        if (!this.interruptedState.active || this.interruptedState.trackId !== capturedTrackId) {
          return;
        }
        if (!audioEl.paused) {
          const saved = this.interruptedState.resumeTime;
          this.cancelRecovery();
          this.restorePositionIfNeeded(audioEl, saved);
          onRecovered();
          return;
        }

        const finishSuccess = () => {
          if (!this.interruptedState.active || this.interruptedState.trackId !== capturedTrackId) {
            return;
          }
          const saved = this.interruptedState.resumeTime;
          this.cancelRecovery();
          this.restorePositionIfNeeded(audioEl, saved);
          onRecovered();
        };

        const finishFailure = () => {
          if (!this.interruptedState.active || this.interruptedState.trackId !== capturedTrackId) {
            return;
          }
          if (idx === total - 1) {
            // 长时通话打断：停止后台定时器，但保留 interruptedState.active 等待前台切回续播
            this.clearProbeTimers();
            onGiveUp();
          }
        };

        try {
          const p = audioEl.play();
          if (p !== undefined) {
            p.then(finishSuccess, finishFailure);
          } else {
            finishSuccess();
          }
        } catch {
          finishFailure();
        }
      }, delay);

      this.probeTimers.push(timer);
    });
  }

  /**
   * 前台切回或窗口重新获焦时，尝试恢复被长期通话/外部语音打断的播放
   */
  tryResumeOnForeground(
    audioEl: HTMLAudioElement | null,
    onRecovered: () => void,
    onFailed?: (err: any) => void
  ): boolean {
    if (!this.interruptedState.active || !audioEl || this.foregroundResuming) {
      return false;
    }

    const saved = this.interruptedState.resumeTime;
    const capturedTrackId = this.interruptedState.trackId;

    if (!audioEl.paused) {
      this.cancelRecovery();
      this.restorePositionIfNeeded(audioEl, saved);
      onRecovered();
      return true;
    }

    this.clearProbeTimers();
    this.foregroundResuming = true;

    try {
      const p = audioEl.play();
      if (p !== undefined) {
        p.then(() => {
          this.foregroundResuming = false;
          if (!this.interruptedState.active || this.interruptedState.trackId !== capturedTrackId) return;
          this.cancelRecovery();
          this.restorePositionIfNeeded(audioEl, saved);
          onRecovered();
        }).catch((err: any) => {
          this.foregroundResuming = false;
          onFailed?.(err);
        });
      } else {
        this.foregroundResuming = false;
        this.cancelRecovery();
        this.restorePositionIfNeeded(audioEl, saved);
        onRecovered();
      }
      return true;
    } catch (err) {
      this.foregroundResuming = false;
      onFailed?.(err);
      return false;
    }
  }

  /**
   * 封装切回前台/获焦时的完整自愈流程：必要时先重载失效音频源并保存断点，再触发播放恢复
   */
  executeForegroundResume(options: {
    audioEl: HTMLAudioElement | null;
    track: Track | null | undefined;
    curTime: number;
    needsReload: boolean;
    onPendingSeek: (t: number) => void;
    onClearedReload: () => void;
    onRecovered: () => void;
    onFallbackPlay: () => void;
  }): boolean {
    const { audioEl, track, curTime, needsReload, onPendingSeek, onClearedReload, onRecovered, onFallbackPlay } = options;
    if (!audioEl || !this.interruptedState.active || !audioEl.paused) return false;
    if (track && (audioEl.error || audioEl.readyState === 0 || needsReload)) {
      const resumeTime = this.interruptedState.resumeTime || audioEl.currentTime || curTime || 0;
      if (resumeTime > 0) onPendingSeek(resumeTime);
      if (track.url && (track.isLocal || !isTrackUrlExpired(track))) {
        onClearedReload();
        audioEl.src = track.url;
      }
    }
    return this.tryResumeOnForeground(audioEl, onRecovered, (err) => {
      if (classifyPlayRejection(err) === 'stream_error') onFallbackPlay();
    });
  }

  /**
   * 统一处理原生 <audio> onpause：区分主动暂停与系统外部打断，决定立即同步暂停态或启动自愈探针
   */
  dispatchPauseEvent(options: {
    audioEl: HTMLAudioElement;
    wasPlaying: boolean;
    curTime: number;
    trackId: string | number | null | undefined;
    onSyncPaused: () => void;
    onRecovered: () => void;
    onGiveUp: () => void;
  }): void {
    const { audioEl, wasPlaying, curTime, trackId, onSyncPaused, onRecovered, onGiveUp } = options;
    if (this.consumeIntentionalPause() || !wasPlaying) {
      onSyncPaused();
      return;
    }
    this.handleUnexpectedPause(audioEl, curTime, trackId, onRecovered, onGiveUp);
  }
}

export const interruptionController = new InterruptionRecoveryController();
