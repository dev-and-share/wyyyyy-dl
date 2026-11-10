<script lang="ts">
  import { onMount } from 'svelte';
  import {
    myPlaylists,
    isFavoritePlaylist,
    sortPlaylistsByPlayCount,
    getPlaylistPlayCount
  } from '../../lib/playlist.svelte';
  import {
    localPlaylistState,
    loadLocalPlaylists,
    isSystemFavoritesPlaylist,
    cleanPlaylistDisplayName,
    isLocalPlaylist
  } from '../../lib/localPlaylistStore.svelte';
  import { matchesKeyword } from '../../lib/utils';
  import { t } from '../../lib/i18n';

  let {
    onPlaylistClick,
    onPlayPlaylist
  } = $props<{
    onPlaylistClick: (id: string | number) => void;
    onPlayPlaylist?: (id: string, name: string) => void;
  }>();

  let sidebarSearchKw = $state('');
  let filterMode = $state<'all' | 'created' | 'subscribed' | 'local'>('all');

  let allScrollEl = $state<HTMLDivElement | null>(null);
  let createdScrollEl = $state<HTMLDivElement | null>(null);
  let subscribedScrollEl = $state<HTMLDivElement | null>(null);
  let localScrollEl = $state<HTMLDivElement | null>(null);
  let canScrollAll = $state(false);
  let canScrollCreated = $state(false);
  let canScrollSubscribed = $state(false);
  let canScrollLocal = $state(false);

  onMount(() => {
    if (localPlaylistState.playlists.length === 0) {
      loadLocalPlaylists().catch(() => {});
    }
    const handlePlCreated = () => {
      loadLocalPlaylists().catch(() => {});
    };
    window.addEventListener('wyy:playlist-created', handlePlCreated);
    return () => window.removeEventListener('wyy:playlist-created', handlePlCreated);
  });

  // 🎯 全部模式：全局混合排序 (包含云端与本地专属歌单，按热度全局统一排列)
  const allPlaylists = $derived(sortPlaylistsByPlayCount([...myPlaylists, ...localPlaylistState.playlists]));
  const createdPlaylists = $derived(sortPlaylistsByPlayCount(myPlaylists.filter((p: any) => !p.subscribed && !p.isLocal)));
  const subscribedPlaylists = $derived(sortPlaylistsByPlayCount(myPlaylists.filter((p: any) => p.subscribed)));
  const localPlaylists = $derived(sortPlaylistsByPlayCount(localPlaylistState.playlists));

  const filteredAll = $derived(
    sidebarSearchKw.trim()
      ? allPlaylists.filter((p: any) => matchesKeyword(p.name, sidebarSearchKw.trim()))
      : allPlaylists
  );

  const filteredCreated = $derived(
    sidebarSearchKw.trim()
      ? createdPlaylists.filter((p: any) => matchesKeyword(p.name, sidebarSearchKw.trim()))
      : createdPlaylists
  );

  const filteredSubscribed = $derived(
    sidebarSearchKw.trim()
      ? subscribedPlaylists.filter((p: any) => matchesKeyword(p.name, sidebarSearchKw.trim()))
      : subscribedPlaylists
  );

  const filteredLocal = $derived(
    sidebarSearchKw.trim()
      ? localPlaylists.filter((p: any) => matchesKeyword(p.name, sidebarSearchKw.trim()))
      : localPlaylists
  );

  // 🔍 搜索框占位符：直接将各分类的总数量无缝融入 Placeholder，消除多余占位栏
  const searchPlaceholder = $derived.by<string>(() => {
    if (filterMode === 'all') {
      const count = allPlaylists.length;
      return count > 0 ? t('playlist.searchAllCount', { count }) : t('playlist.filterPlaceholder');
    }
    if (filterMode === 'created') {
      const count = createdPlaylists.length;
      return count > 0 ? t('playlist.searchCreatedCount', { count }) : t('playlist.filterPlaceholder');
    }
    if (filterMode === 'subscribed') {
      const count = subscribedPlaylists.length;
      return count > 0 ? t('playlist.searchSubscribedCount', { count }) : t('playlist.filterPlaceholder');
    }
    if (filterMode === 'local') {
      const count = localPlaylists.length;
      return count > 0 ? t('playlist.searchLocalCount', { count }) : t('playlist.filterPlaceholder');
    }
    return t('playlist.filterPlaceholder');
  });

  function checkAllScroll() {
    if (!allScrollEl) return;
    const { scrollTop, scrollHeight, clientHeight } = allScrollEl;
    canScrollAll = scrollHeight - scrollTop - clientHeight > 4;
  }

  function checkCreatedScroll() {
    if (!createdScrollEl) return;
    const { scrollTop, scrollHeight, clientHeight } = createdScrollEl;
    canScrollCreated = scrollHeight - scrollTop - clientHeight > 4;
  }

  function checkSubscribedScroll() {
    if (!subscribedScrollEl) return;
    const { scrollTop, scrollHeight, clientHeight } = subscribedScrollEl;
    canScrollSubscribed = scrollHeight - scrollTop - clientHeight > 4;
  }

  function checkLocalScroll() {
    if (!localScrollEl) return;
    const { scrollTop, scrollHeight, clientHeight } = localScrollEl;
    canScrollLocal = scrollHeight - scrollTop - clientHeight > 4;
  }

  $effect(() => {
    filteredAll;
    filteredCreated;
    filteredSubscribed;
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        checkAllScroll();
        checkCreatedScroll();
        checkSubscribedScroll();
      });
    } else {
      checkAllScroll();
      checkCreatedScroll();
      checkSubscribedScroll();
    }
  });

  $effect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      checkCreatedScroll();
      checkSubscribedScroll();
    });
    if (createdScrollEl) ro.observe(createdScrollEl);
    if (subscribedScrollEl) ro.observe(subscribedScrollEl);
    return () => ro.disconnect();
  });
