<script lang="ts">
  import { HardDrive, ChevronDown, Laptop, Smartphone, Loader2 } from '@lucide/svelte';
  import Modal from './Modal.svelte';
  import { t } from '../lib/i18n';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast.svelte';
  import { cacheTrackToBrowser } from '../lib/pwaCache.svelte';
  import { getTrackSourceStatus } from '../lib/player/trackStatus.svelte';
  import { isLocalPlaylist } from '../lib/localPlaylistStore.svelte';
  import { formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';
  import { openSheet, closeSheet } from '../lib/ui.svelte';

  interface Props {
    playlistId: string | number;
    playlistName?: string;
    allTracks?: any[];
    curTrack?: any;
    isLocal?: boolean;
    onDownloadAllToPc?: () => void;
    variant?: 'primary' | 'secondary';
    dropdownMode?: 'popover' | 'sheet' | 'auto';
    class?: string;
  }

  let {
    playlistId,
    playlistName = '',
    allTracks = [],
    curTrack = null,
    isLocal = false,
    onDownloadAllToPc,
    variant = 'secondary',
    dropdownMode = 'auto',
    class: className = ''
  }: Props = $props();

  let isOpen = $state(false);
  let isBatchCaching = $state(false);
  let showCancelConfirm = $state(false);
  let cacheProgress = $state({ current: 0, total: 0 });
  let dropdownEl = $state<HTMLElement | null>(null);
  let batchAbortController: AbortController | null = null;

  const btnClass = $derived(variant === 'primary' ? 'btn-primary' : 'btn-secondary');

  function handleWindowClick(e: MouseEvent) {
    if (isOpen && dropdownEl && !dropdownEl.contains(e.target as Node)) {
      isOpen = false;
    }
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (isOpen && e.key === 'Escape') {
      isOpen = false;
    }
  }

  function handleToggleDropdown(e: MouseEvent) {
    e.stopPropagation();
    if (isBatchCaching) return;

    const shouldUseSheet =
      dropdownMode === 'sheet' ||
      (dropdownMode === 'auto' && typeof window !== 'undefined' && window.innerWidth < 1024);

    if (shouldUseSheet) {
      openMobileSheet();
      return;
    }

    isOpen = !isOpen;
  }

  function openMobileSheet() {
    isOpen = false;
    openSheet({
      title: t('playlist.moreDownloadOptions'),
      subtitle: playlistName ? `《${playlistName}》` : undefined,
      actions: [
        {
          label: `${t('playlist.cachePcOnlyTitle')} (${t('playlist.cachePcOnlyBadge')})`,
          style: 'default',
          onclick: () => {
            closeSheet();
            handleBatchCache('pc-only');
          }
        },
        {
          label: t('playlist.cacheAllViaPcTitle'),
          style: 'default',
          onclick: () => {
            closeSheet();
            handleBatchCache('all');
          }
        },
        {
          label: t('playlist.downloadAllToPc'),
          style: 'default',
          onclick: () => {
            closeSheet();
            handleMainDownload();
          }
        }
      ]
    });
  }

  async function handleMainDownload() {
    if (isBatchCaching) {
      showCancelConfirm = true;
      return;
    }
    if (onDownloadAllToPc) {
      onDownloadAllToPc();
      return;
    }
    if (!playlistId) return;
    try {
      await api.downloadPlaylist(String(playlistId));
      showToast(t('playlist.submittedBatchDownload'), 'success', 2000);
      window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.requestFailed', { error: e?.message || e }), 'error');
    }
  }

  function confirmCancelBatchCache() {
    showCancelConfirm = false;
    batchAbortController?.abort();
  }

  async function handleBatchCache(mode: 'pc-only' | 'all') {
    isOpen = false;
    if (isBatchCaching) return;
    if (!allTracks || !allTracks.length) {
      showToast(t('playlist.noSongsToCache'), 'warning');
      return;
    }

    let targets = allTracks;
    if (mode === 'pc-only') {
      const isLocalPl = isLocalPlaylist(playlistId);
      targets = allTracks.filter((track) => {
        const artist = formatArtist(track);
        const status = getTrackSourceStatus(
          track.id,
          Boolean(track.isLocal && track.filePath),
          curTrack,
          isLocalPl,
          track.name,
          artist
        );
        return status.isServer;
      });

      if (!targets.length) {
        showToast(t('playlist.noPcTracksToCache'), 'warning', 3500);
        return;
      }
    } else {
      // 模式 2：先提交下载歌单到电脑，再批量尝试缓存到浏览器
      try {
        await api.downloadPlaylist(String(playlistId));
        window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
      } catch (err) {
        console.warn('Failed to submit playlist download to server:', err);
      }
    }

    const controller = new AbortController();
    batchAbortController = controller;
    isBatchCaching = true;
    showCancelConfirm = false;
    cacheProgress = { current: 0, total: targets.length };
    showToast(t('playlist.cachingBatchStart', { count: targets.length }), 'info', 2000);

    let successCount = 0;
    for (let i = 0; i < targets.length; i++) {
      if (controller.signal.aborted) break;
      const track = targets[i];
      cacheProgress = { current: i + 1, total: targets.length };
      try {
        const artist = formatArtist(track);
        const res = await cacheTrackToBrowser(
          {
            id: track.id,
            name: track.name,
            artist,
            cover: track.al?.picUrl || DEFAULT_VINYL_COVER,
            album: track.al?.name || track.album
          },
          { signal: controller.signal }
        );
        if (controller.signal.aborted) break;
        if (res.success) {
          successCount++;
        }
      } catch (err) {
        if (controller.signal.aborted) break;
      }
    }

    const wasCancelled = controller.signal.aborted;
    if (batchAbortController === controller) {
      batchAbortController = null;
    }
    isBatchCaching = false;
    showCancelConfirm = false;
    showToast(
      wasCancelled
        ? t('playlist.cachingBatchCancelled', { success: successCount, total: targets.length })
        : t('playlist.cachingBatchComplete', { success: successCount, total: targets.length }),
      wasCancelled ? 'info' : successCount > 0 ? 'success' : 'warning',
      3500
    );
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div
  bind:this={dropdownEl}
  class="relative inline-flex items-stretch rounded-xl shadow-sm {isOpen ? 'z-50' : 'z-auto'} {className}"
  data-testid="playlist-download-dropdown"
>
  <button
    type="button"
    data-testid="btn-detail-download-all"
    class="{btnClass} flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-l-xl rounded-r-none text-xs font-semibold cursor-pointer border-r-0 shrink-0"
    onclick={handleMainDownload}
    title={isBatchCaching ? t('playlist.clickToCancelBatchCache') : t('playlist.downloadAllToPc')}
  >
    {#if isBatchCaching}
      <Loader2 size={13} class="animate-spin text-red-500" />
      <span>{t('playlist.batchCachingInProgress', { current: cacheProgress.current, total: cacheProgress.total })}</span>
    {:else}
      <HardDrive size={13} class="shrink-0" />
      <span class="hidden sm:inline">{t('playlist.downloadAllToPc')}</span>
      <span class="inline sm:hidden">{t('playlist.downloadAllToPcShort')}</span>
    {/if}
  </button>

  <button
    type="button"
    data-testid="btn-detail-download-menu-toggle"
    class="{btnClass} {variant === 'primary' ? 'split-primary-toggle' : ''} px-2 py-1.5 rounded-r-xl rounded-l-none text-xs font-semibold cursor-pointer border-l border-black/15 dark:border-white/20 flex items-center justify-center transition-all shrink-0"
    onclick={handleToggleDropdown}
    disabled={isBatchCaching}
    title={t('playlist.moreDownloadOptions')}
    aria-label={t('playlist.moreDownloadOptions')}
    aria-expanded={isOpen}
  >
    <ChevronDown size={13} class="transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" />
  </button>

  {#if isOpen}
    <div
      class="absolute left-0 top-full mt-1.5 w-68 sm:w-72 p-1.5 rounded-xl bg-[var(--card-bg-solid,#111827)] border border-[var(--border-color)] shadow-2xl ring-1 ring-black/10 dark:ring-white/10 z-50 flex flex-col gap-1 animate-fade-in"
      role="menu"
    >
      <!-- 选项 1：仅电脑已有 (💻) -->
      <button
        type="button"
        data-testid="btn-cache-pc-only"
        class="w-full text-left p-2 rounded-lg hover:bg-[var(--card-header-hover)] transition-colors flex items-start gap-2.5 cursor-pointer text-xs group"
        onclick={() => handleBatchCache('pc-only')}
      >
        <div class="mt-0.5 p-1 rounded-md bg-emerald-500/10 text-emerald-400 shrink-0">
          <Laptop size={14} />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-[var(--text-main)] flex items-center gap-1.5">
            <span>{t('playlist.cachePcOnlyTitle')}</span>
            <span class="text-[10px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-normal shrink-0">
              {t('playlist.cachePcOnlyBadge')}
            </span>
          </div>
          <div class="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
            {t('playlist.cachePcOnlyDesc')}
          </div>
        </div>
      </button>

      <!-- 选项 2：先下到电脑再缓存全部 -->
      <button
        type="button"
        data-testid="btn-cache-all-via-pc"
        class="w-full text-left p-2 rounded-lg hover:bg-[var(--card-header-hover)] transition-colors flex items-start gap-2.5 cursor-pointer text-xs group"
        onclick={() => handleBatchCache('all')}
      >
        <div class="mt-0.5 p-1 rounded-md bg-blue-500/10 text-blue-400 shrink-0">
          <Smartphone size={14} />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-[var(--text-main)] flex items-center gap-1.5">
            <span>{t('playlist.cacheAllViaPcTitle')}</span>
          </div>
          <div class="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
            {t('playlist.cacheAllViaPcDesc')}
          </div>
        </div>
      </button>
    </div>
  {/if}
</div>

{#if showCancelConfirm && isBatchCaching}
  <Modal
    title={t('playlist.cancelBatchCacheTitle')}
    icon="⚠️"
    maxWidth="max-w-[420px]"
    onClose={() => { showCancelConfirm = false; }}
  >
    <p class="text-xs text-[var(--text-secondary)] leading-relaxed m-0">
      {t('playlist.cancelBatchCacheDesc', { current: cacheProgress.current, total: cacheProgress.total })}
    </p>

    {#snippet footer()}
      <button
        type="button"
        data-testid="btn-cancel-cache-continue"
        class="btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
        onclick={() => { showCancelConfirm = false; }}
      >
        {t('playlist.continueCaching')}
      </button>
      <button
        type="button"
        data-testid="btn-cancel-cache-confirm"
        class="px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer text-white bg-red-600 hover:bg-red-500 active:scale-95 transition-all shadow-sm border-none"
        onclick={confirmCancelBatchCache}
      >
        {t('playlist.confirmCancelCaching')}
      </button>
    {/snippet}
  </Modal>
{/if}

<style>
  :global(.split-primary-toggle) {
    background: var(--btn-primary-bg) !important;
    color: var(--btn-primary-color) !important;
  }
  :global(.split-primary-toggle:hover) {
    background: var(--btn-primary-bg) !important;
    filter: brightness(1.08) !important;
  }
  :global(.split-primary-toggle:active) {
    background: var(--btn-primary-bg) !important;
    filter: brightness(0.92) !important;
  }
</style>
