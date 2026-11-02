<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../lib/api';
  import { t } from '../../lib/i18n';
  import { formatArtist, DEFAULT_VINYL_COVER } from '../../lib/utils';
  import { toPlayerTrack } from '../../lib/playerHelper';
  import {
    myPlaylists,
    loadMyPlaylists,
    getLastBackupPlaylist,
    setLastBackupPlaylist,
    updatePlaylistTrackCount
  } from '../../lib/playlist.svelte';
  import { getTrackSourceStatus, markSongDownloaded, isSameTrack, getTrackPlayActionLabel } from '../../lib/trackStatus.svelte';
  import SlotBtn from '../SlotBtn.svelte';
  import TrackLikeBtn from '../TrackLikeBtn.svelte';
  import TrackSourceBadge from '../TrackSourceBadge.svelte';
  import AddToPlaylistModal from '../AddToPlaylistModal.svelte';
  import Modal from '../Modal.svelte';
  import CreatePlaylistModal from '../CreatePlaylistModal.svelte';

  let {
    curTrack = null,
    playing = false,
    likedSet = new Set<number>(),
    downloadedSet = new Set<number>(),
    onBackToGallery,
    onToggleLike,
    onPlayQueue,
    onSong,
    onAlbum,
    onReveal,
    showToast
  } = $props<{
    curTrack?: any;
    playing?: boolean;
    likedSet?: Set<number>;
    downloadedSet?: Set<number>;
    onBackToGallery: () => void;
    onToggleLike?: (id: number, name: string, artist?: string) => void;
    onPlayQueue?: (tracks: any[], optionsOrIdx?: any) => void;
    onSong?: (id: string) => void;
    onAlbum?: (albumId: string) => void;
    onReveal?: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let loading = $state(false);
  let errorMsg = $state('');
  let recommendTracks = $state<any[]>([]);
  let lastBackup = $state<{ id: string; name: string } | null>(getLastBackupPlaylist());
  let isBackingUp = $state(false);
  let isDownloadingAll = $state(false);
  let showSelectModal = $state(false);
  let showCreateModal = $state(false);
  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);

  const dateInfo = $derived.by(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return {
      monthText: t('recommend.monthText', { month: m }),
      dayNum: day,
      fullText: t('recommend.fullText', { month: m, day })
    };
  });

  async function loadRecommend(force = false) {
    if (recommendTracks.length > 0 && !force) return;
    loading = true;
    errorMsg = '';
    try {
      const res = await api.recommendSongs();
      if (res?.code === '000000' && Array.isArray(res.data)) {
        recommendTracks = res.data;
      } else {
        errorMsg = res?.msg || t('recommend.failedCookie');
      }
    } catch (e: any) {
      errorMsg = e?.message || t('recommend.failedNetwork');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadRecommend();
  });

  function handlePlayAll() {
    if (!recommendTracks.length || !onPlayQueue) return;
    const list = recommendTracks.map(trk =>
      toPlayerTrack(trk, {
        artist: typeof trk.artists === 'string' ? trk.artists : formatArtist(trk.artists || trk.ar),
        isLocal: trk.isLocal
      })
    );
    onPlayQueue(list, 0);
  }

  async function handleDownloadAll() {
    if (!recommendTracks.length) return;
    isDownloadingAll = true;
    try {
      for (const trk of recommendTracks) {
        await api.downloadSingle(String(trk.id));
        markSongDownloaded(Number(trk.id));
      }
      showToast(t('recommend.batchSubmitted', { count: recommendTracks.length }), 'success');
    } catch (e: any) {
      showToast(t('recommend.batchFailed', { error: e?.message || e }), 'error');
    } finally {
      isDownloadingAll = false;
    }
  }

  async function handleDownloadSingle(id: string, name: string) {
    try {
      await api.downloadSingle(id);
      markSongDownloaded(Number(id));
      showToast(t('download.submitSuccessWithName', { name }), 'success');
    } catch (e: any) {
      showToast(t('download.failedWithName', { name, reason: e?.message || e }), 'error');
    }
  }

  async function handleBackupToPlaylist(targetId: string, targetName: string) {
    if (!recommendTracks.length) return;
    isBackingUp = true;
    try {
      const trackIds = recommendTracks.map(trk => String(trk.id)).join(',');
      const res = await api.playlistAdd(targetId, trackIds);
      if (res?.code === '000000') {
        const addedCount = res.data?.count ?? recommendTracks.length;
        setLastBackupPlaylist(targetId, targetName);
        lastBackup = { id: targetId, name: targetName };
        updatePlaylistTrackCount(targetId, addedCount);
        showToast(t('recommend.importSuccessWithName', { name: targetName }), 'success');
      } else {
        showToast(res?.msg || t('recommend.importFailed'), 'error');
      }
    } catch (e: any) {
      showToast(t('recommend.importException', { error: e?.message || e }), 'error');
    } finally {
      isBackingUp = false;
      showSelectModal = false;
    }
  }

  async function handleBackupUpdate() {
    if (!lastBackup) {
      showSelectModal = true;
      return;
    }
    await handleBackupToPlaylist(lastBackup.id, lastBackup.name);
  }

  async function handleCreateAndBackup(name: string) {
    try {
      const res = await api.playlistCreate(name, false);
      if (res?.code === '000000' && res.data?.id) {
        const newId = String(res.data.id);
        await loadMyPlaylists();
        showCreateModal = false;
        await handleBackupToPlaylist(newId, name);
      } else {
        showToast(res?.msg || t('recommend.createFailed'), 'error');
      }
    } catch (e: any) {
      showToast(t('recommend.createException', { error: e?.message || e }), 'error');
    }
  }

  const myCreatedPlaylists = $derived(myPlaylists.filter(p => !p.subscribed));
