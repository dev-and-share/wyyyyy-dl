<script lang="ts">
  import { onMount } from 'svelte';
  import FolderExplorer from '../FolderExplorer.svelte';
  import LocalSearchBox from '../LocalSearchBox.svelte';
  import BrowserCacheSection from '../BrowserCacheSection.svelte';
  import LocalPlaylistsSection from '../LocalPlaylistsSection.svelte';
  import DesktopTaskQueueWorkbench from './DesktopTaskQueueWorkbench.svelte';
  import DesktopViewHeader from './DesktopViewHeader.svelte';
  import SlotBtn from '../SlotBtn.svelte';
  import { api } from '../../lib/api';
  import { t } from '../../lib/i18n';
  import { formatBytes, formatArtist, DEFAULT_VINYL_COVER, getApiCache, setApiCache } from '../../lib/utils';
  import { isSameTrack } from '../../lib/trackStatus.svelte';
  import { taskState, getActiveDownloadingCount } from '../../lib/taskStore.svelte';
  import { localPlaylistState } from '../../lib/localPlaylistStore.svelte';
  import { routerState } from '../../lib/router.svelte';
  import type { Track } from '../../lib/types';

  let {
    curTrack = null,
    playing = false,
    tasksTrigger = 0,
    onPlayQueue,
    onPlaylist,
    onReveal,
    showToast
  } = $props<{
    curTrack?: Track | null;
    playing?: boolean;
    tasksTrigger?: number;
    onPlayQueue: (tracks: any[], idx?: number) => void;
    onPlaylist?: (id: string) => void;
    onReveal: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let subTab = $state<'local-playlists' | 'history' | 'folder' | 'browser-cache' | 'tasks'>(
    routerState.downloadSubTab || 'local-playlists'
  );
  let activeTasksCount = $derived(getActiveDownloadingCount());

  // ⚡ 仅当从外部/侧边栏点击数字角标或路由指定时，自动切换至对应 SubTab
  let lastTasksTrigger = 0;
  let lastDownloadSubTab: any = routerState.downloadSubTab || 'local-playlists';
  $effect(() => {
    const trigger = tasksTrigger || routerState.downloadTasksTrigger || 0;
    if (trigger > 0 && trigger !== lastTasksTrigger) {
      lastTasksTrigger = trigger;
      subTab = 'tasks';
    } else if (routerState.downloadSubTab && routerState.downloadSubTab !== lastDownloadSubTab) {
      lastDownloadSubTab = routerState.downloadSubTab;
      subTab = routerState.downloadSubTab;
    }
  });
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
<div class="flex flex-col gap-4 w-full select-none animate-fade-in" data-testid="desktop-download-mgr-view">
  <!-- 1. 统一桌面 Header：本地曲库大标题 + 下载容量 Badge + 统一规格 Sub-Tabs 胶囊 -->
  <DesktopViewHeader
    icon="📥"
    title={t('sidebar.localAndDownload')}
    badge={`${histStats?.totalCount ?? histTotal ?? 0} 首 · ${histStats?.totalSize ? formatBytes(histStats.totalSize) : '-'}`}
    badgeType="default"
  >
    {#snippet actions()}
      <div class="flex items-center gap-1.5 p-1 rounded-xl bg-black/10 dark:bg-white/5 border border-[var(--border-subtle)] shrink-0 overflow-x-auto max-w-full">
        <button
          type="button"
          data-testid="subtab-local-playlists"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {subTab === 'local-playlists' ? 'bg-emerald-600 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => { subTab = 'local-playlists'; routerState.downloadSubTab = 'local-playlists'; }}
        >
          <span>📁</span> <span>本地歌单</span>
          {#if localPlaylistState.playlists.length > 0}
            <span class="text-[10px] px-1.5 py-0.2 rounded-full {subTab === 'local-playlists' ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10 text-[var(--text-muted)]'}">
              {localPlaylistState.playlists.length}
            </span>
          {/if}
        </button>
        <button
          type="button"
          data-testid="subtab-history"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {subTab === 'history' ? 'bg-red-500 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => { subTab = 'history'; routerState.downloadSubTab = 'history'; }}
        >
          <span>📥</span> <span>{t('download.tabHistory')}</span>
        </button>
        <button
          type="button"
          data-testid="subtab-folder"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {subTab === 'folder' ? 'bg-sky-600 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => { subTab = 'folder'; routerState.downloadSubTab = 'folder'; }}
        >
          <span>🗂️</span> <span>{t('download.localLibrary')}</span>
        </button>
        <button
          type="button"
          data-testid="subtab-cache"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {subTab === 'browser-cache' ? 'bg-red-500 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => { subTab = 'browser-cache'; routerState.downloadSubTab = 'browser-cache'; }}
        >
          <span>📱</span> <span>{t('artist.offlineCache')}</span>
        </button>
        <button
          type="button"
          data-testid="subtab-tasks"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {subTab === 'tasks' ? 'bg-red-500 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => { subTab = 'tasks'; routerState.downloadSubTab = 'tasks'; }}
        >
          <span>⚡</span> <span>{t('drawer.tasksTab')}</span>
          {#if activeTasksCount > 0}
            <span class="bg-red-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold leading-none animate-pulse">
              {activeTasksCount}
            </span>
          {:else if taskState.tasks.length > 0}
            <span class="text-[10px] px-1.5 py-0.2 rounded-full {subTab === 'tasks' ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10 text-[var(--text-muted)]'}">
              {taskState.tasks.length}
            </span>
          {/if}
        </button>
      </div>
    {/snippet}
  </DesktopViewHeader>

  <!-- 2. 状态与维护工具条 -->
  <div class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] shadow-sm text-xs">
    <div class="flex items-center gap-3 flex-wrap">
      {#if (histStats?.missingCount ?? 0) > 0}
        <span class="text-amber-400 font-medium bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
          ⚠️ {t('download.missingCount', { count: histStats.missingCount })}
        </span>
      {:else}
        <span class="text-[var(--text-secondary)]">
          💾 {t('download.recordedDownloads', { count: histStats?.totalCount ?? histTotal ?? 0 })}
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

  <!-- 3. Content Area -->
    {#if subTab === 'local-playlists'}
      <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 shadow-sm">
        <LocalPlaylistsSection {onPlayQueue} onViewPlaylist={onPlaylist} {showToast} />
      </div>
    {:else if subTab === 'history'}
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
    {:else if subTab === 'folder'}
      <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 shadow-sm flex flex-col gap-3">
        <div class="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
          <div class="flex items-center gap-2">
            <span class="text-base">📁</span>
            <h2 class="font-bold text-sm text-[var(--text-main)]">{t('download.localLibraryAndTree')}</h2>
          </div>
          <span class="text-[10px] text-[var(--text-muted)]">{t('download.clickToExpandPlay')}</span>
        </div>

        <div class="max-h-[calc(100vh-280px)] min-h-[400px] overflow-y-auto overflow-x-auto custom-scroll pr-1">
          <FolderExplorer {onPlayQueue} {onReveal} {showToast} />
        </div>
      </div>
    {:else if subTab === 'browser-cache'}
      <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 shadow-sm">
        <BrowserCacheSection {onPlayQueue} {showToast} />
      </div>
    {:else if subTab === 'tasks'}
      <DesktopTaskQueueWorkbench {onReveal} {showToast} />
    {/if}
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
