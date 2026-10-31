<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { formatBytes, formatArtist, DEFAULT_VINYL_COVER, getApiCache, setApiCache } from '../lib/utils';
  import AccordionCard from './AccordionCard.svelte';
  import LocalSearchBox from './LocalSearchBox.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import FolderExplorer from './FolderExplorer.svelte';
  import BrowserCacheSection from './BrowserCacheSection.svelte';
  import SegmentedTabs, { type SegmentItem } from './sp/SegmentedTabs.svelte';
  import SwipeableTabsView from './sp/SwipeableTabsView.svelte';
  import DownloadAuditModal from './DownloadAuditModal.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { isSameTrack } from '../lib/trackStatus.svelte';
  import { t } from '../lib/i18n';
  import type { Track } from '../lib/types';

  let {
    curTrack = null,
    playing = false,
    onPlayQueue,
    onReveal,
    showToast = () => {}
  } = $props<{
    curTrack?: Track | null;
    playing?: boolean;
    onPlayQueue: (tracks: any[], idx?: number) => void;
    onReveal: (item: any) => void;
    showToast?: (m: string, t?: 'info' | 'success' | 'warning' | 'error', dur?: number) => void;
  }>();

  let mobileTab = $state<'folder' | 'history' | 'cache'>('history');
  const SUBTABS: ('folder' | 'history' | 'cache')[] = ['folder', 'history', 'cache'];
  let activeTabIndex = $derived(Math.max(0, SUBTABS.indexOf(mobileTab)));

  function setMobileTab(id: 'folder' | 'history' | 'cache') {
    mobileTab = id;
  }

  function handleSwipeIndexChange(newIndex: number) {
    const nextTab = SUBTABS[newIndex] || 'folder';
    setMobileTab(nextTab);
  }

  let histKw = $state('');
  let histPage = $state(1);
  let histList: any[] = $state([]);
  let histStats: any = $state(null);
  let histTotal = $state(0);
  let histTotalPages = $derived(Math.max(1, Math.ceil(histTotal / 10)));

  let scanExternalLoading = $state(false);
  let scanDiskLoading = $state(false);
  let externalResult = $state<any>(null);
  let diskResult = $state<any>(null);

  let modalType = $state<'missing' | 'nonMp3' | null>(null);
  let modalList = $state<any[]>([]);
  let modalLoading = $state(false);

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
      showToast(t('download.loadHistoryFailed', { error: e.message || e }), 'error');
    }
  }

  async function scanExternalLibraries() {
    scanExternalLoading = true;
    externalResult = null;
    try {
      const j = await api.historyScanExternal();
      if (j?.code === '000000') {
        externalResult = j.data;
        showToast(t('download.scanExternalDone'), 'success');
        loadHistory(1);
      } else {
        showToast(j?.msg || t('download.scanFailed'), 'warning');
      }
    } catch (e: any) {
      showToast(t('download.scanException', { error: e.message || e }), 'error');
    } finally {
      scanExternalLoading = false;
    }
  }

  async function scanDiskFiles() {
    scanDiskLoading = true;
    diskResult = null;
    try {
      const j = await api.historyScan();
      if (j?.code === '000000') {
        diskResult = j.data;
        showToast(t('download.diskCheckDone'), 'success');
        loadHistory(histPage);
      } else {
        showToast(j?.msg || t('download.scanFailed'), 'warning');
      }
    } catch (e: any) {
      showToast(t('download.diskCheckException', { error: e.message || e }), 'error');
    } finally {
      scanDiskLoading = false;
    }
  }

  async function importUntrackedFiles() {
    try {
      const j = await api.historyImportUntracked();
      if (j?.code === '000000') {
        showToast(t('download.importedUntrackedSuccess', { count: j.data }), 'success');
        diskResult = null;
        loadHistory(1);
      } else {
        showToast(j?.msg || t('download.importFailed'), 'warning');
      }
    } catch (e: any) {
      showToast(t('download.importException', { error: e.message || e }), 'error');
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
      showToast(t('download.cleanException', { error: e.message || e }), 'error');
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
      showToast(t('download.cleanException', { error: e.message || e }), 'error');
    }
  }

  async function deleteItem(id: number) {
    try {
      const j = await api.historyDelete(id);
      if (j?.code === '000000') {
        showToast(t('download.recordDeleted'), 'info');
        loadHistory(histPage);
      } else {
        showToast(j?.msg || t('download.deleteFailed'), 'warning');
      }
    } catch (e: any) {
      showToast(t('download.deleteException', { error: e.message || e }), 'error');
    }
  }

  async function openMissingModal() {
    modalType = 'missing';
    modalLoading = true;
    modalList = [];
    try {
      const j = await api.historyMissing();
      modalList = j?.data || [];
    } catch (e: any) {
      showToast(t('download.loadMissingListFailed', { error: e.message || e }), 'error');
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
      showToast(t('download.loadNonMp3ListFailed', { error: e.message || e }), 'error');
    } finally {
      modalLoading = false;
    }
  }

  function openTrackSheet(h: any) {
    const isPlayingThis = isSameTrack(curTrack, h);
    const artistName = h.artist || (h.artists ? formatArtist(h.artists) : '');

    openSheet({
      title: h.songName || h.name || t('common.unknownSong'),
      subtitle: artistName || t('download.localAudio'),
      actions: [
        {
          label: isPlayingThis && playing ? t('track.actionPauseDesktop') : t('track.actionPlayLocalFull'),
          style: 'primary',
          onclick: () => {
            onPlayQueue([{
              id: h.songId && h.songId > 0 ? h.songId : (h.id || `local_${Date.now()}`),
              name: h.songName || h.name,
              artist: artistName,
              album: h.album || t('download.localLibrary'),
              cover: h.cover || DEFAULT_VINYL_COVER,
              url: `/v3/history/stream?path=${encodeURIComponent(h.relativePath || h.filePath || '')}`,
              isLocal: true
            }]);
          }
        },
        {
          label: t('playlist.locateInDisk'),
          onclick: () => {
            onReveal({ id: h.songId || h.id, name: h.songName || h.name, artist: artistName, path: h.hostFilePath || h.filePath || h.path });
          }
        },
        {
          label: t('download.deleteFromHistory'),
          style: 'danger',
          onclick: () => deleteItem(h.id)
        }
      ]
    });
  }

  const mobileTabs: SegmentItem[] = $derived([
    { id: 'folder', label: t('download.tabLocal'), icon: '📁', accent: 'red' },
    { id: 'history', label: t('download.tabHistory'), icon: '📥', accent: 'blue' },
    { id: 'cache', label: t('download.tabCache'), icon: '📲', accent: 'emerald' }
  ]);
