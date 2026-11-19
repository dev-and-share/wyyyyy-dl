<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { api } from '../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER, getApiCache, setApiCache } from '../lib/utils';
  import { playPlaylistTracks } from '../lib/playerHelper';
  import type { Track } from '../lib/types';
  import AccordionCard from './AccordionCard.svelte';
  import AlbumDetailCard from './AlbumDetailCard.svelte';
  import ArtistDetailCard from './ArtistDetailCard.svelte';
  import SearchResultsSection from './SearchResultsSection.svelte';
  import SegmentedTabs from './sp/SegmentedTabs.svelte';
  import SwipeableTabsView from './sp/SwipeableTabsView.svelte';
  import { getTrackSourceStatus } from '../lib/trackStatus.svelte';
  import { musicFreeStore } from '../lib/musicfree/musicFreeStore.svelte';
  import DesktopSearchMusicFreeResults from './desktop/DesktopSearchMusicFreeResults.svelte';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte';
  import { routerState } from '../lib/router.svelte';
  import { t } from '../lib/i18n';
  import { Cloud, Puzzle } from '@lucide/svelte';

  let {
    albumId = '', albumTrigger = 0, curTrack = null, playing = false,
    downloadedSet = new Set<number>(), likedSet = new Set<number>(),
    onToggleLike, onAlbum, onPlaylist, onPlayQueue, onSong, onReveal, showToast
  } = $props<{
    albumId?: string; albumTrigger?: number; curTrack?: Track | null; playing?: boolean;
    downloadedSet?: Set<number>; likedSet?: Set<number>;
    onToggleLike?: (id: number, name: string, artist?: string) => void;
    onAlbum?: (id: string, name?: string) => void; onPlaylist: (id: string) => void;
    onPlayQueue?: (tracks: any[], idx?: number) => void; onSong?: (id: string) => void;
    onReveal?: (item: any) => void; showToast: (m: string, t?: string) => void;
  }>();

  const SK_KW = 'wyy_search_kw', SK_TYPE = 'wyy_search_type', SK_SRC = 'wyy_search_source';
  const SK_ALBUM = 'wyy_search_album_id', SK_TAB = 'wyy_search_subtab';
  const SK_ACC_S = 'wyy_search_acc_search', SK_ACC_A = 'wyy_search_acc_album';

  function getStored(key: string, def: string) {
    return (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null) ?? def;
  }

  let kw = $state(getStored(SK_KW, ''));
  let sType = $state(getStored(SK_TYPE, '1'));
  let searchSource = $state<'netease' | 'musicfree'>((getStored(SK_SRC, 'netease') as any) || 'netease');
  let sLimit = $state(20);
  let sResults: any[] = $state([]);
  let mfResults: any[] = $state([]);
  let searchLoading = $state(false);
  let hasSearched = $state(false);
  let addToPlaylistTrack = $state<any>(null);
  let searchInputEl = $state<HTMLInputElement | null>(null);

  function initSubtab() {
    return albumId ? 'album' : ((getStored(SK_TAB, 'search') as any) || 'search');
  }
  let activeSubtab: 'search' | 'album' | 'artist' = $state(initSubtab());
  const SUBTABS: ('search' | 'album' | 'artist')[] = ['search', 'album', 'artist'];
  let activeTabIndex = $derived(Math.max(0, SUBTABS.indexOf(activeSubtab)));

  function setSubtab(id: 'search' | 'album' | 'artist') {
    activeSubtab = id;
    try { localStorage.setItem(SK_TAB, id); } catch {}
  }

  function handleSwipeIndexChange(newIndex: number) {
    setSubtab(SUBTABS[newIndex] || 'search');
  }
  let accSearch = $state(true);
  let accAlbum = $state(true);
  let accArtist = $state(true);
  let currentArtistId = $state('');

  async function handleViewArtist(id: string) {
    currentArtistId = id;
    activeSubtab = 'artist';
    try { localStorage.setItem(SK_TAB, 'artist'); } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await tick();
    setTimeout(() => {
      const el = document.getElementById('section-artist-detail');
      if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 8), behavior: 'smooth' });
    }, 280);
  }

  $effect(() => {
    try {
      localStorage.setItem(SK_ACC_S, String(accSearch));
      localStorage.setItem(SK_ACC_A, String(accAlbum));
    } catch {}
  });

  function initAlbumId() {
    return albumId || getStored(SK_ALBUM, '');
  }
  let currentAlbumId = $state(initAlbumId());
  let album: any = $state(null);
  let albumLoading = $state(false);

  async function focusAlbumSection(id: string) {
    if (!id) return;
    currentAlbumId = id;
    activeSubtab = 'album';
    try { localStorage.setItem(SK_TAB, 'album'); } catch {}
    loadAlbum(id);
    await tick();
    setTimeout(() => {
      const el = document.getElementById('section-album-detail');
      if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 8), behavior: 'smooth' });
    }, 280);
  }

  let lastHandledTrigger = 0;
  $effect(() => {
    if (albumTrigger > 0 && albumTrigger !== lastHandledTrigger) {
      lastHandledTrigger = albumTrigger;
      if (albumId) {
        focusAlbumSection(albumId);
      }
    } else if (albumId && albumId !== currentAlbumId) {
      currentAlbumId = albumId;
      loadAlbum(albumId);
    }
  });

  let lastHandledSearchTrigger = 0;
  $effect(() => {
    if (routerState.searchTrigger > 0 && routerState.searchTrigger !== lastHandledSearchTrigger) {
      lastHandledSearchTrigger = routerState.searchTrigger;
      if (routerState.searchSource) {
        searchSource = routerState.searchSource;
      }
      activeSubtab = 'search';
      sType = '1';
      if (routerState.searchKeyword) {
        kw = routerState.searchKeyword;
        doSearch();
      }
    }
  });

  onMount(() => {
    tick().then(() => {
      if (activeSubtab === 'search') {
        searchInputEl?.focus();
      }
    });

    const onFocusSearch = () => {
      activeSubtab = 'search';
      tick().then(() => {
        searchInputEl?.focus();
        searchInputEl?.select();
      });
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('wyy:focus-search', onFocusSearch);
    }
    if (currentAlbumId) {
      if (!/^\d+$/.test(currentAlbumId.trim())) {
        try { localStorage.removeItem(SK_ALBUM); } catch {}
        currentAlbumId = '';
      } else {
        const cached = getApiCache('album_' + currentAlbumId);
        if (cached?.data) {
          album = cached.data;
        } else {
          loadAlbum(currentAlbumId, true).catch(() => {});
        }
      }
    }
    if (kw.trim()) {
      const cacheKey = 'search_' + sType + '_' + kw.trim();
      const cached = getApiCache(cacheKey);
      if (cached?.data && Array.isArray(cached.data)) {
        sResults = cached.data;
        if (sResults.length > 0) hasSearched = true;
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('wyy:focus-search', onFocusSearch);
      }
    };
  });

  function setType(t: string) {
    sType = t;
    if (kw.trim()) doSearch(false).catch(() => {});
  }

  async function doSearch(showEmptyToast = true) {
    if (!kw.trim()) {
      showToast(t('search.enterKeyword'), 'warning');
      return;
    }
    hasSearched = true;
    try {
      localStorage.setItem(SK_KW, kw);
      localStorage.setItem(SK_TYPE, sType);
      localStorage.setItem(SK_SRC, searchSource);
    } catch {}

    // 1. MusicFree 跨源检索
    if (searchSource === 'musicfree') {
      searchLoading = true;
      try {
        const res = await musicFreeStore.searchAll(kw.trim(), 1);
        mfResults = res.results || [];
        searchLoading = false;
        if (!mfResults.length && showEmptyToast) {
          showToast(t('search.mfNoResults'), 'info');
        }
      } catch (e: any) {
        searchLoading = false;
        if (showEmptyToast) showToast(t('search.mfSearchException', { error: e?.message || e }), 'error');
      }
      return;
    }

    // 2. 原生云端检索
    const cacheKey = 'search_' + sType + '_' + kw.trim();
    const cached = getApiCache(cacheKey);
    if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
      sResults = cached.data;
    } else {
      searchLoading = true;
    }
    try {
      const j = await api.search(kw, sType, String(sLimit));
      searchLoading = false;
      if (j?.code && j.code !== '000000') {
        if (showEmptyToast) showToast(j.msg || t('search.failed'), 'warning');
        return;
      }
      const d = j?.data;
      let res: any[] = [];
      if (Array.isArray(d)) res = d;
      else res = (d as any)?.songs || (d as any)?.albums || (d as any)?.playlists || (d as any)?.artists || (d as any)?.result || [];
      sResults = res;
      setApiCache(cacheKey, res);
      if (!res.length && showEmptyToast) showToast(t('search.noResultsShort'), 'info');
    } catch (e: any) {
      searchLoading = false;
      if (showEmptyToast) showToast(t('search.failedWithMsg', { message: e.message }), 'error');
    }
  }

  async function handleDownloadPlaylist(id: string, name: string) {
    try {
      await api.downloadPlaylist(id);
      showToast(t('search.submittedPlaylist', { name }), 'success');
      window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.submitFailedWithMsg', { message: e.message || e }), 'error');
    }
  }

  async function handlePlayPlaylist(id: string, name: string) {
    if (!onPlayQueue) return;
    await playPlaylistTracks(id, name, onPlayQueue, showToast);
  }

  async function loadAlbum(id?: string, silent = false) {
    const rawTarget = id || currentAlbumId;
    const targetId = (rawTarget || '').trim();
    if (!targetId) {
      if (!silent) showToast(t('album.enterId'), 'warning');
      return;
    }
    if (!/^\d+$/.test(targetId)) {
      try { localStorage.removeItem(SK_ALBUM); } catch {}
      currentAlbumId = '';
      return;
    }
    currentAlbumId = targetId;
    accAlbum = true;
    const cachedAlbum = getApiCache('album_' + targetId);
    if (cachedAlbum?.data) {
      const rawCached = cachedAlbum.data;
      const albumInfo = rawCached?.album || rawCached;
      album = {
        ...albumInfo,
        songs: albumInfo?.songs || rawCached?.songs || []
      };
    } else {
      albumLoading = true;
    }
    try {
      localStorage.setItem(SK_ALBUM, targetId);
    } catch {}
    try {
      const j = await api.album(targetId);
      albumLoading = false;
      if (j?.code && j.code !== '000000') {
        if (!silent) showToast(j.msg || t('album.fetchFailed'), 'warning');
        return;
      }
      const raw = j?.data || j;
      const albumInfo = raw?.album || raw;
      const songList = albumInfo?.songs || raw?.songs || [];
      album = {
        ...albumInfo,
        songs: songList
      };
      setApiCache('album_' + targetId, album);
    } catch (e: any) {
      albumLoading = false;
      if (!silent) showToast(t('album.fetchFailedWithMsg', { message: e.message }), 'error');
    }
  }

  function handleAlbum(id: string) {
    focusAlbumSection(id);
    if (onAlbum) onAlbum(id);
  }

  async function downloadFullAlbum() {
    if (!album || !album.songs?.length) return;
    try {
      await api.downloadAlbum(String(album.id || currentAlbumId));
      showToast(t('download.submittedFullAlbum'), 'success');
      window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.submitFailedWithMsg', { message: e.message || e }), 'error');
    }
  }

  function playFullAlbum() {
    if (!album?.songs?.length || !onPlayQueue) return;
    const q = album.songs.map((s: any) => ({
      id: s.id,
      name: s.name,
      artist: formatArtist(s.artist || s.ar || s.artists || album.artist || ''),
      cover: album.coverImgUrl || album.picUrl || DEFAULT_VINYL_COVER,
      isLocal: getTrackSourceStatus(s.id, s.isLocal, curTrack).isLocal
    }));
    onPlayQueue(q);
  }

  async function downloadSingleTrack(id: string, name?: string) {
    try {
      const res = await api.downloadSingle(id);
      const task = res?.data;
      if (task && typeof task === 'object') {
        const songName = task.name || name || t('common.unknownSong');
        const statusMap: Record<string, { msg: string; type: any; dur: number }> = {
          SKIP: { msg: t('download.skippedWithName', { name: songName, reason: task.errorMsg || t('download.skipReasonPreviewOrExist') }), type: 'warning', dur: 4000 },
          FAILED: { msg: t('download.failedWithName', { name: songName, reason: task.errorMsg || t('download.failReasonExecuteError') }), type: 'error', dur: 4000 },
          SUCCESS: { msg: t('download.downloadSuccessWithName', { name: songName }), type: 'success', dur: 2500 }
        };
        const s = statusMap[task.status] || { msg: t('download.submitSuccessWithName', { name: songName }), type: 'info', dur: 2000 };
        showToast(s.msg, s.type, s.dur);
      } else {
        showToast(t('download.submittedTask'), 'info', 1500);
      }
      window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.submitSingleFailedWithMsg', { message: e.message || e }), 'error');
    }
  }
