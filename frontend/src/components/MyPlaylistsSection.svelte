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
  import { t } from '../lib/i18n';

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
  let showSearch = $state(false);
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
          showToast(t('myPlaylists.deleted', { name: playlistName }), 'success');
          await loadMyPlaylists('created');
        } else {
          showToast(j.msg || t('myPlaylists.deleteFailed'), 'warning');
        }
      } else if (type === 'unsubscribe') {
        const j = await api.playlistSubscribe(targetId, false);
        if (j.code === '000000') {
          showToast(t('myPlaylists.unsubscribed', { name: playlistName }), 'success');
          await loadMyPlaylists('subscribed');
        } else {
          showToast(j.msg || t('myPlaylists.unsubscribeFailed'), 'warning');
        }
      }
    } catch (e: any) {
      showToast(t('error.operationFailed', { message: e.message || e }), 'error');
    }
  }

  function openPlaylistSheet(pl: any, idx: number) {
    openSheet({
      title: pl.name,
      subtitle: `${pl.subscribed ? t('myPlaylists.subscribedPl') : t('myPlaylists.createdPl')} · ${t('playlist.trackCount', { count: pl.trackCount || 0 })}`,
      actions: [
        {
          label: t('myPlaylists.playEntire'),
          style: 'primary',
          onclick: () => onPlayPlaylist(String(pl.id), pl.name)
        },
        {
          label: t('myPlaylists.viewDetails'),
          style: 'default',
          onclick: () => onViewPlaylist(String(pl.id))
        },
        ...(pl.subscribed
          ? [
              {
                label: t('myPlaylists.unsubscribeThis'),
                style: 'danger' as const,
                onclick: () => (confirmAction = { type: 'unsubscribe', playlistId: String(pl.id), playlistName: pl.name })
              }
            ]
          : !isFavoritePlaylist(pl)
          ? [
              {
                label: t('myPlaylists.deleteThis'),
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
<AccordionCard title={t('myPlaylists.sectionTitle')} bind:open {flat} accent="red" onToggle={onToggle}>
  <!-- 快捷过滤按钮组与新建/搜索入口 (整洁紧凑单行设计) -->
  <div class="flex items-center justify-between gap-1.5 mb-2.5">
    <div class="flex gap-1.5 items-center flex-wrap">
      <button
        class="btn-secondary rounded-lg px-2.5 py-1 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 bg-gradient-to-br from-sky-600 to-sky-700 transition-all hover:brightness-110 active:scale-95"
        class:ring-2={playlistFilter === 'created'}
        class:ring-sky-400={playlistFilter === 'created'}
        onclick={() => loadMyPlaylists('created')}
      >
        {t('myPlaylists.tabCreated')}<span class="hidden sm:inline">{t('myPlaylists.tabCreatedFull')}</span>
      </button>
      <button
        class="btn-secondary rounded-lg px-2.5 py-1 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 bg-gradient-to-br from-purple-600 to-purple-700 transition-all hover:brightness-110 active:scale-95"
        class:ring-2={playlistFilter === 'subscribed'}
        class:ring-purple-400={playlistFilter === 'subscribed'}
        onclick={() => loadMyPlaylists('subscribed')}
      >
        {t('myPlaylists.tabSubscribed')}<span class="hidden sm:inline">{t('myPlaylists.tabSubscribedFull')}</span>
      </button>
      <button
        class="btn-secondary rounded-lg px-2.5 py-1 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 bg-gradient-to-br from-slate-600 to-slate-700 transition-all hover:brightness-110 active:scale-95"
        class:ring-2={playlistFilter === 'all'}
        class:ring-slate-400={playlistFilter === 'all'}
        onclick={() => loadMyPlaylists('all')}
      >
        {t('myPlaylists.tabAll')}
      </button>
    </div>

    <div class="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        class="btn-secondary rounded-lg px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border-color)] bg-black/5 dark:bg-white/5 transition-all active:scale-95 flex items-center gap-1 {showSearch || playlistSearchKw ? '!text-blue-500 !border-blue-500/40 !bg-blue-500/10 font-bold' : ''}"
        onclick={() => { showSearch = !showSearch; if (!showSearch) playlistSearchKw = ''; }}
        title={t('common.search')}
      >
        <span>🔍</span>
      </button>
      <button
        type="button"
        class="btn-secondary rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-800/50 shadow-sm inline-flex items-center justify-center gap-1 shrink-0 transition-all active:scale-95"
        onclick={() => showCreateModal = true}
        title={t('playlist.createTitle')}
      >
        ➕ <span class="hidden sm:inline">{t('playlist.create')}</span>
      </button>
    </div>
  </div>

  <!-- 🔍 歌单客户端搜索 / 过滤栏 (点击🔍时才展开) -->
  {#if showSearch || playlistSearchKw}
    <div class="mb-2.5">
      <LocalSearchBox
        bind:value={playlistSearchKw}
        placeholder={t('myPlaylists.searchPlaceholder')}
        historyKey="wyyyy_playlist_search_history"
        onClear={() => { playlistSearchKw = ''; showSearch = false; }}
      />
    </div>
  {/if}

  <ul class="data-list scrollable-list">
    {#each filteredPlaylists as pl, idx}
      <li class="track-item-card">
        <div class="track-title-row">
          {#if isFavoritePlaylist(pl)}
            <span class="status-badge shrink-0 !bg-red-500/15 !text-red-500 font-bold" title={t('myPlaylists.pinnedTitle')}>
              {t('myPlaylists.pinnedBadge')}
            </span>
          {:else}
            <span class="status-badge shrink-0" class:badge-subscribed={pl.subscribed} class:badge-created={!pl.subscribed}>
              {pl.subscribed ? t('myPlaylists.tagSubscribed') : t('myPlaylists.tagCreated')}
            </span>
          {/if}
          <button
            type="button"
            class="clickable-track-title truncate cursor-pointer font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors"
            onclick={() => onViewPlaylist(String(pl.id))}
          >
            {pl.name}
          </button>
          <span class="text-xs text-[var(--text-muted)] shrink-0">({pl.trackCount || 0}{t('common.unit.tracks')})</span>
          {#if getPlaylistPlayCount(pl.id) > 0}
            <span class="text-[11px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium shrink-0" title={t('myPlaylists.historyPlayTooltip', { count: getPlaylistPlayCount(pl.id) })}>
              {t('myPlaylists.historyPlayCount', { count: getPlaylistPlayCount(pl.id) })}
            </span>
          {/if}
        </div>
        <div class="track-action-group">
          <!-- 💻 PC 桌面端快捷操作 -->
          <div class="hidden md:inline-flex items-center gap-1.5">
            <SlotBtn
              onclick={() => onPlayPlaylist(String(pl.id), pl.name)}
              title={t('myPlaylists.playEntire')}
            >
              {t('myPlaylists.playBtn')}
            </SlotBtn>
            {#if pl.subscribed}
              <SlotBtn onclick={() => confirmAction = { type: 'unsubscribe', playlistId: String(pl.id), playlistName: pl.name }}>{t('myPlaylists.cancelBtn')}</SlotBtn>
            {:else if !isFavoritePlaylist(pl)}
              <SlotBtn onclick={() => confirmAction = { type: 'delete', playlistId: String(pl.id), playlistName: pl.name }}>{t('myPlaylists.deleteBtn')}</SlotBtn>
            {/if}
            <SlotBtn onclick={() => onViewPlaylist(String(pl.id))}>{t('myPlaylists.detailBtn')}</SlotBtn>
          </div>

          <!-- 📱 SP 移动端常用功能 + ··· 抽屉 -->
          <div class="inline-flex md:hidden items-center gap-1.5">
            <SlotBtn
              onclick={() => onPlayPlaylist(String(pl.id), pl.name)}
              title={t('myPlaylists.playEntire')}
            >
              {t('myPlaylists.playBtn')}
            </SlotBtn>
            <button
              type="button"
              class="btn-more-actions"
              onclick={() => openPlaylistSheet(pl, idx)}
              title={t('myPlaylists.moreActions')}
              aria-label={t('myPlaylists.moreActions')}
            >
              ···
            </button>
          </div>
        </div>
      </li>
    {:else}
      <li class="flex justify-center items-center py-6 text-xs text-[var(--text-muted)] flex-col gap-2">
        {#if playlistSearchKw.trim()}
          <span>{t('myPlaylists.notFoundKw', { kw: playlistSearchKw })}</span>
          <button
            type="button"
            class="text-xs text-blue-400 hover:underline bg-transparent border-none cursor-pointer"
            onclick={() => playlistSearchKw = ''}
          >
            {t('myPlaylists.clearKw')}
          </button>
        {:else}
          <span>{t('common.noData')}</span>
          <button
            type="button"
            class="text-xs text-blue-400 hover:underline bg-transparent border-none cursor-pointer"
            onclick={() => loadMyPlaylists(playlistFilter)}
          >
            {t('myPlaylists.clickRefresh')}
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
      showToast(t('toast.playlist.created'), 'success');
      loadMyPlaylists('created').catch(() => {});
      if (newId) onViewPlaylist(String(newId));
    }}
  />
{/if}

{#if confirmAction}
  <Modal
    title={confirmAction.type === 'delete' ? t('myPlaylists.confirmDeleteTitle') : t('myPlaylists.confirmUnsubscribeTitle')}
    icon={confirmAction.type === 'delete' ? '🗑️' : '💔'}
    maxWidth="max-w-[440px]"
    onClose={() => confirmAction = null}
  >
    <div class="py-2 text-[14px] text-[var(--text-main)]">
      {#if confirmAction.type === 'delete'}
        {t('myPlaylists.confirmDeletePrompt')} <span class="font-bold text-red-400">「{confirmAction.playlistName}」</span> ?
        <span class="text-xs text-[var(--text-muted)] mt-1.5 block leading-relaxed">{t('myPlaylists.confirmDeleteWarning')}</span>
      {:else}
        {t('myPlaylists.confirmUnsubscribePrompt')} <span class="font-bold text-amber-400">「{confirmAction.playlistName}」</span> ?
      {/if}
    </div>

    {#snippet footer()}
      <button
        type="button"
        onclick={() => confirmAction = null}
        class="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-xs text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
      >
        {t('common.cancel')}
      </button>
      <button
        type="button"
        onclick={executeConfirmAction}
        class="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all cursor-pointer {confirmAction?.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}"
      >
        {confirmAction?.type === 'delete' ? t('myPlaylists.confirmDeleteBtn') : t('myPlaylists.confirmUnsubscribeBtn')}
      </button>
    {/snippet}
  </Modal>
{/if}