</script>

<div class="flex-1 min-h-0 flex flex-col px-2 py-2 gap-1 overflow-hidden">
  <!-- 1. 过滤胶囊选择器：全部 | 自建 | 收藏 | 本地 -->
  <div class="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--btn-secondary-bg)]/80 shrink-0 text-[10px]">
    <button
      type="button"
      data-testid="sidebar-filter-all"
      class="flex-1 py-0.5 px-1 rounded text-center font-medium cursor-pointer border-none transition-colors truncate whitespace-nowrap {filterMode === 'all' ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-xs font-bold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}"
      onclick={() => filterMode = 'all'}
      title={t('playlist.filterAll')}
    >
      {t('playlist.filterAll')}
    </button>
    <button
      type="button"
      data-testid="sidebar-filter-created"
      class="flex-1 py-0.5 px-1 rounded text-center font-medium cursor-pointer border-none transition-colors truncate whitespace-nowrap {filterMode === 'created' ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-xs font-bold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}"
      onclick={() => filterMode = 'created'}
      title={t('playlist.filterCreated')}
    >
      {t('playlist.filterCreated')}
    </button>
    <button
      type="button"
      data-testid="sidebar-filter-subscribed"
      class="flex-1 py-0.5 px-1 rounded text-center font-medium cursor-pointer border-none transition-colors truncate whitespace-nowrap {filterMode === 'subscribed' ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-xs font-bold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}"
      onclick={() => filterMode = 'subscribed'}
      title={t('playlist.filterSubscribed')}
    >
      {t('playlist.filterSubscribed')}
    </button>
    <button
      type="button"
      data-testid="sidebar-filter-local"
      class="flex-1 py-0.5 px-1 rounded text-center font-medium cursor-pointer border-none transition-colors truncate whitespace-nowrap {filterMode === 'local' ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-xs font-bold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}"
      onclick={() => filterMode = 'local'}
      title={t('playlist.filterLocal')}
    >
      {t('playlist.filterLocal')}
    </button>
  </div>

  <!-- 2. 搜索框 -->
  <div class="relative shrink-0 my-0.5">
    <input
      type="text"
      placeholder={searchPlaceholder}
      class="w-full pl-6 pr-2 py-1 rounded-lg text-[11px] bg-[var(--input-bg)] text-[var(--text-main)] border border-[var(--input-border)] focus:outline-none focus:border-red-400/60 transition-colors"
      bind:value={sidebarSearchKw}
    />
    <span class="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] opacity-40 pointer-events-none">🔍</span>
    {#if sidebarSearchKw}
      <button
        type="button"
        class="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer p-0 bg-transparent border-none leading-none"
        onclick={() => sidebarSearchKw = ''}
      >✕</button>
    {/if}
  </div>

  <!-- 3. 歌单展示区域 (全部模式下彻底混合排序，自建/收藏分类模式下独立展示) -->
  {#if filterMode === 'all'}
    <!-- 🎯 全部模式：自建与收藏彻底混合，按播放热度全局统一排序 -->
    <div class="relative flex-1 min-h-0 flex flex-col">
      <div
        bind:this={allScrollEl}
        onscroll={checkAllScroll}
        class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar"
      >
        {#if filteredAll.length > 0}
          {#each filteredAll as pl (pl.id)}
            {@const playCount = getPlaylistPlayCount(pl.id)}
            <div class="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)] transition-colors">
              <button
                type="button"
                class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer bg-transparent border-none p-0 text-inherit"
                onclick={() => onPlaylistClick(pl.id)}
                title={cleanPlaylistDisplayName(pl)}
              >
                <span class="shrink-0 text-xs text-[var(--text-muted)] {pl.subscribed ? 'group-hover:text-amber-400' : (pl.isLocal || isLocalPlaylist(pl.id)) ? 'group-hover:text-emerald-400' : 'group-hover:text-red-400'}">
                  {pl.subscribed ? '⭐' : (pl.isLocal || isLocalPlaylist(pl.id)) ? (isSystemFavoritesPlaylist(pl.id) ? '❤️' : '🖥️') : isFavoritePlaylist(pl) ? '❤️' : '📂'}
                </span>
                <span class="truncate flex-1 font-medium">{cleanPlaylistDisplayName(pl)}</span>
                {#if playCount > 0}
                  <span
                    data-testid="sidebar-playcount-{pl.id}"
                    class="text-[10px] text-amber-400/90 font-medium shrink-0 flex items-center gap-0.5 group-hover:opacity-0 transition-opacity"
                    title={t('myPlaylists.historyPlayTooltip', { count: playCount })}
                  >🔥 {playCount}</span>
                {/if}
                {#if typeof pl.trackCount === 'number'}
                  <span class="text-[10px] text-[var(--text-muted)] shrink-0 group-hover:opacity-0 transition-opacity">{pl.trackCount}</span>
                {/if}
              </button>
              {#if onPlayPlaylist}
                <button
                  type="button"
                  data-testid="sidebar-playbtn-{pl.id}"
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[9px] flex items-center justify-center transition-all duration-150 cursor-pointer border-none shadow-md"
                  onclick={(e) => { e.stopPropagation(); onPlayPlaylist(String(pl.id), pl.name); }}
                  title={t('playlist.playWholePlaylistTooltip')}
                >▶</button>
              {/if}
            </div>
          {/each}
        {:else}
          <div class="px-2 py-3 text-center text-xs text-[var(--text-muted)]">
            {sidebarSearchKw ? t('sidebar.noMatch') : t('playlist.noPlaylistsData')}
          </div>
        {/if}
      </div>
      <div
        data-testid="sidebar-all-scroll-shadow"
        class="pointer-events-none absolute bottom-0 left-0 right-0 h-7 bg-gradient-to-t from-[var(--card-bg-solid,#111827)] to-transparent transition-opacity duration-200 {canScrollAll ? 'opacity-100' : 'opacity-0'}"
        aria-hidden="true"
      ></div>
    </div>
  {:else if filterMode === 'created'}
    <!-- 自建歌单独立展示 -->
    <div class="relative flex-1 min-h-0 flex flex-col">
      <div
        bind:this={createdScrollEl}
        onscroll={checkCreatedScroll}
        class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar"
      >
        {#if filteredCreated.length > 0}
          {#each filteredCreated as pl (pl.id)}
            {@const playCount = getPlaylistPlayCount(pl.id)}
            <div class="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)] transition-colors">
              <button
                type="button"
                class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer bg-transparent border-none p-0 text-inherit"
                onclick={() => onPlaylistClick(pl.id)}
                title={cleanPlaylistDisplayName(pl)}
              >
                <span class="shrink-0 text-xs text-[var(--text-muted)] group-hover:text-red-400">
                  {isFavoritePlaylist(pl) ? '❤️' : '📂'}
                </span>
                <span class="truncate flex-1 font-medium">{cleanPlaylistDisplayName(pl)}</span>
                {#if playCount > 0}
                  <span
                    data-testid="sidebar-playcount-{pl.id}"
                    class="text-[10px] text-amber-400/90 font-medium shrink-0 flex items-center gap-0.5 group-hover:opacity-0 transition-opacity"
                    title={t('myPlaylists.historyPlayTooltip', { count: playCount })}
                  >🔥 {playCount}</span>
                {/if}
                {#if typeof pl.trackCount === 'number'}
                  <span class="text-[10px] text-[var(--text-muted)] shrink-0 group-hover:opacity-0 transition-opacity">{pl.trackCount}</span>
                {/if}
              </button>
              {#if onPlayPlaylist}
                <button
                  type="button"
                  data-testid="sidebar-playbtn-{pl.id}"
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[9px] flex items-center justify-center transition-all duration-150 cursor-pointer border-none shadow-md"
                  onclick={(e) => { e.stopPropagation(); onPlayPlaylist(String(pl.id), pl.name); }}
                  title={t('playlist.playWholePlaylistTooltip')}
                >▶</button>
              {/if}
            </div>
          {/each}
        {:else}
          <div class="px-2 py-3 text-center text-xs text-[var(--text-muted)]">
            {sidebarSearchKw ? t('sidebar.noMatch') : t('playlist.noPlaylistsData')}
          </div>
        {/if}
      </div>
      <div
        data-testid="sidebar-created-scroll-shadow"
        class="pointer-events-none absolute bottom-0 left-0 right-0 h-7 bg-gradient-to-t from-[var(--card-bg-solid,#111827)] to-transparent transition-opacity duration-200 {canScrollCreated ? 'opacity-100' : 'opacity-0'}"
        aria-hidden="true"
      ></div>
    </div>
  {:else if filterMode === 'subscribed'}
    <!-- 收藏歌单独立展示 -->
    <div class="relative flex-1 min-h-0 flex flex-col">
      <div
        bind:this={subscribedScrollEl}
        onscroll={checkSubscribedScroll}
        class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar"
      >
        {#if filteredSubscribed.length > 0}
          {#each filteredSubscribed as pl (pl.id)}
            {@const playCount = getPlaylistPlayCount(pl.id)}
            <div class="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)] transition-colors">
              <button
                type="button"
                class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer bg-transparent border-none p-0 text-inherit"
                onclick={() => onPlaylistClick(pl.id)}
                title={pl.name}
              >
                <span class="shrink-0 text-xs text-[var(--text-muted)] group-hover:text-amber-400">⭐</span>
                <span class="truncate flex-1 font-medium">{pl.name}</span>
                {#if playCount > 0}
                  <span
                    data-testid="sidebar-playcount-{pl.id}"
                    class="text-[10px] text-amber-400/90 font-medium shrink-0 flex items-center gap-0.5 group-hover:opacity-0 transition-opacity"
                    title={t('myPlaylists.historyPlayTooltip', { count: playCount })}
                  >🔥 {playCount}</span>
                {/if}
                {#if typeof pl.trackCount === 'number'}
                  <span class="text-[10px] text-[var(--text-muted)] shrink-0 group-hover:opacity-0 transition-opacity">{pl.trackCount}</span>
                {/if}
              </button>
              {#if onPlayPlaylist}
                <button
                  type="button"
                  data-testid="sidebar-playbtn-{pl.id}"
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[9px] flex items-center justify-center transition-all duration-150 cursor-pointer border-none shadow-md"
                  onclick={(e) => { e.stopPropagation(); onPlayPlaylist(String(pl.id), pl.name); }}
                  title={t('playlist.playWholePlaylistTooltip')}
                >▶</button>
              {/if}
            </div>
          {/each}
        {:else}
          <div class="px-2 py-3 text-center text-xs text-[var(--text-muted)]">
            {sidebarSearchKw ? t('sidebar.noMatch') : t('sidebar.noSubscribedPlaylists')}
          </div>
        {/if}
      </div>
      <div
        data-testid="sidebar-subscribed-scroll-shadow"
        class="pointer-events-none absolute bottom-0 left-0 right-0 h-7 bg-gradient-to-t from-[var(--card-bg-solid,#111827)] to-transparent transition-opacity duration-200 {canScrollSubscribed ? 'opacity-100' : 'opacity-0'}"
        aria-hidden="true"
      ></div>
    </div>
  {:else if filterMode === 'local'}
    <!-- 🖥️ 本地专属歌单独立展示 -->
    <div class="relative flex-1 min-h-0 flex flex-col">
      <div
        bind:this={localScrollEl}
        onscroll={checkLocalScroll}
        class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar"
      >
        {#if filteredLocal.length > 0}
          {#each filteredLocal as pl (pl.id)}
            {@const playCount = getPlaylistPlayCount(pl.id)}
            {@const isSysFav = isSystemFavoritesPlaylist(pl.id)}
            <div class="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)] transition-colors">
              <button
                type="button"
                class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer bg-transparent border-none p-0 text-inherit"
                onclick={() => onPlaylistClick(pl.id)}
                title={cleanPlaylistDisplayName(pl)}
              >
                <span class="shrink-0 text-xs text-[var(--text-muted)] group-hover:text-emerald-400">
                  {isSysFav ? '❤️' : '🖥️'}
                </span>
                <span class="truncate flex-1 font-medium">{cleanPlaylistDisplayName(pl)}</span>
                {#if playCount > 0}
                  <span
                    data-testid="sidebar-playcount-{pl.id}"
                    class="text-[10px] text-amber-400/90 font-medium shrink-0 flex items-center gap-0.5 group-hover:opacity-0 transition-opacity"
                    title={t('myPlaylists.historyPlayTooltip', { count: playCount })}
                  >🔥 {playCount}</span>
                {/if}
                {#if typeof pl.trackCount === 'number'}
                  <span class="text-[10px] text-[var(--text-muted)] shrink-0 group-hover:opacity-0 transition-opacity">{pl.trackCount}</span>
                {/if}
              </button>
              {#if onPlayPlaylist}
                <button
                  type="button"
                  data-testid="sidebar-playbtn-{pl.id}"
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[9px] flex items-center justify-center transition-all duration-150 cursor-pointer border-none shadow-md"
                  onclick={(e) => { e.stopPropagation(); onPlayPlaylist(String(pl.id), pl.name); }}
                  title={t('playlist.playWholePlaylistTooltip')}
                >▶</button>
              {/if}
            </div>
          {/each}
        {:else}
          <div class="px-2 py-3 text-center text-xs text-[var(--text-muted)]">
            {sidebarSearchKw ? t('sidebar.noMatch') : t('sidebar.noLocalPlaylists')}
          </div>
        {/if}
      </div>
      <div
        data-testid="sidebar-local-scroll-shadow"
        class="pointer-events-none absolute bottom-0 left-0 right-0 h-7 bg-gradient-to-t from-[var(--card-bg-solid,#111827)] to-transparent transition-opacity duration-200 {canScrollLocal ? 'opacity-100' : 'opacity-0'}"
        aria-hidden="true"
      ></div>
    </div>
  {/if}
</div>
