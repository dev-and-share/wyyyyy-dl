import type { Track } from '../types';
import { playerStore } from './playerStore.svelte';
import {
  consumePreviousBreadcrumb,
  getOrCreateDeviceId,
  idbAppendEvent,
  idbClearEvents,
  idbGetPendingReports,
  idbLoadRecentEvents,
  loadDiagnosticsConfig,
  saveDiagnosticsConfig,
  type AudioLiveSnapshot,
  type PlaybackDebugReportPayload,
  type PrecacheSnapshot,
  type TelemetryEventEntry,
  type TelemetryStats,
  type TelemetryTriggerType
} from './telemetryStorage';
import {
  bindAudioDomEvents,
  bindGlobalLifecycleListeners,
  buildDebugReportPayload,
  captureAudioSnapshot,
  createEmptyAudioSnapshot,
  createEmptyPrecacheSnapshot,
  createEmptyStats,
  createTelemetryEventEntry,
  dispatchAbnormalBeacon,
  flushPendingReportQueue,
  formatSnapshotJsonPretty,
  isUnexpectedBackgroundKill,
  sendOrEnqueueReport,
  writeBreadcrumbSnapshot
} from './telemetryHelpers';

const MAX_MEMORY_EVENTS = 150;
const AUTO_UPLOAD_COOLDOWN_MS = 60_000;
const MAX_AUTO_REPORTS_PER_SESSION = 5;
const FREEZE_THRESHOLD_MS = 15_000;
const BREADCRUMB_SYNC_INTERVAL_MS = 10_000;
const MAX_UNEXPECTED_KILL_AGE_MS = 2 * 60 * 60 * 1000;

class PlaybackTelemetryStore {
  private initialConfig = loadDiagnosticsConfig();

  hudVisible = $state<boolean>(this.initialConfig.hudEnabled);
  autoUploadEnabled = $state<boolean>(this.initialConfig.autoUpload);
  events = $state<TelemetryEventEntry[]>([]);
  stats = $state<TelemetryStats>(createEmptyStats());
  audioSnapshot = $state<AudioLiveSnapshot>(createEmptyAudioSnapshot());
  precacheSnapshot = $state<PrecacheSnapshot>(createEmptyPrecacheSnapshot());
  resiliencePhase = $state<string>('idle');
  isDesiredPlayback = $state<boolean>(false);
  pendingReportCount = $state<number>(0);
  lastUploadAt = $state<number | null>(null);
  lastUploadStatus = $state<string>('idle');
  isUploading = $state<boolean>(false);
  isFlushingQueue = $state<boolean>(false);

  readonly sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  readonly deviceId = getOrCreateDeviceId();

  private initialized = false;
  private getAudioEl: () => HTMLAudioElement | null = () => null;
  private getDesired: () => boolean = () => this.isDesiredPlayback;
  private checkUrlExpired: (track: Track) => boolean = () => false;

  private audioCleanup: (() => void) | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lifecycleCleanup: (() => void) | null = null;

  private autoCooldownMap = new Map<string, number>();
  private autoReportsThisSession = 0;
  private wasHidden = false;
  private lastBreadcrumbAt = 0;
  private lastStallEventAt = 0;

  private lastFreezeTrackKey = '';
  private lastProgressTime = 0;
  private lastProgressStamp = 0;
  private freezeReportedForEpisode = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const prevCrumb = consumePreviousBreadcrumb();
    const restoredEvents = await idbLoadRecentEvents(MAX_MEMORY_EVENTS);
    if (restoredEvents.length > 0 && this.events.length === 0) {
      this.events = restoredEvents;
    }

    const pending = await idbGetPendingReports();
    this.pendingReportCount = pending.length;

    if (prevCrumb && isUnexpectedBackgroundKill(prevCrumb, MAX_UNEXPECTED_KILL_AGE_MS)) {
      this.stats.unexpectedKills += 1;
      this.recordEvent(
        'unexpected_kill',
        'error',
        `prev_session=${prevCrumb.sessionId} at=${prevCrumb.curTime}s err=${prevCrumb.errCount}`,
        { id: prevCrumb.trackId, name: prevCrumb.trackName }
      );
      if (this.autoUploadEnabled) {
        this.submitReport('unexpected_kill', {
          note: `detected crash/kill from previous session ${prevCrumb.sessionId}`
        }).catch(() => {});
      }
    }

