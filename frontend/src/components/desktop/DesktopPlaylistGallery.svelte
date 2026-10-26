<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../lib/i18n';
  import {
    myPlaylists,
    loadMyPlaylists,
    isFavoritePlaylist,
    sortPlaylistsByPlayCount,
    getPlaylistPlayCount
  } from '../../lib/playlist.svelte';
  import { DEFAULT_VINYL_COVER, formatCoverUrl, matchesKeyword } from '../../lib/utils';

  let {
    onSelectPlaylist,
    onPlayPlaylist,
    showToast
  } = $props<{
    onSelectPlaylist: (id: string) => void;
    onPlayPlaylist?: (id: string, name: string) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let filter = $state<'all' | 'created' | 'subscribed'>('all');
  let searchKeyword = $state('');
  let parseInput = $state('');
  let loading = $state(false);

  const d = new Date();
  const todayMonthText = $derived(t('recommend.monthText', { month: String(d.getMonth() + 1).padStart(2, '0') }));
  const todayDayNum = String(d.getDate()).padStart(2, '0');

  onMount(() => {
    if (myPlaylists.length === 0) {
      handleRefresh();
    }
  });

  async function handleRefresh() {
    loading = true;
    try {
      await loadMyPlaylists();
      showToast(t('playlist.synced'), 'success', 1500);
    } catch (e: any) {
      showToast(t('playlist.loadFailedWithMsg', { error: e?.message || e }), 'error');
    } finally {
      loading = false;
    }
  }

  function handleParseSubmit() {
    const raw = parseInput.trim();
    if (!raw) {
      showToast(t('playlist.inputPrompt'), 'warning');
      return;
    }
    const match = raw.match(/id=([0-9]+)/) || raw.match(/^([0-9]+)$/);
    if (match?.[1]) {
      onSelectPlaylist(match[1]);
    } else {
      showToast(t('playlist.invalidId'), 'warning');
    }
  }

  const filteredPlaylists = $derived(() => {
    let list = myPlaylists;
    if (filter === 'created') list = list.filter(p => !p.subscribed);
    if (filter === 'subscribed') list = list.filter(p => p.subscribed);

    const kw = searchKeyword.trim();
    if (kw) {
      list = list.filter(p => matchesKeyword(p.name, kw));
    }
    return sortPlaylistsByPlayCount(list);
  });
</script>

<!-- PC Desktop: Playlist Cover Gallery (Gallery View) -->
<div class="flex flex-col gap-5 select-none animate-fade-in" data-testid="desktop-playlist-gallery">
  <!-- 1. Top Action Bar: Fast Input Parsing -->
  <div class="flex items-center gap-3 p-3.5 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] shadow-sm lg:pr-[220px]">
    <div class="flex items-center gap-2 flex-1 max-w-xl">
      <input
        type="text"
        placeholder={t('playlist.inputPlaceholderWithLink')}
        class="flex-1 min-w-0 px-3.5 py-2 rounded-xl text-xs bg-[var(--input-bg)] text-[var(--text-main)] border border-[var(--input-border)] focus:outline-none focus:border-red-500 transition-colors"
        bind:value={parseInput}
        onkeydown={(e) => e.key === 'Enter' && handleParseSubmit()}
      />
      <button
        type="button"
        class="btn-primary shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
        onclick={handleParseSubmit}
      >
        {t('playlist.parseDetail')}
      </button>
    </div>
  </div>

  <!-- 2. Categories Tab and Playlist Filter Bar -->
  <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-2.5">
    <div class="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        class="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border-none {filter === 'all' ? 'bg-red-500/15 text-red-400 font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => filter = 'all'}
      >
        {t('playlist.tabAllWithCount', { count: myPlaylists.length })}
      </button>
      <button
        type="button"
        class="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border-none {filter === 'created' ? 'bg-red-500/15 text-red-400 font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => filter = 'created'}
      >
        {t('playlist.tabCreatedWithCount', { count: myPlaylists.filter(p => !p.subscribed).length })}
      </button>
      <button
        type="button"
        class="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border-none {filter === 'subscribed' ? 'bg-red-500/15 text-red-400 font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => filter = 'subscribed'}
      >
        {t('playlist.tabSubscribedWithCount', { count: myPlaylists.filter(p => p.subscribed).length })}
      </button>
    </div>

    <!-- Filter and Refresh -->
    <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
      <input
        type="text"
        placeholder={t('playlist.searchLocalPlaylistsPlaceholder')}
        class="w-36 sm:w-44 lg:w-52 px-3 py-1.5 rounded-xl text-xs bg-[var(--input-bg)] text-[var(--text-main)] border border-[var(--input-border)] focus:outline-none focus:border-red-500 transition-colors"
        bind:value={searchKeyword}
      />
      <button
        type="button"
        class="p-2 rounded-xl text-xs bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--btn-secondary-border)] transition-colors cursor-pointer"
        onclick={handleRefresh}
        title={t('playlist.syncFromCloudTooltip')}
      >
        {loading ? '⏳' : '🔄'}
      </button>
    </div>
  </div>

  <!-- 3. Gallery Grid -->
  {#if filteredPlaylists().length > 0}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
      <!-- Daily Recommend Sticky Card -->
      {#if !searchKeyword.trim() && filter !== 'subscribed'}
        <div
          data-testid="gallery-card-daily-recommend"
          class="group flex flex-col gap-2 p-3 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--card-header-hover)] border border-[var(--border-subtle)] hover:border-red-400/40 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-1"
          role="button"
          tabindex="0"
          onclick={() => onSelectPlaylist('daily-recommend')}
          onkeydown={(e) => e.key === 'Enter' && onSelectPlaylist('daily-recommend')}
        >
          <div class="relative w-full aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-red-500 to-rose-600 shadow-inner flex flex-col select-none group-hover:scale-105 transition-transform duration-300">
            <div class="bg-red-700/80 text-white text-[10px] font-bold text-center py-1 tracking-wider uppercase">
              {todayMonthText}
            </div>
            <div class="flex-1 bg-gradient-to-b from-white to-red-50 dark:from-neutral-900 dark:to-neutral-950 flex flex-col items-center justify-center">
              <span class="text-3xl font-black text-red-600 dark:text-red-400 tracking-tighter leading-none">
                {todayDayNum}
              </span>
              <span class="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">{t('recommend.dailyRecommendShort')}</span>
            </div>
            <span class="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/90 text-white backdrop-blur-xs">
              {t('recommend.todayRecommend')}
            </span>
          </div>

          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="font-semibold text-xs text-[var(--text-main)] truncate group-hover:text-red-400 transition-colors">
              {t('recommend.dailyExclusiveText')}
            </span>
            <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>{t('recommend.updateDaily')}</span>
              <span class="text-red-400 font-medium">{t('recommend.privateMusic')}</span>
            </div>
          </div>
        </div>
      {/if}

      {#each filteredPlaylists() as pl (pl.id)}
        {@const isFav = isFavoritePlaylist(pl)}
        {@const playCount = getPlaylistPlayCount(pl.id)}
        <div
          data-testid="gallery-card-{pl.id}"
          class="group flex flex-col gap-2 p-3 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--card-header-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-1"
          role="button"
          tabindex="0"
          onclick={() => onSelectPlaylist(String(pl.id))}
          onkeydown={(e) => e.key === 'Enter' && onSelectPlaylist(String(pl.id))}
        >
          <div class="relative w-full aspect-square rounded-xl overflow-hidden bg-black/20">
            <img
              src={formatCoverUrl(pl.coverImgUrl, 250)}
              alt={pl.name}
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            {#if onPlayPlaylist}
              <button
                type="button"
                class="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-sm shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 cursor-pointer border-none"
                onclick={(e) => {
                  e.stopPropagation();
                  onPlayPlaylist(String(pl.id), pl.name);
                }}
                title={t('playlist.playWholePlaylistTooltip')}
              >
                ▶
              </button>
            {/if}

            {#if isFav}
              <span class="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-500/90 text-white backdrop-blur-xs">
                {t('playlist.favoriteTag')}
              </span>
            {/if}
          </div>

          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="font-semibold text-xs text-[var(--text-main)] truncate group-hover:text-red-400 transition-colors" title={pl.name}>
              {pl.name}
            </span>
            <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>{t('playlist.trackCount', { count: pl.trackCount || 0 })}</span>
              {#if playCount > 0}
                <span class="text-amber-400/80 font-medium">🔥 {playCount}</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="py-16 text-center flex flex-col items-center gap-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)]">
      <span class="text-4xl">📁</span>
      <span class="text-sm font-medium text-[var(--text-secondary)]">
        {searchKeyword ? t('playlist.noMatchingPlaylists') : t('playlist.noPlaylistsData')}
      </span>
      <button
        type="button"
        class="btn-secondary text-xs px-4 py-1.5 rounded-xl cursor-pointer"
        onclick={handleRefresh}
      >
        {t('playlist.syncFromCloudBtn')}
      </button>
    </div>
  {/if}
</div>
