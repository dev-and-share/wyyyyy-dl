import type { Track } from '../types';
import { api } from '../api';
import { playerStore } from './playerStore.svelte';
import {
  classifyAndSanitizeUrl,
  collectDeviceSummary,
  idbEnqueuePendingReport,
  idbGetPendingReports,
  idbRemovePendingReport,
  saveCrashBreadcrumb,
  sendReportViaBeacon,
  type AudioLiveSnapshot,
  type CrashBreadcrumb,
  type PlaybackDebugReportPayload,
  type PrecacheSnapshot,
  type TelemetryEventEntry,
  type TelemetryStats,
  type TelemetryTriggerType
} from './telemetryStorage';

const MEDIA_ERR_NAMES: Record<number, string> = {
  1: 'MEDIA_ERR_ABORTED',
  2: 'MEDIA_ERR_NETWORK',
  3: 'MEDIA_ERR_DECODE',
  4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
};

export function createEmptyStats(): TelemetryStats {
  return {
    trackPlays: 0,
    resolveTimeouts: 0,
    audioErrors: 0,
    watchdogTimeouts: 0,
    stalls: 0,
    freezes: 0,
    interruptionRecoveries: 0,
    recoveryFailures: 0,
    autoSkips: 0,
    unexpectedKills: 0,
    playRejections: 0
  };
}

export function createEmptyAudioSnapshot(): AudioLiveSnapshot {
  return {
    srcKind: 'none',
    srcSummary: '',
    readyState: 0,
    networkState: 0,
    paused: true,
    ended: false,
    loop: false,
    currentTime: 0,
    duration: 0,
    bufferedAheadSec: 0,
    bufferedRanges: '',
    errorCode: null,
    errorName: null
  };
}

export function createEmptyPrecacheSnapshot(): PrecacheSnapshot {
  return {
    hits: 0,
    misses: 0,
    failures: 0,
    lastStatus: 'idle',
    nextTrackId: '',
    nextTrackName: '',
    hasPreloadedBlob: false,
    silentHoldActive: false
  };
}

function formatBufferedRanges(audioEl: HTMLAudioElement): { text: string; aheadSec: number } {
  try {
    const buf = audioEl.buffered;
    if (!buf || buf.length === 0) return { text: 'none', aheadSec: 0 };
    const ranges: string[] = [];
    let aheadSec = 0;
    const now = Number.isFinite(audioEl.currentTime) ? audioEl.currentTime : 0;
    for (let i = 0; i < buf.length; i++) {
      const start = buf.start(i);
      const end = buf.end(i);
      ranges.push(`${start.toFixed(1)}-${end.toFixed(1)}s`);
      if (now >= start - 0.5 && now <= end) {
        aheadSec = Math.max(aheadSec, end - now);
      }
    }
    return { text: ranges.slice(-3).join(', '), aheadSec: Math.round(aheadSec * 10) / 10 };
  } catch {
    return { text: 'unavailable', aheadSec: 0 };
  }
}

export function captureAudioSnapshot(el: HTMLAudioElement): AudioLiveSnapshot {
  const { kind, summary } = classifyAndSanitizeUrl(el.currentSrc || el.src);
  const { text, aheadSec } = formatBufferedRanges(el);
  const code = el.error?.code ?? null;
  return {
    srcKind: kind,
    srcSummary: summary,
    readyState: el.readyState,
    networkState: el.networkState,
    paused: el.paused,
    ended: el.ended,
    loop: el.loop,
    currentTime: Number.isFinite(el.currentTime) ? Math.round(el.currentTime * 10) / 10 : 0,
    duration: Number.isFinite(el.duration) ? Math.round(el.duration * 10) / 10 : 0,
    bufferedAheadSec: aheadSec,
    bufferedRanges: text,
    errorCode: code,
    errorName: code ? (MEDIA_ERR_NAMES[code] || `ERR_${code}`) : null
  };
}

