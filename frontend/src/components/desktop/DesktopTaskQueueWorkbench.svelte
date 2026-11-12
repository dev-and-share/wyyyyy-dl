<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../lib/api';
  import { taskState, fetchTasks, clearTasks, getActiveDownloadingCount, startTaskPolling } from '../../lib/taskStore.svelte';
  import { playerStore } from '../../lib/playerStore.svelte';
  import type { Track } from '../../lib/types';
  import TaskStatusBadge from '../TaskStatusBadge.svelte';
  import LocalSearchBox from '../LocalSearchBox.svelte';
  import { t } from '../../lib/i18n';
  import { matchesKeyword } from '../../lib/utils';

  let {
    onReveal,
    showToast = () => {}
  } = $props<{
    onReveal: (item: any) => void;
    showToast?: (m: string, t?: string, dur?: number) => void;
  }>();

  const ACTIVE_STATUSES = new Set(['WAITING', 'DOWNLOADING', 'PENDING']);

  let searchKw = $state('');
  let statusFilter = $state<'all' | 'active' | 'success' | 'failed'>('all');
  let refreshing = $state(false);
  let clearing = $state(false);
  let retryingAll = $state(false);
  let retryingIds = $state<Set<string>>(new Set());
  let forcingIds = $state<Set<string>>(new Set());

  // 统计指标
  let activeCount = $derived(getActiveDownloadingCount());
  let totalCount = $derived(taskState.tasks.length);
  let successCount = $derived(taskState.tasks.filter((t: any) => t.status === 'SUCCESS').length);
  let failedCount = $derived(
    taskState.tasks.filter((t: any) => t.status === 'FAILED' || t.status === 'ERROR' || (t.status === 'SKIP' && t.errorMsg?.includes('阻止落盘'))).length
  );

  // 过滤后的任务列表
  let filteredTasks = $derived.by(() => {
    let list = taskState.tasks;

    if (statusFilter === 'active') {
      list = list.filter((item: any) => ACTIVE_STATUSES.has(item.status));
    } else if (statusFilter === 'success') {
      list = list.filter((item: any) => item.status === 'SUCCESS');
    } else if (statusFilter === 'failed') {
      list = list.filter((item: any) => item.status === 'FAILED' || item.status === 'ERROR' || (item.status === 'SKIP' && item.errorMsg?.includes('阻止落盘')));
    }

    const kw = searchKw.trim();
    if (kw) {
      list = list.filter((item: any) => {
        const title = item.name || item.songName || item.title || String(item.id || '');
        return matchesKeyword(title, kw);
      });
    }

    return list;
  });

  onMount(() => {
    handleRefresh();
  });

  async function handleRefresh() {
    refreshing = true;
    try {
      await fetchTasks();
    } finally {
      refreshing = false;
    }
  }

  async function handleClearAll() {
    if (totalCount === 0) return;
    if (!confirm(t('drawer.clearTasks') + '?')) return;
    clearing = true;
    try {
      await clearTasks();
      showToast(t('drawer.clearTasks'), 'success');
    } catch (e: any) {
      showToast(e?.message || 'Clear failed', 'error');
    } finally {
      clearing = false;
    }
  }

  async function handleRetrySingle(item: any) {
    const songId = String(item.id || item.songId || '');
    if (!songId || retryingIds.has(songId)) return;

    const next = new Set(retryingIds);
    next.add(songId);
    retryingIds = next;

    // 🚀 乐观更新：立刻在界面上置为排队状态 PENDING
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

  function isTrackPlaying(item: any): boolean {
    const songId = String(item.id || item.songId || '');
    return Boolean(
      playerStore.playing &&
      playerStore.activeTrack &&
      String(playerStore.activeTrack.id) === songId
    );
  }

  function handlePreviewSingle(item: any) {
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

  async function handleForceDownloadSingle(item: any) {
    const songId = String(item.id || item.songId || '');
    if (!songId || forcingIds.has(songId)) return;

    const next = new Set(forcingIds);
    next.add(songId);
    forcingIds = next;

    const songTitle = item.name || item.songName || item.title || songId;

    // 🚀 乐观更新：立刻在界面上置为排队状态 PENDING
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

  async function handleRetryAllFailed() {
    const failedItems = taskState.tasks.filter((t: any) => t.status === 'FAILED' || t.status === 'ERROR');
    if (!failedItems.length || retryingAll) return;

    retryingAll = true;
    const failedIds = new Set(failedItems.map((item: any) => String(item.id || item.songId || '')));

    // 🚀 乐观更新：立刻在界面上把所有失败项目重置为 PENDING，清空错误，让用户瞬间看到全部进入排队！
    taskState.tasks = taskState.tasks.map((t: any) => {
      const sid = String(t.id || t.songId || '');
      if (failedIds.has(sid)) {
        return { ...t, status: 'PENDING', errorMsg: null };
      }
      return t;
    });

    showToast(t('drawer.batchSubmitting', { count: failedItems.length }), 'info', 2000);
    window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
    startTaskPolling();

    // 🛡️ 智能节流提交队列：依次间隔 120ms 错开派发，避免瞬间并发打爆解析接口
    try {
      for (const item of failedItems) {
        const songId = String(item.id || item.songId || '');
        if (songId) {
          try {
            await api.downloadSingle(songId);
          } catch (e) {
            console.warn(`Retry single song ${songId} error:`, e);
          }
          await new Promise((r) => setTimeout(r, 120));
        }
      }
      showToast(t('drawer.batchSubmitted', { count: failedItems.length }), 'success', 2500);
    } finally {
      retryingAll = false;
      await fetchTasks();
    }
  }
</script>

<!-- PC Desktop: Active Download Tasks & Queue Workbench -->
<div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] overflow-hidden shadow-sm flex flex-col">
  <!-- 1. Header Toolbar & Quick Stats -->
  <div class="p-3.5 border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-3 bg-[var(--card-header-bg)]/50 backdrop-blur-md">
    <!-- Filter Pills -->
    <div class="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        class="px-2.5 py-1 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all {statusFilter === 'all' ? 'bg-red-500 text-white shadow-xs' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => statusFilter = 'all'}
      >
        {t('common.all')} ({totalCount})
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {statusFilter === 'active' ? 'bg-amber-500 text-white shadow-xs' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => statusFilter = 'active'}
      >
        <span>⚡ {t('common.inProgress')} ({activeCount})</span>
        {#if activeCount > 0}
          <span class="bg-red-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold leading-none animate-pulse">
            {activeCount}
          </span>
        {/if}
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all {statusFilter === 'success' ? 'bg-emerald-500 text-white shadow-xs' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => statusFilter = 'success'}
      >
        ✓ SUCCESS ({successCount})
      </button>

      {#if failedCount > 0}
        <button
          type="button"
          class="px-2.5 py-1 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all {statusFilter === 'failed' ? 'bg-rose-500 text-white shadow-xs' : 'bg-[var(--btn-secondary-bg)] text-rose-400 hover:text-rose-300'}"
          onclick={() => statusFilter = 'failed'}
        >
          ✕ FAILED ({failedCount})
        </button>
      {/if}
    </div>

    <!-- Right Controls: Retry All Failed & Refresh & Clear -->
    <div class="flex items-center gap-2">
      {#if failedCount > 0}
        <button
          type="button"
          data-testid="btn-retry-all-failed"
          class="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
          disabled={retryingAll}
          onclick={handleRetryAllFailed}
          title={t('common.retryAllFailed', { count: failedCount })}
        >
          <span class={retryingAll ? 'animate-spin inline-block' : ''}>🔄</span>
          <span>{t('common.retryAllFailed', { count: failedCount })}</span>
        </button>
      {/if}

      <button
        type="button"
        class="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--btn-secondary-border)] transition-colors cursor-pointer flex items-center gap-1"
        disabled={refreshing}
        onclick={handleRefresh}
        title={t('topbar.refresh')}
      >
        <span class={refreshing ? 'animate-spin inline-block' : ''}>🔄</span>
        <span class="hidden sm:inline">{t('common.refresh')}</span>
      </button>

      <button
        type="button"
        class="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer flex items-center gap-1"
        disabled={clearing || totalCount === 0}
        onclick={handleClearAll}
        title={t('drawer.clearTasks')}
      >
        <span>🗑️</span>
        <span class="hidden sm:inline">{t('common.clear')}</span>
      </button>
    </div>
  </div>

  <!-- 2. Search Bar -->
  <div class="p-3 border-b border-[var(--border-color)] flex items-center gap-2">
    <div class="flex-1 max-w-md">
      <LocalSearchBox
        bind:value={searchKw}
        placeholder={t('download.searchHistoryPlaceholder')}
        historyKey="wyy_tasks_search_history"
        onSearch={() => {}}
        onClear={() => searchKw = ''}
      />
    </div>
    {#if searchKw.trim()}
      <button
        type="button"
        class="btn-secondary px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
        onclick={() => searchKw = ''}
      >
        {t('common.clear')}
      </button>
    {/if}
  </div>

  <!-- 3. Tasks Table / List View -->
  <div class="overflow-x-auto max-h-[560px] overflow-y-auto custom-scroll">
    <table class="w-full text-left border-collapse text-xs">
      <thead class="sticky top-0 z-10 bg-[var(--card-header-bg)] backdrop-blur-xl border-b border-[var(--border-color)] text-[var(--text-muted)]">
        <tr>
          <th class="w-12 py-3 pl-4 font-semibold">#</th>
          <th class="py-3 px-3 font-semibold">{t('search.tableTitle')}</th>
          <th class="py-3 px-3 font-semibold w-36">{t('common.status')}</th>
          <th class="py-3 px-3 font-semibold hidden md:table-cell">{t('download.filePath')} / {t('common.remark')}</th>
          <th class="py-3 pr-4 text-right font-semibold min-w-[210px]">{t('search.tableActions')}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-[var(--border-subtle)]">
        {#if filteredTasks.length === 0}
          <tr>
            <td colspan="5" class="py-16 text-center text-[var(--text-muted)]">
              {#if searchKw.trim()}
                {t('drawer.noMatching')}
              {:else if statusFilter === 'active'}
                {#if failedCount > 0}
                  <div class="flex flex-col items-center gap-1 text-xs">
                    <span class="text-[var(--text-main)] font-medium">⚡ 当前没有正在下载中的任务</span>
                    <span class="text-[11px] text-rose-400">
                      （有 {failedCount} 首曲目下载失败，请点击上方「✕ FAILED ({failedCount})」药丸查看或重试）
                    </span>
                  </div>
                {:else}
                  <span>⚡ 队列中所有歌曲已全部处理完成！</span>
                {/if}
              {:else}
                {t('download.empty')}
              {/if}
            </td>
          </tr>
        {:else}
          {#each filteredTasks as item, i (item.id || item.songId || i)}
            {@const songTitle = item.name || item.songName || item.title || `Task #${item.id || i + 1}`}
            {@const isSuccess = item.status === 'SUCCESS'}
            {@const isFailed = item.status === 'FAILED' || item.status === 'ERROR' || (item.status === 'SKIP' && item.errorMsg?.includes('阻止落盘'))}
            {@const isActive = ACTIVE_STATUSES.has(item.status)}
            {@const formattedError = item.errorMsg === '分析歌曲URL失败' ? '分析歌曲URL失败 (因版权保护或需VIP会员)' : item.errorMsg}
            <tr class="hover:bg-[var(--card-header-hover)] transition-colors group {isActive ? 'bg-amber-500/5' : ''} {isFailed ? 'bg-rose-500/[0.03]' : ''}">
              <td class="py-2.5 pl-4 text-[var(--text-muted)] font-mono text-[11px]">
                {#if isActive}
                  <span class="text-amber-500 animate-pulse">⚡</span>
                {:else if isFailed}
                  <span class="text-rose-500 font-bold">✕</span>
                {:else}
                  {i + 1}
                {/if}
              </td>
              <td class="py-2.5 px-3 min-w-0">
                <div class="flex flex-col gap-0.5">
                  <span class="font-semibold text-[var(--text-main)] truncate max-w-sm {isFailed ? 'text-rose-500 dark:text-rose-400' : ''}" title={songTitle}>
                    {songTitle}
                  </span>
                  {#if formattedError}
                    <span class="text-[10px] {isFailed ? 'text-rose-400/90 font-medium' : 'text-amber-500/90'} truncate max-w-sm" title={formattedError}>
                      {formattedError}
                    </span>
                  {/if}
                </div>
              </td>
              <td class="py-2.5 px-3 whitespace-nowrap">
                <TaskStatusBadge status={item.status} />
              </td>
              <td class="py-2.5 px-3 text-[var(--text-muted)] font-mono text-[11px] truncate max-w-[220px] hidden md:table-cell" title={item.filePath || formattedError || '-'}>
                {item.filePath || formattedError || '-'}
              </td>
              <td class="py-2.5 pr-4 text-right whitespace-nowrap">
                {#if isSuccess}
                  <button
                    type="button"
                    class="btn-primary px-2.5 py-1 text-[11px] rounded-lg cursor-pointer"
                    onclick={() => onReveal(item)}
                    title={t('download.locatePhysicalTooltip')}
                  >
                    {t('common.reveal')}
                  </button>
                {:else if isFailed}
                  <div class="inline-flex items-center justify-end gap-1.5">
                    <!-- 🎧 试听按钮 -->
                    <button
                      type="button"
                      data-testid="btn-preview-task"
                      class="px-2 py-1 text-[11px] rounded-lg font-semibold cursor-pointer transition-all inline-flex items-center gap-1 active:scale-95 {isTrackPlaying(item) ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40' : 'bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-main)] border border-[var(--btn-secondary-border)]'}"
                      onclick={() => handlePreviewSingle(item)}
                      title={t('common.audition')}
                    >
                      <span>{isTrackPlaying(item) ? '⏸️' : '🎧'}</span>
                      <span>{isTrackPlaying(item) ? t('common.auditioning') : t('common.audition')}</span>
                    </button>

                    <!-- 💾 强制落盘按钮 -->
                    <button
                      type="button"
                      data-testid="btn-force-download-task"
                      class="px-2 py-1 text-[11px] rounded-lg bg-amber-500/15 hover:bg-amber-500/25 active:scale-95 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold cursor-pointer transition-all inline-flex items-center gap-1"
                      disabled={forcingIds.has(String(item.id || item.songId))}
                      onclick={() => handleForceDownloadSingle(item)}
                      title={t('download.forceDownloadTooltip')}
                    >
                      <span class={forcingIds.has(String(item.id || item.songId)) ? 'animate-spin inline-block' : ''}>{forcingIds.has(String(item.id || item.songId)) ? '⏳' : '💾'}</span>
                      <span>{t('common.forceSave')}</span>
                    </button>

                    <!-- 🔄 重试按钮 -->
                    <button
                      type="button"
                      data-testid="btn-retry-task"
                      class="px-2 py-1 text-[11px] rounded-lg bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-500 dark:text-rose-400 border border-rose-500/30 font-semibold cursor-pointer transition-all inline-flex items-center gap-1"
                      disabled={retryingIds.has(String(item.id || item.songId))}
                      onclick={() => handleRetrySingle(item)}
                      title={t('common.retry')}
                    >
                      <span class={retryingIds.has(String(item.id || item.songId)) ? 'animate-spin inline-block' : ''}>🔄</span>
                      <span>{t('common.retry')}</span>
                    </button>
                  </div>
                {:else if isActive}
                  <span class="text-[11px] text-amber-500 font-medium animate-pulse">
                    ⏳ ...
                  </span>
                {:else}
                  <span class="text-[11px] text-[var(--text-muted)]">-</span>
                {/if}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