    this.syncCrashBreadcrumb(false, true);
    if (!this.lifecycleCleanup) {
      this.lifecycleCleanup = bindGlobalLifecycleListeners({
        onOnline: () => {
          this.recordEvent('net_online', 'info', 'network restored');
          this.flushPendingReports().catch(() => {});
        },
        onOffline: () => this.recordEvent('net_offline', 'warn', 'network offline'),
        onVisibility: (hidden) => {
          this.wasHidden = hidden && (this.getDesired() || playerStore.playing);
          this.recordEvent(hidden ? 'vis_hidden' : 'vis_visible', 'info', `desired=${this.getDesired()} silentHold=${this.precacheSnapshot.silentHoldActive}`);
          this.syncCrashBreadcrumb(false, true);
        },
        onPageHide: (persisted, hidden) => {
          this.syncCrashBreadcrumb(!hidden && !persisted, true);
          if (
            this.autoUploadEnabled &&
            hidden &&
            this.getDesired() &&
            !this.precacheSnapshot.silentHoldActive &&
            (this.stats.audioErrors > 0 || this.stats.stalls > 0 || this.stats.watchdogTimeouts > 0)
          ) {
            dispatchAbnormalBeacon(this.buildReportPayload('audio_error', 'pagehide while playback abnormal'));
          }
        },
        onBeforeUnload: () => this.syncCrashBreadcrumb(true, true)
      });
    }
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      this.flushPendingReports().catch(() => {});
    }
  }

  attachAudioElement(options: {
    getAudioEl: () => HTMLAudioElement | null;
    getDesired?: () => boolean;
    isUrlExpired?: (track: Track) => boolean;
  }): () => void {
    this.init().catch(() => {});
    this.getAudioEl = options.getAudioEl;
    if (options.getDesired) this.getDesired = options.getDesired;
    if (options.isUrlExpired) this.checkUrlExpired = options.isUrlExpired;

    this.detachAudioElement();

    const el = this.getAudioEl();
    this.freezeReportedForEpisode = false;
    this.lastProgressStamp = Date.now();
    this.lastProgressTime = el && Number.isFinite(el.currentTime) ? el.currentTime : 0;
    if (el) {
      this.audioCleanup = bindAudioDomEvents(el, {
        onPlay: () => {
          this.isDesiredPlayback = this.getDesired();
          this.resiliencePhase = 'starting';
          this.stats.trackPlays += 1;
          this.recordEvent('audio_play', 'info');
        },
        onPlaying: () => {
          this.isDesiredPlayback = this.getDesired();
          this.resiliencePhase = this.precacheSnapshot.silentHoldActive ? 'silent_hold' : 'playing';
          this.freezeReportedForEpisode = false;
          this.lastProgressStamp = Date.now();
          this.lastProgressTime = Number.isFinite(el.currentTime) ? el.currentTime : 0;
          this.recordEvent('audio_playing', 'info');
        },
        onPause: () => {
          this.isDesiredPlayback = this.getDesired();
          if (!this.precacheSnapshot.silentHoldActive) {
            this.resiliencePhase = this.isDesiredPlayback ? 'interrupted' : 'paused';
          }
          this.recordEvent('audio_pause', 'info', `desired=${this.isDesiredPlayback}`);
        },
        onStall: (kind) => {
          if (Date.now() - this.lastStallEventAt > 4000) {
            this.lastStallEventAt = Date.now();
            this.stats.stalls += 1;
            this.recordEvent(`audio_${kind}`, 'warn', `ready=${el.readyState} net=${el.networkState}`);
          }
        },
        onEnded: () => this.recordEvent('audio_ended', 'info'),
        onMeta: () => {
          this.refreshAudioSnapshot();
          this.recordEvent('audio_meta', 'info', `dur=${Math.round(el.duration || 0)}s`);
        },
        onSeeked: () => {
          this.lastProgressTime = Number.isFinite(el.currentTime) ? el.currentTime : 0;
          this.lastProgressStamp = Date.now();
          this.freezeReportedForEpisode = false;
        },
        onAbort: () => {
          if (this.getDesired()) this.recordEvent('audio_abort', 'warn');
        },
        onError: (errName, message) => {
          this.recordEvent('audio_native_error', 'error', `${errName}${message ? ': ' + message : ''}`);
        }
      });
    }

    this.restartHeartbeat();
    return () => this.detachAudioElement();
  }

  private detachAudioElement(): void {
    if (this.audioCleanup) {
      this.audioCleanup();
      this.audioCleanup = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private restartHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => this.tickHeartbeat(), this.hudVisible ? 1000 : 2000);
    this.refreshAudioSnapshot();
  }

  setHudVisible(visible: boolean): void {
    this.hudVisible = Boolean(visible);
    saveDiagnosticsConfig({ hudEnabled: this.hudVisible, autoUpload: this.autoUploadEnabled });
    if (this.audioCleanup || this.heartbeatTimer) this.restartHeartbeat();
    else this.refreshAudioSnapshot();
  }

  toggleHud(): boolean {
    this.setHudVisible(!this.hudVisible);
    return this.hudVisible;
  }

  setAutoUpload(enabled: boolean): void {
    this.autoUploadEnabled = Boolean(enabled);
    saveDiagnosticsConfig({ hudEnabled: this.hudVisible, autoUpload: this.autoUploadEnabled });
    this.recordEvent('diag_autoupload', 'info', `enabled=${this.autoUploadEnabled}`);
  }

  setSilentHoldActive(active: boolean): void {
    this.precacheSnapshot = { ...this.precacheSnapshot, silentHoldActive: active };
    if (active) this.resiliencePhase = 'silent_hold';
  }

  updatePrecacheStatus(status: string, nextTrack?: { id?: string | number; name?: string } | null, hasBlob?: boolean): void {
    this.precacheSnapshot = {
      ...this.precacheSnapshot,
      lastStatus: status,
      nextTrackId: nextTrack?.id != null ? String(nextTrack.id) : this.precacheSnapshot.nextTrackId,
      nextTrackName: nextTrack?.name || this.precacheSnapshot.nextTrackName,
      hasPreloadedBlob: hasBlob !== undefined ? hasBlob : this.precacheSnapshot.hasPreloadedBlob
    };
  }

  recordEvent(
    type: string,
    level: 'info' | 'warn' | 'error' = 'info',
    detail?: string,
    explicitTrack?: { id?: string | number; name?: string } | null
  ): void {
    const entry = createTelemetryEventEntry({ type, level, detail, explicitTrack, audioEl: this.getAudioEl() });
    const next = [...this.events, entry];
    if (next.length > MAX_MEMORY_EVENTS) next.splice(0, next.length - MAX_MEMORY_EVENTS);
    this.events = next;
    idbAppendEvent(entry).catch(() => {});
  }

  recordResolve(outcome: 'start' | 'ok' | 'fallback' | 'timeout' | 'failed', track?: Track | null, detail?: string): void {
    if (outcome === 'start') { this.resiliencePhase = 'resolving'; return; }
    if (outcome === 'timeout') { this.stats.resolveTimeouts += 1; this.recordEvent('resolve_timeout', 'error', detail, track); return; }
    if (outcome === 'failed') { this.recordEvent('resolve_failed', 'error', detail, track); return; }
    if (outcome === 'fallback') { this.recordEvent('resolve_fallback', 'warn', detail || 'builtin_fallback_used', track); return; }
    this.recordEvent('resolve_ok', 'info', detail, track);
  }

  recordPrecache(outcome: 'ok' | 'trial' | 'unplayable' | 'error' | 'hit' | 'miss', track?: Track | null, detail?: string): void {
    if (outcome === 'ok') {
      this.updatePrecacheStatus('ready', track, true);
      this.recordEvent('precache_ready', 'info', detail, track);
    } else if (outcome === 'hit') {
      this.precacheSnapshot = { ...this.precacheSnapshot, hits: this.precacheSnapshot.hits + 1, hasPreloadedBlob: true };
      this.recordEvent('precache_hit', 'info', detail, track);
    } else if (outcome === 'miss') {
      this.precacheSnapshot = { ...this.precacheSnapshot, misses: this.precacheSnapshot.misses + 1, hasPreloadedBlob: false };
    } else {
      this.precacheSnapshot = { ...this.precacheSnapshot, failures: this.precacheSnapshot.failures + 1, lastStatus: outcome };
      this.recordEvent(`precache_${outcome}`, 'warn', detail, track);
    }
  }

  recordSilentHold(action: 'enter' | 'exit' | 'flip_resume' | 'transition' | 'reset', track?: Track | null): void {
    if (action === 'enter' || action === 'transition') this.setSilentHoldActive(true);
    else if (action === 'exit' || action === 'flip_resume' || action === 'reset') this.setSilentHoldActive(false);
    this.recordEvent(`silent_hold_${action}`, 'info', undefined, track);
  }

  recordAutoSkip(track: Track, reason: string, isTrial: boolean, skipCount: number): void {
    this.stats.autoSkips += 1;
    this.recordEvent('auto_skip', isTrial ? 'info' : 'warn', `count=${skipCount} reason=${reason}`, track);
  }

  recordWatchdogTimeout(track?: Track | null): void {
    this.stats.watchdogTimeouts += 1;
    this.resiliencePhase = 'watchdog_timeout';
    this.recordEvent('watchdog_timeout', 'error', 'first_frame_timeout', track);
    if (this.autoUploadEnabled) this.submitReport('watchdog_timeout', { track }).catch(() => {});
  }

  recordStreamFailure(track: Track, reason?: string): void {
    this.stats.audioErrors += 1;
    this.resiliencePhase = 'error';
    this.recordEvent('stream_failure', 'error', reason, track);
    if (this.autoUploadEnabled) this.submitReport('audio_error', { track }).catch(() => {});
  }

  recordPlayRejection(kind: string, err?: any, track?: Track | null): void {
    if (kind === 'abort') return;
    this.stats.playRejections += 1;
    this.recordEvent('play_rejected', kind === 'not_allowed' ? 'warn' : 'error', `${kind}: ${err?.name || err?.message || ''}`, track);
  }

  recordInterruptionRecovery(outcome: 'attempt' | 'recovered' | 'give_up', detail?: string): void {
    if (outcome === 'attempt') { this.resiliencePhase = 'recovering'; this.recordEvent('recovery_attempt', 'warn', detail); }
    else if (outcome === 'recovered') { this.stats.interruptionRecoveries += 1; this.resiliencePhase = 'playing'; this.recordEvent('recovery_ok', 'info', detail); }
    else {
      this.stats.recoveryFailures += 1;
      this.resiliencePhase = 'recovery_give_up';
      this.recordEvent('recovery_give_up', 'error', detail);
      if (this.autoUploadEnabled) this.submitReport('interruption_give_up').catch(() => {});
    }
  }

  refreshAudioSnapshot(): void {
    const el = this.getAudioEl();
    this.isDesiredPlayback = this.getDesired();
    if (el) this.audioSnapshot = captureAudioSnapshot(el);
  }

  tickHeartbeat(): void {
    this.refreshAudioSnapshot();
    const el = this.getAudioEl();
    const desired = this.getDesired();
    const now = Date.now();
    const tr = playerStore.activeTrack;
    const trackKey = tr ? `${tr.id}:${playerStore.qIndex}` : '';

    if (trackKey !== this.lastFreezeTrackKey) {
      this.lastFreezeTrackKey = trackKey;
      this.lastProgressStamp = now;
      this.lastProgressTime = el && Number.isFinite(el.currentTime) ? el.currentTime : 0;
      this.freezeReportedForEpisode = false;
    }

    const activeExpected = Boolean(
      desired && !playerStore.loading && !this.precacheSnapshot.silentHoldActive && el && !el.paused && !el.ended
    );

    if (activeExpected && el) {
      const cur = Number.isFinite(el.currentTime) ? el.currentTime : 0;
      if (Math.abs(cur - this.lastProgressTime) >= 0.2) {
        this.lastProgressTime = cur;
        this.lastProgressStamp = now;
        this.freezeReportedForEpisode = false;
      } else if (!this.freezeReportedForEpisode && now - this.lastProgressStamp >= FREEZE_THRESHOLD_MS) {
        this.freezeReportedForEpisode = true;
        this.stats.freezes += 1;
        this.resiliencePhase = 'frozen';
        this.recordEvent('freeze_detected', 'error', `stalled>=15s at=${cur.toFixed(1)}s ready=${el.readyState} net=${el.networkState}`, tr);
        if (this.autoUploadEnabled) this.submitReport('freeze_detected', { track: tr }).catch(() => {});
      }
    } else {
      this.lastProgressStamp = now;
      this.lastProgressTime = el && Number.isFinite(el.currentTime) ? el.currentTime : 0;
    }

    if (now - this.lastBreadcrumbAt >= BREADCRUMB_SYNC_INTERVAL_MS) {
      this.syncCrashBreadcrumb(false, false);
    }
  }

  private syncCrashBreadcrumb(cleanUnload: boolean, force = false): void {
    const now = Date.now();
    if (!force && now - this.lastBreadcrumbAt < BREADCRUMB_SYNC_INTERVAL_MS) return;
    this.lastBreadcrumbAt = now;
    writeBreadcrumbSnapshot({
      sessionId: this.sessionId,
      desired: this.getDesired(),
      silentHold: this.precacheSnapshot.silentHoldActive,
      wasHidden: this.wasHidden,
      cleanUnload,
      audioEl: this.getAudioEl(),
      stats: this.stats
    });
  }

  buildReportPayload(triggerType: TelemetryTriggerType | string, note?: string, overrideTrack?: Track | null): PlaybackDebugReportPayload {
    this.refreshAudioSnapshot();
    return buildDebugReportPayload({
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      triggerType,
      audioSnapshot: this.audioSnapshot,
      precacheSnapshot: this.precacheSnapshot,
      stats: this.stats,
      events: this.events,
      isDesiredPlayback: this.isDesiredPlayback,
      resiliencePhase: this.resiliencePhase,
      isUrlExpired: this.checkUrlExpired,
      note,
      overrideTrack
    });
  }

  async submitReport(
    triggerType: TelemetryTriggerType | string = 'manual',
    options?: { note?: string; manual?: boolean; track?: Track | null }
  ): Promise<{ ok: boolean; queued: boolean; throttled?: boolean; report?: any }> {
    const manual = Boolean(options?.manual || triggerType === 'manual');
    const tr = options?.track || playerStore.activeTrack;
    const dedupKey = `${triggerType}:${tr?.id ?? 'none'}`;
    const now = Date.now();

    if (!manual) {
      if (this.autoReportsThisSession >= MAX_AUTO_REPORTS_PER_SESSION) return { ok: false, queued: false, throttled: true };
      const prevAt = this.autoCooldownMap.get(dedupKey) ?? 0;
      if (now - prevAt < AUTO_UPLOAD_COOLDOWN_MS) return { ok: false, queued: false, throttled: true };
      this.autoCooldownMap.set(dedupKey, now);
      this.autoReportsThisSession += 1;
    }

    const payload = this.buildReportPayload(triggerType, options?.note, tr);
    this.isUploading = true;
    try {
      const result = await sendOrEnqueueReport(payload);
      this.pendingReportCount = result.pendingCount;
      if (result.ok) {
        this.lastUploadAt = Date.now();
        this.lastUploadStatus = 'sent';
        this.recordEvent('report_uploaded', 'info', `trigger=${triggerType}`, tr);
      } else {
        this.lastUploadStatus = 'queued';
        this.recordEvent('report_queued', 'warn', `trigger=${triggerType} pending=${result.pendingCount}`, tr);
      }
      return { ok: result.ok, queued: result.queued, report: result.report };
    } finally {
      this.isUploading = false;
    }
  }

  async flushPendingReports(): Promise<number> {
    if (this.isFlushingQueue) return 0;
    this.isFlushingQueue = true;
    try {
      const { sentCount, remainingCount } = await flushPendingReportQueue();
      this.pendingReportCount = remainingCount;
      if (sentCount > 0) {
        this.lastUploadAt = Date.now();
        this.lastUploadStatus = 'flushed';
        this.recordEvent('report_flushed', 'info', `sent=${sentCount} remaining=${remainingCount}`);
      }
      return sentCount;
    } finally {
      this.isFlushingQueue = false;
    }
  }

  async clearLocalLogs(): Promise<void> {
    this.events = [];
    await idbClearEvents();
  }

  exportSnapshotJson(): string {
    return formatSnapshotJsonPretty(this.buildReportPayload('manual', 'clipboard_snapshot'));
  }
}

export const playbackTelemetry = new PlaybackTelemetryStore();