export function bindAudioDomEvents(
  el: HTMLAudioElement,
  handlers: {
    onPlay: () => void;
    onPlaying: () => void;
    onPause: () => void;
    onStall: (kind: 'waiting' | 'stalled') => void;
    onEnded: () => void;
    onMeta: () => void;
    onSeeked: () => void;
    onAbort: () => void;
    onError: (errName: string, message?: string) => void;
  }
): () => void {
  const entries: Array<[string, EventListener]> = [
    ['play', () => handlers.onPlay()],
    ['playing', () => handlers.onPlaying()],
    ['pause', () => handlers.onPause()],
    ['waiting', () => handlers.onStall('waiting')],
    ['stalled', () => handlers.onStall('stalled')],
    ['ended', () => handlers.onEnded()],
    ['loadedmetadata', () => handlers.onMeta()],
    ['seeked', () => handlers.onSeeked()],
    ['abort', () => handlers.onAbort()],
    [
      'error',
      () => {
        const code = el.error?.code ?? null;
        const errName = code ? (MEDIA_ERR_NAMES[code] || `ERR_${code}`) : 'UNKNOWN';
        handlers.onError(errName, el.error?.message);
      }
    ]
  ];
  entries.forEach(([evt, fn]) => el.addEventListener(evt, fn));
  return () => entries.forEach(([evt, fn]) => el.removeEventListener(evt, fn));
}

export function buildDebugReportPayload(params: {
  sessionId: string;
  deviceId: string;
  triggerType: TelemetryTriggerType | string;
  audioSnapshot: AudioLiveSnapshot;
  precacheSnapshot: PrecacheSnapshot;
  stats: TelemetryStats;
  events: TelemetryEventEntry[];
  isDesiredPlayback: boolean;
  resiliencePhase: string;
  isUrlExpired: (track: Track) => boolean;
  note?: string;
  overrideTrack?: Track | null;
}): PlaybackDebugReportPayload {
  const tr = params.overrideTrack || playerStore.activeTrack;
  const appVer = typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : 'unknown';

  const trackSummary = tr
    ? {
        id: String(tr.id ?? ''),
        name: String(tr.name ?? '').slice(0, 80),
        artist: String(tr.artist ?? '').slice(0, 60),
        isLocal: Boolean(tr.isLocal),
        br: tr.br,
        level: tr.level,
        urlExpired: params.isUrlExpired(tr),
        qIndex: playerStore.qIndex,
        queueLength: playerStore.queue.length,
        playMode: playerStore.playMode
      }
    : {
        qIndex: playerStore.qIndex,
        queueLength: playerStore.queue.length,
        playMode: playerStore.playMode
      };

  return {
    createdAt: Date.now(),
    sessionId: params.sessionId,
    deviceId: params.deviceId,
    triggerType: params.triggerType,
    appVersion: appVer,
    deviceInfo: collectDeviceSummary(),
    trackSummary: JSON.stringify(trackSummary),
    audioSnapshot: JSON.stringify({
      ...params.audioSnapshot,
      isDesiredPlayback: params.isDesiredPlayback,
      storePlaying: playerStore.playing,
      storeLoading: playerStore.loading,
      resiliencePhase: params.resiliencePhase
    }),
    precacheSnapshot: JSON.stringify(params.precacheSnapshot),
    statsJson: JSON.stringify(params.stats),
    eventsJson: JSON.stringify(params.events.slice(-100)),
    note: params.note ? String(params.note).slice(0, 500) : ''
  };
}

export async function sendOrEnqueueReport(payload: PlaybackDebugReportPayload): Promise<{
  ok: boolean;
  queued: boolean;
  pendingCount: number;
  report?: any;
}> {
  try {
    if (typeof api?.submitPlaybackDebugReport !== 'function') {
      throw new Error('api_unavailable');
    }
    const res: any = await api.submitPlaybackDebugReport(payload);
    if (res?.code === '000000') {
      const left = await idbGetPendingReports();
      return { ok: true, queued: false, pendingCount: left.length, report: res.data };
    }
    throw new Error(res?.msg || 'upload_failed');
  } catch {
    await idbEnqueuePendingReport(payload);
    const pending = await idbGetPendingReports();
    return { ok: false, queued: true, pendingCount: pending.length };
  }
}

