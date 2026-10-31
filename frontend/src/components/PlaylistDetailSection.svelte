<script lang="ts">
  import { tick, onMount } from 'svelte';
  import {
    allTracks, getFilteredTracks, getTotalPages, getPlaylist, getCurPage,
    getPlaylistSearchKeyword, isPlaylistLoading, incPage, recordPlaylistPlay,
    loadPlaylistDetail, getPaged
  } from '../lib/playlist.svelte';
  import { api } from '../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';
  import { toPlayerTrack } from '../lib/playerHelper';
  import AccordionCard from './AccordionCard.svelte';
  import DetailHeaderCard from './DetailHeaderCard.svelte';
  import PlaylistTrackFilter from './PlaylistTrackFilter.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';
  import TrackSourceBadge from './TrackSourceBadge.svelte';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte';
  import ForkPlaylistModal from './ForkPlaylistModal.svelte';
  import RemoveFromPlaylistModal from './RemoveFromPlaylistModal.svelte';
  import { cacheTrackToBrowser } from '../lib/pwaCache.svelte';
  import { getTrackSourceStatus, getTrackPlayActionLabel, isSameTrack, markSongDownloaded } from '../lib/trackStatus.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { t } from '../lib/i18n';

  let paged = $derived(getPaged());
  let totalPages = $derived(getTotalPages());
  let playlist = $derived(getPlaylist());
  let curPage = $derived(getCurPage());
  let filteredTracks = $derived(getFilteredTracks());
  let hasMore = $derived(curPage < totalPages);

  let {
    pid = '', open = $bindable(true), curTrack = null, playing = false, likedSet,
    downloadedSet = new Set<number>(), onToggleLike, onPlayQueue, onAlbum, onReveal,
    onSong, onViewPlaylist, onToggle, showToast
  } = $props<{
    pid?: string; open?: boolean; curTrack?: any; playing?: boolean; likedSet: Set<number>;
    downloadedSet?: Set<number>; onToggleLike: (id: number, name: string) => void;
    onPlayQueue: (tracks: any[], optionsOrIdx?: any) => void; onAlbum?: (albumId: string) => void;
    onReveal?: (item: any) => void; onSong?: (id: string) => void;
    onViewPlaylist: (id: string, force?: boolean) => void; onToggle?: () => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let pidInput = $state('');
  let showForkModal = $state(false);
  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);
  let removingTrack = $state<{ id: string | number; name: string; artist?: string } | null>(null);
  let cachingTrackId = $state<string | number | null>(null);

  let listContainerEl = $state<HTMLElement | null>(null);
  let sentinelEl = $state<HTMLElement | null>(null);
  let isLoadingNext = $state(false);

  let pullDistance = $state(0);
  let isPullingAtTop = $state(false);
  let touchStartY = 0;
  let touchStartX = 0;
  let canPullAtTop = false;
  const PULL_THRESHOLD = 36;

  function triggerScrollToTop() {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const mainEl = typeof document !== 'undefined' ? document.querySelector('.app-main-container') : null;
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (listContainerEl) {
      listContainerEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
    } catch {}
  }

  function handleTouchStart(e: TouchEvent) {
    if (!listContainerEl || e.touches.length !== 1) return;
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    canPullAtTop = listContainerEl.scrollTop <= 0;
    isPullingAtTop = false;
    pullDistance = 0;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!listContainerEl || !canPullAtTop || e.touches.length !== 1) return;
    const diffY = e.touches[0].clientY - touchStartY;
    const diffX = e.touches[0].clientX - touchStartX;
    if (diffY > 6 && Math.abs(diffY) > Math.abs(diffX) * 1.5) {
      if (listContainerEl.scrollTop <= 0) {
        isPullingAtTop = true;
        pullDistance = Math.min(55, Math.pow(diffY, 0.8));
      }
    } else if (diffY < 0) {
      isPullingAtTop = false;
      pullDistance = 0;
    }
  }

  function handleTouchEnd() {
    if (isPullingAtTop && pullDistance >= PULL_THRESHOLD) {
      triggerScrollToTop();
    }
    isPullingAtTop = false;
    pullDistance = 0;
  }

  function handleWheel(e: WheelEvent) {
    if (!listContainerEl) return;
    if (listContainerEl.scrollTop <= 0 && e.deltaY < 0) {
      if (typeof window !== 'undefined' && window.scrollY > 0) {
        window.scrollBy({ top: e.deltaY, behavior: 'auto' });
      } else {
        const mainEl = typeof document !== 'undefined' ? document.querySelector('.app-main-container') : null;
        if (mainEl && mainEl.scrollTop > 0) {
          mainEl.scrollBy({ top: e.deltaY, behavior: 'auto' });
        }
      }
    }
  }

  onMount(() => {
    const handleScrollListTop = () => {
      if (listContainerEl) {
        listContainerEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('wyyyy:scroll-list-top', handleScrollListTop);
    return () => {
      window.removeEventListener('wyyyy:scroll-list-top', handleScrollListTop);
    };
  });

  $effect(() => {
    pidInput = pid;
  });

  function loadNextPage() {
    if (!hasMore || isLoadingNext) return;
    isLoadingNext = true;
    incPage(1);
    tick().then(() => {
      isLoadingNext = false;
      checkSentinel();
    });
  }

  function checkSentinel() {
    if (!hasMore || isLoadingNext) return;
    if (listContainerEl) {
      const { scrollTop, scrollHeight, clientHeight } = listContainerEl;
      if (scrollTop + clientHeight >= scrollHeight - 120) {
        loadNextPage();
        return;
      }
    }
    if (sentinelEl) {
      const rect = sentinelEl.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top <= vh + 150) {
        loadNextPage();
      }
    }
  }

  function handleListScroll() {
    checkSentinel();
  }

  $effect(() => {
    if (!sentinelEl || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting) {
        loadNextPage();
      }
    }, {
      root: listContainerEl,
      rootMargin: '120px'
    });
    observer.observe(sentinelEl);
    window.addEventListener('scroll', checkSentinel, { passive: true });
    checkSentinel();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', checkSentinel);
    };
  });

  async function downloadPlaylistById(id: string) {
    try {
      await api.downloadPlaylist(id);
      showToast(t('download.submittedTask'), 'success');
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.requestFailed', { error: e.message || e }), 'error');
    }
  }

  async function handleToggleSubscribe() {
    if (!playlist?.id) return;
    const nextSub = !playlist.subscribed;
    try {
      const res = await api.playlistSubscribe(String(playlist.id), nextSub);
      if (res?.code && res.code !== '000000') {
        showToast(res.msg || (nextSub ? t('playlist.subscribeRiskWarning') : t('playlist.unsubscribeFailed')), 'warning', 5000);
        return;
      }
      playlist.subscribed = nextSub;
      showToast(nextSub ? t('playlist.subscribedSuccess', { name: playlist.name }) : t('playlist.unsubscribedSuccess', { name: playlist.name }), 'success');
      window.dispatchEvent(new CustomEvent('wyyyy:playlist-created'));
    } catch (e: any) {
      showToast(t('playlist.riskTip'), 'warning', 4000);
    }
  }

  async function downloadSingleTrack(id: string, name?: string) {
    try {
      const res = await api.downloadSingle(id);
      const task = res?.data;
      if (task?.status === 'SKIP') {
        const msg = task.errorMsg || '';
        if (msg.includes('已存在') || msg.includes('磁盘中')) { // i18n-ignore: backend string
          markSongDownloaded(id);
          showToast(t('playlist.alreadyInDisk', { name: task.name || name || t('comment.defaultSong') }), 'info', 3000);
        } else {
          showToast(t('download.skippedWithName', { name: task.name || name || t('comment.defaultSong'), reason: msg || t('download.skipReasonPreviewOrExist') }), 'warning', 4000);
        }
      } else if (task?.status === 'FAILED') {
        showToast(t('download.failedWithName', { name: task.name || name || t('comment.defaultSong'), reason: task.errorMsg || t('common.failed') }), 'error', 4000);
      } else {
        showToast(t('drawer.downloadSubmitted', { name: task?.name || name || t('comment.defaultSong') }), 'info', 2000);
      }
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.requestFailed', { error: e.message || e }), 'error');
    }
  }

  async function handleCacheTrack(tItem: any) {
    cachingTrackId = tItem.id;
    showToast(t('playlist.caching', { name: tItem.name }), 'info', 1500);
    try {
      const res = await cacheTrackToBrowser({
        id: tItem.id,
        name: tItem.name,
        artist: formatArtist(tItem),
        cover: tItem.al?.picUrl || tItem.picUrl || DEFAULT_VINYL_COVER,
        album: tItem.al?.name || tItem.album
      });
      if (res.success) {
        showToast(res.isTrial ? t('playlist.cachedTrial', { name: tItem.name }) : t('playlist.cached', { name: tItem.name }), res.isTrial ? 'warning' : 'success');
      } else {
        showToast(res.msg || t('playlist.cacheFailed', { error: t('common.failed') }), 'error');
      }
    } catch (e: any) {
      showToast(t('playlist.cacheFailed', { error: e.message || e }), 'error');
    } finally {
      cachingTrackId = null;
    }
  }

  function openTrackSheet(tItem: any, isLocal: boolean, isPhone: boolean, isServer: boolean, artist: string, isPlayingThis: boolean) {
    openSheet({
      title: tItem.name,
      subtitle: artist || t('player.unknownArtist'),
      actions: [
        { label: getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal, variant: 'full' }), style: 'primary', onclick: () => onPlayQueue([toPlayerTrack(tItem, { artist, isLocal })]) },
        isServer
          ? { label: t('playlist.locateInDisk'), style: 'default', onclick: () => onReveal && onReveal({ id: tItem.id, name: tItem.name, artist }) }
          : { label: t('playlist.downloadToServer'), style: 'default', onclick: () => downloadSingleTrack(String(tItem.id), tItem.name) },
        { label: cachingTrackId === tItem.id ? t('playlist.cachingOffline') : (isPhone ? t('playlist.recachePhone') : t('playlist.cachePhonePwa')), style: 'default', onclick: () => handleCacheTrack(tItem) },
        { label: t('playlist.addTo'), style: 'default', onclick: () => { addToPlaylistSong = { id: tItem.id, name: tItem.name, artist }; } },
        ...(playlist && (playlist.isCreator || !playlist.subscribed) ? [{ label: t('playlist.removeThisTrack'), style: 'danger' as const, onclick: () => { removingTrack = { id: tItem.id, name: tItem.name, artist }; } }] : []),
        ...(onSong ? [{ label: t('playlist.viewSongDetails'), style: 'default' as const, onclick: () => onSong(String(tItem.id)) }] : []),
        { label: likedSet.has(Number(tItem.id)) ? t('recommend.actionUnlike') : t('recommend.actionLike'), style: 'default', onclick: () => onToggleLike(Number(tItem.id), tItem.name) }
      ]
    });
  }
