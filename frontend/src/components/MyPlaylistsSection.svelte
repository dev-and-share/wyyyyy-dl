<script lang="ts">
  import { onMount } from 'svelte';
  import { myPlaylists, getPlaylistFilter, loadMyPlaylists } from '../lib/playlist.svelte';
  import { api } from '../lib/api';
  import AccordionCard from './AccordionCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import CreatePlaylistModal from './CreatePlaylistModal.svelte';
  import Modal from './Modal.svelte';

  let {
    open = $bindable(true),
    onToggle,
    onViewPlaylist,
    onPlayPlaylist,
    showToast
  } = $props<{
    open: boolean;
    onToggle: () => void;
    onViewPlaylist: (id: string) => void;
    onPlayPlaylist: (id: string, name: string) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let playlistFilter = $derived(getPlaylistFilter());

  const STORAGE_KEY_PLAYLIST_SEARCH_HISTORY = 'wyyyy_playlist_search_history';

  let playlistSearchKw = $state('');
  let searchHistory = $state<string[]>([]);
  let showCreateModal = $state(false);
  let confirmAction = $state<{
    type: 'delete' | 'unsubscribe';
    playlistId: string;
    playlistName: string;
  } | null>(null);

  function loadSearchHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PLAYLIST_SEARCH_HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) searchHistory = parsed;
      }
    } catch {}
  }

  function addSearchHistory(kw: string) {
    const trimmed = kw.trim();
    if (!trimmed) return;
    const next = [trimmed, ...searchHistory.filter(item => item !== trimmed)].slice(0, 10);
    searchHistory = next;
    try {
      localStorage.setItem(STORAGE_KEY_PLAYLIST_SEARCH_HISTORY, JSON.stringify(next));
    } catch {}
  }

  function removeSearchHistory(target: string) {
    const next = searchHistory.filter(item => item !== target);
    searchHistory = next;
    try {
      localStorage.setItem(STORAGE_KEY_PLAYLIST_SEARCH_HISTORY, JSON.stringify(next));
    } catch {}
  }

  function clearSearchHistory() {
    searchHistory = [];
    try {
      localStorage.removeItem(STORAGE_KEY_PLAYLIST_SEARCH_HISTORY);
    } catch {}
  }

  function handleSearchSubmit() {
    if (playlistSearchKw.trim()) {
      addSearchHistory(playlistSearchKw.trim());
    }
  }

  let filteredPlaylists = $derived(
    myPlaylists.filter((p: any) => {
      const matchType = playlistFilter === 'all' || (playlistFilter === 'created' ? !p.subscribed : !!p.subscribed);
      if (!matchType) return false;
      const kw = playlistSearchKw.trim().toLowerCase();
      if (!kw) return true;
      const nameMatch = (p.name || '').toLowerCase().includes(kw);
      const idMatch = String(p.id || '').includes(kw);
      return nameMatch || idMatch;
    })
  );

  async function executeConfirmAction() {
    if (!confirmAction) return;
    const { type, playlistId: targetId, playlistName } = confirmAction;
    confirmAction = null;
    try {
      if (type === 'delete') {
        const j = await api.playlistDelete(targetId);
        if (j.code === '000000') {
          showToast(`已删除歌单「${playlistName}」`, 'success');
          await loadMyPlaylists('created');
        } else {
          showToast(j.msg || '删除失败', 'warning');
        }
      } else if (type === 'unsubscribe') {
        const j = await api.playlistSubscribe(targetId, false);
        if (j.code === '000000') {
          showToast(`已取消收藏「${playlistName}」`, 'success');
          await loadMyPlaylists('subscribed');
        } else {
          showToast(j.msg || '取消收藏失败', 'warning');
        }
      }
    } catch (e: any) {
      showToast('操作异常: ' + (e.message || e), 'error');
    }
  }

  onMount(() => {
    loadSearchHistory();
  });
</script>

