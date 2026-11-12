<script lang="ts">
  import TaskStatusBadge from './TaskStatusBadge.svelte';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast.svelte';
  import { taskState, startTaskPolling, fetchTasks } from '../lib/taskStore.svelte';
  import { playerStore } from '../lib/playerStore.svelte';
  import type { Track } from '../lib/types';
  import { t } from '../lib/i18n';

  let {
    tasks = [],
    onReveal
  } = $props<{
    tasks: any[];
    onReveal: (item: any) => void;
  }>();

  let retryingIds = $state<Set<string>>(new Set());
  let forcingIds = $state<Set<string>>(new Set());

  function isTrackPlaying(item: any): boolean {
    const songId = String(item.id || item.songId || '');
    return Boolean(
      playerStore.playing &&
      playerStore.activeTrack &&
      String(playerStore.activeTrack.id) === songId
    );
  }

  function handlePreview(item: any) {
    const songId = String(item.id || item.songId || '');
    if (!songId) return;
    const songTitle = item.name || item.songName || item.title || `Task #${songId}`;

    if (isTrackPlaying(item)) {
      playerStore.togglePlay();
      return;
    }

    const previewTrack: Track = {
      id: songId,
      name: songTitle,
      artist: item.artist || '',
      isLocal: false,
      allowTrial: true
    };

    playerStore.setQueue([previewTrack], 0);
    showToast(t('download.previewStarted', { name: songTitle }), 'info', 1800);
  }

  async function handleForceDownload(item: any) {
    const songId = String(item.id || item.songId || '');
    if (!songId || forcingIds.has(songId)) return;

    const next = new Set(forcingIds);
    next.add(songId);
    forcingIds = next;

    const songTitle = item.name || item.songName || item.title || songId;

    taskState.tasks = taskState.tasks.map((t: any) => {
      if (String(t.id || t.songId || '') === songId) {
        return { ...t, status: 'PENDING', errorMsg: null };
      }
      return t;
    });

    try {
      await api.downloadSingle(songId, true);
      showToast(t('download.forceDownloadSubmitted', { name: songTitle }), 'info');
      window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
      startTaskPolling();
      await fetchTasks();
    } catch (err: any) {
      showToast(err?.message || 'Force download failed', 'error');
    } finally {
      const cleanup = new Set(forcingIds);
      cleanup.delete(songId);
      forcingIds = cleanup;
    }
  }

  async function handleRetry(item: any) {
    const songId = String(item.id || item.songId || '');
    if (!songId || retryingIds.has(songId)) return;

    const next = new Set(retryingIds);
    next.add(songId);
    retryingIds = next;

    // 🚀 乐观更新
    taskState.tasks = taskState.tasks.map((t: any) => {
      if (String(t.id || t.songId || '') === songId) {
        return { ...t, status: 'PENDING', errorMsg: null };
      }
      return t;
    });

    try {
      await api.downloadSingle(songId);
      showToast(t('drawer.downloadSubmitted', { name: item.name || songId }), 'info');
      window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
      startTaskPolling();
      await fetchTasks();
    } catch (err: any) {
      showToast(err?.message || 'Retry failed', 'error');
    } finally {
      const cleanup = new Set(retryingIds);
      cleanup.delete(songId);
      retryingIds = cleanup;
    }
  }
</script>

<!-- Download Tasks View -->
<div class="flex flex-col flex-1 min-h-0 overflow-hidden">
  <div
    class="flex-1 overflow-y-auto overscroll-contain p-2.5 custom-table-scroll"
    style="-webkit-overflow-scrolling: touch; touch-action: pan-y;"
  >
    <div class="flex flex-col gap-1.5">
      {#each tasks as taskItem}
        {@const isFailed = taskItem.status === 'FAILED' || taskItem.status === 'ERROR' || (taskItem.status === 'SKIP' && taskItem.errorMsg?.includes('阻止落盘'))}
        <div class="flex justify-between items-center px-2.5 py-2 rounded-xl bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 gap-2 {isFailed ? 'border-rose-500/20 bg-rose-500/[0.02]' : ''}">
          <div class="flex-1 min-w-0">
            <span class="truncate block text-xs {isFailed ? 'text-rose-500 dark:text-rose-400 font-semibold' : 'text-[var(--text-main)] font-medium'}">
              {taskItem.name || taskItem.id}
            </span>
            {#if taskItem.errorMsg}
              <span class="text-[10px] {isFailed ? 'text-rose-400/90 font-medium' : 'text-amber-500/90'} block truncate mt-0.5" title={taskItem.errorMsg}>
                {taskItem.errorMsg}
              </span>
            {/if}
          </div>
          <div class="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {#if taskItem.status === 'SUCCESS'}
              <button
                type="button"
                class="btn-primary px-2 py-0.5 text-[11px] rounded"
                onclick={() => onReveal(taskItem)}
                title={t('download.locatePhysicalTooltip')}
              >
                {t('common.reveal')}
              </button>
            {:else if isFailed}
              <!-- 🎧 试听 -->
              <button
                type="button"
                data-testid="btn-preview-task"
                class="px-1.5 py-0.5 text-[11px] rounded font-semibold cursor-pointer transition-all inline-flex items-center gap-0.5 active:scale-95 {isTrackPlaying(taskItem) ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40' : 'bg-black/5 dark:bg-white/10 text-[var(--text-main)] border border-black/10 dark:border-white/10'}"
                onclick={() => handlePreview(taskItem)}
                title={t('common.audition')}
              >
                <span>{isTrackPlaying(taskItem) ? '⏸️' : '🎧'}</span>
                <span>{isTrackPlaying(taskItem) ? t('common.auditioning') : t('common.audition')}</span>
              </button>

              <!-- 💾 强制落盘 -->
              <button
                type="button"
                data-testid="btn-force-download-task"
                class="px-1.5 py-0.5 text-[11px] rounded bg-amber-500/15 hover:bg-amber-500/25 active:scale-95 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold cursor-pointer transition-all inline-flex items-center gap-0.5"
                disabled={forcingIds.has(String(taskItem.id || taskItem.songId))}
                onclick={() => handleForceDownload(taskItem)}
                title={t('download.forceDownloadTooltip')}
              >
                <span class={forcingIds.has(String(taskItem.id || taskItem.songId)) ? 'animate-spin inline-block' : ''}>{forcingIds.has(String(taskItem.id || taskItem.songId)) ? '⏳' : '💾'}</span>
                <span>{t('common.forceSave')}</span>
              </button>

              <!-- 🔄 重试 -->
              <button
                type="button"
                data-testid="btn-retry-task"
                class="px-1.5 py-0.5 text-[11px] rounded bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-500 dark:text-rose-400 border border-rose-500/30 font-semibold cursor-pointer transition-all inline-flex items-center gap-0.5"
                disabled={retryingIds.has(String(taskItem.id || taskItem.songId))}
                onclick={() => handleRetry(taskItem)}
                title={t('common.retry')}
              >
                <span class={retryingIds.has(String(taskItem.id || taskItem.songId)) ? 'animate-spin inline-block' : ''}>🔄</span>
                <span>{t('common.retry')}</span>
              </button>
            {/if}
            <TaskStatusBadge status={taskItem.status} />
          </div>
        </div>
      {:else}
        <div class="py-12 px-4 text-center text-[var(--text-muted)] text-xs">{t('download.empty')}</div>
      {/each}
    </div>
  </div>
</div>
