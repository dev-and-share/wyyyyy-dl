<script lang="ts">
  import { onMount } from 'svelte';
  import FolderExplorer from '../FolderExplorer.svelte';
  import LocalSearchBox from '../LocalSearchBox.svelte';
  import BrowserCacheSection from '../BrowserCacheSection.svelte';
  import SlotBtn from '../SlotBtn.svelte';
  import { api } from '../../lib/api';
  import { t } from '../../lib/i18n';
  import { formatBytes, formatArtist, DEFAULT_VINYL_COVER, getApiCache, setApiCache } from '../../lib/utils';
  import { isSameTrack } from '../../lib/trackStatus.svelte';
  import type { Track } from '../../lib/types';

  let {
    curTrack = null,
    playing = false,
    onPlayQueue,
    onReveal,
    showToast
  } = $props<{
    curTrack?: Track | null;
    playing?: boolean;
    onPlayQueue: (tracks: any[], idx?: number) => void;
    onReveal: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let subTab = $state<'history' | 'browser-cache'>('history');
  let histKw = $state('');
  let histPage = $state(1);
  let histList = $state<any[]>([]);
  let histStats = $state<any>(null);
  let histTotal = $state(0);
  let loadingHistory = $state(false);
  let scanLoading = $state(false);

  let histTotalPages = $derived(Math.max(1, Math.ceil(histTotal / 10)));

  onMount(() => {
    loadHistory(1);
  });

  async function loadHistory(p = 1) {
    histPage = p;
    if (p === 1 && !histKw.trim()) {
      const cachedList = getApiCache('history_list_1');
      if (cachedList?.data && Array.isArray(cachedList.data)) {
        histList = cachedList.data;
        histTotal = cachedList.total || cachedList.data.length;
      }
      const cachedStats = getApiCache('history_stats');
      if (cachedStats?.data) {
        histStats = cachedStats.data;
      }
    }
    loadingHistory = true;
    try {
      const j = await api.historyList(histKw, p);
      const list = j?.data?.list || [];
      const total = j?.data?.total || 0;
      histList = list;
      histTotal = total;
      if (p === 1 && !histKw.trim()) {
        setApiCache('history_list_1', list);
      }
      const s = await api.historyStats();
      const stats = s?.data || null;
      histStats = stats;
      if (stats) setApiCache('history_stats', stats);
    } catch (e: any) {
      showToast(t('download.loadHistoryFailed', { error: e?.message || e }), 'error');
    } finally {
      loadingHistory = false;
    }
  }

  async function handleDeleteHistory(item: any) {
    if (!item?.id) return;
    const songName = item.songName || item.name || t('common.unknownSong');
    if (!confirm(t('download.confirmRemoveFromHistory', { name: songName }))) {
      return;
    }
    try {
      const j = await api.historyDelete(item.id);
      if (j?.code === '000000') {
        showToast(t('download.removedFromHistory'), 'success', 1500);
        loadHistory(histPage);
      } else {
        showToast(j?.msg || t('download.deleteFailed'), 'warning');
      }
    } catch (e: any) {
      showToast(t('download.deleteFailedWithMsg', { error: e?.message || e }), 'error');
    }
  }

  async function handleScanExternal() {
    scanLoading = true;
    try {
      const j = await api.historyScanExternal();
      if (j?.code === '000000') {
        showToast(t('download.scanExternalDone'), 'success');
        loadHistory(1);
      } else {
        showToast(j?.msg || t('download.scanFailed'), 'warning');
      }
    } catch (e: any) {
      showToast(t('download.scanException', { error: e?.message || e }), 'error');
    } finally {
      scanLoading = false;
    }
  }

  async function handleScanDisk() {
    scanLoading = true;
    try {
      const j = await api.historyScan();
      if (j?.code === '000000') {
        showToast(t('download.diskCheckDone'), 'success');
        loadHistory(histPage);
      } else {
        showToast(j?.msg || t('download.scanFailed'), 'warning');
      }
    } catch (e: any) {
      showToast(t('download.diskCheckException', { error: e?.message || e }), 'error');
    } finally {
      scanLoading = false;
    }
  }
</script>

<!-- PC Desktop: Local Management Workbench -->
<div class="flex flex-col lg:flex-row gap-5 items-start w-full select-none animate-fade-in" data-testid="desktop-download-mgr-view">
  <!-- Left Column: Folder Explorer Tree -->
  <div class="w-full lg:w-[400px] xl:w-[460px] 2xl:w-[500px] shrink-0 flex flex-col gap-3 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] p-4 shadow-sm">
    <div class="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
      <div class="flex items-center gap-2">
        <span class="text-base">📁</span>
        <h2 class="font-bold text-sm text-[var(--text-main)]">{t('download.localLibraryAndTree')}</h2>
      </div>
      <span class="text-[10px] text-[var(--text-muted)]">{t('download.clickToExpandPlay')}</span>
    </div>

    <div class="max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto custom-scroll pr-1">
      <FolderExplorer {onPlayQueue} {onReveal} {showToast} />
    </div>
  </div>

  <!-- Right Column: Download History & Offline Cache Workbench -->
  <div class="flex-1 min-w-0 w-full flex flex-col gap-4">
    <!-- 1. Stats and Maintenance Bar -->
    <div class="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] shadow-sm text-xs lg:pr-[220px]">
      <div class="flex items-center gap-3 flex-wrap">
        <span class="text-[var(--text-secondary)]">
          {t('download.recordedDownloads', { count: histStats?.totalCount ?? histTotal ?? 0 })}
        </span>
        <span class="text-[var(--text-secondary)]">
          {t('download.diskSpaceUsed', { size: histStats?.totalSize ? formatBytes(histStats.totalSize) : '-' })}
        </span>
        {#if (histStats?.missingCount ?? 0) > 0}
          <span class="text-amber-400 font-medium bg-amber-400/10 px-2 py-0.5 rounded-md">
            {t('download.missingCount', { count: histStats.missingCount })}
          </span>
        {/if}
      </div>

      <!-- Quick Maintenance Tools -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn-secondary px-2.5 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer"
          disabled={scanLoading}
          onclick={handleScanExternal}
          title={t('download.scanExternalTooltip')}
        >
          {scanLoading ? t('download.scanning') : t('download.incrementalScan')}
        </button>
        <button
          type="button"
          class="btn-secondary px-2.5 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer"
          disabled={scanLoading}
          onclick={handleScanDisk}
          title={t('download.diskCheckTooltip')}
        >
          {t('download.diskCheck')}
        </button>
      </div>
    </div>

    <!-- 2. Subtab Switcher -->
    <div class="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
      <div class="flex items-center gap-2">
        <button
          type="button"
          data-testid="subtab-history"
          class="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border-none transition-all {subTab === 'history' ? 'bg-red-500 text-white shadow-md shadow-red-500/20' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => subTab = 'history'}
        >
          {t('download.tabHistoryAndFiles')}
        </button>
        <button
          type="button"
          data-testid="subtab-cache"
          class="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border-none transition-all {subTab === 'browser-cache' ? 'bg-red-500 text-white shadow-md shadow-red-500/20' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => subTab = 'browser-cache'}
        >
          {t('download.tabBrowserCache')}
        </button>
      </div>
    </div>

    <!-- 3. Content Area -->
    {#if subTab === 'history'}
      <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] overflow-hidden shadow-sm flex flex-col">
        <!-- Search & Refresh Bar -->
        <div class="p-3 border-b border-[var(--border-color)] flex items-center justify-between gap-2.5">
          <div class="flex items-center gap-2 flex-1 max-w-md">
            <LocalSearchBox
              bind:value={histKw}
              placeholder={t('download.searchHistoryPlaceholder')}
              historyKey="wyyyy_history_search_history"
              onSearch={() => loadHistory(1)}
              onClear={() => loadHistory(1)}
            />
            <button
              type="button"
              class="btn-primary px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
              onclick={() => loadHistory(1)}
            >
              {t('common.search')}
            </button>
          </div>
          <button
            type="button"
            class="p-2 rounded-xl text-xs bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--btn-secondary-border)] transition-colors cursor-pointer"
            onclick={() => loadHistory(histPage)}
            title={t('download.refreshHistoryTooltip')}
          >
            🔄
          </button>
        </div>

        <!-- History Table -->
        <div class="overflow-x-auto max-h-[560px] overflow-y-auto custom-scroll">
          <table class="w-full text-left border-collapse text-xs">
            <thead class="sticky top-0 z-10 bg-[var(--card-header-bg)] backdrop-blur-xl border-b border-[var(--border-color)] text-[var(--text-muted)]">
              <tr>
                <th class="w-12 py-3 pl-4 font-semibold">#</th>
                <th class="py-3 px-3 font-semibold">{t('search.tableTitle')}</th>
                <th class="py-3 px-3 font-semibold w-28">{t('download.sizeAndFormat')}</th>
                <th class="py-3 px-3 font-semibold hidden md:table-cell">{t('download.filePath')}</th>
                <th class="py-3 pr-4 text-right font-semibold w-40">{t('search.tableActions')}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border-subtle)]">
              {#if loadingHistory && histList.length === 0}
                <tr>
                  <td colspan="5" class="py-12 text-center text-[var(--text-muted)]">
                    {t('download.readingHistory')}
                  </td>
                </tr>
              {:else if histList.length === 0}
                <tr>
                  <td colspan="5" class="py-12 text-center text-[var(--text-muted)]">
                    {t('download.noHistoryFound')}
                  </td>
                </tr>
              {:else}
                {#each histList as item, i (item.id || i)}
                  {@const idx = (histPage - 1) * 10 + i + 1}
                  {@const songTitle = item.songName || item.name || item.title || t('common.unknownSong')}
                  {@const artist = item.artist || item.artists || ''}
                  {@const isPlayingThis = isSameTrack(curTrack, item)}
                  {@const displayPath = item.hostFilePath || item.filePath || item.relativePath || item.path || t('download.defaultMusicDir')}
                  <tr class="hover:bg-[var(--card-header-hover)] transition-colors group {isPlayingThis ? 'bg-red-500/10' : ''}">
                    <td class="py-2.5 pl-4 text-[var(--text-muted)] font-mono text-[11px]">
                      {#if isPlayingThis && playing}
                        <span class="text-red-500 animate-pulse">▶</span>
                      {:else}
                        {idx}
                      {/if}
                    </td>
                    <td class="py-2.5 px-3 min-w-0">
                      <div class="flex flex-col gap-0.5">
                        <span class="font-semibold text-[var(--text-main)] truncate max-w-xs group-hover:text-red-400 transition-colors" title={songTitle}>
                          {songTitle}
                        </span>
                        {#if artist}
                          <span class="text-[11px] text-[var(--text-muted)] truncate" title={artist}>{artist}</span>
                        {/if}
                      </div>
                    </td>
                    <td class="py-2.5 px-3 text-[var(--text-secondary)] whitespace-nowrap">
                      <span>{item.fileSize ? formatBytes(item.fileSize) : '-'}</span>
                      {#if item.format}
                        <span class="ml-1 text-[10px] text-red-400/80 font-mono uppercase">.{item.format}</span>
                      {/if}
                    </td>
                    <td class="py-2.5 px-3 text-[var(--text-muted)] font-mono text-[11px] truncate max-w-[200px] hidden md:table-cell" title={displayPath}>
                      {displayPath}
                    </td>
                    <td class="py-2.5 pr-4 text-right whitespace-nowrap">
                      <div class="inline-flex items-center justify-end gap-1.5">
                        <SlotBtn
                          playing={isPlayingThis && playing}
                          onclick={() => onPlayQueue([{
                            id: item.songId && item.songId > 0 ? item.songId : (item.id || `local_${Date.now()}`),
                            name: songTitle,
                            artist: artist || t('common.unknownArtist'),
                            album: item.album || t('download.localLibrary'),
                            cover: item.cover || DEFAULT_VINYL_COVER,
                            url: `/v3/stream?${item.songId && item.songId > 0 ? `id=${item.songId}&` : ''}${item.id ? `historyId=${item.id}&` : ''}path=${encodeURIComponent(item.relativePath || item.filePath || '')}`,
                            isLocal: true
                          }])}
                        >
                          {isPlayingThis && playing ? '⏸ ' + t('player.pause') : '▶ ' + t('common.local')}
                        </SlotBtn>
                        <SlotBtn onclick={() => onReveal({ id: item.songId || item.id, name: songTitle, artist, path: displayPath })}>
                          {t('common.reveal')}
                        </SlotBtn>
                        <button
                          type="button"
                          class="p-1 rounded-md text-[var(--text-muted)] hover:text-red-400 cursor-pointer border-none bg-transparent transition-colors"
                          onclick={() => handleDeleteHistory(item)}
                          title={t('download.removeFromHistoryTooltip')}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div class="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)] bg-[var(--card-bg)]">
          <button
            type="button"
            class="btn-secondary px-3 py-1 text-xs rounded-lg cursor-pointer"
            disabled={histPage <= 1}
            onclick={() => loadHistory(histPage - 1)}
          >
            {t('download.prevPage')}
          </button>
          <span class="text-xs text-[var(--text-secondary)]">
            {t('download.pageStats', { page: histPage, total: histTotalPages, count: histTotal })}
          </span>
          <button
            type="button"
            class="btn-secondary px-3 py-1 text-xs rounded-lg cursor-pointer"
            disabled={histPage >= histTotalPages}
            onclick={() => loadHistory(histPage + 1)}
          >
            {t('download.nextPage')}
          </button>
        </div>
      </div>
    {:else}
      <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 shadow-sm">
        <BrowserCacheSection {onPlayQueue} {showToast} />
      </div>
    {/if}
  </div>
</div>

<style>
  .custom-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scroll::-webkit-scrollbar-thumb {
    background: var(--border-color, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
  }
</style>
