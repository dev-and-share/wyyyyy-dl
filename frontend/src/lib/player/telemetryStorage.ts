/**
 * 🩺 播放器运行诊断与断播遥测持久化层
 * 存储分级：
 * 1. IndexedDB (`wyy_playback_diagnostics`) -> 滚动保留近期事件日志 + 离线待上报队列
 * 2. localStorage (`< 500B`) -> HUD/自动上报开关、匿名设备ID、极简崩溃面包屑（用于识别 iOS 后台被杀）
 */

export const TELEMETRY_DB_NAME = 'wyy_playback_diagnostics';
export const TELEMETRY_DB_VERSION = 1;
export const EVENTS_STORE = 'events';
export const PENDING_STORE = 'pending_reports';
export const MAX_IDB_EVENTS = 300;
export const MAX_PENDING_REPORTS = 30;

const LS_CONFIG_KEY = 'wyy_diag_config';
const LS_DEVICE_ID_KEY = 'wyy_diag_device_id';
const LS_BREADCRUMB_KEY = 'wyy_diag_breadcrumb';
const REPORT_ENDPOINT = '/v3/debug/playback';

export type TelemetryTriggerType =
  | 'manual'
  | 'audio_error'
  | 'watchdog_timeout'
  | 'freeze_detected'
  | 'unexpected_kill'
  | 'interruption_give_up'
  | 'play_rejected';

export interface DiagnosticsConfig {
  hudEnabled: boolean;
  autoUpload: boolean;
}

export interface TelemetryEventEntry {
  id?: number;
  ts: number;
  type: string;
  level: 'info' | 'warn' | 'error';
  detail?: string;
  trackId?: string;
  trackName?: string;
  readyState?: number;
  networkState?: number;
  curTime?: number;
}

export interface TrackSummarySnapshot {
  id: string;
  name: string;
  artist: string;
  isLocal: boolean;
  br?: number;
  level?: string;
  urlExpired?: boolean;
}

export interface AudioLiveSnapshot {
  srcKind: string;
  srcSummary: string;
  readyState: number;
  networkState: number;
  paused: boolean;
  ended: boolean;
  loop: boolean;
  currentTime: number;
  duration: number;
  bufferedAheadSec: number;
  bufferedRanges: string;
  errorCode: number | null;
  errorName: string | null;
}

export interface PrecacheSnapshot {
  hits: number;
  misses: number;
  failures: number;
  lastStatus: string;
  nextTrackId: string;
  nextTrackName: string;
  hasPreloadedBlob: boolean;
  silentHoldActive: boolean;
}

export interface TelemetryStats {
  trackPlays: number;
  resolveTimeouts: number;
  audioErrors: number;
  watchdogTimeouts: number;
  stalls: number;
  freezes: number;
  interruptionRecoveries: number;
  recoveryFailures: number;
  autoSkips: number;
  unexpectedKills: number;
  playRejections: number;
}

export interface PlaybackDebugReportPayload {
  id?: number;
  createdAt: number;
  sessionId: string;
  deviceId: string;
  triggerType: TelemetryTriggerType | string;
  appVersion: string;
  deviceInfo: string;
  trackSummary: string;
  audioSnapshot: string;
  precacheSnapshot: string;
  statsJson: string;
  eventsJson: string;
  note?: string;
}

export interface CrashBreadcrumb {
  ts: number;
  sessionId: string;
  desired: boolean;
  playing: boolean;
  silentHold: boolean;
  wasHidden: boolean;
  cleanUnload: boolean;
  curTime: number;
  trackId: string;
  trackName: string;
  errCount: number;
}

const memoryEventsFallback: TelemetryEventEntry[] = [];
const memoryPendingFallback: Array<{ id: number; payload: PlaybackDebugReportPayload }> = [];
let memoryPendingSeq = 1;

function openTelemetryDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(TELEMETRY_DB_NAME, TELEMETRY_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(EVENTS_STORE)) {
          db.createObjectStore(EVENTS_STORE, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(PENDING_STORE)) {
          db.createObjectStore(PENDING_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function pruneStore(store: IDBObjectStore, maxEntries: number): void {
  const countReq = store.count();
  countReq.onsuccess = () => {
    const excess = countReq.result - maxEntries;
    if (excess <= 0) return;
    let remaining = excess;
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor && remaining > 0) {
        cursor.delete();
        remaining--;
        cursor.continue();
      }
    };
  };
}

export async function idbAppendEvent(entry: TelemetryEventEntry): Promise<void> {
  const db = await openTelemetryDb();
  if (!db) {
    memoryEventsFallback.push(entry);
    if (memoryEventsFallback.length > MAX_IDB_EVENTS) {
      memoryEventsFallback.splice(0, memoryEventsFallback.length - MAX_IDB_EVENTS);
    }
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(EVENTS_STORE, 'readwrite');
      const store = tx.objectStore(EVENTS_STORE);
      store.add({ ...entry });
      pruneStore(store, MAX_IDB_EVENTS);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    } catch {
      try { db.close(); } catch {}
      resolve();
    }
  });
}

export async function idbLoadRecentEvents(limit = 150): Promise<TelemetryEventEntry[]> {
  const db = await openTelemetryDb();
  if (!db) {
    return memoryEventsFallback.slice(-limit);
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(EVENTS_STORE, 'readonly');
      const store = tx.objectStore(EVENTS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = Array.isArray(req.result) ? req.result : [];
        db.close();
        resolve(all.slice(-limit));
      };
      req.onerror = () => { db.close(); resolve([]); };
    } catch {
      try { db.close(); } catch {}
      resolve([]);
    }
  });
}

export async function idbClearEvents(): Promise<void> {
  memoryEventsFallback.length = 0;
  const db = await openTelemetryDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(EVENTS_STORE, 'readwrite');
      tx.objectStore(EVENTS_STORE).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    } catch {
      try { db.close(); } catch {}
      resolve();
    }
  });
}

export async function idbEnqueuePendingReport(payload: PlaybackDebugReportPayload): Promise<void> {
  const db = await openTelemetryDb();
  if (!db) {
    memoryPendingFallback.push({ id: memoryPendingSeq++, payload });
    if (memoryPendingFallback.length > MAX_PENDING_REPORTS) {
      memoryPendingFallback.shift();
    }
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PENDING_STORE, 'readwrite');
      const store = tx.objectStore(PENDING_STORE);
      store.add({ payload, enqueuedAt: Date.now() });
      pruneStore(store, MAX_PENDING_REPORTS);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    } catch {
      try { db.close(); } catch {}
      resolve();
    }
  });
}

export async function idbGetPendingReports(): Promise<Array<{ id: number; payload: PlaybackDebugReportPayload }>> {
  const db = await openTelemetryDb();
  if (!db) return [...memoryPendingFallback];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PENDING_STORE, 'readonly');
      const req = tx.objectStore(PENDING_STORE).getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result) ? req.result : [];
        db.close();
        resolve(list.filter((r: any) => r?.payload).map((r: any) => ({ id: r.id, payload: r.payload })));
      };
      req.onerror = () => { db.close(); resolve([]); };
    } catch {
      try { db.close(); } catch {}
      resolve([]);
    }
  });
}

export async function idbRemovePendingReport(id: number): Promise<void> {
  const idx = memoryPendingFallback.findIndex((item) => item.id === id);
  if (idx >= 0) memoryPendingFallback.splice(idx, 1);

  const db = await openTelemetryDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PENDING_STORE, 'readwrite');
      tx.objectStore(PENDING_STORE).delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    } catch {
      try { db.close(); } catch {}
      resolve();
    }
  });
}

export function loadDiagnosticsConfig(): DiagnosticsConfig {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_CONFIG_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        hudEnabled: parsed?.hudEnabled === true,
        autoUpload: parsed?.autoUpload === true
      };
    }
  } catch {}
  return { hudEnabled: false, autoUpload: false };
}

export function saveDiagnosticsConfig(cfg: DiagnosticsConfig): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_CONFIG_KEY, JSON.stringify({
        hudEnabled: !!cfg.hudEnabled,
        autoUpload: !!cfg.autoUpload
      }));
    }
  } catch {}
}

