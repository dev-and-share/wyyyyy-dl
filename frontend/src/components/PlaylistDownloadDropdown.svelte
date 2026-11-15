<script lang="ts">
  import { HardDrive, ChevronDown, Laptop, Smartphone, Loader2 } from '@lucide/svelte';
  import { t } from '../lib/i18n';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast.svelte';
  import { cacheTrackToBrowser } from '../lib/pwaCache.svelte';
  import { getTrackSourceStatus } from '../lib/player/trackStatus.svelte';
  import { isLocalPlaylist } from '../lib/localPlaylistStore.svelte';
  import { formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';

  interface Props {
    playlistId: string | number;
    playlistName?: string;
    allTracks?: any[];
    curTrack?: any;
    isLocal?: boolean;
    onDownloadAllToPc?: () => void;
    variant?: 'primary' | 'secondary';
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
    class: className = ''
  }: Props = $props();

  let isOpen = $state(false);
  let isBatchCaching = $state(false);
  let cacheProgress = $state({ current: 0, total: 0 });
  let dropdownEl = $state<HTMLElement | null>(null);
  let menuPos = $state<{ top: number; left: number }>({ top: 0, left: 0 });

  const btnClass = $derived(variant === 'primary' ? 'btn-primary' : 'btn-secondary');

  function updateMenuPosition() {
    if (!dropdownEl || typeof window === 'undefined') return;
    const rect = dropdownEl.getBoundingClientRect();
    const menuWidth = Math.min(288, window.innerWidth - 16);
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8);
    }
    menuPos = {
      top: rect.bottom + 6,
      left: Math.max(8, left)
    };
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (isOpen && e.key === 'Escape') {
      isOpen = false;
    }
  }

  function handleToggleDropdown(e: MouseEvent) {
    e.stopPropagation();
    if (isBatchCaching) return;

    if (!isOpen) {
      updateMenuPosition();
      isOpen = true;
    } else {
      isOpen = false;
    }
  }

  async function handleMainDownload() {
    if (isBatchCaching) return;
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

    isBatchCaching = true;
    cacheProgress = { current: 0, total: targets.length };
    showToast(t('playlist.cachingBatchStart', { count: targets.length }), 'info', 2000);

    let successCount = 0;
    for (let i = 0; i < targets.length; i++) {
      const track = targets[i];
      cacheProgress = { current: i + 1, total: targets.length };
      try {
        const artist = formatArtist(track);
        const res = await cacheTrackToBrowser({
          id: track.id,
          name: track.name,
          artist,
          cover: track.al?.picUrl || DEFAULT_VINYL_COVER,
          album: track.al?.name || track.album
        });
        if (res.success) {
          successCount++;
        }
      } catch (err) {
        // continue
      }
    }

    isBatchCaching = false;
    showToast(
      t('playlist.cachingBatchComplete', { success: successCount, total: targets.length }),
      successCount > 0 ? 'success' : 'warning',
      3500
    );
  }
</script>

<svelte:window
  onkeydown={handleWindowKeydown}
  onresize={() => { if (isOpen) isOpen = false; }}
  onscroll={() => { if (isOpen) isOpen = false; }}
/>

<div
  bind:this={dropdownEl}
  class="relative inline-flex items-stretch rounded-xl shadow-sm {className}"
  data-testid="playlist-download-dropdown"
>
  <button
    type="button"
    data-testid="btn-detail-download-all"
    class="{btnClass} flex items-center gap-1.5 px-3.5 py-1.5 rounded-l-xl rounded-r-none text-xs font-semibold cursor-pointer border-r-0"
    onclick={handleMainDownload}
    disabled={isBatchCaching}
    title={t('playlist.downloadAllToPc')}
  >
    {#if isBatchCaching}
      <Loader2 size={13} class="animate-spin text-red-500" />
      <span>{t('playlist.batchCachingInProgress', { current: cacheProgress.current, total: cacheProgress.total })}</span>
    {:else}
      <HardDrive size={13} />
      <span>{t('playlist.downloadAllToPc')}</span>
    {/if}
  </button>

  <button
    type="button"
    data-testid="btn-detail-download-menu-toggle"
    class="{btnClass} px-2 py-1.5 rounded-r-xl rounded-l-none text-xs font-semibold cursor-pointer border-l border-[var(--border-subtle)] flex items-center justify-center transition-colors"
    onclick={handleToggleDropdown}
    disabled={isBatchCaching}
    title={t('playlist.moreDownloadOptions')}
    aria-label={t('playlist.moreDownloadOptions')}
    aria-expanded={isOpen}
  >
    <ChevronDown size={13} class="transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" />
  </button>
</div>

{#if isOpen}
  <!-- 全局透明点击遮罩：点击任意处立刻收起菜单 -->
  <div
    class="fixed inset-0 z-[9990] bg-transparent cursor-default"
    onclick={(e) => {
      e.stopPropagation();
      isOpen = false;
    }}
    aria-hidden="true"
  ></div>

  <!-- 浮层菜单：固定定位 (Fixed Popover)，跨越所有父容器 overflow/z-index 限制，SP 与 PC 统一样式 -->
  <div
    class="fixed z-[9995] w-68 sm:w-72 p-1.5 rounded-xl bg-[var(--card-bg-solid,#111827)] border border-[var(--border-color)] shadow-2xl ring-1 ring-black/10 dark:ring-white/10 flex flex-col gap-1 animate-fade-in"
    style="top: {menuPos.top}px; left: {menuPos.left}px;"
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
