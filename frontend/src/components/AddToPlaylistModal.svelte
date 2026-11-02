<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { myPlaylists, loadMyPlaylists, setLastBackupPlaylist, updatePlaylistTrackCount } from '../lib/playlist.svelte';
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
    song: { id: string | number; name: string; artist?: string } | null;
    zIndex?: string;
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
    } else {
      loadMyPlaylists('created').catch(() => {});
    }
  });

  async function handleAddTo(pl: any) {
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
</script>

{#if song}
  <Modal title={t('playlist.addToTitle')} icon="📂" maxWidth="max-w-[480px]" {zIndex} {onClose}>
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
      <span class="text-xs font-medium text-[var(--text-secondary)]">{t('playlist.selectCreated')}</span>
      <button
        type="button"
        class="text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-transparent border-none cursor-pointer flex items-center gap-1"
        onclick={() => showCreate = true}
      >
        ➕ {t('playlist.create')}
      </button>
    </div>

    <!-- 自建歌单列表 -->
    <div class="max-h-[48vh] sm:max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
      {#if loading}
        <div class="py-8 text-center text-xs text-[var(--text-muted)]">
          🔄 {t('playlist.loadingMine')}
        </div>
      {:else}
        {#each createdPlaylists as pl}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="flex justify-between items-center p-2.5 rounded-xl border border-black/5 dark:border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group cursor-pointer"
            onclick={() => handleAddTo(pl)}
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
              onclick={(e) => { e.stopPropagation(); handleAddTo(pl); }}
            >
              {addingId === String(pl.id) ? t('playlist.adding') : `➕ ${t('playlist.add')}`}
            </button>
          </div>
        {:else}
          <div class="py-8 text-center text-xs text-[var(--text-muted)]">
            {t('playlist.noCreatedPrompt')}
          </div>
        {/each}
      {/if}
    </div>

  </Modal>
{/if}

{#if showCreate}
  <CreatePlaylistModal
    zIndex="z-[100030]"
    onClose={() => showCreate = false}
    onSuccess={(newId) => {
      showToast(t('toast.playlist.created'), 'success');
      loadMyPlaylists('created').catch(() => {});
    }}
  />
{/if}
