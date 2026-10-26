<script lang="ts">
  import { tick } from 'svelte';
  import {
    allTracks,
    getFilteredTracks,
    pageSize,
    getTotalPages,
    getPlaylist,
    getPlaylistSearchKeyword,
    loadPlaylistDetail,
    recordPlaylistPlay
  } from '../../lib/playlist.svelte';
  import { api } from '../../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER, formatCoverUrl } from '../../lib/utils';
  import PlaylistTrackFilter from '../PlaylistTrackFilter.svelte';
  import SlotBtn from '../SlotBtn.svelte';
  import TrackLikeBtn from '../TrackLikeBtn.svelte';
  import TrackSourceBadge from '../TrackSourceBadge.svelte';
  import AddToPlaylistModal from '../AddToPlaylistModal.svelte';
  import ForkPlaylistModal from '../ForkPlaylistModal.svelte';
  import RemoveFromPlaylistModal from '../RemoveFromPlaylistModal.svelte';
  import { cacheTrackToBrowser } from '../../lib/pwaCache.svelte';
  import { getTrackSourceStatus, getTrackPlayActionLabel, markSongDownloaded, isSameTrack } from '../../lib/trackStatus.svelte';
  import { t } from '../../lib/i18n';

  let {
    playlistId, playlistTrigger = 0, curTrack = null, playing = false, likedSet,
    downloadedSet = new Set<number>(), onBackToGallery, onToggleLike, onPlayQueue,
    onAlbum, onReveal, showToast
  } = $props<{
    playlistId: string; playlistTrigger?: number; curTrack?: any; playing?: boolean;
    likedSet: Set<number>; downloadedSet?: Set<number>; onBackToGallery: () => void;
    onToggleLike: (id: number, name: string) => void; onPlayQueue: (tracks: any[], optionsOrIdx?: any) => void;
    onAlbum?: (albumId: string) => void; onReveal?: (item: any) => void; showToast: (m: string, t?: string) => void;
  }>();

  let desktopCurPage = $state(1);
  let filteredTracks = $derived(getFilteredTracks());
  let totalPages = $derived(Math.max(1, Math.ceil(filteredTracks.length / pageSize)));
  let hasMore = $derived(desktopCurPage < totalPages);
  let paged = $derived(filteredTracks.slice(0, desktopCurPage * pageSize));
  let playlist = $derived(getPlaylist());

  let sentinelEl = $state<HTMLElement | null>(null);
  let isLoadingNext = $state(false);

  function loadNextPage() {
    if (!hasMore || isLoadingNext) return;
    isLoadingNext = true;
    desktopCurPage = Math.min(totalPages, desktopCurPage + 1);
    tick().then(() => {
      isLoadingNext = false;
      checkSentinel();
    });
  }

  function checkSentinel() {
    if (!sentinelEl || !hasMore || isLoadingNext) return;
    const rect = sentinelEl.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top <= vh + 200) {
      loadNextPage();
    }
  }

  let prevKeyword = $state(getPlaylistSearchKeyword());
  $effect(() => {
    const kw = getPlaylistSearchKeyword();
    if (kw !== prevKeyword) {
      prevKeyword = kw;
      desktopCurPage = 1;
    }
  });

  $effect(() => {
    if (desktopCurPage > totalPages) {
      desktopCurPage = Math.max(1, totalPages);
    }
  });

  $effect(() => {
    if (!sentinelEl || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting) {
        loadNextPage();
      }
    }, {
      rootMargin: '200px'
    });

    observer.observe(sentinelEl);

    const scrollParent = sentinelEl.closest('.app-main-container') || window;
    const onScroll = () => checkSentinel();
    scrollParent.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    checkSentinel();

    return () => {
      observer.disconnect();
      scrollParent.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  });

  let downloadedCount = $derived(
    allTracks.filter((t: any) => (downloadedSet && downloadedSet.has(Number(t.id))) || t.isLocal === true).length
  );
  let pendingCount = $derived(Math.max(0, allTracks.length - downloadedCount));

  let isCurrentPlaylistLoaded = $derived(
    !!playlist && String(playlist.id) === String(playlistId)
  );

  let loadError = $state('');
  let showForkModal = $state(false);
  let cachingTrackId = $state<number | null>(null);
  let addToPlaylistSong = $state<{ id: number; name: string; artist: string } | null>(null);
  let removingTrack = $state<{ id: number | string; name: string; artist?: string } | null>(null);
  let lastSeenTrigger = -1;
  let lastSeenId = '';

  $effect(() => {
    const curId = playlistId;
    const curTrig = playlistTrigger;
    if (curId && (curId !== lastSeenId || curTrig !== lastSeenTrigger)) {
      lastSeenId = curId;
      lastSeenTrigger = curTrig;
      desktopCurPage = 1;
      loadData(curId);
    }
  });

  async function loadData(id: string, force = false) {
    if (!id) return;
    loadError = '';
    try {
      await loadPlaylistDetail(id, force);
    } catch (e: any) {
      loadError = e?.message || t('playlist.getDetailFailed');
      showToast(loadError, 'error');
    }
  }

  async function handlePlayAll() {
    if (!allTracks.length) return;
    if (playlist?.id) recordPlaylistPlay(playlist.id);
    const queue = allTracks.map((item: any) => {
      const status = getTrackSourceStatus(item.id, item.isLocal, curTrack);
      return {
        id: item.id,
        name: item.name,
        artist: formatArtist(item),
        cover: item.al?.picUrl || DEFAULT_VINYL_COVER,
        isLocal: status.isLocal
      };
    });
    onPlayQueue(queue, { startIndex: 0, playlistId: playlist?.id, isExplicitTrack: false });
    showToast(t('playlist.playingPlaylistToast', { name: playlist?.name || t('playlist.title'), count: queue.length }), 'success', 2000);
  }

  async function handleDownloadAll() {
    if (!playlistId) return;
    try {
      await api.downloadPlaylist(playlistId);
      showToast(t('playlist.submittedBatchDownload'), 'success', 2000);
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.requestFailed', { error: e?.message || e }), 'error');
    }
  }

  async function handleDownloadSingle(id: string, name?: string) {
    try {
      const res = await api.downloadSingle(id);
      const task = res?.data;
      const songName = task?.name || name || t('common.unknownSong');
      if (task?.status === 'SKIP') {
        const msg = task.errorMsg || '';
        if (msg.includes('已存在') || msg.includes('磁盘中')) { // i18n-ignore: backend status check
          markSongDownloaded(id);
          showToast(t('download.alreadyInDiskSynced', { name: songName }), 'info', 3000);
        } else {
          showToast(t('download.skippedWithName', { name: songName, reason: msg || t('download.skipReasonPreviewOrExist') }), 'warning', 4000);
        }
      } else if (task?.status === 'FAILED') {
        showToast(t('download.failedWithName', { name: songName, reason: task.errorMsg || t('download.failReasonExecuteError') }), 'error', 4000);
      } else {
        showToast(t('download.submitSuccessWithName', { name: songName }), 'info', 2000);
      }
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.requestFailed', { error: e?.message || e }), 'error');
    }
  }

  async function handleCache(item: any) {
    cachingTrackId = item.id;
    try {
      const res = await cacheTrackToBrowser({
        id: item.id,
        name: item.name,
        artist: formatArtist(item),
        cover: item.al?.picUrl || DEFAULT_VINYL_COVER,
        album: item.al?.name || item.album
      });
      showToast(res.msg || (res.success ? t('search.cachedToBrowser') : t('common.failed')), res.success ? 'success' : 'error');
    } catch (e: any) {
      showToast(t('search.cacheFailedWithMsg', { message: e?.message || e }), 'error');
    } finally {
      cachingTrackId = null;
    }
  }

  async function handleToggleSubscribe() {
    if (!playlist?.id) return;
    const nextSub = !playlist.subscribed;
    try {
      const res = await api.playlistSubscribe(String(playlist.id), nextSub);
      if (res?.code && res.code !== '000000') {
        showToast(res.msg || (nextSub ? t('playlist.subscribeFailedRiskPrompt') : t('playlist.unsubscribeFailed')), 'warning', 5000);
        return;
      }
      playlist.subscribed = nextSub;
      showToast(nextSub ? t('playlist.subscribedSuccess', { name: playlist.name }) : t('playlist.unsubscribedSuccess', { name: playlist.name }), 'success');
      window.dispatchEvent(new CustomEvent('wyyyy:playlist-created'));
    } catch (e: any) {
      showToast(t('playlist.operateExceptionPrompt'), 'warning', 4000);
    }
  }

  function handleForkSuccess(newId: string) {
    if (newId) {
      loadData(newId);
    }
  }
