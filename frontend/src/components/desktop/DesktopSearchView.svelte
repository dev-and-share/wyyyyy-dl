<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER, formatCoverUrl, getApiCache, setApiCache } from '../../lib/utils';
  import type { Track } from '../../lib/types';
  import SlotBtn from '../SlotBtn.svelte';
  import TrackLikeBtn from '../TrackLikeBtn.svelte';
  import TrackSourceBadge from '../TrackSourceBadge.svelte';
  import AddToPlaylistModal from '../AddToPlaylistModal.svelte';
  import DesktopArtistDetail from './DesktopArtistDetail.svelte';
  import { cacheTrackToBrowser } from '../../lib/pwaCache.svelte';
  import { getTrackSourceStatus, getTrackPlayActionLabel, isSameTrack } from '../../lib/trackStatus.svelte';
  import { routerState } from '../../lib/router.svelte';
  import { t } from '../../lib/i18n';

  let {
    curTrack = null,
    playing = false,
    downloadedSet = new Set<number>(),
    likedSet = new Set<number>(),
    onToggleLike,
    onAlbum,
    onPlaylist,
    onPlayQueue,
    onSong,
    onReveal,
    showToast
  } = $props<{
    curTrack?: Track | null;
    playing?: boolean;
    downloadedSet?: Set<number>;
    likedSet?: Set<number>;
    onToggleLike?: (id: number, name: string, artist?: string) => void;
    onAlbum?: (id: string, name?: string) => void;
    onPlaylist: (id: string) => void;
    onPlayQueue?: (tracks: any[], idx?: number) => void;
    onSong?: (id: string) => void;
    onReveal?: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  const STORAGE_KEY_KW = 'wyyyy_search_kw';
  const STORAGE_KEY_TYPE = 'wyyyy_search_type';
  const STORAGE_KEY_HISTORY = 'wyyyy_desktop_search_history';

  let kw = $state('');
  let sType = $state('1'); // 1: song, 10: album, 1000: playlist, 100: artist
  let sLimit = $state(30);
  let sResults = $state<any[]>([]);
  let searchLoading = $state(false);
  let hasSearched = $state(false);
  let cachingTrackId = $state<number | null>(null);
  let addToPlaylistSong = $state<{ id: number; name: string; artist: string } | null>(null);
  let searchHistory = $state<string[]>([]);
  let activeArtistId = $state('');

  let lastHandledAlbumTrigger = 0;
  $effect(() => {
    if (routerState.albumTrigger > 0 && routerState.albumTrigger !== lastHandledAlbumTrigger) {
      lastHandledAlbumTrigger = routerState.albumTrigger;
      activeArtistId = '';
      sType = '10';
      const searchWord = routerState.albumName || routerState.albumId;
      if (searchWord) {
        kw = searchWord;
        executeSearch(searchWord);
      }
    }
  });

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      kw = localStorage.getItem(STORAGE_KEY_KW) || '';
      sType = localStorage.getItem(STORAGE_KEY_TYPE) || '1';
      try {
        const hist = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (hist) searchHistory = JSON.parse(hist);
      } catch {}
    }
    if (kw.trim()) {
      const cacheKey = 'search_' + sType + '_' + kw.trim();
      const cached = getApiCache(cacheKey);
      if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
        sResults = cached.data;
        hasSearched = true;
      }
    }
  });

  function saveHistory(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [trimmed, ...searchHistory.filter(item => item !== trimmed)].slice(0, 10);
    searchHistory = next;
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(next));
    } catch {}
  }

  function clearHistory() {
    searchHistory = [];
    try {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    } catch {}
  }

  async function executeSearch(targetKw = kw, showEmptyToast = true) {
    const query = targetKw.trim();
    if (!query) {
      showToast(t('search.enterKeyword'), 'warning');
      return;
    }
    kw = query;
    hasSearched = true;
    saveHistory(query);

    try {
      localStorage.setItem(STORAGE_KEY_KW, query);
      localStorage.setItem(STORAGE_KEY_TYPE, sType);
    } catch {}

    const cacheKey = 'search_' + sType + '_' + query;
    const cached = getApiCache(cacheKey);
    if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
      sResults = cached.data;
    } else {
      searchLoading = true;
    }

    try {
      const j = await api.search(query, sType, String(sLimit));
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
      if (showEmptyToast) showToast(t('search.failedWithMsg', { message: e?.message || e }), 'error');
    }
  }

  function handleTypeChange(typeStr: string) {
    sType = typeStr;
    if (kw.trim()) {
      executeSearch(kw, false).catch(() => {});
    }
  }

  async function handleDownloadTrack(id: string, name?: string) {
    try {
      const res = await api.downloadSingle(id);
      const task = res?.data;
      const songName = task?.name || name || t('common.unknownSong');
      if (task?.status === 'SKIP') {
        showToast(t('download.skippedWithName', { name: songName, reason: task.errorMsg || t('download.skipReasonPreviewOrExist') }), 'warning', 4000);
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

  async function handleDownloadPlaylist(id: string, name: string) {
    try {
      await api.downloadPlaylist(id);
      showToast(t('search.submittedPlaylist', { name }), 'success');
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.submitFailedWithMsg', { message: e?.message || e }), 'error');
    }
  }

  async function handleDownloadAlbum(id: string, name: string) {
    try {
      await api.downloadAlbum(id);
      showToast(t('search.submittedAlbum', { name }), 'success');
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.submitFailedWithMsg', { message: e?.message || e }), 'error');
    }
  }

  async function handleCache(item: any) {
    cachingTrackId = item.id;
    try {
      const res = await cacheTrackToBrowser({
        id: item.id,
        name: item.name,
        artist: formatArtist(item),
        cover: item.al?.picUrl || item.picUrl || DEFAULT_VINYL_COVER,
        album: item.al?.name || item.album
      });
      showToast(res.msg || (res.success ? t('search.cachedToBrowser') : t('common.failed')), res.success ? 'success' : 'error');
    } catch (e: any) {
      showToast(t('search.cacheFailedWithMsg', { message: e?.message || e }), 'error');
    } finally {
      cachingTrackId = null;
    }
  }
</script>

<!-- 🖥️ PC 桌面端：搜索中心全宽直铺 (去手风琴化) -->
<div class="flex flex-col gap-4 select-none animate-fade-in" data-testid="desktop-search-view">
  {#if activeArtistId}
    <DesktopArtistDetail
      artistId={activeArtistId}
      {curTrack}
      {playing}
      {likedSet}
      {downloadedSet}
      onBackToSearch={() => activeArtistId = ''}
      {onToggleLike}
      {onPlayQueue}
      {onAlbum}
      {onSong}
      {onReveal}
      {showToast}
    />
  {:else}
    <!-- 1. 顶部控制栏：搜索类型胶囊 + 大搜索框 + 单页条数 (右侧 lg:pr-[220px] 避让控制胶囊) -->
    <div class="flex flex-col gap-3 p-4 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] shadow-sm lg:pr-[220px]">
    <!-- 类型切换 -->
    <div class="flex items-center gap-1.5 flex-wrap">
      <button type="button" data-testid="search-type-1" class="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border-none transition-all {sType === '1' ? 'bg-red-500 text-white shadow-md shadow-red-500/20 scale-105' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}" onclick={() => handleTypeChange('1')}>{t('search.typeSong')}</button>
      <button type="button" data-testid="search-type-10" class="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border-none transition-all {sType === '10' ? 'bg-red-500 text-white shadow-md shadow-red-500/20 scale-105' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}" onclick={() => handleTypeChange('10')}>{t('search.typeAlbum')}</button>
      <button type="button" data-testid="search-type-1000" class="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border-none transition-all {sType === '1000' ? 'bg-red-500 text-white shadow-md shadow-red-500/20 scale-105' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}" onclick={() => handleTypeChange('1000')}>{t('search.typePlaylist')}</button>
      <button type="button" data-testid="search-type-100" class="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border-none transition-all {sType === '100' ? 'bg-red-500 text-white shadow-md shadow-red-500/20 scale-105' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}" onclick={() => handleTypeChange('100')}>{t('search.typeArtist')}</button>
    </div>

    <!-- 搜索输入框与条数 -->
    <div class="flex items-center gap-2.5">
      <div class="relative flex-1">
        <input
          type="search"
          data-testid="desktop-search-input"
          placeholder={t('search.desktopInputPlaceholder')}
          class="w-full pl-9 pr-8 py-2.5 rounded-xl text-xs bg-[var(--input-bg)] text-[var(--text-main)] border border-[var(--input-border)] focus:outline-none focus:border-red-500 transition-colors"
          bind:value={kw}
          onkeydown={(e) => e.key === 'Enter' && executeSearch()}
        />
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs opacity-50">🔍</span>
        {#if kw}
          <button
            type="button"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer border-none bg-transparent"
            onclick={() => kw = ''}
          >
            ✕
          </button>
        {/if}
      </div>

      <select bind:value={sLimit} class="w-auto px-2.5 py-2.5 rounded-xl text-xs bg-[var(--input-bg)] text-[var(--text-main)] border border-[var(--input-border)] shrink-0 cursor-pointer" title={t('search.limitPerPage')}>
        {#each [20, 30, 50, 100] as lim}
          <option value={lim}>{t('search.itemsCount', { count: lim })}</option>
        {/each}
      </select>

      <button type="button" data-testid="desktop-search-btn" class="btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer shadow-md shrink-0" onclick={() => executeSearch()}>
        {t('common.search')}
      </button>
    </div>

    <!-- 历史搜索标签 -->
    {#if searchHistory.length > 0}
      <div class="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-[var(--text-muted)]">
        <span>{t('search.recentSearches')}</span>
        {#each searchHistory as term}
          <button type="button" class="px-2 py-0.5 rounded-md bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer border-none transition-colors" onclick={() => executeSearch(term)}>{term}</button>
        {/each}
        <button type="button" class="text-[10px] text-[var(--text-muted)] hover:text-red-400 cursor-pointer border-none bg-transparent ml-1" onclick={clearHistory}>{t('common.clear')}</button>
      </div>
    {/if}
  </div>

  <!-- 2. 结果展示区 (去手风琴化) -->
  {#if searchLoading}
    <div class="py-20 text-center flex flex-col items-center gap-3 text-xs text-[var(--text-muted)]">
      <span class="text-3xl animate-spin">⏳</span>
      <span>{t('search.searchingLibrary')}</span>
    </div>
  {:else if sResults.length > 0}
    {#if sType === '1'}
      <!-- 单曲全宽大表 -->
      <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] overflow-hidden shadow-sm">
        <div class="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>{t('search.searchedSongCount', { count: sResults.length })}</span>
          <span>{t('search.clickToPlayOrDownload')}</span>
        </div>
        <div class="overflow-x-auto max-h-[620px] overflow-y-auto custom-table-scroll">
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
              {#each sResults as r, idx (r.id)}
                {@const artistName = formatArtist(r)}
                {@const status = getTrackSourceStatus(r.id, r.isLocal, curTrack)}
                {@const isPlayingThis = isSameTrack(curTrack, r)}
                <tr class="hover:bg-[var(--card-header-hover)] transition-colors group {isPlayingThis ? 'bg-red-500/10' : ''}">
                  <td class="py-2.5 pl-4 text-[var(--text-muted)] font-mono text-[11px]">
                    {#if isPlayingThis && playing}
                      <span class="text-red-500 animate-pulse">▶</span>
                    {:else}
                      {idx + 1}
                    {/if}
                  </td>
                  <td class="py-2.5 px-3 min-w-0">
                    <div class="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        class="font-semibold text-[var(--text-main)] truncate max-w-xs xl:max-w-md group-hover:text-red-400 transition-colors bg-transparent border-none p-0 cursor-pointer text-left"
                        onclick={() => onSong ? onSong(String(r.id)) : (onPlayQueue && onPlayQueue([{ id: r.id, name: r.name, artist: artistName, cover: r.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }]))}
                      >
                        {r.name}
                      </button>
                      <TrackSourceBadge id={r.id} isLocal={r.isLocal} {curTrack} class="shrink-0" />
                      {#if onToggleLike}
                        <TrackLikeBtn liked={likedSet.has(Number(r.id))} onclick={() => onToggleLike(Number(r.id), r.name, artistName)} />
                      {/if}
                    </div>
                  </td>
                  <td class="py-2.5 px-3 text-[var(--text-secondary)] truncate">
                    {artistName || t('common.variousArtists')}
                  </td>
                  <td class="py-2.5 px-3 text-[var(--text-muted)] truncate hidden md:table-cell">
                    {#if r.al?.id && onAlbum}
                      <button
                        type="button"
                        class="text-left bg-transparent border-none p-0 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer truncate max-w-[160px]"
                        onclick={() => onAlbum(String(r.al.id), r.al?.name)}
                      >
                        {r.al.name || t('search.tab.song')}
                      </button>
                    {:else}
                      <span>{r.al?.name || r.album?.name || t('search.tab.song')}</span>
                    {/if}
                  </td>
                  <td class="py-2.5 pr-4 text-right whitespace-nowrap">
                    <div class="inline-flex items-center justify-end gap-1.5">
                      <SlotBtn
                        playing={isPlayingThis && playing}
                        onclick={() => onPlayQueue && onPlayQueue([{ id: r.id, name: r.name, artist: artistName, cover: r.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                      >
                        {getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal: status.isLocal, variant: 'desktop' })}
                      </SlotBtn>
                      {#if status.isServer}
                        <SlotBtn onclick={() => onReveal && onReveal({ id: r.id, name: r.name, artist: artistName })}>{t('common.reveal')}</SlotBtn>
                      {:else}
                        <SlotBtn onclick={() => handleDownloadTrack(String(r.id), r.name)}>{t('download.downloadSingle')}</SlotBtn>
                      {/if}
                      <SlotBtn onclick={() => handleCache(r)}>
                        {status.isPhone ? t('search.cachedShort') : cachingTrackId === r.id ? '⏳' : t('search.cacheShort')}
                      </SlotBtn>
                      <SlotBtn onclick={() => addToPlaylistSong = { id: r.id, name: r.name, artist: artistName }}>➕</SlotBtn>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {:else if sType === '10'}
      <!-- 专辑网格直铺 -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {#each sResults as al (al.id)}
          <div class="group flex flex-col gap-2 p-3 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--card-header-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-1">
            <div class="relative w-full aspect-square rounded-xl overflow-hidden bg-black/20">
              <img src={formatCoverUrl(al.picUrl, 250)} alt={al.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
            </div>
            <span class="font-semibold text-xs text-[var(--text-main)] truncate group-hover:text-red-400 transition-colors" title={al.name}>{al.name}</span>
            <span class="text-[11px] text-[var(--text-secondary)] truncate">{formatArtist(al.artists || al.artist) || t('common.variousArtists')}</span>
            <div class="flex items-center gap-1.5 pt-1">
              {#if onAlbum}
                <button type="button" class="btn-primary flex-1 py-1 rounded-lg text-[11px] font-semibold cursor-pointer" onclick={() => onAlbum(String(al.id), al.name)}>{t('album.viewShort')}</button>
              {/if}
              <button type="button" class="btn-secondary py-1 px-2 rounded-lg text-[11px] font-semibold cursor-pointer" onclick={() => handleDownloadAlbum(String(al.id), al.name)} title={t('album.downloadFull')}>📥</button>
            </div>
          </div>
        {/each}
      </div>
    {:else if sType === '1000'}
      <!-- 歌单网格直铺 -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {#each sResults as pl (pl.id)}
          <div class="group flex flex-col gap-2 p-3 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--card-header-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-1">
            <div class="relative w-full aspect-square rounded-xl overflow-hidden bg-black/20">
              <img src={formatCoverUrl(pl.coverImgUrl, 250)} alt={pl.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
            </div>
            <span class="font-semibold text-xs text-[var(--text-main)] truncate group-hover:text-red-400 transition-colors" title={pl.name}>{pl.name}</span>
            <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>{t('playlist.trackCount', { count: pl.trackCount || 0 })}</span>
              <span class="truncate max-w-[90px]">{pl.creator?.nickname || ''}</span>
            </div>
            <div class="flex items-center gap-1.5 pt-1">
              <button type="button" class="btn-primary flex-1 py-1 rounded-lg text-[11px] font-semibold cursor-pointer" onclick={() => onPlaylist(String(pl.id))}>{t('playlist.viewShort')}</button>
              <button type="button" class="btn-secondary py-1 px-2 rounded-lg text-[11px] font-semibold cursor-pointer" onclick={() => handleDownloadPlaylist(String(pl.id), pl.name)} title={t('playlist.downloadAllShort')}>📥</button>
            </div>
          </div>
        {/each}
      </div>
    {:else if sType === '100'}
      <!-- 歌手圆形头像网格直铺 (显示 ID 并支持一键查看热门 50 首) -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {#each sResults as ar (ar.id)}
          <div class="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--card-header-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-1 text-center">
            <button
              type="button"
              class="w-20 h-20 rounded-full overflow-hidden bg-black/20 shadow-md border-none p-0 cursor-pointer group-hover:ring-2 ring-red-500/50 transition-all"
              onclick={() => activeArtistId = String(ar.id)}
              title={t('artist.clickToViewTop50WithName', { name: ar.name })}
            >
              <img src={formatCoverUrl(ar.picUrl || ar.img1v1Url, 250)} alt={ar.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
            </button>
            <button
              type="button"
              class="font-bold text-xs text-[var(--text-main)] truncate max-w-full group-hover:text-red-400 transition-colors bg-transparent border-none p-0 cursor-pointer flex items-center gap-1"
              onclick={() => activeArtistId = String(ar.id)}
              title={t('artist.clickToViewTop50')}
            >
              <span>{ar.name}</span>
              <span class="text-[11px] text-[var(--text-muted)] font-normal font-mono">(ID: {ar.id})</span>
            </button>
            <span class="text-[11px] text-[var(--text-muted)]">{t('artist.albumCount', { count: ar.albumSize || 0 })} · {t('artist.songCount', { count: ar.musicSize || 0 })}</span>
            <div class="flex items-center gap-1.5 w-full pt-1">
              <button
                type="button"
                data-testid="btn-artist-view-top50"
                class="btn-primary flex-1 py-1 rounded-lg text-[11px] font-semibold cursor-pointer"
                onclick={() => activeArtistId = String(ar.id)}
                title={t('artist.viewTop50Desc')}
              >
                {t('artist.hotTop50')}
              </button>
              <button
                type="button"
                class="btn-secondary py-1 px-2 rounded-lg text-[11px] font-semibold cursor-pointer shrink-0"
                onclick={() => { sType = '1'; executeSearch(ar.name); }}
                title={t('artist.searchSongsDesc')}
              >
                {t('artist.searchSongs')}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else if hasSearched}
    <div class="py-20 text-center flex flex-col items-center gap-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)]">
      <span class="text-4xl">🔍</span>
      <span class="text-sm font-medium text-[var(--text-secondary)]">{t('search.noResultsForKw', { kw })}</span>
      <span class="text-xs text-[var(--text-muted)]">{t('search.tryDifferentKw')}</span>
    </div>
  {:else}
    <div class="py-20 text-center flex flex-col items-center gap-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)]">
      <span class="text-4xl">🎵</span>
      <span class="text-sm font-bold text-[var(--text-main)]">{t('search.librarySearchTitle')}</span>
      <span class="text-xs text-[var(--text-muted)] max-w-md">{t('search.librarySearchPrompt')}</span>
    </div>
  {/if}

  {#if addToPlaylistSong}
    <AddToPlaylistModal song={addToPlaylistSong} onClose={() => addToPlaylistSong = null} {showToast} />
  {/if}
  {/if}
</div>

<style>
  .custom-table-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
  .custom-table-scroll::-webkit-scrollbar-thumb { background: var(--border-color, rgba(255, 255, 255, 0.15)); border-radius: 4px; }
</style>
