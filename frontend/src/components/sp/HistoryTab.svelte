<script lang="ts">
  import { api } from '../../lib/api';
  import { t } from '../../lib/i18n';
  import { formatBytes } from '../../lib/utils';
  import AccordionCard from '../AccordionCard.svelte';
  import LocalSearchBox from '../LocalSearchBox.svelte';
  import SlotBtn from '../SlotBtn.svelte';

  let histKw = $state('');
  let histPage = $state(1);
  let histList: any[] = $state([]);
  let histStats: any = $state(null);
  let histTotal = $state(0);

  let histTotalPages = $derived(Math.max(1, Math.ceil(histTotal / 10)));

  async function loadHistory(p = 1) {
    histPage = p;
    const j = await api.historyList(histKw, p);
    histList = j?.data?.list || [];
    histTotal = j?.data?.total || 0;
    const s = await api.historyStats();
    histStats = s?.data || null;
  }

  $effect(() => {
    loadHistory(1);
  });

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
  }
</script>

<AccordionCard title={t('download.accordionHistory')} open={true}>
  <!-- Stats Toolbar -->
  <div class="flex flex-wrap gap-2.5 bg-[var(--stat-bar-bg,#1e293b)]/30 border border-[var(--border-subtle)] p-2.5 px-3.5 rounded-xl mb-2.5 items-center text-xs">
    <span class="text-[var(--text-secondary)]">{t('download.recordedDownloads', { count: histStats?.totalCount ?? histTotal ?? 0 })}</span>
    <span class="text-[var(--text-secondary)]">{t('download.diskSpaceUsed', { size: histStats?.totalSize ? formatBytes(histStats.totalSize) : '-' })}</span>
    {#if (histStats?.missingCount ?? 0) > 0}
      <span class="text-red-500 font-medium">{t('download.missingCount', { count: histStats.missingCount })}</span>
    {/if}
    {#if (histStats?.nonMp3Count ?? 0) > 0}
      <span class="text-amber-500 font-medium">{t('download.nonMp3Count', { count: histStats.nonMp3Count })}</span>
    {/if}
    <div class="ml-auto flex gap-1.5">
      <button
        type="button"
        class="btn-primary px-3 py-1 text-xs"
        onclick={() => loadHistory(1)}
      >
        🔄 {t('common.refresh')}
      </button>
      <button
        type="button"
        class="btn-secondary px-3 py-1 text-xs"
        onclick={() => {
          const v = prompt(t('download.searchHistoryPrompt'));
          if (v !== null) {
            histKw = v;
            loadHistory(1);
          }
        }}
      >
        🔍 {t('common.search')}
      </button>
    </div>
  </div>

  <!-- Search Input Row -->
  <div class="flex gap-2 mb-2.5">
    <div class="flex-1 min-w-0">
      <LocalSearchBox
        bind:value={histKw}
        placeholder={t('download.searchHistoryPlaceholder')}
        historyKey="wyyyy_history_search_history"
        onSearch={() => loadHistory(1)}
        onClear={() => loadHistory(1)}
      />
    </div>
    <button
      type="button"
      class="btn-primary px-4 py-1.5 text-xs hidden md:inline-flex"
      onclick={() => loadHistory(1)}
    >
      {t('common.search')}
    </button>
  </div>

  <!-- History Record List -->
  <div class="border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--card-bg)]">
    <ul class="divide-y divide-black/5 dark:divide-white/5 m-0 p-0 list-none">
      {#each histList as h}
        <li class="flex justify-between items-center py-2 px-3 hover:bg-black/5 dark:hover:bg-white/5 transition-all group">
          <div class="flex-1 overflow-hidden min-w-0 pr-2">
            <div class="font-bold text-xs text-[var(--text-main)] truncate">{h.songName || h.title}</div>
            <div class="text-[11px] text-[var(--text-secondary)] truncate mt-0.5 flex items-center gap-1.5">
              <span>{h.artist || ''}</span>
              {#if h.fileSize}<span>| {formatBytes(h.fileSize)}</span>{/if}
              <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold {h.fileExists ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'}">
                {h.fileExists ? t('download.fileStatusNormal') : t('download.fileStatusMissing')}
              </span>
            </div>
          </div>
          <div class="flex gap-1.5 shrink-0 transition-all duration-150 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <SlotBtn onclick={() => copy(h.hostFilePath || h.filePath)}>{t('common.reveal')}</SlotBtn>
            <SlotBtn onclick={() => { if (confirm(t('download.confirmDeleteRecord'))) alert('Deleted'); }}>🗑️ {t('common.delete')}</SlotBtn>
          </div>
        </li>
      {:else}
        <li class="py-8 px-4 text-center text-[var(--text-muted)] text-xs list-none">{t('download.noHistoryFound')}</li>
      {/each}
    </ul>
  </div>

  <!-- Pagination -->
  <div class="flex justify-between items-center mt-3 text-xs text-[var(--text-secondary)] select-none">
    <button
      type="button"
      class="btn-secondary px-3 py-1 text-xs"
      disabled={histPage <= 1}
      onclick={() => loadHistory(histPage - 1)}
    >
      {t('download.prevPage')}
    </button>
    <span>{t('download.pageStatsItems', { page: histPage, total: histTotalPages, count: histTotal })}</span>
    <button
      type="button"
      class="btn-secondary px-3 py-1 text-xs"
      disabled={histPage >= histTotalPages}
      onclick={() => loadHistory(histPage + 1)}
    >
      {t('download.nextPage')}
    </button>
  </div>
</AccordionCard>