</script>

<div class="flex flex-col gap-2.5">
  <!-- Mobile Tab Segmented Switcher -->
  <SegmentedTabs
    items={mobileTabs}
    activeId={mobileTab}
    onChange={(id) => setMobileTab(id as any)}
  />

  <SwipeableTabsView
    activeIndex={activeTabIndex}
    count={3}
    onChange={handleSwipeIndexChange}
  >
    <div class="w-full">
      <AccordionCard title={t('download.accordionLocalTree')} flat open={true} accent="red">
        <FolderExplorer {onPlayQueue} {onReveal} {showToast} />
      </AccordionCard>
    </div>

    <div class="w-full">
      <AccordionCard title={t('download.accordionHistoryShort')} flat open={true} accent="blue">
      <div class="flex flex-wrap gap-2.5 bg-[var(--stat-bar-bg)] border border-[var(--border-subtle)] p-2.5 px-3.5 rounded-xl mb-2.5 items-center text-xs">
        <span class="text-[var(--text-secondary)]">{t('download.recordedDownloads', { count: histStats?.totalCount ?? histTotal ?? 0 })}</span>
        <span class="text-[var(--text-secondary)]">{t('download.diskSpaceUsed', { size: histStats?.totalSize ? formatBytes(histStats.totalSize) : '-' })}</span>
        {#if (histStats?.missingCount ?? 0) > 0}
          <button type="button" class="bg-transparent border-none p-0 cursor-pointer text-red-500 hover:underline text-left inline-flex items-center gap-1 font-normal text-[13px]" onclick={openMissingModal} title={t('download.modalTitleMissing')}>
            {t('download.missingCount', { count: histStats.missingCount })} <span class="text-[10px] border border-red-500/30 px-1 py-0.5 rounded-md">{t('download.viewArrow')}</span>
          </button>
        {/if}
        {#if (histStats?.nonMp3Count ?? 0) > 0}
          <button type="button" class="bg-transparent border-none p-0 cursor-pointer text-amber-500 hover:underline text-left inline-flex items-center gap-1 font-normal text-[13px]" onclick={openNonMp3Modal} title={t('download.modalTitleNonMp3')}>
            {t('download.nonMp3Format', { count: histStats.nonMp3Count })} <span class="text-[10px] border border-amber-500/30 px-1 py-0.5 rounded-md">{t('download.viewArrow')}</span>
          </button>
        {/if}
        <div class="ml-auto flex gap-1.5 flex-wrap">
          <button class="btn-secondary px-2.5 py-1 text-xs" onclick={scanExternalLibraries}>{t('download.btnExternal')}</button>
          <button class="btn-secondary px-2.5 py-1 text-xs" onclick={scanDiskFiles}>{t('download.btnAlignDisk')}</button>
          <button class="btn-secondary px-2.5 py-1 text-xs" onclick={cleanMissingRecords}>{t('download.btnCleanMissing')}</button>
          <button class="btn-secondary px-2.5 py-1 text-xs" onclick={() => loadHistory(1)}>🔄 {t('common.refresh')}</button>
        </div>
      </div>

      <!-- Scan result panels -->
      {#if scanExternalLoading || externalResult}
        <div class="bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-xl p-3 mb-2.5 text-xs flex flex-col gap-1.5">
          {#if scanExternalLoading}
            <div class="text-[var(--text-secondary)] text-center py-2.5">{t('download.scanningPleaseWait')}</div>
          {:else if externalResult}
            <div class="text-[var(--text-main)] font-bold text-sm mb-1">{t('download.externalScanFinished')}</div>
            <div class="text-[var(--text-main)]">{t('download.configuredDirsList', { dirs: (externalResult.configuredDirs || []).join(' ; ') || '-' })}</div>
            <div class="text-[var(--text-main)]">{t('download.totalScannedFiles', { count: externalResult.scannedFiles || 0 })}</div>
            <div class="text-[var(--text-main)]">{t('download.newlyIndexedCount', { count: externalResult.addedCount || 0 })}</div>
            <div class="text-[var(--text-secondary)] mt-1.5">{t('download.externalScanTip')}</div>
          {/if}
        </div>
      {/if}

      {#if scanDiskLoading || diskResult}
        <div class="bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-xl p-3 mb-2.5 text-xs flex flex-col gap-1.5">
          {#if scanDiskLoading}
            <div class="text-[var(--text-secondary)] text-center py-2.5">{t('download.scanningPleaseWait')}</div>
          {:else if diskResult}
            <div>
              <strong>{t('download.labelDbRecords')}</strong>{diskResult.totalRecords || 0} |
              <strong>{t('download.labelValidRecords')}</strong>{diskResult.validRecordsCount || 0} |
              <strong>{t('download.labelMissingRecords')}</strong><span class="text-red-500 font-semibold">{diskResult.missingCount || 0}</span> |
              <strong>{t('download.labelUntrackedRecords')}</strong><span class="text-red-500 font-semibold">{diskResult.untrackedCount || 0}</span>
            </div>
            {#if diskResult.untrackedCount > 0}
              <div class="flex items-center justify-between gap-2 mt-1 flex-wrap">
                <span class="text-[var(--text-main)]">{t('download.foundUntrackedNotice', { count: diskResult.untrackedCount })}</span>
                <button class="btn-primary px-2.5 py-1 text-xs" onclick={importUntrackedFiles}>{t('download.importToDb')}</button>
              </div>
              <ul class="text-[11px] text-[var(--text-secondary)] pl-4 max-h-24 overflow-y-auto">
                {#each (diskResult.untrackedFiles || []).slice(0, 5) as uf}
                  <li class="truncate">{uf}</li>
                {/each}
                {#if (diskResult.untrackedFiles || []).length > 5}
                  <li>{t('download.andMoreItems', { count: diskResult.untrackedFiles.length })}</li>
                {/if}
              </ul>
            {:else}
              <div class="text-[var(--text-main)] font-semibold">{t('download.allAlignedNotice')}</div>
            {/if}
          {/if}
        </div>
      {/if}

      <!-- Search Row -->
      <div class="flex gap-2 mb-2.5">
        <div class="flex-1 min-w-0">
          <LocalSearchBox
            bind:value={histKw}
            placeholder={t('download.searchHistoryAdvancedPlaceholder')}
            historyKey="wyyyy_history_search_history"
            onSearch={() => loadHistory(1)}
            onClear={() => loadHistory(1)}
          />
        </div>
        <button class="btn-primary shrink-0 whitespace-nowrap hidden md:inline-flex px-4 py-1.5 text-xs" onclick={() => loadHistory(1)}>
          {t('common.search')}
        </button>
      </div>

      <!-- History List -->
      <ul class="data-list divide-y divide-black/5 dark:divide-white/5 border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--card-bg)] m-0 p-0 list-none">
        {#each histList as h, idx (h.id || idx)}
          {@const isPlayingThis = isSameTrack(curTrack, h)}
          {@const artistName = h.artist || (h.artists ? formatArtist(h.artists) : '')}
          {@const displayPath = h.hostFilePath || h.filePath || h.path}
          <li class="flex justify-between items-center py-2 px-3 hover:bg-black/5 dark:hover:bg-white/5 transition-all group">
            <div class="flex-1 overflow-hidden min-w-0 pr-2">
              <div class="font-bold text-xs text-[var(--text-main)] truncate flex items-center">
                <span>{(histPage - 1) * 10 + idx + 1}. {h.songName || h.name || t('common.unknownSong')}</span>
                <span class="audio-source-badge icon-only badge-server ml-1.5" title={t('download.localDownloadedTooltip')}>🖥️</span>
                {#if h.fileExists === false}
                  <span class="text-[10px] bg-red-500/15 text-red-400 border border-red-500/30 px-1 py-0.5 rounded ml-1">{t('download.missingBadge')}</span>
                {/if}
              </div>
              <div class="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                {artistName} {h.fileSize ? `| ${formatBytes(h.fileSize)}` : ''}
              </div>
            </div>

            <!-- Desktop actions -->
            <div class="hidden md:inline-flex items-center gap-1.5 shrink-0">
              <SlotBtn
                playing={isPlayingThis && playing}
                onclick={() => onPlayQueue([{
                  id: h.songId && h.songId > 0 ? h.songId : (h.id || `local_${Date.now()}`),
                  name: h.songName || h.name,
                  artist: artistName,
                  album: h.album || t('download.localLibrary'),
                  cover: h.cover || DEFAULT_VINYL_COVER,
                  url: `/v3/history/stream?path=${encodeURIComponent(h.relativePath || h.filePath || '')}`,
                  isLocal: true
                }])}
              >
                {isPlayingThis && playing ? t('track.actionPlaying') : t('track.actionPlayShort')}
              </SlotBtn>
              <SlotBtn onclick={() => onReveal({ id: h.songId || h.id, name: h.songName || h.name, artist: artistName, path: displayPath })}>
                {t('common.reveal')}
              </SlotBtn>
              <SlotBtn onclick={() => deleteItem(h.id)} title={t('download.deleteFromHistory')}>
                {t('common.delete')}
              </SlotBtn>
            </div>

            <!-- Mobile actions -->
            <div class="inline-flex md:hidden items-center gap-1 shrink-0">
              <SlotBtn
                playing={isPlayingThis && playing}
                onclick={() => onPlayQueue([{
                  id: h.songId && h.songId > 0 ? h.songId : (h.id || `local_${Date.now()}`),
                  name: h.songName || h.name,
                  artist: artistName,
                  album: h.album || t('download.localLibrary'),
                  cover: h.cover || DEFAULT_VINYL_COVER,
                  url: `/v3/history/stream?path=${encodeURIComponent(h.relativePath || h.filePath || '')}`,
                  isLocal: true
                }])}
              >
                {isPlayingThis && playing ? t('track.actionPlaying') : t('track.actionPlayShort')}
              </SlotBtn>
              <button
                type="button"
                class="w-7 h-7 flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] cursor-pointer"
                onclick={() => openTrackSheet(h)}
                title={t('common.moreActions')}
                aria-label={t('common.moreActions')}
              >
                ···
              </button>
            </div>
          </li>
        {:else}
          <li class="p-5 text-center text-[var(--text-muted)] text-xs list-none">{t('download.noHistoryFound')}</li>
        {/each}
      </ul>

      <!-- Pagination -->
      <div class="flex justify-between items-center mt-3 text-xs text-[var(--text-secondary)] select-none">
        <button class="btn-secondary px-3 py-1 text-xs" disabled={histPage <= 1} onclick={() => loadHistory(histPage - 1)}>{t('download.prevPage')}</button>
        <span>{t('download.pageStats', { page: histPage, total: histTotalPages, count: histTotal })}</span>
        <button class="btn-secondary px-3 py-1 text-xs" disabled={histPage >= histTotalPages} onclick={() => loadHistory(histPage + 1)}>{t('download.nextPage')}</button>
      </div>
    </AccordionCard>
  </div>

  <div class="w-full">
    <BrowserCacheSection flat open={true} {onPlayQueue} {showToast} />
  </div>
</SwipeableTabsView>
</div>

<DownloadAuditModal
  {modalType}
  {modalList}
  {modalLoading}
  onClose={() => modalType = null}
  onCleanMissing={cleanMissingRecords}
  onCleanNonMp3={cleanNonMp3Records}
/>
