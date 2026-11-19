<script lang="ts">
  import { Activity, ChevronDown, ChevronUp, Copy, Send, Trash2, X } from '@lucide/svelte';
  import { t } from '../lib/i18n';
  import { playerStore } from '../lib/player/playerStore.svelte';
  import { playbackTelemetry } from '../lib/player/playbackTelemetry.svelte';

  let { showToast = () => {} } = $props<{
    showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error', dur?: number) => void;
  }>();

  let minimized = $state(false);
  let noteInput = $state('');

  const READY_LABELS: Record<number, string> = {
    0: 'HAVE_NOTHING',
    1: 'HAVE_METADATA',
    2: 'HAVE_CURRENT_DATA',
    3: 'HAVE_FUTURE_DATA',
    4: 'HAVE_ENOUGH_DATA'
  };

  const NET_LABELS: Record<number, string> = {
    0: 'EMPTY',
    1: 'IDLE',
    2: 'LOADING',
    3: 'NO_SOURCE'
  };

  function formatTs(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }

  async function handleCopyJson() {
    const json = playbackTelemetry.exportSnapshotJson();
    try {
      await navigator.clipboard.writeText(json);
      showToast(t('settings.diag.hudCopied'), 'success', 2000);
    } catch {
      showToast(t('settings.diag.hudCopyFailed'), 'warning', 2500);
    }
  }

  async function handleSendManual() {
    const res = await playbackTelemetry.submitReport('manual', {
      manual: true,
      note: noteInput.trim() || undefined
    });
    if (res.ok) {
      noteInput = '';
      showToast(t('settings.diag.uploadSuccess'), 'success', 2200);
    } else if (res.queued) {
      noteInput = '';
      showToast(t('settings.diag.uploadQueued'), 'warning', 2800);
    } else {
      showToast(t('settings.diag.uploadFailed', { error: 'UNKNOWN' }), 'error', 2800);
    }
  }

  async function handleClearLocal() {
    await playbackTelemetry.clearLocalLogs();
  }

  let snap = $derived(playbackTelemetry.audioSnapshot);
  let pre = $derived(playbackTelemetry.precacheSnapshot);
  let st = $derived(playbackTelemetry.stats);
  let tr = $derived(playerStore.activeTrack);
  let reversedEvents = $derived([...playbackTelemetry.events].reverse());
  let totalErrorCount = $derived(st.audioErrors + st.watchdogTimeouts + st.freezes + st.unexpectedKills);
</script>

<div
  data-testid="player-diagnostics-hud"
  class="fixed inset-x-2 top-[calc(8px+env(safe-area-inset-top,0px))] sm:inset-x-auto sm:right-3 sm:top-3 sm:w-[min(720px,95vw)] z-[105000] rounded-2xl bg-slate-950/92 text-slate-100 border border-slate-700/80 shadow-2xl backdrop-blur-md font-mono text-[11px] leading-snug flex flex-col overflow-hidden {minimized ? '' : 'max-h-[82vh]'}"