</script>

<div class="flex flex-col gap-4 animate-fade-in" data-testid="desktop-daily-recommend-detail">
  <!-- 1. Top Breadcrumb Bar -->
  <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)] min-h-[34px] pr-[215px]">
    <button
      type="button"
      data-testid="btn-back-gallery"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-main)] border border-[var(--btn-secondary-border)] cursor-pointer transition-colors font-medium shrink-0"
      onclick={onBackToGallery}
    >
      <span>←</span>
      <span>{t('playlist.backToGallery')}</span>
    </button>
    <span class="opacity-40 shrink-0">/</span>
    <span class="truncate font-semibold text-[var(--text-main)]">{t('recommend.dailyExclusive')}</span>
  </div>

  <!-- 2. Hero Banner -->
  <div class="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 sm:p-5 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] shadow-sm">
    <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shrink-0 flex flex-col overflow-hidden border border-red-400/30 select-none">
      <div class="bg-red-700/80 text-white text-[11px] font-bold text-center py-1 tracking-wider uppercase">
        {dateInfo.monthText}
      </div>
      <div class="flex-1 bg-gradient-to-b from-white to-red-50 dark:from-neutral-900 dark:to-neutral-950 flex flex-col items-center justify-center">
        <span class="text-3xl sm:text-4xl font-black text-red-600 dark:text-red-400 tracking-tighter leading-none">
          {dateInfo.dayNum}
        </span>
        <span class="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">{t('recommend.dailyRecommendShort')}</span>
      </div>
    </div>

    <div class="flex-1 min-w-0 flex flex-col gap-2">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
          <span>📅</span>
          <span>{dateInfo.fullText}</span>
        </span>
        <span class="text-xs text-[var(--text-muted)] font-medium">
          {#if loading}
            {t('recommend.fetchingPrivate')}
          {:else if recommendTracks.length}
            {t('recommend.privateTracksTotal', { count: recommendTracks.length })}
          {:else}
            {t('recommend.updateTime')}
          {/if}
        </span>
      </div>

      <h1 class="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">
        {t('recommend.dailyExclusiveText')}
      </h1>
      <p class="text-xs text-[var(--text-secondary)]">
        {t('recommend.tasteIntro')}
      </p>

      <!-- Action buttons -->
      <div class="flex items-center gap-2.5 pt-1 flex-wrap">
        <button
          type="button"
          data-testid="btn-play-all-recommend"
          disabled={loading || !recommendTracks.length}
          class="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-sm disabled:opacity-50"
          onclick={handlePlayAll}
        >
          <span>▶️</span>
          <span>{t('playlist.playAll')}</span>
        </button>

        <button
          type="button"
          data-testid="btn-download-all-recommend"
          disabled={loading || isDownloadingAll || !recommendTracks.length}
          class="btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
          onclick={handleDownloadAll}
        >
          <span>{isDownloadingAll ? '🔄' : '📥'}</span>
          <span>{isDownloadingAll ? t('download.status.downloading') : t('playlist.downloadAll')}</span>
        </button>

        {#if lastBackup}
          <div class="inline-flex rounded-xl border border-emerald-500/30 bg-emerald-500/10 overflow-hidden shadow-xs">
            <button
              type="button"
              disabled={isBackingUp || !recommendTracks.length}
              class="px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border-none bg-transparent"
              onclick={handleBackupUpdate}
              title={t('recommend.updateBackupTitle', { name: lastBackup.name })}
            >
              <span>{isBackingUp ? '🔄' : '📦'}</span>
              <span>{t('recommend.backupToWithName', { name: lastBackup.name })}</span>
            </button>
            <button
              type="button"
              disabled={isBackingUp}
              class="px-2 py-2 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-l border-emerald-500/20 cursor-pointer bg-transparent"
              onclick={() => showSelectModal = true}
              title={t('recommend.backupChangeTooltip')}
            >
              ⚙️
            </button>
          </div>
        {:else}
          <button
            type="button"
            disabled={isBackingUp || !recommendTracks.length}
            class="btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 text-emerald-600 dark:text-emerald-400"
            onclick={() => showSelectModal = true}
          >
            <span>📦</span>
            <span>{t('recommend.backupBtn')}</span>
          </button>
        {/if}

        <button
          type="button"
          disabled={loading}
          class="btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
          onclick={() => loadRecommend(true)}
          title={t('recommend.refreshTooltip')}
        >
          <span>🔄</span>
          <span>{t('common.refresh')}</span>
        </button>
      </div>
    </div>
  </div>

  <!-- 3. Wide Tracks Table -->
  <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] overflow-hidden shadow-sm flex flex-col">
    {#if loading}
      <div class="flex flex-col items-center justify-center p-12 gap-3 text-[var(--text-muted)]">
        <div class="w-8 h-8 border-3 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        <div class="text-xs font-medium">{t('recommend.syncing')}</div>
      </div>
    {:else if errorMsg}
      <div class="p-8 text-center flex flex-col items-center gap-3">
        <div class="text-3xl">⚠️</div>
        <div class="text-sm font-semibold text-red-500">{errorMsg}</div>
        <button
          type="button"
          class="btn-primary text-xs px-4 py-2 rounded-xl mt-2 cursor-pointer"
          onclick={() => loadRecommend(true)}
        >
          {t('common.retry')}
        </button>
      </div>
    {:else if recommendTracks.length === 0}
      <div class="p-12 text-center text-xs text-[var(--text-muted)]">
        {t('recommend.empty')}
      </div>
    {:else}
      <div class="overflow-x-auto custom-table-scroll">
        <table class="w-full text-left border-collapse text-xs">
          <thead class="sticky top-0 z-10 bg-[var(--card-header-bg)] backdrop-blur-xl border-b border-[var(--border-color)] text-[var(--text-muted)]">
            <tr>
              <th class="w-12 py-3 pl-4 font-semibold">#</th>
              <th class="py-3 px-3 font-semibold">{t('search.tableTitle')}</th>
              <th class="py-3 px-3 font-semibold w-44">{t('search.tableArtist')}</th>
              <th class="py-3 px-3 font-semibold w-48 hidden md:table-cell">{t('search.tableAlbum')}</th>
              <th class="py-3 pr-4 text-right font-semibold w-56">{t('search.tableActions')}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--border-subtle)]">
            {#each recommendTracks as trackItem, i (trackItem.id)}
              {@const status = getTrackSourceStatus(trackItem.id, trackItem.isLocal, curTrack)}
              {@const artist = typeof trackItem.artists === 'string' ? trackItem.artists : formatArtist(trackItem.artists || trackItem.ar)}
              {@const albumName = trackItem.album?.name || trackItem.al?.name || t('search.tab.song')}
              {@const albumId = trackItem.album?.id || trackItem.al?.id}
              {@const coverUrl = trackItem.album?.picUrl || trackItem.al?.picUrl || DEFAULT_VINYL_COVER}
              {@const isPlayingThis = isSameTrack(curTrack, trackItem)}
              <tr class="hover:bg-[var(--card-header-hover)] transition-colors group {isPlayingThis ? 'bg-red-500/10' : ''}">
                <td class="py-2.5 pl-4 text-[var(--text-muted)] font-mono text-[11px]">
                  {#if isPlayingThis && playing}
                    <span class="text-red-500 animate-pulse">▶</span>
                  {:else}
                    {i + 1}
                  {/if}
                </td>

                <td class="py-2.5 px-3 min-w-0">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="font-semibold text-[var(--text-main)] truncate max-w-xs xl:max-w-md group-hover:text-red-400 transition-colors">
                      {trackItem.name}
                    </span>
                    <TrackSourceBadge id={trackItem.id} isLocal={trackItem.isLocal} {curTrack} class="shrink-0" />
                    {#if onToggleLike}
                      <TrackLikeBtn liked={likedSet.has(Number(trackItem.id))} onclick={() => onToggleLike?.(Number(trackItem.id), trackItem.name, artist)} />
                    {/if}
                  </div>
                </td>

                <td class="py-2.5 px-3 text-[var(--text-secondary)] truncate">
                  {artist || t('common.variousArtists')}
                </td>

                <td class="py-2.5 px-3 text-[var(--text-muted)] truncate hidden md:table-cell">
                  {#if albumId && onAlbum}
                    <button
                      type="button"
                      class="text-left bg-transparent border-none p-0 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer truncate max-w-[180px]"
                      onclick={() => onAlbum?.(String(albumId))}
                    >
                      {albumName}
                    </button>
                  {:else}
                    <span>{albumName}</span>
                  {/if}
                </td>

                <td class="py-2.5 pr-4 text-right whitespace-nowrap">
                  <div class="inline-flex items-center justify-end gap-1.5">
                    {#if onPlayQueue}
                      <SlotBtn
                        playing={isPlayingThis && playing}
                        onclick={() => onPlayQueue([{ id: trackItem.id, name: trackItem.name, artist, cover: coverUrl, isLocal: status.isLocal }])}
                      >
                        {getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal: status.isLocal, variant: 'desktop' })}
                      </SlotBtn>
                    {/if}

                    {#if status.isServer}
                      <SlotBtn onclick={() => onReveal && onReveal({ id: trackItem.id, name: trackItem.name, artist })}>
                        {t('common.reveal')}
                      </SlotBtn>
                    {:else}
                      <SlotBtn onclick={() => handleDownloadSingle(String(trackItem.id), trackItem.name)}>
                        {t('download.downloadSingle')}
                      </SlotBtn>
                    {/if}

                    <SlotBtn onclick={() => { addToPlaylistSong = { id: trackItem.id, name: trackItem.name, artist }; }}>
                      {t('playlist.collectTo')}
                    </SlotBtn>

                    {#if onSong}
                      <SlotBtn onclick={() => onSong?.(String(trackItem.id))}>
                        {t('playlist.viewSongDetails')}
                      </SlotBtn>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- Modals -->
{#if addToPlaylistSong}
  <AddToPlaylistModal
    song={addToPlaylistSong}
    onClose={() => addToPlaylistSong = null}
    {showToast}
  />
{/if}

{#if showSelectModal}
  <Modal title={t('recommend.selectBackupTitle')} onClose={() => showSelectModal = false}>
    <div class="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1 select-none">
      <p class="text-xs text-[var(--text-secondary)]">
        {t('recommend.selectBackupPrompt')}
      </p>

      <button
        type="button"
        class="w-full py-2 px-3 rounded-xl border border-dashed border-red-500/40 text-red-500 hover:bg-red-500/10 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        onclick={() => { showSelectModal = false; showCreateModal = true; }}
      >
        <span>➕</span>
        <span>{t('recommend.createBackupPlaylist')}</span>
      </button>

      <div class="flex flex-col gap-1.5">
        {#each myCreatedPlaylists as p (p.id)}
          <button
            type="button"
            class="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--card-header-hover)] text-left cursor-pointer border border-transparent hover:border-[var(--border-subtle)] transition-all"
            onclick={() => handleBackupToPlaylist(String(p.id), p.name)}
          >
            <img src={p.coverImgUrl || DEFAULT_VINYL_COVER} alt="" class="w-9 h-9 rounded-lg object-cover" />
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold text-[var(--text-main)] truncate">{p.name}</div>
              <div class="text-[10px] text-[var(--text-muted)]">{t('playlist.songCountTotal', { count: p.trackCount })}</div>
            </div>
            <span class="text-xs text-[var(--text-muted)]">{t('recommend.importArrow')}</span>
          </button>
        {/each}
      </div>
    </div>
  </Modal>
{/if}

{#if showCreateModal}
  <CreatePlaylistModal
    onClose={() => showCreateModal = false}
    onSuccess={async (newId) => {
      showCreateModal = false;
      if (newId) {
        await loadMyPlaylists();
        const pl = myPlaylists.find(p => String(p.id) === String(newId));
        await handleBackupToPlaylist(String(newId), pl?.name || t('playlist.createDefaultName'));
      }
    }}
  />
{/if}
