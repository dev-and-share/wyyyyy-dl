<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER, getApiCache, setApiCache } from '../../lib/utils';
  import type { Track } from '../../lib/types';
  import AddToPlaylistModal from '../AddToPlaylistModal.svelte';
  import DesktopArtistDetail from './DesktopArtistDetail.svelte';
  import DesktopSearchNeteaseResults from './DesktopSearchNeteaseResults.svelte';
  import DesktopSearchMusicFreeResults from './DesktopSearchMusicFreeResults.svelte';
  import DesktopViewHeader from './DesktopViewHeader.svelte';
  import { cacheTrackToBrowser } from '../../lib/pwaCache.svelte';
  import { musicFreeStore } from '../../lib/musicfree/musicFreeStore.svelte';
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

  const STORAGE_KEY_KW = 'wyy_search_kw';
  const STORAGE_KEY_TYPE = 'wyy_search_type';
  const STORAGE_KEY_SOURCE = 'wyy_search_source';
  const STORAGE_KEY_HISTORY = 'wyy_desktop_search_history';

  let kw = $state('');
  let sType = $state('1'); // 1: song, 10: album, 1000: playlist, 100: artist
  let searchSource = $state<'netease' | 'musicfree'>('netease');
  let sLimit = $state(30);

  let sResults = $state<any[]>([]);
  let mfResults = $state<any[]>([]);
  let searchLoading = $state(false);
  let hasSearched = $state(false);
  let cachingTrackId = $state<number | null>(null);
  let addToPlaylistSong = $state<any>(null);
  let searchHistory = $state<string[]>([]);
  let activeArtistId = $state('');

  let lastHandledAlbumTrigger = 0;
  $effect(() => {
    if (routerState.albumTrigger > 0 && routerState.albumTrigger !== lastHandledAlbumTrigger) {
      lastHandledAlbumTrigger = routerState.albumTrigger;
      activeArtistId = '';
      searchSource = 'netease';
      sType = '10';
      const searchWord = routerState.albumName || routerState.albumId;
      if (searchWord) {
        kw = searchWord;
        executeSearch(searchWord);
      }
    }
  });

  let lastHandledSearchTrigger = 0;
  $effect(() => {
    if (routerState.searchTrigger > 0 && routerState.searchTrigger !== lastHandledSearchTrigger) {
      lastHandledSearchTrigger = routerState.searchTrigger;
      activeArtistId = '';
      if (routerState.searchSource) {
        searchSource = routerState.searchSource;
      }
      sType = '1';
      if (routerState.searchKeyword) {
        kw = routerState.searchKeyword;
        executeSearch(routerState.searchKeyword);
      }
    }
  });

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      kw = localStorage.getItem(STORAGE_KEY_KW) || '';
      sType = localStorage.getItem(STORAGE_KEY_TYPE) || '1';
      searchSource = (localStorage.getItem(STORAGE_KEY_SOURCE) as any) || 'netease';
      try {
        const hist = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (hist) searchHistory = JSON.parse(hist);
      } catch {}
    }
    if (kw.trim()) {
      executeSearch(kw.trim(), false).catch(() => {});
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
      localStorage.setItem(STORAGE_KEY_SOURCE, searchSource);
    } catch {}

    searchLoading = true;

    // 1. MusicFree 跨源检索分支
    if (searchSource === 'musicfree') {
      try {
        const res = await musicFreeStore.searchAll(query, 1);
        mfResults = res.results || [];
        searchLoading = false;
        if (!mfResults.length && showEmptyToast) {
          showToast('未在已启用的 MusicFree 插件中找到相关结果', 'info');
        }
      } catch (e: any) {
        searchLoading = false;
        if (showEmptyToast) showToast('插件检索异常: ' + (e?.message || e), 'error');
      }
      return;
    }

    // 2. 网易云原生检索分支
    const cacheKey = 'search_' + sType + '_' + query;
    const cached = getApiCache(cacheKey);
    if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
      sResults = cached.data;
      searchLoading = false;
      return;
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

  function handleSourceChange(source: 'netease' | 'musicfree') {
    searchSource = source;
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
      window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.requestFailed', { error: e?.message || e }), 'error');
    }
  }

  async function handleDownloadPlaylist(id: string, name: string) {
    try {
      await api.downloadPlaylist(id);
      showToast(t('search.submittedPlaylist', { name }), 'success');
      window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.submitFailedWithMsg', { message: e?.message || e }), 'error');
    }
  }

  async function handleDownloadAlbum(id: string, name: string) {
    try {
      await api.downloadAlbum(id);
      showToast(t('search.submittedAlbum', { name }), 'success');
      window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
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

<!-- 🖥️ PC 桌面端：搜索中心 -->
<div class="flex flex-col gap-4 select-none animate-fade-in" data-testid="desktop-search-view">
  {#if activeArtistId}
    <DesktopArtistDetail
      artistId={activeArtistId}
      {curTrack}
      {playing}
      {downloadedSet}
      {likedSet}
      onBackToSearch={() => activeArtistId = ''}
      {onToggleLike}
      {onAlbum}
      {onPlayQueue}
      {onSong}
      {onReveal}
      {showToast}
    />
  {:else}
    <!-- 1. 统一桌面 Header：大标题 + 状态 Badge + 音源切换胶囊 -->
    <DesktopViewHeader
      icon="🔍"
      title={t('topbar.search')}
      badge={searchSource === 'musicfree' ? '聚合检索' : '官方直连'}
      badgeType={searchSource === 'musicfree' ? 'purple' : 'default'}
      subtitle="全网多源搜索引擎"
    >
      {#snippet actions()}
        <!-- 🎯 音源来源选择器 (统一规格胶囊) -->
        <div class="flex items-center gap-1 p-1 rounded-xl bg-black/10 dark:bg-white/5 border border-[var(--border-subtle)] shrink-0">
          <button
            type="button"
            data-testid="desktop-search-source-netease"
            class="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {searchSource === 'netease' ? 'bg-red-500 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
            onclick={() => handleSourceChange('netease')}
          >
            <span>☁️</span> <span>网易云</span>
          </button>
          <button
            type="button"
            data-testid="desktop-search-source-musicfree"
            class="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {searchSource === 'musicfree' ? 'bg-purple-600 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
            onclick={() => handleSourceChange('musicfree')}
          >
            <span>🧩</span> <span>MusicFree 聚合</span>
          </button>
        </div>
      {/snippet}
    </DesktopViewHeader>

    <!-- 2. 搜索控制栏：搜索类型胶囊 + 大搜索框 -->
    <div class="flex flex-col gap-3 p-4 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] shadow-sm">
      <!-- 搜索类型切换 -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <button type="button" data-testid="search-type-1" class="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border-none transition-all {sType === '1' ? 'bg-red-500 text-white shadow-md shadow-red-500/20 scale-105' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}" onclick={() => handleTypeChange('1')}>{t('search.typeSong')}</button>
        {#if searchSource === 'netease'}
          <button type="button" data-testid="search-type-10" class="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border-none transition-all {sType === '10' ? 'bg-red-500 text-white shadow-md shadow-red-500/20 scale-105' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}" onclick={() => handleTypeChange('10')}>{t('search.typeAlbum')}</button>
          <button type="button" data-testid="search-type-1000" class="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border-none transition-all {sType === '1000' ? 'bg-red-500 text-white shadow-md shadow-red-500/20 scale-105' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}" onclick={() => handleTypeChange('1000')}>{t('search.typePlaylist')}</button>
          <button type="button" data-testid="search-type-100" class="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border-none transition-all {sType === '100' ? 'bg-red-500 text-white shadow-md shadow-red-500/20 scale-105' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}" onclick={() => handleTypeChange('100')}>{t('search.typeArtist')}</button>
        {/if}
      </div>

      <!-- 搜索输入框与条数 -->
      <div class="flex items-center gap-2.5">
        <div class="relative flex-1">
          <input
            type="search"
            data-testid="desktop-search-input"
            placeholder={searchSource === 'musicfree' ? '输入歌曲或歌手，跨所有启用插件并行检索...' : t('search.desktopInputPlaceholder')}
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
            >✕</button>
          {/if}
        </div>

        {#if searchSource === 'netease'}
          <select bind:value={sLimit} class="w-auto px-2.5 py-2.5 rounded-xl text-xs bg-[var(--input-bg)] text-[var(--text-main)] border border-[var(--input-border)] shrink-0 cursor-pointer" title={t('search.limitPerPage')}>
            {#each [20, 30, 50, 100] as lim}
              <option value={lim}>{t('search.itemsCount', { count: lim })}</option>
            {/each}
          </select>
        {/if}

        <button type="button" data-testid="desktop-search-btn" class="btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer shadow-md shrink-0 {searchSource === 'musicfree' ? '!bg-purple-600 hover:!bg-purple-500' : ''}" onclick={() => executeSearch()}>
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

    <!-- 2. 结果展示区 -->
    {#if searchLoading}
      <div class="py-20 text-center flex flex-col items-center gap-3 text-xs text-[var(--text-muted)]">
        <span class="text-3xl animate-spin">⏳</span>
        <span>{searchSource === 'musicfree' ? '正在调用插件跨源检索中...' : t('search.searchingLibrary')}</span>
      </div>
    {:else if searchSource === 'musicfree'}
      <DesktopSearchMusicFreeResults
        results={mfResults}
        loading={searchLoading}
        {curTrack}
        {playing}
        {onPlayQueue}
        onOpenAddToPlaylist={(track) => addToPlaylistSong = track}
        {showToast}
      />
    {:else if sResults.length > 0}
      <DesktopSearchNeteaseResults
        results={sResults}
        {sType}
        {curTrack}
        {playing}
        {likedSet}
        {cachingTrackId}
        {onToggleLike}
        {onAlbum}
        {onPlaylist}
        {onPlayQueue}
        {onSong}
        {onReveal}
        onDownloadTrack={handleDownloadTrack}
        onDownloadAlbum={handleDownloadAlbum}
        onDownloadPlaylist={handleDownloadPlaylist}
        onCacheTrack={handleCache}
        onOpenAddToPlaylist={(track) => addToPlaylistSong = track}
        onSelectArtist={(id) => activeArtistId = id}
        onSearchSongsForArtist={(name) => { sType = '1'; executeSearch(name); }}
      />
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
  :global(.custom-table-scroll::-webkit-scrollbar) { width: 6px; height: 6px; }
  :global(.custom-table-scroll::-webkit-scrollbar-thumb) { background: rgba(150, 150, 150, 0.25); border-radius: 4px; }
</style>