<!-- Section 1: 我的歌单 -->
<AccordionCard title="📋 1. 我的歌单" bind:open onToggle={onToggle}>
  <!-- 快捷过滤按钮组与新建快捷入口 -->
  <div class="flex justify-between items-center flex-wrap gap-2 mb-3">
    <span class="text-[13px] text-[var(--text-secondary)] font-medium">账号歌单快捷加载：</span>
    <div class="flex gap-1.5 items-center flex-wrap">
      <button
        class="btn-secondary rounded-lg px-2.5 py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 bg-gradient-to-br from-sky-600 to-sky-700 transition-all hover:brightness-110 active:scale-95"
        class:ring-2={playlistFilter === 'created'}
        class:ring-sky-400={playlistFilter === 'created'}
        onclick={() => loadMyPlaylists('created')}
      >
        📂 创建<span class="hidden sm:inline">的歌单</span>
      </button>
      <button
        class="btn-secondary rounded-lg px-2.5 py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 bg-gradient-to-br from-purple-600 to-purple-700 transition-all hover:brightness-110 active:scale-95"
        class:ring-2={playlistFilter === 'subscribed'}
        class:ring-purple-400={playlistFilter === 'subscribed'}
        onclick={() => loadMyPlaylists('subscribed')}
      >
        ⭐ 收藏<span class="hidden sm:inline">的歌单</span>
      </button>
      <button
        class="btn-secondary rounded-lg px-2.5 py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 bg-gradient-to-br from-slate-600 to-slate-700 transition-all hover:brightness-110 active:scale-95"
        class:ring-2={playlistFilter === 'all'}
        class:ring-slate-400={playlistFilter === 'all'}
        onclick={() => loadMyPlaylists('all')}
      >
        📋 全部
      </button>
      <button
        class="btn-secondary rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-800/50 shadow-sm inline-flex items-center justify-center gap-1 shrink-0 transition-all active:scale-95"
        onclick={() => showCreateModal = true}
        title="新建自建歌单"
      >
        ➕ <span class="hidden sm:inline">新建</span>
      </button>
    </div>
  </div>

  <!-- 🔍 歌单客户端搜索 / 过滤栏 -->
  <div class="mb-3">
    <div class="relative w-full">
      <input
        type="text"
        placeholder="搜索歌单名称..."
        class="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all"
        bind:value={playlistSearchKw}
        onkeydown={(e) => {
          if (e.key === 'Enter') handleSearchSubmit();
        }}
        onblur={handleSearchSubmit}
      />
      <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs opacity-50 pointer-events-none">🔍</span>
      {#if playlistSearchKw}
        <button
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded cursor-pointer leading-none"
          onclick={() => { playlistSearchKw = ''; }}
          title="清除搜索"
        >
          ✕
        </button>
      {/if}
    </div>

    <!-- 🕒 搜索历史标签 -->
    {#if searchHistory.length > 0}
      <div class="flex items-center flex-wrap gap-1.5 mt-2 text-xs">
        <span class="text-[var(--text-muted)] text-[11px] shrink-0">🕒 搜索历史:</span>
        {#each searchHistory as item}
          <div
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-black/5 dark:bg-white/10 text-[var(--text-secondary)] border border-black/5 dark:border-white/10 transition-all hover:bg-blue-500/15 hover:text-blue-400 group"
          >
            <button
              type="button"
              class="cursor-pointer bg-transparent border-none p-0 text-inherit hover:underline"
              onclick={() => {
                playlistSearchKw = item;
                addSearchHistory(item);
              }}
            >
              {item}
            </button>
            <button
              type="button"
              class="opacity-40 hover:opacity-100 group-hover:opacity-70 transition-opacity cursor-pointer p-0 bg-transparent border-none text-[10px] leading-none"
              onclick={(e) => {
                e.stopPropagation();
                removeSearchHistory(item);
              }}
              title="删除此条历史"
            >
              ✕
            </button>
          </div>
        {/each}
        <button
          type="button"
          class="text-[11px] text-[var(--text-muted)] hover:text-red-400 ml-auto cursor-pointer p-0 bg-transparent border-none"
          onclick={clearSearchHistory}
        >
          清空
        </button>
      </div>
    {/if}
  </div>

  <ul class="data-list scrollable-list">
    {#each filteredPlaylists as pl, idx}
      <li class="track-item-card">
        <div class="track-title-row">
          <span class="status-badge shrink-0" class:badge-subscribed={pl.subscribed} class:badge-created={!pl.subscribed}>
            {pl.subscribed ? '收藏' : '创建'}
          </span>
          <button
            type="button"
            class="clickable-track-title truncate cursor-pointer font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors"
            onclick={() => onViewPlaylist(String(pl.id))}
          >
            {pl.name}
          </button>
          <span class="text-xs text-[var(--text-muted)] shrink-0">({pl.trackCount || 0}首)</span>
        </div>
        <div class="track-action-group">
          <SlotBtn
            onclick={() => onPlayPlaylist(String(pl.id), pl.name)}
            title="立即播放整张歌单"
          >
            ▶️ 播放
          </SlotBtn>
          {#if pl.subscribed}
            <SlotBtn onclick={() => confirmAction = { type: 'unsubscribe', playlistId: String(pl.id), playlistName: pl.name }}>💔 取消</SlotBtn>
          {:else if idx > 0}
            <SlotBtn onclick={() => confirmAction = { type: 'delete', playlistId: String(pl.id), playlistName: pl.name }}>🗑️ 删除</SlotBtn>
          {/if}
          <SlotBtn onclick={() => onViewPlaylist(String(pl.id))}>👉 详情</SlotBtn>
        </div>
      </li>
    {:else}
      <li class="flex justify-center items-center py-6 text-xs text-[var(--text-muted)] flex-col gap-2">
        {#if playlistSearchKw.trim()}
          <span>未找到包含 "{playlistSearchKw}" 的歌单</span>
          <button
            type="button"
            class="text-xs text-blue-400 hover:underline bg-transparent border-none cursor-pointer"
            onclick={() => playlistSearchKw = ''}
          >
            清除搜索词
          </button>
        {:else}
          <span>暂无歌单数据</span>
          <button
            type="button"
            class="text-xs text-blue-400 hover:underline bg-transparent border-none cursor-pointer"
            onclick={() => loadMyPlaylists(playlistFilter)}
          >
            点击刷新
          </button>
        {/if}
      </li>
    {/each}
  </ul>
</AccordionCard>

{#if showCreateModal}
  <CreatePlaylistModal
    onClose={() => showCreateModal = false}
    onSuccess={(newId) => {
      showToast('歌单创建成功', 'success');
      loadMyPlaylists('created').catch(() => {});
      if (newId) onViewPlaylist(String(newId));
    }}
  />
{/if}

{#if confirmAction}
  <Modal
    title={confirmAction.type === 'delete' ? '删除歌单确认' : '取消收藏确认'}
    icon={confirmAction.type === 'delete' ? '🗑️' : '💔'}
    maxWidth="max-w-[440px]"
    onClose={() => confirmAction = null}
  >
    <div class="py-2 text-[14px] text-[var(--text-main)]">
      {#if confirmAction.type === 'delete'}
        确定要删除自建歌单 <span class="font-bold text-red-400">「{confirmAction.playlistName}」</span> 吗？
        <span class="text-xs text-[var(--text-muted)] mt-1.5 block leading-relaxed">⚠️ 此操作将直接在网易云音乐账号中删除该歌单，不可恢复。</span>
      {:else}
        确定要取消收藏歌单 <span class="font-bold text-amber-400">「{confirmAction.playlistName}」</span> 吗？
      {/if}
    </div>

    {#snippet footer()}
      <button
        type="button"
        onclick={() => confirmAction = null}
        class="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-xs text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
      >
        取消
      </button>
      <button
        type="button"
        onclick={executeConfirmAction}
        class="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all cursor-pointer {confirmAction?.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}"
      >
        {confirmAction?.type === 'delete' ? '确认删除' : '确认取消'}
      </button>
    {/snippet}
  </Modal>
{/if}