export async function flushPendingReportQueue(): Promise<{ sentCount: number; remainingCount: number }> {
  const pending = await idbGetPendingReports();
  let sentCount = 0;
  for (const item of pending) {
    try {
      if (typeof api?.submitPlaybackDebugReport !== 'function') break;
      const res: any = await api.submitPlaybackDebugReport(item.payload);
      if (res?.code === '000000') {
        await idbRemovePendingReport(item.id);
        sentCount += 1;
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  const left = await idbGetPendingReports();
  return { sentCount, remainingCount: left.length };
}

export function isUnexpectedBackgroundKill(crumb: CrashBreadcrumb | null, maxAgeMs: number): boolean {
  return Boolean(
    crumb &&
    crumb.desired &&
    !crumb.cleanUnload &&
    crumb.wasHidden &&
    Date.now() - crumb.ts < maxAgeMs
  );
}

export function writeBreadcrumbSnapshot(params: {
  sessionId: string;
  desired: boolean;
  silentHold: boolean;
  wasHidden: boolean;
  cleanUnload: boolean;
  audioEl: HTMLAudioElement | null;
  stats: TelemetryStats;
}): void {
  const tr = playerStore.activeTrack;
  const el = params.audioEl;
  saveCrashBreadcrumb({
    ts: Date.now(),
    sessionId: params.sessionId,
    desired: params.desired,
    playing: playerStore.playing,
    silentHold: params.silentHold,
    wasHidden: typeof document !== 'undefined' ? document.visibilityState === 'hidden' : params.wasHidden,
    cleanUnload: params.cleanUnload,
    curTime: el && Number.isFinite(el.currentTime) ? el.currentTime : playerStore.curTime,
    trackId: tr?.id != null ? String(tr.id) : '',
    trackName: tr?.name ? String(tr.name) : '',
    errCount: params.stats.audioErrors + params.stats.watchdogTimeouts + params.stats.freezes
  });
}

export function bindGlobalLifecycleListeners(hooks: {
  onOnline: () => void;
  onOffline: () => void;
  onVisibility: (hidden: boolean) => void;
  onPageHide: (persisted: boolean, hidden: boolean) => void;
  onBeforeUnload: () => void;
}): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  const onOnline = () => hooks.onOnline();
  const onOffline = () => hooks.onOffline();
  const onVisibility = () => hooks.onVisibility(document.visibilityState === 'hidden');
  const onPageHide = (e: PageTransitionEvent) => hooks.onPageHide(e.persisted, document.visibilityState === 'hidden');
  const onBeforeUnload = () => hooks.onBeforeUnload();

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('beforeunload', onBeforeUnload);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}

export function dispatchAbnormalBeacon(payload: PlaybackDebugReportPayload): void {
  sendReportViaBeacon(payload);
}

export function formatSnapshotJsonPretty(payload: PlaybackDebugReportPayload): string {
  return JSON.stringify({
    sessionId: payload.sessionId,
    deviceId: payload.deviceId,
    appVersion: payload.appVersion,
    createdAt: payload.createdAt,
    deviceInfo: JSON.parse(payload.deviceInfo),
    trackSummary: JSON.parse(payload.trackSummary),
    audioSnapshot: JSON.parse(payload.audioSnapshot),
    precacheSnapshot: JSON.parse(payload.precacheSnapshot),
    stats: JSON.parse(payload.statsJson),
    events: JSON.parse(payload.eventsJson)
  }, null, 2);
}

export function createTelemetryEventEntry(params: {
  type: string;
  level: 'info' | 'warn' | 'error';
  detail?: string;
  explicitTrack?: { id?: string | number; name?: string } | null;
  audioEl: HTMLAudioElement | null;
}): TelemetryEventEntry {
  const tr = params.explicitTrack || playerStore.activeTrack;
  const el = params.audioEl;
  return {
    ts: Date.now(),
    type: params.type,
    level: params.level,
    detail: params.detail ? params.detail.slice(0, 180) : undefined,
    trackId: tr?.id != null ? String(tr.id) : undefined,
    trackName: tr?.name ? String(tr.name).slice(0, 48) : undefined,
    readyState: el ? el.readyState : undefined,
    networkState: el ? el.networkState : undefined,
    curTime: el && Number.isFinite(el.currentTime) ? Math.round(el.currentTime * 10) / 10 : undefined
  };
}
