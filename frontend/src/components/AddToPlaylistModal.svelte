<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { myPlaylists, loadMyPlaylists } from '../lib/playlist.svelte';
  import { deleteApiCache } from '../lib/utils';
  import Modal from './Modal.svelte';
  import CreatePlaylistModal from './CreatePlaylistModal.svelte';

  let {
    song,
    onClose,
    showToast
  } = $props<{
    song: { id: string | number; name: string; artist?: string } | null;
    onClose: () => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let loading = $state(false);
  let addingId = $state<string | null>(null);
  let showCreate = $state(false);

  let createdPlaylists = $derived(myPlaylists.filter((p: any) => !p.subscribed));

  onMount(async () => {
    if (myPlaylists.length === 0) {
      loading = true;
      try {
        await loadMyPlaylists('created');
      } catch {}
      loading = false;
    }
  });

  async function handleAddTo(pl: any) {
    if (!song) return;
    addingId = String(pl.id);
    try {
      const j = await api.playlistAdd(String(pl.id), String(song.id));
      if (j.code === '000000') {
        showToast(`已成功将《${song.name}》添加到歌单「${pl.name}」`, 'success');
        deleteApiCache('playlist_' + pl.id);
        deleteApiCache('my_playlists');
        onClose();
      } else {
        showToast(j.msg || '添加到歌单失败', 'warning');
      }
    } catch (e: any) {
      showToast('操作异常: ' + (e.message || e), 'error');
    } finally {
      addingId = null;
    }
  }
</script>

{#if song}
  <Modal title="添加歌曲到歌单" icon="📂" maxWidth="max-w-[480px]" {onClose}>
    <!-- 目标曲目提示卡片 -->
    <div class="flex items-center gap-2 p-2.5 rounded-xl bg-black/5 dark:bg-white/[0.04] border border-black/5 dark:border-white/10 mb-3">
      <span class="text-base">🎵</span>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-bold text-[var(--text-main)] truncate">{song.name}</div>
        {#if song.artist}
          <div class="text-[11px] text-[var(--text-secondary)] truncate">{song.artist}</div>
        {/if}
      </div>
    </div>

    <!-- 顶部操作栏 -->
    <div class="flex justify-between items-center mb-2 px-0.5">
      <span class="text-xs font-medium text-[var(--text-secondary)]">选择我的自建歌单：</span>
      <button
        type="button"
        class="text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-transparent border-none cursor-pointer flex items-center gap-1"
        onclick={() => showCreate = true}
      >
        ➕ 新建歌单
      </button>
    </div>

    <!-- 自建歌单列表 -->
    <div class="max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
      {#if loading}
        <div class="py-8 text-center text-xs text-[var(--text-muted)]">
          🔄 正在读取我的歌单...
        </div>
      {:else}
        {#each createdPlaylists as pl}
          <div
            class="flex justify-between items-center p-2.5 rounded-xl border border-black/5 dark:border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
          >
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="text-sm">📁</span>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-semibold text-[var(--text-main)] truncate">{pl.name}</div>
                <div class="text-[10px] text-[var(--text-muted)]">{pl.trackCount || 0} 首曲目</div>
              </div>
            </div>
            <button
              type="button"
              disabled={addingId === String(pl.id)}
              class="btn-primary text-xs px-3 py-1 rounded-lg font-medium shrink-0 cursor-pointer disabled:opacity-50"
              onclick={() => handleAddTo(pl)}
            >
              {addingId === String(pl.id) ? '添加中...' : '➕ 添加'}
            </button>
          </div>
        {:else}
          <div class="py-8 text-center text-xs text-[var(--text-muted)]">
            暂无自建歌单，可点击右上角「新建歌单」
          </div>
        {/each}
      {/if}
    </div>

    {#snippet footer()}
      <button
        type="button"
        onclick={onClose}
        class="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-xs text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
      >
        关闭
      </button>
    {/snippet}
  </Modal>
{/if}

{#if showCreate}
  <CreatePlaylistModal
    onClose={() => showCreate = false}
    onSuccess={(newId) => {
      showToast('歌单创建成功', 'success');
      loadMyPlaylists('created').catch(() => {});
    }}
  />
{/if}
