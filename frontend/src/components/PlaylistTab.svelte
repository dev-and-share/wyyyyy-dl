<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    allTracks, getFilteredTracks, pageSize, getPaged, getTotalPages, getPlaylist, getCurPage,
    getPlaylistSearchKeyword, setPlaylistSearchKeyword, loadMyPlaylists, loadPlaylistDetail,
    isPlaylistLoading, incPage, recordPlaylistPlay
  } from '../lib/playlist.svelte';
  import { api } from '../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';
  import { playPlaylistTracks, toPlayerTrack } from '../lib/playerHelper';
  import AccordionCard from './AccordionCard.svelte';
  import DetailHeaderCard from './DetailHeaderCard.svelte';
  import PlaylistTrackFilter from './PlaylistTrackFilter.svelte';
  import SlotBtn from './SlotBtn.svelte'; import TrackLikeBtn from './TrackLikeBtn.svelte'; import TrackSourceBadge from './TrackSourceBadge.svelte';
  import MyPlaylistsSection from './MyPlaylistsSection.svelte';
  import DailyRecommendSection from './DailyRecommendSection.svelte';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte'; import ForkPlaylistModal from './ForkPlaylistModal.svelte'; import RemoveFromPlaylistModal from './RemoveFromPlaylistModal.svelte';
  import SegmentedTabs from './sp/SegmentedTabs.svelte';
  import { cacheTrackToBrowser } from '../lib/pwaCache.svelte';
  import { getTrackSourceStatus, getTrackPlayActionLabel, isSameTrack, markSongDownloaded } from '../lib/trackStatus.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { layoutState } from '../lib/layout.svelte';
  import { t } from '../lib/i18n';

  let paged = $derived(getPaged());
  let totalPages = $derived(getTotalPages());
  let playlist = $derived(getPlaylist());
  let curPage = $derived(getCurPage());
  let filteredTracks = $derived(getFilteredTracks());
  let hasMore = $derived(curPage < totalPages);

  let listContainerEl = $state<HTMLElement | null>(null);
  let sentinelEl = $state<HTMLElement | null>(null);
  let isLoadingNext = $state(false);

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

  let {
    playlistId, playlistTrigger = 0, curTrack = null, playing = false, likedSet,
    downloadedSet = new Set<number>(), onToggleLike, onPlayQueue, onAlbum, onReveal, onSong, showToast
  } = $props<{
    playlistId: string; playlistTrigger?: number; curTrack?: any; playing?: boolean; likedSet: Set<number>;
    downloadedSet?: Set<number>; onToggleLike: (id: number, name: string) => void;
    onPlayQueue: (tracks: any[], optionsOrIdx?: any) => void; onAlbum?: (albumId: string) => void;
    onReveal?: (item: any) => void; onSong?: (id: string) => void; showToast: (m: string, t?: string) => void;
  }>();

  let showForkModal = $state(false);

  const STORAGE_KEY_PLAYLIST_ID = 'wyyyy_last_playlist_id';
  const STORAGE_KEY_SUBTAB = 'wyyyy_pl_subtab';
  const getStored = (k: string, def: string) => typeof localStorage !== 'undefined' ? (localStorage.getItem(k) ?? def) : def;
  const initPlaylistId = () => playlistId || getStored(STORAGE_KEY_PLAYLIST_ID, '');

  let pid = $state(initPlaylistId());
  let pidInput = $state(initPlaylistId());
  let lastSeenPlaylistId = $state('');
  let lastSeenTrigger = $state(-1);
  function initSubtab() {
    return playlistId ? 'detail' : ((getStored(STORAGE_KEY_SUBTAB, 'my') as any) || 'my');
  }
  let activeSubtab: 'my' | 'detail' | 'recommend' = $state(initSubtab());
  let accMy = $state(true), accDetail = $state(true), accRecommend = $state(true);
  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);
  let removingTrack = $state<{ id: string | number; name: string; artist?: string } | null>(null);
  let cachingTrackId = $state<string | number | null>(null);

  function saveAccState() {
    try { localStorage.setItem(STORAGE_KEY_SUBTAB, activeSubtab); } catch {}
  }

  function scrollToDetail() {
    tick().then(() => {
      const el = document.getElementById('section-playlist-detail');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // 初始化自动拉取/读取 SWR 缓存
  onMount(() => {
    const isDesktopMode = layoutState.isDesktop;
    const targetPid = playlistId || (!isDesktopMode ? (pid || getStored(STORAGE_KEY_PLAYLIST_ID, '')) : '');
    if (targetPid && targetPid !== 'daily-recommend') {
      pid = targetPid;
      pidInput = targetPid;
      loadPlaylistDetail(targetPid).catch(() => {});
    } else if (targetPid === 'daily-recommend') {
      pid = 'daily-recommend';
    }
    loadMyPlaylists('created').catch(() => {});
  });

  // 监听外部传入的歌单 ID 变更与强制刷新触发器
  $effect(() => {
    const curId = playlistId;
    const curTrig = playlistTrigger;
    if (curId && (curId !== lastSeenPlaylistId || curTrig !== lastSeenTrigger)) {
      lastSeenPlaylistId = curId;
      lastSeenTrigger = curTrig;
      pid = curId;
      pidInput = curId;
      activeSubtab = 'detail';
      accDetail = true;
      saveAccState();
      scrollToDetail();
      if (curId !== 'daily-recommend') {
        loadPlaylistDetail(curId, false).catch(() => {});
      }
    }
  });

  function handleViewPlaylist(targetId: string, force = false) {
    if (!targetId || !targetId.trim()) {
      showToast(t('playlist.enterId'), 'warning');
      return;
    }
    const cleanId = targetId.trim();
    pid = cleanId;
    pidInput = cleanId;
    activeSubtab = 'detail';
    accDetail = true;
    saveAccState();
    try {
      localStorage.setItem(STORAGE_KEY_PLAYLIST_ID, cleanId);
      localStorage.setItem(STORAGE_KEY_SUBTAB, 'detail');
    } catch {}
    scrollToDetail();
    loadPlaylistDetail(cleanId, force).then(() => {
      if (force) showToast(t('playlist.refreshed'), 'success');
    }).catch(e => {
      showToast(t('playlist.fetchFailed', { error: e.message || e }), 'error');
    });
  }

  function playPlaylistDirect(targetId: string, targetName?: string) {
    if (!targetId) return;
    showToast(t('playlist.loadingTracks', { name: targetName || t('topbar.playlist') }), 'info', 1500);
    recordPlaylistPlay(targetId);
    loadPlaylistDetail(targetId).then(pl => {
      if (pl?.tracks?.length) {
        onPlayQueue && onPlayQueue(pl.tracks.map((tItem: any) => toPlayerTrack(tItem)), {
          startIndex: 0,
          playlistId: targetId,
          isExplicitTrack: false
        });
        showToast(t('playlist.startPlaying', { name: pl.name || targetName, count: pl.tracks.length }), 'success');
      } else {
        showToast(t('playlist.emptyOrError'), 'warning');
      }
    }).catch(e => {
      showToast(t('playlist.playFailed', { error: e.message || e }), 'error');
    });
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

<!-- 📱 SP 移动端顶部三段式分段切换器 -->
<SegmentedTabs
  items={[
    { id: 'my', label: t('playlist.tabMy'), icon: '📋', accent: 'red' },
    { id: 'detail', label: t('playlist.tabDetail'), icon: '🎼', accent: 'blue' },
    { id: 'recommend', label: t('playlist.tabRecommend'), icon: '📅', accent: 'amber' }
  ]}
  activeId={activeSubtab}
  onChange={(id) => { activeSubtab = id as any; try { localStorage.setItem(STORAGE_KEY_SUBTAB, id); } catch {} }}
/>

<!-- Section 1: 我的歌单 -->
<div class:hidden={activeSubtab !== 'my'}>
  <MyPlaylistsSection
    flat bind:open={accMy} onToggle={saveAccState}
    onViewPlaylist={(id) => handleViewPlaylist(id)}
    onPlayPlaylist={(id, name) => playPlaylistDirect(id, name)}
    {showToast}
  />
</div>

<!-- Section 2: 查看歌单详情 -->
<div id="section-playlist-detail" class:hidden={activeSubtab !== 'detail'}>
  <AccordionCard title={t('playlist.sectionDetail')} bind:open={accDetail} flat accent="blue" onToggle={saveAccState}>
    <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
      <input
        type="text" placeholder={t('playlist.inputIdPlaceholder')} class="flex-1 min-w-0"
        bind:value={pidInput} disabled={isPlaylistLoading()}
        onkeydown={(e) => e.key === 'Enter' && !isPlaylistLoading() && handleViewPlaylist(pidInput)}
      />
      <button
        class="btn-primary shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 min-w-[84px] md:min-w-[100px]"
        disabled={isPlaylistLoading()} onclick={() => handleViewPlaylist(pidInput)}
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
        <ul bind:this={listContainerEl} class="data-list scrollable-list" onscroll={handleListScroll}>
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
</div>

  <!-- Section 3: 每日专属推荐 -->
  <div class:hidden={activeSubtab !== 'recommend'}>
    <DailyRecommendSection
      flat bind:open={accRecommend} onToggle={saveAccState} {curTrack} {playing} {likedSet}
      {onToggleLike} {onPlayQueue} {onSong} {onAlbum} {onReveal} {showToast}
    />
  </div>

{#if addToPlaylistSong}
  <AddToPlaylistModal song={addToPlaylistSong} onClose={() => addToPlaylistSong = null} {showToast} />
{/if}

{#if showForkModal && playlist}
  <ForkPlaylistModal
    playlistName={playlist.name} trackCount={allTracks.length} trackIds={allTracks.map((t: any) => t.id)}
    onClose={() => showForkModal = false} onSuccess={(newId) => { if (newId) handleViewPlaylist(newId); }} {showToast}
  />
{/if}

{#if removingTrack && playlist}
  <RemoveFromPlaylistModal song={removingTrack} playlistId={playlist.id} playlistName={playlist.name} onClose={() => removingTrack = null} {showToast} />
{/if}
