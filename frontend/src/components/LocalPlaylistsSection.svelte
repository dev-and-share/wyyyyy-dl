<script lang="ts">
  import { onMount } from 'svelte';
  import {
    localPlaylistState,
    loadLocalPlaylists,
    createLocalPlaylist,
    deleteLocalPlaylist,
    isSystemFavoritesPlaylist,
    cleanPlaylistDisplayName,
    type LocalPlaylist
  } from '../lib/localPlaylistStore.svelte';
  import { matchesKeyword } from '../lib/utils';
  import { t } from '../lib/i18n';
  import SlotBtn from './SlotBtn.svelte';

  let {
    onPlayQueue,
    onViewPlaylist,
    showToast
  } = $props<{
    onPlayQueue?: (tracks: any[], optionsOrIdx?: any) => void;
    onViewPlaylist?: (id: string) => void;
    showToast: (m: string, t?: 'info' | 'success' | 'warning' | 'error', d?: number) => void;
  }>();

  let searchKw = $state('');
  let showCreateInput = $state(false);
  let newName = $state('');
  let deletingId = $state<string | null>(null);

  onMount(() => {
    loadLocalPlaylists().catch(() => {});
  });

  let filteredList = $derived(
    searchKw.trim()
      ? localPlaylistState.playlists.filter((p: LocalPlaylist) =>
          matchesKeyword(p.name, searchKw.trim())
        )
      : localPlaylistState.playlists
  );

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const res = await createLocalPlaylist(trimmed);
      if (res.success) {
        showToast(t('playlist.createLocalSuccess', { name: trimmed }), 'success');
        newName = '';
        showCreateInput = false;
      } else {
        showToast(res.msg || t('playlist.createLocalFailed'), 'warning');
      }
    } catch (e: any) {
      showToast(`${t('playlist.createLocalFailed')}: ${e?.message || e}`, 'error');
    }
  }

  async function handleDelete(pl: LocalPlaylist) {
    if (!confirm(t('localPlaylist.deleteConfirm', { name: pl.name }))) {
      return;
    }
    deletingId = pl.id;
    try {
      await deleteLocalPlaylist(pl.id);
      showToast(t('localPlaylist.deletedSuccess', { name: pl.name }), 'success');
    } catch (e: any) {
      showToast(t('localPlaylist.deleteFailed', { error: e?.message || e }), 'error');
    } finally {
      deletingId = null;
    }
  }
</script>

<div class="flex flex-col gap-3 select-none" data-testid="local-playlists-section">
  <!-- 顶栏：标题与操作栏 (SP 移动端防撑破自适应优化) -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
    <div class="flex items-center justify-between w-full sm:w-auto gap-2">
      <div class="flex items-center gap-2">
        <span class="text-base text-emerald-400">📁</span>
        <h3 class="font-bold text-sm text-[var(--text-main)]">{t('localPlaylist.title')}</h3>
        <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
          {localPlaylistState.playlists.length}
        </span>
      </div>

      <button
        type="button"
        class="sm:hidden px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white border-none shadow-xs transition-colors flex items-center gap-1 shrink-0 active:scale-95"
        onclick={() => showCreateInput = !showCreateInput}
      >
        <span>➕</span>
        <span>{t('localPlaylist.createBtn')}</span>
      </button>
    </div>

    <div class="flex items-center gap-2 w-full sm:w-auto">
      <div class="relative flex-1 sm:w-48">
        <input
          type="search"
          enterkeyhint="search"
          placeholder={t('localPlaylist.searchPlaceholder')}
          class="w-full pl-6 pr-2 py-1 rounded-lg text-xs bg-[var(--input-bg)] text-[var(--text-main)] border border-[var(--input-border)] focus:outline-none focus:border-emerald-500 transition-colors"
          bind:value={searchKw}
        />
        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] opacity-40 pointer-events-none">🔍</span>
      </div>

      <button
        type="button"
        class="hidden sm:inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white border-none shadow-xs transition-colors items-center gap-1 shrink-0 active:scale-95"
        onclick={() => showCreateInput = !showCreateInput}
      >
        <span>➕</span>
        <span>{t('localPlaylist.createBtn')}</span>
      </button>
    </div>
  </div>

  <!-- 新建歌单行内输入框 -->
  {#if showCreateInput}
    <div class="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
      <span class="text-sm">📁</span>
      <input
        type="text"
        placeholder={t('localPlaylist.inputPlaceholder')}
        class="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
        bind:value={newName}
        onkeydown={(e) => e.key === 'Enter' && handleCreate()}
      />
      <button
        type="button"
        class="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer border-none shadow-xs whitespace-nowrap"
        onclick={handleCreate}
      >
        {t('common.confirm')}
      </button>
      <button
        type="button"
        class="px-2.5 py-1.5 text-xs rounded-lg bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer border-none whitespace-nowrap"
        onclick={() => { showCreateInput = false; newName = ''; }}
      >
        {t('common.cancel')}
      </button>
    </div>
  {/if}

  <!-- 歌单列表 -->
  {#if filteredList.length > 0}
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {#each filteredList as pl (pl.id)}
        <div
          role="button"
          tabindex="0"
          class="group relative flex flex-col justify-between p-3.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-emerald-500/40 hover:shadow-md transition-all cursor-pointer text-left"
          onclick={() => onViewPlaylist?.(pl.id)}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewPlaylist?.(pl.id); } }}
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-lg {isSystemFavoritesPlaylist(pl.id) ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-400'} flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
              {isSystemFavoritesPlaylist(pl.id) ? '❤️' : '📁'}
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold text-xs text-[var(--text-main)] truncate group-hover:text-emerald-400 transition-colors">
                {cleanPlaylistDisplayName(pl)}
              </h4>
              <p class="text-[11px] text-[var(--text-muted)] mt-1">
                {t('playlist.trackItemCount', { count: pl.trackCount || 0 })}
              </p>
            </div>
          </div>

          <div class="flex items-center justify-between mt-3 pt-2 border-t border-[var(--border-subtle)]">
            <span class="text-[10px] text-[var(--text-muted)] truncate">{isSystemFavoritesPlaylist(pl.id) ? t('localPlaylist.systemFavorites') : t('localPlaylist.localSqlite')}</span>
            <div class="flex items-center gap-1.5 shrink-0" onclick={(e) => e.stopPropagation()} role="presentation">
              <SlotBtn
                onclick={() => onViewPlaylist?.(pl.id)}
              >
                {t('localPlaylist.view')}
              </SlotBtn>
              {#if !isSystemFavoritesPlaylist(pl.id)}
                <SlotBtn
                  onclick={() => handleDelete(pl)}
                >
                  🗑️
                </SlotBtn>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="flex flex-col items-center justify-center py-10 text-center text-[var(--text-muted)] bg-[var(--card-bg)]/40 rounded-xl border border-dashed border-[var(--border-subtle)]">
      <span class="text-3xl mb-2">📁</span>
      <p class="text-xs">
        {searchKw ? t('localPlaylist.emptySearch') : t('localPlaylist.empty')}
      </p>
      {#if !searchKw}
        <p class="text-[11px] text-[var(--text-muted)] opacity-70 mt-1 max-w-[280px]">
          {t('localPlaylist.emptyHint')}
        </p>
      {/if}
    </div>
  {/if}
</div>
