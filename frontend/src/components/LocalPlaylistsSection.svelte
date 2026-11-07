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
        showToast(`已创建本地歌单「${trimmed}」`, 'success');
        newName = '';
        showCreateInput = false;
      } else {
        showToast(res.msg || '创建失败', 'warning');
      }
    } catch (e: any) {
      showToast('创建失败: ' + (e?.message || e), 'error');
    }
  }

  async function handleDelete(pl: LocalPlaylist) {
    if (!confirm(`确定删除本地歌单「${pl.name}」吗？（不会删除磁盘中的物理音频文件）`)) {
      return;
    }
    deletingId = pl.id;
    try {
      await deleteLocalPlaylist(pl.id);
      showToast(`已删除本地歌单「${pl.name}」`, 'success');
    } catch (e: any) {
      showToast('删除失败: ' + (e?.message || e), 'error');
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
        <h3 class="font-bold text-sm text-[var(--text-main)]">本地自建歌单</h3>
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
        <span>新建歌单</span>
      </button>
    </div>

    <div class="flex items-center gap-2 w-full sm:w-auto">
      <div class="relative flex-1 sm:w-48">
        <input
          type="search"
          enterkeyhint="search"
          placeholder="搜索本地歌单..."
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
        <span>新建歌单</span>
      </button>
    </div>
  </div>

  <!-- 新建歌单行内输入框 -->
  {#if showCreateInput}
    <div class="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
      <span class="text-sm">📁</span>
      <input
        type="text"
        placeholder="输入新本地歌单名称..."
        class="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
        bind:value={newName}
        onkeydown={(e) => e.key === 'Enter' && handleCreate()}
      />
      <button
        type="button"
        class="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer border-none shadow-xs"
        onclick={handleCreate}
      >
        确定
      </button>
      <button
        type="button"
        class="px-2.5 py-1.5 text-xs rounded-lg bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer border-none"
        onclick={() => { showCreateInput = false; newName = ''; }}
      >
        取消
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
                {pl.trackCount || 0} 首曲目
              </p>
            </div>
          </div>

          <div class="flex items-center justify-between mt-3 pt-2 border-t border-[var(--border-subtle)]">
            <span class="text-[10px] text-[var(--text-muted)]">{isSystemFavoritesPlaylist(pl.id) ? '系统专属' : '本地 SQLite'}</span>
            <div class="flex items-center gap-1.5" onclick={(e) => e.stopPropagation()} role="presentation">
              <SlotBtn
                onclick={() => onViewPlaylist?.(pl.id)}
              >
                查看
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
        {searchKw ? '未搜索到匹配的本地歌单' : '暂无本地自建歌单'}
      </p>
      {#if !searchKw}
        <p class="text-[11px] text-[var(--text-muted)] opacity-70 mt-1">
          点击右上角「新建歌单」，可将已下载曲目整理为专属本地离线歌单
        </p>
      {/if}
    </div>
  {/if}
</div>
