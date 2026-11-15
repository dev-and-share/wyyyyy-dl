<script lang="ts">
  import { Activity, ChevronDown, ChevronUp, RefreshCw, Send, Trash2 } from '@lucide/svelte';
  import { api } from '../../lib/api';
  import { t } from '../../lib/i18n';
  import { playbackTelemetry } from '../../lib/player/playbackTelemetry.svelte';

  let { showToast = () => {}, onOpenHud }: {
    showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error', dur?: number) => void;
    onOpenHud?: () => void;
  } = $props();

  let serverReports = $state<any[]>([]);
  let serverTotal = $state(0);
  let loadingReports = $state(false);
  let showReportsPanel = $state(false);
  let expandedReportId = $state<number | null>(null);

  function formatDateTime(ts: number): string {
    if (!ts) return '-';
    return new Date(ts).toLocaleString();
  }

  function safeParseSummary(raw: string): Record<string, any> | null {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function handleManualUpload() {
    const res = await playbackTelemetry.submitReport('manual', { manual: true });
    if (res.ok) {
      showToast(t('settings.diag.uploadSuccess'), 'success');
      if (showReportsPanel) loadServerReports().catch(() => {});
    } else if (res.queued) {
      showToast(t('settings.diag.uploadQueued'), 'warning');
    } else {
      showToast(t('settings.diag.uploadFailed', { error: 'UNKNOWN' }), 'error');
    }
  }

  async function handleFlushQueue() {
    const sent = await playbackTelemetry.flushPendingReports();
    if (sent > 0) {
      showToast(t('settings.diag.uploadSuccess'), 'success');
      if (showReportsPanel) loadServerReports().catch(() => {});
    }
  }

  async function loadServerReports() {
    loadingReports = true;
    try {
      const res: any = await api.listPlaybackDebugReports(30);
      if (res?.code === '000000' && res.data) {
        serverReports = Array.isArray(res.data.items) ? res.data.items : [];
        serverTotal = typeof res.data.total === 'number' ? res.data.total : serverReports.length;
      } else {
        showToast(t('settings.diag.loadReportsFailed', { error: res?.msg || 'ERROR' }), 'error');
      }
    } catch (e: any) {
      showToast(t('settings.diag.loadReportsFailed', { error: e?.message || e }), 'error');
    } finally {
      loadingReports = false;
    }
  }

  async function handleClearServerReports() {
    try {
      const res: any = await api.clearPlaybackDebugReports();
      if (res?.code === '000000') {
        const deleted = res.data?.deleted ?? 0;
        serverReports = [];
        serverTotal = 0;
        showToast(t('settings.diag.reportsCleared', { count: deleted }), 'success');
      } else {
        showToast(t('settings.diag.loadReportsFailed', { error: res?.msg || 'ERROR' }), 'error');
      }
    } catch (e: any) {
      showToast(t('settings.diag.loadReportsFailed', { error: e?.message || e }), 'error');
    }
  }

  function handleToggleReportsPanel() {
    showReportsPanel = !showReportsPanel;
    if (showReportsPanel) {
      loadServerReports();
    }
  }
</script>

<section class="flex flex-col gap-2.5">
  <div class="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
    <Activity size={14} />
    <span>{t('settings.diag.sectionTitle')}</span>
  </div>

  <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-3">
    <span class="text-xs text-[var(--text-secondary)] leading-relaxed">
      {t('settings.diag.sectionDesc')}
    </span>

    <!-- Toggle 1: HUD Visibility -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex flex-col min-w-0">
        <span class="text-xs font-semibold text-[var(--text-main)]">{t('settings.diag.hudToggleTitle')}</span>
        <span class="text-[11px] text-[var(--text-muted)]">{t('settings.diag.hudToggleDesc')}</span>
      </div>
      <button
        type="button"
        role="switch"
        data-testid="toggle-diag-hud"
        aria-checked={playbackTelemetry.hudVisible}
        aria-label={t('settings.diag.hudToggleAria')}
        onclick={() => playbackTelemetry.toggleHud()}
        class="relative w-10 h-5.5 rounded-full transition-colors cursor-pointer border-none shrink-0 {playbackTelemetry.hudVisible ? 'bg-[var(--primary-color)]' : 'bg-slate-400/40 dark:bg-slate-600'}"
      >
        <span class="block w-4 h-4 rounded-full bg-white shadow transition-transform {playbackTelemetry.hudVisible ? 'translate-x-5' : 'translate-x-1'}"></span>
      </button>
    </div>

    <!-- Toggle 2: Auto-Upload Abnormal Stops -->
    <div class="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border-color)]/60">
      <div class="flex flex-col min-w-0">
        <span class="text-xs font-semibold text-[var(--text-main)]">{t('settings.diag.autoUploadTitle')}</span>
        <span class="text-[11px] text-[var(--text-muted)]">{t('settings.diag.autoUploadDesc')}</span>
      </div>
      <button
        type="button"
        role="switch"
        data-testid="toggle-diag-autoupload"
        aria-checked={playbackTelemetry.autoUploadEnabled}
        aria-label={t('settings.diag.autoUploadAria')}
        onclick={() => playbackTelemetry.setAutoUpload(!playbackTelemetry.autoUploadEnabled)}
        class="relative w-10 h-5.5 rounded-full transition-colors cursor-pointer border-none shrink-0 {playbackTelemetry.autoUploadEnabled ? 'bg-emerald-500' : 'bg-slate-400/40 dark:bg-slate-600'}"
      >
        <span class="block w-4 h-4 rounded-full bg-white shadow transition-transform {playbackTelemetry.autoUploadEnabled ? 'translate-x-5' : 'translate-x-1'}"></span>
      </button>
    </div>

    <!-- Pending Offline Reports Notice -->
    {#if playbackTelemetry.pendingReportCount > 0}
      <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-300 text-[11px]">
        <span>{t('settings.diag.pendingQueueHint', { count: playbackTelemetry.pendingReportCount })}</span>
        <button
          type="button"
          data-testid="btn-diag-flush-queue"
          onclick={handleFlushQueue}
          class="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-semibold border-none cursor-pointer shrink-0"
        >
          {t('settings.diag.flushQueueBtn')}
        </button>
      </div>
    {/if}

    <!-- Action Buttons -->
    <div class="grid grid-cols-2 gap-2 pt-1">
      <button
        type="button"
        data-testid="btn-diag-open-hud"
        onclick={() => {
          playbackTelemetry.setHudVisible(true);
          onOpenHud?.();
        }}
        class="py-2 px-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs font-medium text-[var(--text-main)] border border-[var(--border-color)] cursor-pointer transition-all flex items-center justify-center gap-1.5"
      >
        <Activity size={13} />
        <span class="truncate">{t('settings.diag.openHudBtn')}</span>
      </button>
      <button
        type="button"
        data-testid="btn-diag-upload-now"
        disabled={playbackTelemetry.isUploading}
        onclick={handleManualUpload}
        class="py-2 px-2.5 rounded-xl bg-[var(--primary-color)]/15 hover:bg-[var(--primary-color)]/25 text-xs font-semibold text-[var(--primary-color)] border border-[var(--primary-color)]/30 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <Send size={13} />
        <span class="truncate">{playbackTelemetry.isUploading ? t('settings.diag.uploading') : t('settings.diag.uploadNowBtn')}</span>
      </button>
    </div>

    <!-- Expandable Server Reports Viewer -->
    <div class="pt-1 border-t border-[var(--border-color)]/60 flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          data-testid="btn-diag-toggle-server-reports"
          onclick={handleToggleReportsPanel}
          class="flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] bg-transparent border-none cursor-pointer p-0"
        >
          {#if showReportsPanel}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
          <span>{t('settings.diag.serverReportsTitle', { count: serverTotal })}</span>
        </button>
        {#if showReportsPanel}
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="btn-diag-refresh-reports"
              disabled={loadingReports}
              onclick={loadServerReports}
              class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--btn-secondary-bg)] text-[11px] text-[var(--text-main)] border border-[var(--border-color)] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={11} class={loadingReports ? 'animate-spin' : ''} />
              <span>{t('settings.diag.refreshReportsBtn')}</span>
            </button>
            <button
              type="button"
              data-testid="btn-diag-clear-server-reports"
              onclick={handleClearServerReports}
              class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-[11px] text-red-500 border border-red-500/20 cursor-pointer"
            >
              <Trash2 size={11} />
              <span>{t('settings.diag.clearReportsBtn')}</span>
            </button>
          </div>
        {/if}
      </div>

      {#if showReportsPanel}
        {#if serverReports.length === 0}
          <div class="text-xs text-[var(--text-muted)] text-center py-2">
            {t('settings.diag.noServerReports')}
          </div>
        {:else}
          <div class="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto custom-scrollbar">
            {#each serverReports as rep (rep.id)}
              {@const trSum = safeParseSummary(rep.trackSummary)}
              <div class="rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] p-2 text-[11px]">
                <button
                  type="button"
                  onclick={() => { expandedReportId = expandedReportId === rep.id ? null : rep.id; }}
                  class="w-full text-left flex items-center justify-between gap-2 bg-transparent border-none cursor-pointer p-0 text-[var(--text-main)]"
                >
                  <span class="font-mono font-bold text-emerald-500">#{rep.id} {rep.triggerType}</span>
                  <span class="text-[10px] text-[var(--text-muted)]">{formatDateTime(rep.createdAt)}</span>
                </button>
                <div class="text-[var(--text-secondary)] truncate mt-0.5">
                  {trSum?.name ? `${trSum.name} - ${trSum.artist || ''}` : '-'} {rep.note ? `(${rep.note})` : ''}
                </div>
                {#if expandedReportId === rep.id}
                  <pre class="mt-1.5 p-1.5 rounded-lg bg-slate-950/90 text-slate-200 font-mono text-[10px] overflow-x-auto max-h-[160px] whitespace-pre-wrap break-all">{JSON.stringify({
                    audio: safeParseSummary(rep.audioSnapshot),
                    stats: safeParseSummary(rep.statsJson),
                    precache: safeParseSummary(rep.precacheSnapshot),
                    device: safeParseSummary(rep.deviceInfo),
                    events: safeParseSummary(rep.eventsJson)
                  }, null, 2)}</pre>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </div>
</section>
