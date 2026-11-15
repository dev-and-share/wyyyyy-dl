<script lang="ts">
  import { onMount } from 'svelte';
  import FolderExplorer from '../FolderExplorer.svelte';
  import BrowserCacheSection from '../BrowserCacheSection.svelte';
  import LocalPlaylistsSection from '../LocalPlaylistsSection.svelte';
  import DesktopTaskQueueWorkbench from './DesktopTaskQueueWorkbench.svelte';
  import DesktopHistorySection from './DesktopHistorySection.svelte';
  import DesktopViewHeader from './DesktopViewHeader.svelte';
  import DownloadAuditModal from '../DownloadAuditModal.svelte';
  import { Folder, Download, FolderArchive, Smartphone, Zap, AlertTriangle, Save } from '@lucide/svelte';
  import { api } from '../../lib/api';
  import { t } from '../../lib/i18n';
  import { formatBytes, getApiCache, setApiCache } from '../../lib/utils';
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

  let modalType = $state<'missing' | 'nonMp3' | null>(null);
  let modalList = $state<any[]>([]);
  let modalLoading = $state(false);

  async function openMissingModal() {
    modalType = 'missing';
    modalLoading = true;
    modalList = [];
    try {
      const j = await api.historyMissing();
      modalList = j?.data || [];
    } catch (e: any) {
      showToast(t('download.loadMissingListFailed', { error: e?.message || e }), 'error');
    } finally {
      modalLoading = false;
    }
  }

  async function openNonMp3Modal() {
    modalType = 'nonMp3';
    modalLoading = true;
    modalList = [];
    try {
      const j = await api.historyNonMp3();
      modalList = j?.data || [];
    } catch (e: any) {
      showToast(t('download.loadNonMp3ListFailed', { error: e?.message || e }), 'error');
    } finally {
      modalLoading = false;
    }
  }

  async function cleanMissingRecords() {
    try {
      const j = await api.historyCleanMissing();
      if (j?.code === '000000') {
        showToast(t('download.cleanMissingSuccess', { count: j.data }), 'success');
        if (modalType === 'missing') modalType = null;
        loadHistory(1);
      } else {
        showToast(j?.msg || t('download.cleanFailed'), 'warning');
      }
    } catch (e: any) {
      showToast(t('download.cleanException', { error: e?.message || e }), 'error');
    }
  }

  async function cleanNonMp3Records() {
    try {
      const j = await api.historyCleanNonMp3();
      if (j?.code === '000000') {
        showToast(t('download.cleanNonMp3Success', { count: j.data }), 'success');
        if (modalType === 'nonMp3') modalType = null;
        loadHistory(1);
      } else {
        showToast(j?.msg || t('download.cleanFailed'), 'warning');
      }
    } catch (e: any) {
      showToast(t('download.cleanException', { error: e?.message || e }), 'error');
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
          <Folder size={14} /> <span>本地歌单</span>
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
          <Download size={14} /> <span>{t('download.tabHistory')}</span>
        </button>
        <button
          type="button"
          data-testid="subtab-folder"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {subTab === 'folder' ? 'bg-sky-600 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => { subTab = 'folder'; routerState.downloadSubTab = 'folder'; }}
        >
          <FolderArchive size={14} /> <span>{t('download.localLibrary')}</span>
        </button>
        <button
          type="button"
          data-testid="subtab-cache"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {subTab === 'browser-cache' ? 'bg-red-500 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => { subTab = 'browser-cache'; routerState.downloadSubTab = 'browser-cache'; }}
        >
          <Smartphone size={14} /> <span>{t('artist.offlineCache')}</span>
        </button>
        <button
          type="button"
          data-testid="subtab-tasks"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {subTab === 'tasks' ? 'bg-red-500 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => { subTab = 'tasks'; routerState.downloadSubTab = 'tasks'; }}
        >
          <Zap size={14} /> <span>{t('drawer.tasksTab')}</span>
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
      <span class="text-[var(--text-secondary)] inline-flex items-center gap-1.5">
        <Save size={13} class="text-emerald-500" />
        <span>{t('download.recordedDownloads', { count: histStats?.totalCount ?? histTotal ?? 0 })}</span>
      </span>
      {#if (histStats?.missingCount ?? 0) > 0}
        <button
          type="button"
          class="bg-transparent border-none p-0 cursor-pointer text-red-500 hover:underline text-left inline-flex items-center gap-1 font-normal text-xs"
          onclick={openMissingModal}
          title={t('download.modalTitleMissing')}
        >
          <AlertTriangle size={12} />
          <span>{t('download.missingCount', { count: histStats.missingCount })}</span>
          <span class="text-[10px] border border-red-500/30 px-1 py-0.5 rounded-md">{t('download.viewArrow')}</span>
        </button>
      {/if}
      {#if (histStats?.nonMp3Count ?? 0) > 0}
        <button
          type="button"
          data-testid="btn-nonmp3-modal"
          class="bg-transparent border-none p-0 cursor-pointer text-amber-500 hover:underline text-left inline-flex items-center gap-1 font-normal text-xs"
          onclick={openNonMp3Modal}
          title={t('download.modalTitleNonMp3')}
        >
          <span>{t('download.nonMp3Format', { count: histStats.nonMp3Count })}</span>
          <span class="text-[10px] border border-amber-500/30 px-1 py-0.5 rounded-md">{t('download.viewArrow')}</span>
        </button>
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
      <DesktopHistorySection
        {curTrack}
        {playing}
        {histList}
        {loadingHistory}
        {histPage}
        {histTotalPages}
        {histTotal}
        bind:histKw
        onSearch={() => loadHistory(1)}
        onPageChange={(p) => loadHistory(p)}
        onDeleteHistory={handleDeleteHistory}
        {onPlayQueue}
        {onReveal}
      />
    {:else if subTab === 'folder'}
      <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 shadow-sm flex flex-col gap-3">
        <div class="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
          <div class="flex items-center gap-2">
            <Folder size={16} class="text-sky-500" />
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

<DownloadAuditModal
  {modalType}
  {modalList}
  {modalLoading}
  onClose={() => (modalType = null)}
  onCleanMissing={cleanMissingRecords}
  onCleanNonMp3={cleanNonMp3Records}
/>

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