</script>

<!-- 📱 SP 移动端顶部三段式分段切换器 -->
<SegmentedTabs
  items={[
    { id: 'search', label: t('search.subtab.search'), icon: '🔍', accent: 'red' },
    { id: 'album', label: t('search.subtab.album'), icon: '💽', accent: 'blue' },
    { id: 'artist', label: t('search.subtab.artist'), icon: '🎤', accent: 'purple' }
  ]}
  activeId={activeSubtab}
  onChange={(id) => setSubtab(id as any)}
/>

<!-- 🛝 移动端原生合成器级 120Hz 零卡顿丝滑滚动容器 -->
<SwipeableTabsView
  activeIndex={activeTabIndex}
  count={3}
  onChange={handleSwipeIndexChange}
>
  <!-- Section 1: 在线搜索 -->
  <div class="w-full flex-1 flex flex-col">
    <AccordionCard title={t('search.globalSearch')} flat open={true} accent="red">
      <!-- 🎯 音源来源选择器：云端 vs MusicFree 聚合 -->
      <div class="flex items-center gap-1.5 p-1 rounded-xl bg-black/10 dark:bg-white/5 border border-[var(--border-subtle)] mb-2.5">
        <button
          type="button"
          data-testid="sp-search-source-netease"
          class="flex-1 py-1 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center justify-center gap-1 {searchSource === 'netease' ? 'bg-red-500 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => { searchSource = 'netease'; if (kw.trim()) doSearch(false); }}
        >
          <Cloud size={13} /> <span>{t('search.sourceNetease')}</span>
        </button>
        <button
          type="button"
          data-testid="sp-search-source-musicfree"
          class="flex-1 py-1 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center justify-center gap-1 {searchSource === 'musicfree' ? 'bg-purple-600 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => { searchSource = 'musicfree'; if (kw.trim()) doSearch(false); }}
        >
          <Puzzle size={13} /> <span>{t('search.sourceMusicFree')}</span>
        </button>
      </div>

      {#if searchSource === 'netease'}
        <div class="flex gap-1.5 items-center overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto">
          <button type="button" class="btn-secondary rounded-lg px-2.5 py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 whitespace-nowrap break-keep {sType === '1' ? 'bg-gradient-to-br from-red-500 to-red-600 ring-2 ring-red-400/30' : 'bg-gradient-to-br from-slate-600 to-slate-700 opacity-80'}" onclick={() => setType('1')}>{t('search.typeSong')}</button>
          <button type="button" class="btn-secondary rounded-lg px-2.5 py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 whitespace-nowrap break-keep {sType === '10' ? 'bg-gradient-to-br from-red-500 to-red-600 ring-2 ring-red-400/30' : 'bg-gradient-to-br from-slate-600 to-slate-700 opacity-80'}" onclick={() => setType('10')}>{t('search.typeAlbum')}</button>
          <button type="button" class="btn-secondary rounded-lg px-2.5 py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 whitespace-nowrap break-keep {sType === '1000' ? 'bg-gradient-to-br from-red-500 to-red-600 ring-2 ring-red-400/30' : 'bg-gradient-to-br from-slate-600 to-slate-700 opacity-80'}" onclick={() => setType('1000')}>{t('search.typePlaylist')}</button>
          <button type="button" class="btn-secondary rounded-lg px-2.5 py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 whitespace-nowrap break-keep {sType === '100' ? 'bg-gradient-to-br from-red-500 to-red-600 ring-2 ring-red-400/30' : 'bg-gradient-to-br from-slate-600 to-slate-700 opacity-80'}" onclick={() => setType('100')}>{t('search.typeArtist')}</button>
        </div>
      {/if}

      <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
        <input
          bind:this={searchInputEl}
          type="search"
          enterkeyhint="search"
          placeholder={searchSource === 'musicfree' ? t('search.placeholderMusicFree') : t('search.inputPlaceholderWithShortcut')}
          class="flex-1 min-w-0 placeholder:text-[var(--text-muted)]/60 placeholder:italic placeholder:transition-opacity"
          bind:value={kw}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              (e.currentTarget as HTMLInputElement).blur();
              doSearch().catch((err: any) => showToast(err.message, 'warning'));
            }
          }}
        />
        {#if searchSource === 'netease'}
          <input type="number" bind:value={sLimit} min="1" max="100" class="w-[50px] md:w-[60px] text-center shrink-0" title={t('search.limitPerPage')} />
        {/if}
        <button type="button" class="btn-primary shrink-0 whitespace-nowrap hidden sm:inline-flex" onclick={() => doSearch().catch((e:any) => showToast(e.message, 'warning'))}>{t('common.search')}</button>
      </div>

      {#if searchSource === 'musicfree'}
        <DesktopSearchMusicFreeResults
          results={mfResults}
          loading={searchLoading}
          {curTrack}
          {playing}
          {onPlayQueue}
          onOpenAddToPlaylist={(item) => addToPlaylistTrack = item}
          {showToast}
        />
      {:else}
        <SearchResultsSection
          {sResults}
          {sType}
          {searchLoading}
          {hasSearched}
          {curTrack}
          {playing}
          {likedSet}
          {onToggleLike}
          {onPlaylist}
          onAlbum={handleAlbum}
          {onPlayQueue}
          {onSong}
          {onReveal}
          onViewArtist={handleViewArtist}
          {handlePlayPlaylist}
          {handleDownloadPlaylist}
          {showToast}
        />
        {#if hasSearched && sResults.length > 0}
          <div style="font-size:12px; color:var(--text-muted); text-align:center; margin-top:8px;">{t('search.resultCount', { count: sResults.length })}</div>
        {/if}
      {/if}
    </AccordionCard>
  </div>

  <!-- Section 2: 专辑解析与整辑下载 (已拆分组件) -->
  <div id="section-album-detail" class="w-full flex-1 flex flex-col">
    <AlbumDetailCard
      flat open={true} {album} {albumLoading} bind:currentAlbumId
      {curTrack} {playing} {likedSet} {downloadedSet}
      onLoadAlbum={loadAlbum} onDownloadFullAlbum={downloadFullAlbum}
      onPlayFullAlbum={playFullAlbum} onDownloadSingleTrack={downloadSingleTrack}
      {onToggleLike} {onPlayQueue} {onReveal} {onSong}
    />
  </div>

  <!-- Section 3: 歌手热门曲目与收藏 -->
  <div id="section-artist-detail" class="w-full flex-1 flex flex-col">
    <ArtistDetailCard
      flat open={true} bind:currentArtistId
      {curTrack} {playing} {likedSet} {downloadedSet}
      {onToggleLike} {onPlayQueue} {onReveal} {onSong} {showToast}
    />
  </div>
</SwipeableTabsView>

{#if addToPlaylistTrack}
  <AddToPlaylistModal
    song={addToPlaylistTrack}
    onClose={() => addToPlaylistTrack = null}
    {showToast}
  />
{/if}
