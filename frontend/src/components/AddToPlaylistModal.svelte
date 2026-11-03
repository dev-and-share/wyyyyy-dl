<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { myPlaylists, loadMyPlaylists, setLastBackupPlaylist, updatePlaylistTrackCount } from '../lib/playlist.svelte';
  import {
    localPlaylistState,
    loadLocalPlaylists,
    createLocalPlaylist,
    addTrackToLocalPlaylist
  } from '../lib/localPlaylistStore.svelte';
  import { getTrackSourceStatus } from '../lib/player/trackStatus.svelte';
  import { deleteApiCache } from '../lib/utils';
  import Modal from './Modal.svelte';
  import CreatePlaylistModal from './CreatePlaylistModal.svelte';
  import { t } from '../lib/i18n/index.svelte';

  let {
    song,
    zIndex = 'z-[100020]',
    onClose,
    showToast
  } = $props<{
    song: { id: string | number; name: string; artist?: string; cover?: string; isLocal?: boolean; _isMusicFree?: boolean; isExternal?: boolean; raw?: any } | null;
    zIndex?: string;
    onClose: () => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let loading = $state(false);
  let addingId = $state<string | null>(null);
  let showCreateNetease = $state(false);
  let showCreateLocal = $state(false);
  let newLocalName = $state('');

  // 判定是否为外部音源插件歌曲
  const isExternal = $derived(
    Boolean(
      song &&
      (String(song.id).startsWith('mf_') ||
       (song as any)?._isMusicFree ||
       (song as any)?.isExternal)
    )
  );

  // 本地落盘 / 离线缓存状态
  const sourceStatus = $derived(
    song ? getTrackSourceStatus(song.id, song.isLocal) : { isServer: false, isPhone: false, isLocal: false }
  );
  const isDownloadedOrCached = $derived(sourceStatus.isServer || sourceStatus.isPhone);

  // 歌单选项卡：外部音源强制只能存入 'local'
  let activeTab = $state<'netease' | 'local'>('netease');

  $effect(() => {
    if (isExternal) {
      activeTab = 'local';
    }
  });

  const createdPlaylists = $derived(myPlaylists.filter((p: any) => !p.subscribed));

  onMount(async () => {
    loading = true;
    try {
      await Promise.all([
        myPlaylists.length === 0 ? loadMyPlaylists('created') : loadMyPlaylists('created').catch(() => {}),
        loadLocalPlaylists()
      ]);
    } finally {
      loading = false;
    }
  });

  async function handleAddToNetease(pl: any) {
    if (!song) return;
    addingId = String(pl.id);
    try {
      const j = await api.playlistAdd(String(pl.id), String(song.id));
      if (j.code === '000000') {
        const addedCount = typeof j.data?.addedCount === 'number' ? j.data.addedCount : 1;
        if (addedCount > 0) {
          updatePlaylistTrackCount(pl.id, addedCount);
        }
        setLastBackupPlaylist(pl.id, pl.name);
        showToast(j.msg || t('playlist.addSongSuccess', { song: song.name, playlist: pl.name }), 'success');
        deleteApiCache('playlist_' + pl.id);
        onClose();
      } else {
        showToast(j.msg || t('playlist.addToFailed'), 'warning');
      }
    } catch (e: any) {
      showToast(t('playlist.addSongException', { error: e.message || e }), 'error');
    } finally {
      addingId = null;
    }
  }

  async function handleAddToLocal(pl: any) {
    if (!song) return;
    addingId = String(pl.id);
    try {
      const res = await addTrackToLocalPlaylist(pl.id, {
        name: song.name,
        artist: song.artist,
        coverUrl: song.cover || (song as any)?.al?.picUrl || (song as any)?.artwork
      });
      if (res.success) {
        showToast(res.msg || `已成功加入本地歌单「${pl.name}」`, 'success');
        deleteApiCache('playlist_' + pl.id);
        onClose();
      } else {
        showToast(res.msg || '添加到本地歌单失败', 'warning');
      }
    } catch (e: any) {
      showToast('添加到本地歌单异常: ' + (e.message || e), 'error');
    } finally {
      addingId = null;
    }
  }

  async function handleCreateLocalPlaylist() {
    if (!newLocalName.trim()) return;
    const res = await createLocalPlaylist(newLocalName.trim());
    if (res.success && res.data) {
      showToast(`已成功创建本地歌单「${res.data.name}」`, 'success');
      newLocalName = '';
      showCreateLocal = false;
      if (song && isDownloadedOrCached) {
        await handleAddToLocal(res.data);
      }
    } else {
      showToast(res.msg || '创建本地歌单失败', 'warning');
    }
  }
</script>

{#if song}
  <Modal title={t('playlist.addToTitle')} icon="📂" maxWidth="max-w-[480px]" {zIndex} {onClose}>
    <!-- 目标曲目提示卡片 -->
    <div class="flex items-center gap-2 p-2.5 rounded-xl bg-black/5 dark:bg-white/[0.04] border border-black/5 dark:border-white/10 mb-3">
      <span class="text-base">{isExternal ? '🧩' : '🎵'}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="text-xs font-bold text-[var(--text-main)] truncate">{song.name}</span>
          {#if isExternal}
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400 font-medium shrink-0">外部音源</span>
          {/if}
          {#if sourceStatus.isServer}
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-medium shrink-0" title="已落盘到电脑曲库">🖥️ 本地已存</span>
          {:else if sourceStatus.isPhone}
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-medium shrink-0" title="已缓存至浏览器">📱 离线缓存</span>
          {/if}
        </div>
        {#if song.artist}
          <div class="text-[11px] text-[var(--text-secondary)] truncate">{song.artist}</div>
        {/if}
      </div>
    </div>

    <!-- 歌单类型切换胶囊 (外部音源仅允许本地专属歌单) -->
    <div class="flex items-center gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/5 mb-3">
      {#if !isExternal}
        <button
          type="button"
          class="flex-1 py-1 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all {activeTab === 'netease' ? 'bg-red-500 text-white shadow-sm' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => activeTab = 'netease'}
        >
          ☁️ 网易云歌单
        </button>
      {/if}
      <button
        type="button"
        class="flex-1 py-1 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all {activeTab === 'local' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => activeTab = 'local'}
      >
        🖥️ 本地专属歌单 (零污染云端)
      </button>
    </div>

    <!-- 顶部操作栏 -->
    <div class="flex justify-between items-center mb-2 px-0.5">
      <span class="text-xs font-medium text-[var(--text-secondary)]">
        {activeTab === 'netease' ? t('playlist.selectCreated') : '选择目标本地歌单'}
      </span>
      {#if activeTab === 'netease'}
        <button
          type="button"
          class="text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-transparent border-none cursor-pointer flex items-center gap-1"
          onclick={() => showCreateNetease = true}
        >
          ➕ {t('playlist.create')}
        </button>
      {:else}
        <button
          type="button"
          class="text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-transparent border-none cursor-pointer flex items-center gap-1"
          onclick={() => showCreateLocal = !showCreateLocal}
        >
          ➕ 新建本地歌单
        </button>
      {/if}
    </div>

    <!-- 新建本地歌单内联表单 -->
    {#if showCreateLocal && activeTab === 'local'}
      <div class="flex items-center gap-2 mb-3 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <input
          type="text"
          placeholder="输入新本地歌单名称..."
          bind:value={newLocalName}
          class="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-[var(--input-bg)] text-[var(--text-main)] border border-[var(--input-border)] focus:outline-none focus:border-emerald-500"
          onkeydown={(e) => e.key === 'Enter' && handleCreateLocalPlaylist()}
        />
        <button
          type="button"
          class="btn-primary text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer"
          onclick={handleCreateLocalPlaylist}
        >
          创建并加入
        </button>
      </div>
    {/if}

    <!-- 外部音源未落盘阻断提示 -->
    {#if isExternal && !isDownloadedOrCached}
      <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed mb-3">
        <div class="font-bold mb-1 flex items-center gap-1">
          <span>⚠️</span> <span>外部音源需先下载或缓存</span>
        </div>
        <p class="text-[11px] opacity-80 mb-2">
          该歌曲来自外部插件，为保障播放高可用性与零延迟秒播，请先将其下载到本地磁盘或保存离线缓存，再添加到本地歌单。
        </p>
      </div>
    {/if}

    <!-- 歌单列表 -->
    <div class="max-h-[48vh] sm:max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
      {#if loading}
        <div class="py-8 text-center text-xs text-[var(--text-muted)]">
          🔄 {t('playlist.loadingMine')}
        </div>
      {:else if activeTab === 'netease'}
        {#each createdPlaylists as pl}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="flex justify-between items-center p-2.5 rounded-xl border border-black/5 dark:border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group cursor-pointer"
            onclick={() => handleAddToNetease(pl)}
          >
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="text-sm">📁</span>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-semibold text-[var(--text-main)] truncate">{pl.name}</div>
                <div class="text-[10px] text-[var(--text-muted)]">{t('playlist.trackItemCount', { count: pl.trackCount || 0 })}</div>
              </div>
            </div>
            <button
              type="button"
              disabled={addingId === String(pl.id)}
              class="btn-primary text-xs px-3 py-1 rounded-lg font-medium shrink-0 cursor-pointer disabled:opacity-50 pointer-events-auto"
              onclick={(e) => { e.stopPropagation(); handleAddToNetease(pl); }}
            >
              {addingId === String(pl.id) ? t('playlist.adding') : `➕ ${t('playlist.add')}`}
            </button>
          </div>
        {:else}
          <div class="py-8 text-center text-xs text-[var(--text-muted)]">
            {t('playlist.noCreatedPrompt')}
          </div>
        {/each}
      {:else}
        <!-- 本地专属歌单 -->
        {#each localPlaylistState.playlists as pl}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="flex justify-between items-center p-2.5 rounded-xl border border-black/5 dark:border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group cursor-pointer {isExternal && !isDownloadedOrCached ? 'opacity-40 pointer-events-none' : ''}"
            onclick={() => handleAddToLocal(pl)}
          >
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="text-sm">🖥️</span>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-semibold text-[var(--text-main)] truncate">{pl.name}</div>
                <div class="text-[10px] text-[var(--text-muted)]">{pl.trackCount || 0} 首已落盘歌曲</div>
              </div>
            </div>
            <button
              type="button"
              disabled={addingId === String(pl.id) || (isExternal && !isDownloadedOrCached)}
              class="btn-primary text-xs px-3 py-1 rounded-lg font-medium shrink-0 cursor-pointer disabled:opacity-50 pointer-events-auto !bg-emerald-600 hover:!bg-emerald-500"
              onclick={(e) => { e.stopPropagation(); handleAddToLocal(pl); }}
            >
              {addingId === String(pl.id) ? t('playlist.adding') : '➕ 加入本地'}
            </button>
          </div>
        {:else}
          <div class="py-8 text-center text-xs text-[var(--text-muted)]">
            暂无本地歌单，点击上方「➕ 新建本地歌单」立即创建
          </div>
        {/each}
      {/if}
    </div>

  </Modal>
{/if}

{#if showCreateNetease}
  <CreatePlaylistModal
    zIndex="z-[100030]"
    onClose={() => showCreateNetease = false}
    onSuccess={(newId) => {
      showToast(t('toast.playlist.created'), 'success');
      loadMyPlaylists('created').catch(() => {});
    }}
  />
{/if}
