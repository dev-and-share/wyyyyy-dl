<script lang="ts">
  import { myPlaylists, getPlaylistFilter, loadMyPlaylists, sortPlaylistsByPlayCount, isFavoritePlaylist, getPlaylistPlayCount } from '../lib/playlist.svelte';
  import { api } from '../lib/api';
  import AccordionCard from './AccordionCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import CreatePlaylistModal from './CreatePlaylistModal.svelte';
  import LocalSearchBox from './LocalSearchBox.svelte';
  import Modal from './Modal.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { matchesKeyword } from '../lib/utils';

  let {
    open = $bindable(true),
    flat = false,
    onToggle,
    onViewPlaylist,
    onPlayPlaylist,
    showToast
  } = $props<{
    open?: boolean;
    flat?: boolean;
    onToggle?: () => void;
    onViewPlaylist: (id: string) => void;
    onPlayPlaylist: (id: string, name: string) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let playlistFilter = $derived(getPlaylistFilter());

  let playlistSearchKw = $state('');
  let showCreateModal = $state(false);
  let confirmAction = $state<{
    type: 'delete' | 'unsubscribe';
    playlistId: string;
    playlistName: string;
  } | null>(null);

  let filteredPlaylists = $derived(
    sortPlaylistsByPlayCount(
      myPlaylists.filter((p: any) => {
        const kw = playlistSearchKw.trim();
        // 当用户输入关键词时跨分类全局搜索，关键词为空时恢复当前分类筛选
        const matchType = !kw ? (playlistFilter === 'all' || (playlistFilter === 'created' ? !p.subscribed : !!p.subscribed)) : true;
        if (!matchType) return false;
        if (!kw) return true;
        const nameMatch = matchesKeyword(p.name, kw);
        const creatorMatch = matchesKeyword(p.creator?.nickname || p.creator, kw);
        const idMatch = String(p.id || '').includes(kw);
        return nameMatch || creatorMatch || idMatch;
      })
    )
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

  function openPlaylistSheet(pl: any, idx: number) {
    openSheet({
      title: pl.name,
      subtitle: `${pl.subscribed ? '收藏歌单' : '我创建的歌单'} · 共 ${pl.trackCount || 0} 首`,
      actions: [
        {
          label: '▶️ 立即播放整张歌单',
          style: 'primary',
          onclick: () => onPlayPlaylist(String(pl.id), pl.name)
        },
        {
          label: '👉 查看歌单详情与歌曲列表',
          style: 'default',
          onclick: () => onViewPlaylist(String(pl.id))
        },
        ...(pl.subscribed
          ? [
              {
                label: '💔 取消收藏该歌单',
                style: 'danger' as const,
                onclick: () => (confirmAction = { type: 'unsubscribe', playlistId: String(pl.id), playlistName: pl.name })
              }
            ]
          : !isFavoritePlaylist(pl)
          ? [
              {
                label: '🗑️ 删除该歌单',
                style: 'danger' as const,
                onclick: () => (confirmAction = { type: 'delete', playlistId: String(pl.id), playlistName: pl.name })
              }
            ]
          : [])
      ]
    });
  }
</script>

<!-- Section 1: 我的歌单 -->
<AccordionCard title="📋 1. 我的歌单" bind:open {flat} accent="red" onToggle={onToggle}>
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
    <LocalSearchBox
      bind:value={playlistSearchKw}
      placeholder="🔍 搜索歌单名称、ID (支持拼音全拼与首字母)..."
      historyKey="wyyyy_playlist_search_history"
    />
  </div>

  <ul class="data-list scrollable-list">
    {#each filteredPlaylists as pl, idx}
      <li class="track-item-card">
        <div class="track-title-row">
          {#if isFavoritePlaylist(pl)}
            <span class="status-badge shrink-0 !bg-red-500/15 !text-red-500 font-bold" title="我喜欢的音乐（常驻置顶）">
              ❤️ 置顶
            </span>
          {:else}
            <span class="status-badge shrink-0" class:badge-subscribed={pl.subscribed} class:badge-created={!pl.subscribed}>
              {pl.subscribed ? '收藏' : '创建'}
            </span>
          {/if}
          <button
            type="button"
            class="clickable-track-title truncate cursor-pointer font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors"
            onclick={() => onViewPlaylist(String(pl.id))}
          >
            {pl.name}
          </button>
          <span class="text-xs text-[var(--text-muted)] shrink-0">({pl.trackCount || 0}首)</span>
          {#if getPlaylistPlayCount(pl.id) > 0}
            <span class="text-[11px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium shrink-0" title="历史播放过 {getPlaylistPlayCount(pl.id)} 次">
              🔥 {getPlaylistPlayCount(pl.id)}次
            </span>
          {/if}
        </div>
        <div class="track-action-group">
          <!-- 💻 PC 桌面端快捷操作 -->
          <div class="hidden md:inline-flex items-center gap-1.5">
            <SlotBtn
              onclick={() => onPlayPlaylist(String(pl.id), pl.name)}
              title="立即播放整张歌单"
            >
              ▶️ 播放
            </SlotBtn>
            {#if pl.subscribed}
              <SlotBtn onclick={() => confirmAction = { type: 'unsubscribe', playlistId: String(pl.id), playlistName: pl.name }}>💔 取消</SlotBtn>
            {:else if !isFavoritePlaylist(pl)}
              <SlotBtn onclick={() => confirmAction = { type: 'delete', playlistId: String(pl.id), playlistName: pl.name }}>🗑️ 删除</SlotBtn>
            {/if}
            <SlotBtn onclick={() => onViewPlaylist(String(pl.id))}>👉 详情</SlotBtn>
          </div>

          <!-- 📱 SP 移动端常用功能 + ··· 抽屉 -->
          <div class="inline-flex md:hidden items-center gap-1.5">
            <SlotBtn
              onclick={() => onPlayPlaylist(String(pl.id), pl.name)}
              title="立即播放整张歌单"
            >
              ▶️ 播放
            </SlotBtn>
            <button
              type="button"
              class="btn-more-actions"
              onclick={() => openPlaylistSheet(pl, idx)}
              title="更多歌单操作"
              aria-label="更多歌单操作"
            >
              ···
            </button>
          </div>
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
