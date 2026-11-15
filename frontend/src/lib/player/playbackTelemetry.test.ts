import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  classifyAndSanitizeUrl,
  loadDiagnosticsConfig,
  saveCrashBreadcrumb
} from './telemetryStorage';
import { playbackTelemetry } from './playbackTelemetry.svelte';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    submitPlaybackDebugReport: vi.fn(),
    listPlaybackDebugReports: vi.fn(),
    clearPlaybackDebugReports: vi.fn()
  }
}));

describe('playbackTelemetry & telemetryStorage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await playbackTelemetry.clearLocalLogs();
    playbackTelemetry.setHudVisible(false);
    playbackTelemetry.setAutoUpload(false);
    (api.submitPlaybackDebugReport as any).mockResolvedValue({ code: '000000', data: { id: 1 } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sanitizes URLs to prevent token or signature leaks', () => {
    expect(classifyAndSanitizeUrl('/v3/stream/online?url=https%3A%2F%2Fcdn.example%2Fsecret.mp3&token=xyz'))
      .toEqual({ kind: 'online_proxy', summary: '/v3/stream/online?[sanitized]' });

    expect(classifyAndSanitizeUrl('/v3/stream?id=4567&auth=secret'))
      .toEqual({ kind: 'local_stream', summary: '/v3/stream?id=4567' });

    expect(classifyAndSanitizeUrl('https://m701.music.126.net/20261115/secret_sig/abc/track.mp3?wsSecret=123456'))
      .toEqual({ kind: 'online_direct', summary: 'https://m701.music.126.net/....mp3' });

    expect(classifyAndSanitizeUrl('blob:https://example.com/1234-5678'))
      .toEqual({ kind: 'blob_precache', summary: 'blob:[preloaded_cache]' });

    expect(classifyAndSanitizeUrl('data:audio/wav;base64,UklGR...'))
      .toEqual({ kind: 'silent_wav', summary: 'data:audio/wav[silent_keepalive]' });
  });

  it('persists compact HUD and autoUpload settings under localStorage', () => {
    playbackTelemetry.setHudVisible(true);
    playbackTelemetry.setAutoUpload(true);

    const cfg = loadDiagnosticsConfig();
    expect(cfg).toEqual({ hudEnabled: true, autoUpload: true });
    expect((localStorage.getItem('wyy_diag_config') || '').length).toBeLessThan(128);
  });

  it('records semantic events without PII and enforces manual vs auto upload cooldown', async () => {
    playbackTelemetry.setAutoUpload(true);
    const track = { id: 'track-9', name: 'Test Song', artist: 'Tester', url: 'https://cdn.test/song.mp3?token=secret' };

    playbackTelemetry.recordStreamFailure(track, 'audio_error');
    // Second identical auto-trigger immediately should be deduplicated
    const throttledRes = await playbackTelemetry.submitReport('audio_error', { track });
    expect(throttledRes.throttled).toBe(true);

    // Manual report bypasses cooldown
    const manualRes = await playbackTelemetry.submitReport('manual', { manual: true, note: 'manual check', track });
    expect(manualRes.ok).toBe(true);
    expect(api.submitPlaybackDebugReport).toHaveBeenCalledTimes(2);

    const firstPayload = (api.submitPlaybackDebugReport as any).mock.calls[0][0];
    expect(firstPayload.triggerType).toBe('audio_error');
    expect(JSON.stringify(firstPayload)).not.toContain('token=secret');
  });

  it('queues reports offline when upload fails and flushes them when connection returns', async () => {
    (api.submitPlaybackDebugReport as any).mockRejectedValueOnce(new Error('network offline'));

    const res = await playbackTelemetry.submitReport('manual', { manual: true });
    expect(res.ok).toBe(false);
    expect(res.queued).toBe(true);
    expect(playbackTelemetry.pendingReportCount).toBeGreaterThanOrEqual(1);

    (api.submitPlaybackDebugReport as any).mockResolvedValue({ code: '000000', data: { id: 99 } });
    const flushed = await playbackTelemetry.flushPendingReports();
    expect(flushed).toBeGreaterThanOrEqual(1);
    expect(playbackTelemetry.pendingReportCount).toBe(0);
  });

  it('detects >15s freeze when desired playback currentTime stalls', () => {
    vi.useFakeTimers();
    const audioEl = document.createElement('audio');
    Object.defineProperty(audioEl, 'paused', { value: false, configurable: true });
    Object.defineProperty(audioEl, 'ended', { value: false, configurable: true });
    Object.defineProperty(audioEl, 'readyState', { value: 3, configurable: true });
    Object.defineProperty(audioEl, 'networkState', { value: 2, configurable: true });
    let cur = 12.0;
    Object.defineProperty(audioEl, 'currentTime', {
      get: () => cur,
      configurable: true
    });

    playbackTelemetry.setSilentHoldActive(false);
    const beforeFreezes = playbackTelemetry.stats.freezes;
    const detach = playbackTelemetry.attachAudioElement({
      getAudioEl: () => audioEl,
      getDesired: () => true
    });

    vi.advanceTimersByTime(14_000);
    expect(playbackTelemetry.stats.freezes).toBe(beforeFreezes);

    vi.advanceTimersByTime(2_500);
    expect(playbackTelemetry.stats.freezes).toBe(beforeFreezes + 1);
    expect(playbackTelemetry.resiliencePhase).toBe('frozen');

    // Moving currentTime clears freeze state
    cur = 18.0;
    vi.advanceTimersByTime(2_100);
    detach();
  });

  it('logs unexpected background kill when previous breadcrumb shows hidden unclean desired playback', async () => {
    const beforeKills = playbackTelemetry.stats.unexpectedKills;
    saveCrashBreadcrumb({
      ts: Date.now() - 30_000,
      sessionId: 'sess_prev',
      desired: true,
      playing: true,
      silentHold: false,
      wasHidden: true,
      cleanUnload: false,
      curTime: 42.5,
      trackId: 't-100',
      trackName: 'Interrupted Song',
      errCount: 1
    });

    // Reset initialized flag only inside test to simulate cold boot
    (playbackTelemetry as any).initialized = false;
    await playbackTelemetry.init();

    expect(playbackTelemetry.stats.unexpectedKills).toBe(beforeKills + 1);
    expect(playbackTelemetry.events.some((e) => e.type === 'unexpected_kill')).toBe(true);
  });
});