</script>

<AccordionCard title={t('playlist.sectionDetail')} bind:open flat accent="blue" {onToggle}>
  <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
    <input
      type="text" placeholder={t('playlist.inputIdPlaceholder')} class="flex-1 min-w-0"
      bind:value={pidInput} disabled={isPlaylistLoading()}
      onkeydown={(e) => e.key === 'Enter' && !isPlaylistLoading() && onViewPlaylist(pidInput)}
    />
    <button
      class="btn-primary shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 min-w-[84px] md:min-w-[100px]"
      disabled={isPlaylistLoading()} onclick={() => onViewPlaylist(pidInput)}
    >
      {#if isPlaylistLoading()}
        <span class="inline-block animate-spin text-xs">⏳</span><span>{t('common.loading')}</span>
      {:else}
        <span>{t('playlist.viewDetailBtn')}</span>
      {/if}
    </button>
  </div>

  {#if isPlaylistLoading() && (!playlist || String(playlist.id) !== pid)}
    <div class="py-8 px-4 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)] rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] my-3 shadow-sm">
      <div class="text-3xl animate-spin text-red-500">⏳</div>
      <div class="text-sm font-semibold text-[var(--text-main)]">{t('playlist.fetchingData', { id: pid })}</div>
      <p class="text-xs text-[var(--text-muted)] text-center max-w-sm m-0 leading-relaxed">
        {t('playlist.fetchingDataHint')}
      </p>
      <div class="w-full max-w-sm flex flex-col gap-2 mt-2">
        <div class="h-12 rounded-xl bg-white/5 animate-pulse w-full"></div>
        <div class="h-6 rounded-lg bg-white/5 animate-pulse w-4/5"></div>
        <div class="h-6 rounded-lg bg-white/5 animate-pulse w-3/5"></div>
      </div>
    </div>
  {:else if playlist}
    <DetailHeaderCard cover={playlist.coverImgUrl || '/favicon.png'} title={playlist.name} subtitle={`${playlist.creator || t('common.unknown')} | ${t('playlist.trackCount', { count: allTracks.length })}`}>
      <button class="btn-primary" onclick={() => downloadPlaylistById(String(playlist.id))} title={t('playlist.downloadToPcTooltip')}>
        <span>🖥️</span><span>{t('playlist.downloadToPc')}</span>
      </button>
      <button
        class="btn-secondary"
        onclick={() => {
          if (playlist?.id) recordPlaylistPlay(playlist.id);
          onPlayQueue && onPlayQueue(allTracks.map((tItem: any) => toPlayerTrack(tItem)), { startIndex: 0, playlistId: playlist?.id, isExplicitTrack: false });
        }}
        title={t('playlist.playAllTooltip')}
      >
        <span>▶️</span><span>{t('playlist.playAll')}</span>
      </button>
      {#if playlist && !playlist.isCreator}
        <button class="btn-secondary !text-purple-400 !border-purple-500/30" onclick={() => showForkModal = true} title={t('playlist.forkTooltip')}>
          <span>📦</span><span>{t('playlist.forkBtn')}</span>
        </button>
        <button class="btn-secondary {playlist.subscribed ? '!text-red-400 !border-red-500/30' : ''}" onclick={handleToggleSubscribe} title={playlist.subscribed ? t('playlist.unsubscribe') : t('playlist.subscribe')}>
          <span>{playlist.subscribed ? '💔' : '⭐'}</span><span>{playlist.subscribed ? t('playlist.unsubscribe') : t('playlist.subscribe')}</span>
        </button>
      {/if}
    </DetailHeaderCard>

    <PlaylistTrackFilter />

    {#if filteredTracks.length === 0}
      <div class="py-12 text-center text-xs text-[var(--text-muted)] bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl p-6 my-2 border border-dashed border-[var(--border-color)]">
        <span class="text-2xl block mb-1">🔍</span>
        <span>{t('playlist.notFoundSong', { kw: getPlaylistSearchKeyword() })}</span>
      </div>
    {:else}
      {#if pullDistance > 0}
        <div
          class="flex items-center justify-center py-1 transition-all select-none pointer-events-none"
          style="transform: translateY({Math.min(8, pullDistance * 0.2)}px);"
        >
          <div
            class="px-3 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 shadow-sm border transition-all duration-150 {pullDistance >= PULL_THRESHOLD ? 'bg-blue-600 text-white border-blue-400/50 scale-105 shadow-blue-500/20' : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border-color)]'}"
          >
            <span class="transition-transform duration-150 inline-block {pullDistance >= PULL_THRESHOLD ? '-rotate-180 text-white' : ''}">↓</span>
            <span>{pullDistance >= PULL_THRESHOLD ? t('playlist.releaseToTopHint') : t('playlist.pullToTopHint')}</span>
          </div>
        </div>
      {/if}
      <ul
        bind:this={listContainerEl}
        class="data-list scrollable-list"
        style={pullDistance > 0 ? `transform: translateY(${pullDistance * 0.35}px); transition: none;` : 'transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);'}
        onscroll={handleListScroll}
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
        onwheel={handleWheel}
      >
        {#each paged as trackItem, i}
        {@const idx = i + 1}
        {@const status = getTrackSourceStatus(trackItem.id, trackItem.isLocal, curTrack)}
        {@const artist = formatArtist(trackItem)}
        {@const isPlayingThis = isSameTrack(curTrack, trackItem)}
        {@const playLabel = getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal: status.isLocal, variant: 'short' })}
        <li class="track-item-card" class:is-active-playing={isPlayingThis}>
          <div class="track-title-row">
            <button
              type="button"
              class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors"
              onclick={() => onSong ? onSong(String(trackItem.id)) : (onPlayQueue && onPlayQueue([toPlayerTrack(trackItem, { artist, isLocal: status.isLocal })]))}
            >
              {idx}. {trackItem.name}{artist ? ' - ' + artist : ''}
            </button>
            <TrackSourceBadge id={trackItem.id} isLocal={trackItem.isLocal} {curTrack} class="ml-1.5" />
            <TrackLikeBtn liked={likedSet.has(Number(trackItem.id))} onclick={() => onToggleLike(Number(trackItem.id), trackItem.name)} />
          </div>
          <div class="track-action-group">
            <!-- 💻 PC 桌面端：宽屏时显示完整快捷按钮组 -->
            <div class="hidden md:inline-flex items-center gap-1.5">
              <SlotBtn
                playing={isPlayingThis && playing}
                onclick={() => onPlayQueue([toPlayerTrack(trackItem, { artist, isLocal: status.isLocal })])}
              >
                {playLabel}
              </SlotBtn>
              {#if status.isServer}
                <SlotBtn onclick={() => onReveal && onReveal({ id: trackItem.id, name: trackItem.name, artist })}>{t('playlist.locateBtn')}</SlotBtn>
              {:else}
                <SlotBtn onclick={() => downloadSingleTrack(String(trackItem.id), trackItem.name)}>{t('playlist.downloadBtn')}</SlotBtn>
              {/if}
              <SlotBtn onclick={() => handleCacheTrack(trackItem)}>{status.isPhone ? t('playlist.cachedBadge') : cachingTrackId === trackItem.id ? t('playlist.cachingBadge') : t('playlist.cacheBtn')}</SlotBtn>
              <SlotBtn onclick={() => addToPlaylistSong = { id: trackItem.id, name: trackItem.name, artist }}>{t('playlist.playlistBtn')}</SlotBtn>
              {#if playlist && (playlist.isCreator || !playlist.subscribed)}
                <SlotBtn onclick={() => removingTrack = { id: trackItem.id, name: trackItem.name, artist }}>{t('playlist.removeBtn')}</SlotBtn>
              {/if}
              {#if onSong}
                <SlotBtn onclick={() => onSong(String(trackItem.id))}>{t('playlist.detailBtn')}</SlotBtn>
              {/if}
            </div>

            <!-- 📱 SP 移动端：外面仅保留核心常用功能 (▶️播放) + (··· 更多选项抽屉) -->
            <div class="inline-flex md:hidden items-center gap-1.5">
              <SlotBtn
                playing={isPlayingThis && playing}
                onclick={() => onPlayQueue([toPlayerTrack(trackItem, { artist, isLocal: status.isLocal })])}
              >
                {playLabel}
              </SlotBtn>
              <button
                type="button"
                class="btn-more-actions"
                onclick={() => openTrackSheet(trackItem, status.isLocal, status.isPhone, status.isServer, artist, isPlayingThis)}
                title={t('recommend.moreActions')}
                aria-label={t('recommend.moreActions')}
              >
                ···
              </button>
            </div>
          </div>
        </li>
      {/each}

      <!-- 触底自动刷下一页哨兵与状态提示 -->
      <li
        bind:this={sentinelEl}
        data-testid="playlist-tab-infinite-sentinel"
        class="infinite-scroll-sentinel py-3 text-center text-xs text-[var(--text-secondary)] border-t border-dashed border-[var(--border-subtle)] mt-2 list-none select-none"
      >
        {#if hasMore}
          <div class="flex items-center justify-center gap-2 text-[var(--text-secondary)] py-1">
            <span class="inline-block animate-spin text-red-500 text-sm">⏳</span>
            <span>{t('playlist.loadingMoreTracks', { loaded: paged.length, total: filteredTracks.length })}</span>
          </div>
        {:else}
          <div class="flex items-center justify-center gap-2 text-[var(--text-muted)] text-[11px] py-1">
            <span>{t('playlist.loadedAllTracks', { count: filteredTracks.length })}</span>
          </div>
        {/if}
      </li>
    </ul>
    {/if}
  {:else}
    <div class="empty-placeholder-card">
      <div class="empty-icon">🎼</div>
      <div class="empty-title">{t('playlist.emptyTabPrompt')}</div>
    </div>
  {/if}
</AccordionCard>

{#if addToPlaylistSong}
  <AddToPlaylistModal song={addToPlaylistSong} onClose={() => addToPlaylistSong = null} {showToast} />
{/if}

{#if showForkModal && playlist}
  <ForkPlaylistModal
    playlistName={playlist.name} trackCount={allTracks.length} trackIds={allTracks.map((t: any) => t.id)}
    onClose={() => showForkModal = false} onSuccess={(newId) => { if (newId) onViewPlaylist(newId); }} {showToast}
  />
{/if}

{#if removingTrack && playlist}
  <RemoveFromPlaylistModal song={removingTrack} playlistId={playlist.id} playlistName={playlist.name} onClose={() => removingTrack = null} {showToast} />
{/if}