</script>

<!-- 🖥️ PC 桌面端：歌单详情宽屏大表 (Detail View) -->
<div class="flex flex-col gap-2.5 select-none animate-fade-in" data-testid="desktop-playlist-detail">
  <!-- 1. 顶部面包屑导航 (与右上角控制胶囊平齐在同一行) -->
  <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)] min-h-[34px] pr-[215px]">
    <button
      type="button"
      data-testid="btn-back-gallery"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-main)] border border-[var(--btn-secondary-border)] cursor-pointer transition-colors font-medium shrink-0"
      onclick={onBackToGallery}
    >
      <span>←</span>
      <span>{t('playlist.backToGallery')}</span>
    </button>
    <span class="opacity-40 shrink-0">/</span>
    <span class="truncate font-semibold text-[var(--text-main)]">{isCurrentPlaylistLoaded ? playlist.name : (loadError ? t('common.failed') : t('common.loading'))}</span>
  </div>

  {#if isCurrentPlaylistLoaded}
    <!-- 2. 精致紧凑 Hero 横幅区 -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 sm:p-4 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] shadow-sm">
      <img
        src={formatCoverUrl(playlist.coverImgUrl, 300)}
        alt={playlist.name}
        class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shadow-md shrink-0 border border-[var(--border-subtle)]"
      />
      <div class="flex-1 min-w-0 flex flex-col gap-1.5">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
            {t('playlist.title')}
          </span>
          <span class="text-xs text-[var(--text-muted)]">ID: {playlist.id}</span>
        </div>
        <h1 class="text-lg sm:text-xl font-bold text-[var(--text-main)] truncate tracking-tight">
          {playlist.name}
        </h1>
        <p class="text-xs text-[var(--text-secondary)] flex items-center gap-2 flex-wrap">
          <span>{t('playlist.creatorLabel', { creator: playlist.creator || t('playlist.defaultCreator') })}</span>
          <span>{t('playlist.songCountTotal', { count: allTracks.length })}</span>
          {#if allTracks.length > 0}
            <span class="text-[11px] opacity-85 flex items-center gap-1.5 ml-1">
              <span>{t('playlist.diskStats', { downloaded: downloadedCount, pending: pendingCount })}</span>
            </span>
          {/if}
        </p>

        <!-- 快捷操作按钮组 -->
        <div class="flex items-center gap-2 pt-0.5 flex-wrap">
          <button
            type="button"
            data-testid="btn-detail-play-all"
            class="btn-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
            onclick={handlePlayAll}
          >
            <span>▶️</span>
            <span>{t('playlist.playAll')}</span>
          </button>
          <button
            type="button"
            data-testid="btn-detail-download-all"
            class="btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
            onclick={handleDownloadAll}
          >
            <span>🖥️</span>
            <span>{t('playlist.downloadAllToPc')}</span>
          </button>
          {#if playlist && !playlist.isCreator}
            <button
              type="button"
              data-testid="btn-detail-fork"
              class="btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer text-purple-400 hover:text-purple-300 border-purple-500/30 hover:border-purple-500/50"
              onclick={() => showForkModal = true}
              title={t('playlist.forkDesc')}
            >
              <span>📦</span>
              <span>{t('playlist.forkTitle')}</span>
            </button>
            <button
              type="button"
              data-testid="btn-detail-subscribe"
              class="btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer {playlist.subscribed ? 'text-red-400 border-red-500/30' : ''}"
              onclick={handleToggleSubscribe}
              title={playlist.subscribed ? t('playlist.unsubscribeTooltip') : t('playlist.subscribeTooltip')}
            >
              <span>{playlist.subscribed ? '💔' : '⭐'}</span>
              <span>{playlist.subscribed ? t('playlist.unsubscribe') : t('playlist.subscribe')}</span>
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- 歌单内歌曲过滤栏 -->
    <PlaylistTrackFilter />

    <!-- 3. 宽屏歌曲大表格 (流式平滑展开，表头吸顶，与外层视口完美契合) -->
    {#if filteredTracks.length === 0}
      <div class="py-16 text-center text-xs text-[var(--text-muted)] bg-[var(--card-bg)] rounded-2xl border border-dashed border-[var(--border-color)] p-8">
        <span class="text-3xl block mb-2">🔍</span>
        <span>{t('playlist.notFoundSong', { kw: getPlaylistSearchKeyword() })}</span>
      </div>
    {:else}
      <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] overflow-hidden shadow-sm flex flex-col">
        <div class="overflow-x-auto custom-table-scroll">
          <table class="w-full text-left border-collapse text-xs">
            <thead class="sticky top-0 z-10 bg-[var(--card-header-bg)] backdrop-blur-xl border-b border-[var(--border-color)] text-[var(--text-muted)]">
              <tr>
                <th class="w-12 py-3 pl-4 font-semibold">#</th>
                <th class="py-3 px-3 font-semibold">{t('search.tableTitle')}</th>
                <th class="py-3 px-3 font-semibold w-40">{t('common.artist')}</th>
                <th class="py-3 px-3 font-semibold w-44 hidden md:table-cell">{t('common.album')}</th>
                <th class="py-3 pr-4 text-right font-semibold w-56">{t('search.tableActions')}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border-subtle)]">
              {#each paged as trackItem, i (trackItem.id)}
                {@const idx = i + 1}
                {@const status = getTrackSourceStatus(trackItem.id, trackItem.isLocal, curTrack)}
                {@const artist = formatArtist(trackItem)}
                {@const isPlayingThis = isSameTrack(curTrack, trackItem)}
                <tr class="hover:bg-[var(--card-header-hover)] transition-colors group {isPlayingThis ? 'bg-red-500/10' : ''}">
                  <td class="py-2.5 pl-4 text-[var(--text-muted)] font-mono text-[11px]">
                    {#if isPlayingThis && playing}
                      <span class="text-red-500 animate-pulse">▶</span>
                    {:else}
                      {idx}
                    {/if}
                  </td>
                  <td class="py-2.5 px-3 min-w-0">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="font-semibold text-[var(--text-main)] truncate max-w-xs xl:max-w-md group-hover:text-red-400 transition-colors">
                        {trackItem.name}
                      </span>
                      <TrackSourceBadge id={trackItem.id} isLocal={trackItem.isLocal} {curTrack} class="shrink-0" />
                      <TrackLikeBtn liked={likedSet.has(Number(trackItem.id))} onclick={() => onToggleLike(Number(trackItem.id), trackItem.name)} />
                    </div>
                  </td>
                  <td class="py-2.5 px-3 text-[var(--text-secondary)] truncate">
                    {artist || t('common.variousArtists')}
                  </td>
                  <td class="py-2.5 px-3 text-[var(--text-muted)] truncate hidden md:table-cell">
                    {#if trackItem.al?.id && onAlbum}
                      <button
                        type="button"
                        class="text-left bg-transparent border-none p-0 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer truncate max-w-[160px]"
                        onclick={() => onAlbum?.(String(trackItem.al.id))}
                      >
                        {trackItem.al.name || t('search.tab.song')}
                      </button>
                    {:else}
                      <span>{trackItem.al?.name || t('search.tab.song')}</span>
                    {/if}
                  </td>
                  <td class="py-2.5 pr-4 text-right whitespace-nowrap">
                    <div class="inline-flex items-center justify-end gap-1.5">
                      <SlotBtn
                        playing={isPlayingThis && playing}
                        onclick={() => onPlayQueue([{ id: trackItem.id, name: trackItem.name, artist, cover: trackItem.al?.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                      >
                        {getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal: status.isLocal, variant: 'desktop' })}
                      </SlotBtn>
                      {#if status.isServer}
                        <SlotBtn onclick={() => onReveal && onReveal({ id: trackItem.id, name: trackItem.name, artist })}>{t('common.reveal')}</SlotBtn>
                      {:else}
                        <SlotBtn onclick={() => handleDownloadSingle(String(trackItem.id), trackItem.name)}>{t('download.downloadSingle')}</SlotBtn>
                      {/if}
                      <SlotBtn onclick={() => handleCache(trackItem)}>
                        {status.isPhone ? t('search.cachedShort') : cachingTrackId === trackItem.id ? t('playlist.cachingBadge') : t('search.cacheShort')}
                      </SlotBtn>
                      <SlotBtn onclick={() => addToPlaylistSong = { id: trackItem.id, name: trackItem.name, artist }}>➕</SlotBtn>
                      {#if playlist && (playlist.isCreator || !playlist.subscribed)}
                        <SlotBtn onclick={() => removingTrack = { id: trackItem.id, name: trackItem.name, artist }}>🗑️</SlotBtn>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- 触底自动刷下一页哨兵与状态提示 -->
        <div
          bind:this={sentinelEl}
          data-testid="playlist-infinite-sentinel"
          class="flex flex-col items-center justify-center py-3.5 px-4 border-t border-[var(--border-color)] bg-[var(--card-bg)] text-xs text-[var(--text-secondary)] transition-all select-none"
        >
          {#if hasMore}
            <div class="flex items-center gap-2 text-[var(--text-secondary)] py-1">
              <span class="inline-block animate-spin text-red-500 text-sm">⏳</span>
              <span>{t('playlist.loadingMoreTracks', { loaded: paged.length, total: filteredTracks.length })}</span>
            </div>
          {:else}
            <div class="flex items-center gap-2 text-[var(--text-muted)] text-[11px] py-1">
              <span>✨</span>
              <span>{t('playlist.loadedAllTracks', { count: filteredTracks.length })}{#if getPlaylistSearchKeyword()}{t('playlist.filteredFromTotal', { count: allTracks.length })}{/if}</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {:else if loadError}
    <div class="py-16 text-center flex flex-col items-center justify-center gap-3 text-xs text-[var(--text-muted)] bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] p-8 my-2 shadow-sm">
      <span class="text-3xl">⚠️</span>
      <span class="text-sm font-semibold text-red-400">{loadError}</span>
      <div class="flex items-center gap-2 mt-2">
        <button
          type="button"
          class="btn-primary text-xs px-4 py-1.5 rounded-xl cursor-pointer"
          onclick={() => loadData(playlistId, true)}
        >
          {t('common.retry')}
        </button>
        <button
          type="button"
          class="btn-secondary text-xs px-4 py-1.5 rounded-xl cursor-pointer"
          onclick={onBackToGallery}
        >
          {t('playlist.backToGallery')}
        </button>
      </div>
    </div>
  {:else}
    <div class="py-16 text-center flex flex-col items-center justify-center gap-3 text-xs text-[var(--text-muted)] bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] p-8 my-2 shadow-sm">
      <span class="text-3xl animate-spin text-red-500">⏳</span>
      <span class="text-sm font-semibold text-[var(--text-main)]">{t('playlist.loadingContent')}</span>
      <span class="text-xs text-[var(--text-muted)] max-w-sm">{t('playlist.loadingLargeNotice')}</span>
    </div>
  {/if}

  {#if addToPlaylistSong}
    <AddToPlaylistModal song={addToPlaylistSong} onClose={() => addToPlaylistSong = null} {showToast} />
  {/if}

  {#if showForkModal && playlist}
    <ForkPlaylistModal
      playlistName={playlist.name} trackCount={allTracks.length} trackIds={allTracks.map((t: any) => t.id)}
      onClose={() => showForkModal = false} onSuccess={handleForkSuccess} {showToast}
    />
  {/if}

  {#if removingTrack && playlist}
    <RemoveFromPlaylistModal song={removingTrack} playlistId={playlist.id} playlistName={playlist.name} onClose={() => removingTrack = null} {showToast} />
  {/if}
</div>

<style>
  .custom-table-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-table-scroll::-webkit-scrollbar-thumb {
    background: var(--border-color, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
  }
</style>