>
  <!-- Header -->
  <div class="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/90 border-b border-slate-800 shrink-0">
    <div class="flex items-center gap-2 min-w-0">
      <Activity size={14} class="text-emerald-400 shrink-0" />
      <span class="font-bold text-slate-100 truncate">{t('settings.diag.hudTitle')}</span>
      <span class="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
        {t('settings.diag.hudShortcutHint')}
      </span>
      <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold {playbackTelemetry.autoUploadEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}">
        {playbackTelemetry.autoUploadEnabled ? t('settings.diag.hudAutoOn') : t('settings.diag.hudAutoOff')}
      </span>
    </div>
    <div class="flex items-center gap-1 shrink-0">
      {#if minimized}
        <span class="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 text-[10px]">
          {playbackTelemetry.resiliencePhase} | r={snap.readyState} | +{snap.bufferedAheadSec}s | err={totalErrorCount}
        </span>
      {/if}
      <button
        type="button"
        data-testid="btn-diag-hud-collapse"
        onclick={() => { minimized = !minimized; }}
        class="w-6 h-6 rounded-lg flex items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-none cursor-pointer"
        aria-label={minimized ? t('settings.diag.openHudBtn') : t('settings.diag.hudTitle')}
      >
        {#if minimized}<ChevronDown size={14} />{:else}<ChevronUp size={14} />{/if}
      </button>
      <button
        type="button"
        data-testid="btn-diag-hud-close"
        onclick={() => playbackTelemetry.setHudVisible(false)}
        class="w-6 h-6 rounded-lg flex items-center justify-center bg-slate-800/80 hover:bg-red-500/30 text-slate-300 hover:text-red-200 border-none cursor-pointer"
        aria-label={t('settings.diag.hudClose')}
      >
        <X size={14} />
      </button>
    </div>
  </div>

  {#if !minimized}
    <!-- Actions Bar -->
    <div class="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-slate-800/80 bg-slate-900/50 shrink-0">
      <input
        type="text"
        bind:value={noteInput}
        placeholder={t('settings.diag.hudNotePlaceholder')}
        class="flex-1 min-w-[160px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 text-[11px] outline-none focus:border-emerald-500"
      />
      <button
        type="button"
        data-testid="btn-diag-hud-send"
        disabled={playbackTelemetry.isUploading}
        onclick={handleSendManual}
        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold border-none cursor-pointer"
      >
        <Send size={12} />
        <span>{playbackTelemetry.isUploading ? t('settings.diag.uploading') : t('settings.diag.hudSendManual')}</span>
      </button>
      <button
        type="button"
        data-testid="btn-diag-hud-copy"
        onclick={handleCopyJson}
        class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
      >
        <Copy size={12} />
        <span>{t('settings.diag.hudCopyJson')}</span>
      </button>
      <button
        type="button"
        data-testid="btn-diag-hud-clear"
        onclick={handleClearLocal}
        class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-red-900/50 text-slate-300 hover:text-red-200 border border-slate-700 cursor-pointer"
      >
        <Trash2 size={12} />
        <span>{t('settings.diag.hudClearLocal')}</span>
      </button>
    </div>

    <!-- Scrollable Metrics + Event Timeline -->
    <div class="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2.5 custom-scrollbar">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <!-- Card 1: State Machine & Track -->
        <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1">
          <div class="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">STATE &amp; TRACK</div>
          {#if tr}
            <div class="truncate text-slate-100 font-semibold">{tr.name} — {tr.artist}</div>
            <div class="text-slate-400">
              id={tr.id} | local={String(Boolean(tr.isLocal))} | br={tr.br || '-'} | q={playerStore.qIndex + 1}/{playerStore.queue.length}
            </div>
          {:else}
            <div class="text-slate-500">{t('settings.diag.hudNoTrack')}</div>
          {/if}
          <div class="text-sky-300">
            phase={playbackTelemetry.resiliencePhase} | desired={String(playbackTelemetry.isDesiredPlayback)} | storePlaying={String(playerStore.playing)} | loading={String(playerStore.loading)} | mode={playerStore.playMode}
          </div>
        </div>

        <!-- Card 2: Audio Element Internals -->
        <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1">
          <div class="text-[10px] uppercase tracking-wider text-sky-400 font-bold">HTMLAudioElement</div>
          <div class="text-slate-200">
            ready={snap.readyState} ({READY_LABELS[snap.readyState] || '?'}) | net={snap.networkState} ({NET_LABELS[snap.networkState] || '?'})
          </div>
          <div class="text-slate-300">
            t={snap.currentTime}s / {snap.duration}s | paused={String(snap.paused)} | ended={String(snap.ended)} | loop={String(snap.loop)}
          </div>
          <div class="text-amber-300 truncate" title={snap.bufferedRanges}>
            buf=+{snap.bufferedAheadSec}s ({snap.bufferedRanges || 'none'}) | src={snap.srcKind}
          </div>
          {#if snap.errorCode !== null}
            <div class="text-red-400 font-bold">error={snap.errorCode} ({snap.errorName})</div>
          {/if}
        </div>

        <!-- Card 3: Precache & KeepAlive -->
        <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1">
          <div class="text-[10px] uppercase tracking-wider text-purple-400 font-bold">PRECACHE &amp; KEEPALIVE</div>
          <div class="text-slate-200">
            silentHold={String(pre.silentHoldActive)} | preloadedBlob={String(pre.hasPreloadedBlob)} | last={pre.lastStatus}
          </div>
          <div class="text-slate-300 truncate">
            hits={pre.hits} | misses={pre.misses} | fail={pre.failures} | next={pre.nextTrackName || '-'}
          </div>
          <div class="text-slate-400">
            pendingQueue={playbackTelemetry.pendingReportCount} | lastUpload={playbackTelemetry.lastUploadStatus}
          </div>
        </div>

        <!-- Card 4: Error Counters -->
        <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1">
          <div class="text-[10px] uppercase tracking-wider text-amber-400 font-bold">COUNTERS ({playbackTelemetry.sessionId})</div>
          <div class="text-slate-200">
            plays={st.trackPlays} | errors={st.audioErrors} | watchdog={st.watchdogTimeouts} | freezes={st.freezes}
          </div>
          <div class="text-slate-300">
            stalls={st.stalls} | timeouts={st.resolveTimeouts} | skips={st.autoSkips} | rejected={st.playRejections}
          </div>
          <div class="text-slate-400">
            recoverOk={st.interruptionRecoveries} | recoverFail={st.recoveryFailures} | bgKills={st.unexpectedKills}
          </div>
        </div>
      </div>

      <!-- Events Stream -->
      <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1">
        <div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
          {t('settings.diag.hudEventsTitle', { count: reversedEvents.length })}
        </div>
        {#if reversedEvents.length === 0}
          <div class="text-slate-500 py-2 text-center">{t('settings.diag.hudNoEvents')}</div>
        {:else}
          <div class="max-h-[190px] overflow-y-auto flex flex-col gap-0.5 pr-1 custom-scrollbar">
            {#each reversedEvents as ev, i (ev.ts + '_' + i)}
              <div class="flex items-baseline gap-1.5 py-0.5 border-b border-slate-800/50 last:border-none">
                <span class="text-slate-500 shrink-0">{formatTs(ev.ts)}</span>
                <span class="px-1 rounded text-[9px] uppercase shrink-0 {ev.level === 'error' ? 'bg-red-500/20 text-red-300' : ev.level === 'warn' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}">
                  {ev.level}
                </span>
                <span class="text-sky-300 font-semibold shrink-0">{ev.type}</span>
                {#if ev.trackName}
                  <span class="text-slate-400 truncate max-w-[140px]">[{ev.trackName}]</span>
                {/if}
                {#if ev.detail}
                  <span class="text-slate-300 truncate">{ev.detail}</span>
                {/if}
                {#if ev.curTime !== undefined}
                  <span class="text-slate-500 ml-auto shrink-0">@{ev.curTime}s r{ev.readyState ?? '-'}/n{ev.networkState ?? '-'}</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