export function getOrCreateDeviceId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const existing = localStorage.getItem(LS_DEVICE_ID_KEY);
      if (existing) return existing;
      const created = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(LS_DEVICE_ID_KEY, created);
      return created;
    }
  } catch {}
  return `dev_eph_${Math.random().toString(36).slice(2, 8)}`;
}

export function saveCrashBreadcrumb(crumb: CrashBreadcrumb): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const compact: CrashBreadcrumb = {
        ts: crumb.ts,
        sessionId: crumb.sessionId.slice(0, 32),
        desired: crumb.desired,
        playing: crumb.playing,
        silentHold: crumb.silentHold,
        wasHidden: crumb.wasHidden,
        cleanUnload: crumb.cleanUnload,
        curTime: Math.round((crumb.curTime || 0) * 10) / 10,
        trackId: String(crumb.trackId || '').slice(0, 32),
        trackName: String(crumb.trackName || '').slice(0, 48),
        errCount: crumb.errCount
      };
      localStorage.setItem(LS_BREADCRUMB_KEY, JSON.stringify(compact));
    }
  } catch {}
}

export function consumePreviousBreadcrumb(): CrashBreadcrumb | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LS_BREADCRUMB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.ts === 'number') {
      return parsed as CrashBreadcrumb;
    }
  } catch {}
  return null;
}

/**
 * 隐私与安全脱敏：绝不上传完整携带 token/auth/cookie 的音频外链，仅保留路径或查询 ID 摘要
 */
export function classifyAndSanitizeUrl(rawUrl: string | null | undefined): { kind: string; summary: string } {
  if (!rawUrl || (typeof window !== 'undefined' && rawUrl === window.location.href)) {
    return { kind: 'none', summary: '' };
  }
  if (rawUrl.startsWith('data:audio/wav')) {
    return { kind: 'silent_wav', summary: 'data:audio/wav[silent_keepalive]' };
  }
  if (rawUrl.startsWith('data:')) {
    return { kind: 'data_uri', summary: 'data:[redacted]' };
  }
  if (rawUrl.startsWith('blob:')) {
    return { kind: 'blob_precache', summary: 'blob:[preloaded_cache]' };
  }
  try {
    const parsed = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : 'https://local.app');
    const path = parsed.pathname || '';
    if (path.startsWith('/v3/stream/online')) {
      return { kind: 'online_proxy', summary: '/v3/stream/online?[sanitized]' };
    }
    if (path.startsWith('/v3/stream') || path.startsWith('/v3/history/stream')) {
      const songId = parsed.searchParams.get('id');
      return {
        kind: 'local_stream',
        summary: songId ? `${path}?id=${songId}` : `${path}?[sanitized]`
      };
    }
    const safeHost = parsed.host || 'external';
    const tail = path.split('/').filter(Boolean).slice(-1)[0] || '';
    const extMatch = tail.match(/\.[a-zA-Z0-9]{2,5}$/);
    return {
      kind: 'online_direct',
      summary: `${parsed.protocol}//${safeHost}/...${extMatch ? extMatch[0] : ''}`
    };
  } catch {
    return { kind: 'other', summary: '[unparseable_url]' };
  }
}

export function collectDeviceSummary(): string {
  if (typeof navigator === 'undefined') {
    return JSON.stringify({ env: 'non-browser' });
  }
  const nav = navigator as any;
  const ua = String(navigator.userAgent || '');
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && typeof document !== 'undefined' && 'ontouchend' in document);
  const standalone = (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches)
    || nav.standalone === true;
  const info: Record<string, any> = {
    isIOS,
    standalone,
    online: navigator.onLine !== false,
    visibility: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
    platform: navigator.platform || '',
    cores: navigator.hardwareConcurrency || null,
    memGB: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    uaBrief: ua.slice(0, 140)
  };
  return JSON.stringify(info);
}

export function sendReportViaBeacon(payload: PlaybackDebugReportPayload): boolean {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      return navigator.sendBeacon(REPORT_ENDPOINT, blob);
    }
  } catch {}
  return false;
}
