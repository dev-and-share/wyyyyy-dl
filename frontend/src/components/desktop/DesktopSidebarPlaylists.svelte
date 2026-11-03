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
    createLocalPlaylist
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
  let filterMode = $state<'all' | 'netease' | 'local'>('all');
  let showCreateInput = $state(false);
  let newLocalName = $state('');

  let createdScrollEl = $state<HTMLDivElement | null>(null);
  let subscribedScrollEl = $state<HTMLDivElement | null>(null);
  let localScrollEl = $state<HTMLDivElement | null>(null);
  let canScrollCreated = $state(false);
  let canScrollSubscribed = $state(false);

  onMount(() => {
    loadLocalPlaylists().catch(() => {});
  });

  const createdPlaylists = $derived(sortPlaylistsByPlayCount(myPlaylists.filter((p: any) => !p.subscribed)));
  const subscribedPlaylists = $derived(sortPlaylistsByPlayCount(myPlaylists.filter((p: any) => p.subscribed)));

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
      ? localPlaylistState.playlists.filter((p: any) => matchesKeyword(p.name, sidebarSearchKw.trim()))
      : localPlaylistState.playlists
  );

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

  $effect(() => {
    filteredCreated;
    filteredSubscribed;
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        checkCreatedScroll();
        checkSubscribedScroll();
      });
    } else {
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

  async function handleQuickCreateLocal() {
    if (!newLocalName.trim()) return;
    await createLocalPlaylist(newLocalName.trim());
    newLocalName = '';
    showCreateInput = false;
  }
</script>

<div class="flex-1 min-h-0 flex flex-col px-2 py-2 gap-1 overflow-hidden">
  <!-- 1. 过滤胶囊选择器：全部 | 网易云 | 本地 -->
  <div class="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--btn-secondary-bg)]/80 shrink-0 text-[10px]">
    <button
      type="button"
      class="flex-1 py-0.5 rounded text-center font-medium cursor-pointer border-none transition-colors {filterMode === 'all' ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-xs font-bold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}"
      onclick={() => filterMode = 'all'}
    >
      全部
    </button>
    <button
      type="button"
      class="flex-1 py-0.5 rounded text-center font-medium cursor-pointer border-none transition-colors {filterMode === 'netease' ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-xs font-bold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}"
      onclick={() => filterMode = 'netease'}
    >
      ☁️ 网易云
    </button>
    <button
      type="button"
      class="flex-1 py-0.5 rounded text-center font-medium cursor-pointer border-none transition-colors {filterMode === 'local' ? 'bg-[var(--card-bg)] text-emerald-400 shadow-xs font-bold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}"
      onclick={() => filterMode = 'local'}
    >
      🖥️ 本地
    </button>
  </div>

  <!-- 2. 搜索框 -->
  <div class="relative shrink-0 my-0.5">
    <input
      type="text"
      placeholder={t('playlist.filterPlaceholder')}
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

  <!-- 3. 本地专属自建歌单区域 (当 filterMode 为 'all' 或 'local') -->
  {#if filterMode === 'all' || filterMode === 'local'}
    <div class="flex-col {filterMode === 'local' ? 'flex-1 min-h-0' : 'max-h-[140px] shrink-0'} flex border-b border-[var(--border-subtle)] pb-1 mb-1">
      <div class="px-2.5 py-1 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center justify-between sticky top-0 bg-[var(--card-bg-solid,#111827)] z-10 border-b border-[var(--border-subtle)]/30">
        <span class="flex items-center gap-1"><span>🖥️</span> <span>本地歌单</span></span>
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] opacity-70">{filteredLocal.length}</span>
          <button
            type="button"
            class="text-[10px] text-emerald-400 hover:text-emerald-300 font-normal bg-transparent border-none cursor-pointer"
            onclick={() => showCreateInput = !showCreateInput}
            title="新建本地歌单"
          >
            ➕ 新建
          </button>
        </div>
      </div>

      {#if showCreateInput}
        <div class="flex items-center gap-1 px-1.5 py-1 bg-emerald-500/10 rounded-lg my-1">
          <input
            type="text"
            placeholder="歌单名称..."
            class="flex-1 px-2 py-0.5 text-[11px] rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-main)] focus:outline-none"
            bind:value={newLocalName}
            onkeydown={(e) => e.key === 'Enter' && handleQuickCreateLocal()}
          />
          <button
            type="button"
            class="px-2 py-0.5 text-[10px] rounded bg-emerald-600 text-white font-medium cursor-pointer border-none"
            onclick={handleQuickCreateLocal}
          >
            确定
          </button>
        </div>
      {/if}

      <div bind:this={localScrollEl} class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar">
        {#each filteredLocal as pl (pl.id)}
          <div class="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)] transition-colors">
            <button
              type="button"
              class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer bg-transparent border-none p-0 text-inherit"
              onclick={() => onPlaylistClick(pl.id)}
              title={pl.name}
            >
              <span class="shrink-0 text-xs text-emerald-400">📁</span>
              <span class="truncate flex-1 font-medium">{pl.name}</span>
              <span class="text-[10px] text-[var(--text-muted)] shrink-0">{pl.trackCount || 0}</span>
            </button>
            {#if onPlayPlaylist}
              <button
                type="button"
                data-testid="sidebar-playbtn-{pl.id}"
                class="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] flex items-center justify-center transition-all duration-150 cursor-pointer border-none shadow-md"
                onclick={(e) => { e.stopPropagation(); onPlayPlaylist(String(pl.id), pl.name); }}
                title="播放整张歌单"
              >▶</button>
            {/if}
          </div>
        {:else}
          <div class="px-2 py-2 text-center text-[11px] text-[var(--text-muted)]">
            暂无本地歌单
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- 4. 网易云自建歌单区域 (当 filterMode 为 'all' 或 'netease') -->
  {#if filterMode === 'all' || filterMode === 'netease'}
    <div class="flex-1 min-h-0 flex flex-col border-b border-[var(--border-subtle)] pb-1 mb-1">
      <div class="relative flex-1 min-h-0 flex flex-col">
        <div
          bind:this={createdScrollEl}
          onscroll={checkCreatedScroll}
          class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar"
        >
          {#if filteredCreated.length > 0}
            <div class="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between sticky top-0 bg-[var(--card-bg-solid,#111827)] z-10 border-b border-[var(--border-subtle)]/30">
              <span>{t('playlist.myPlaylists')}</span>
              <span class="text-[10px] opacity-70">{filteredCreated.length}</span>
            </div>
            {#each filteredCreated as pl (pl.id)}
              {@const playCount = getPlaylistPlayCount(pl.id)}
              <div class="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)] transition-colors">
                <button
                  type="button"
                  class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer bg-transparent border-none p-0 text-inherit"
                  onclick={() => onPlaylistClick(pl.id)}
                  title={pl.name}
                >
                  <span class="shrink-0 text-xs text-[var(--text-muted)] group-hover:text-red-400">
                    {isFavoritePlaylist(pl) ? '❤️' : '📂'}
                  </span>
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
    </div>

    <!-- 5. 收藏的云端歌单 -->
    <div class="relative flex-1 min-h-0 flex flex-col">
      <div
        bind:this={subscribedScrollEl}
        onscroll={checkSubscribedScroll}
        class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar"
      >
        {#if filteredSubscribed.length > 0}
          <div class="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between sticky top-0 bg-[var(--card-bg-solid,#111827)] z-10 border-b border-[var(--border-subtle)]/30">
            <span>{t('sidebar.subscribedPlaylists')}</span>
            <span class="text-[10px] opacity-70">{filteredSubscribed.length}</span>
          </div>
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
  {/if}
</div>
