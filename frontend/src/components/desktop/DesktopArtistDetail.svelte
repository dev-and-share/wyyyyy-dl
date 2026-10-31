<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER, formatCoverUrl, getApiCache, setApiCache } from '../../lib/utils';
  import SlotBtn from '../SlotBtn.svelte';
  import TrackLikeBtn from '../TrackLikeBtn.svelte';
  import TrackSourceBadge from '../TrackSourceBadge.svelte';
  import AddToPlaylistModal from '../AddToPlaylistModal.svelte';
  import { cacheTrackToBrowser } from '../../lib/pwaCache.svelte';
  import { getTrackSourceStatus, isSameTrack } from '../../lib/trackStatus.svelte';
  import { t } from '../../lib/i18n';

  let {
    artistId,
    curTrack = null,
    playing = false,
    likedSet = new Set<number>(),
    downloadedSet = new Set<number>(),
    onBackToSearch,
    onToggleLike,
    onPlayQueue,
    onAlbum,
    onSong,
    onReveal,
    showToast
  } = $props<{
    artistId: string;
    curTrack?: any;
    playing?: boolean;
    likedSet?: Set<number>;
    downloadedSet?: Set<number>;
    onBackToSearch: () => void;
    onToggleLike?: (id: number, name: string, artist?: string) => void;
    onPlayQueue?: (tracks: any[], idx?: number) => void;
    onAlbum?: (albumId: string) => void;
    onSong?: (songId: string) => void;
    onReveal?: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let artistData = $state<any>(null);
  let loading = $state(false);
  let forking = $state(false);
  let cachingBatch = $state(false);
  let cachingTrackId = $state<number | null>(null);
  let addToPlaylistSong = $state<{ id: number; name: string; artist: string } | null>(null);

  let songs = $derived<any[]>(artistData?.songs || []);

  onMount(() => {
    if (artistId) {
      loadArtist(artistId);
    }
  });

  $effect(() => {
    if (artistId && String(artistData?.id) !== String(artistId)) {
      loadArtist(artistId);
    }
  });

  async function loadArtist(id: string) {
    if (!id) return;
    const cacheKey = 'artist_' + id;
    const cached = getApiCache(cacheKey);
    if (cached?.data?.artist || cached?.data) {
      artistData = cached.data.artist || cached.data;
    } else {
      loading = true;
    }

    try {
      const res = await api.artist(id);
      loading = false;
      if (res?.code && res.code !== '000000') {
        showToast(res.msg || t('artist.fetchFailed'), 'warning');
        return;
      }
      artistData = res?.data?.artist || res?.data || res;
      setApiCache(cacheKey, res.data);
    } catch (e: any) {
      loading = false;
      showToast(t('artist.fetchFailedWithMsg', { message: e?.message || e }), 'error');
    }
  }

  function handlePlayAll() {
    if (!songs.length || !onPlayQueue) return;
    const queue = songs.map((s: any) => {
      const art = formatArtist(s.artist || s.ar || s.artists || artistData?.name || '');
      const status = getTrackSourceStatus(s.id, s.isLocal, curTrack);
      return {
        id: s.id,
        name: s.name,
        artist: art,
        cover: s.picUrl || s.al?.picUrl || artistData?.picUrl || DEFAULT_VINYL_COVER,
        isLocal: status.isLocal
      };
    });
    onPlayQueue(queue, 0);
    showToast(t('artist.playingTop50Toast', { name: artistData?.name || t('artist.artistWord') }), 'success', 2000);
  }

  async function handleForkToPlaylist() {
    if (!songs.length) {
      showToast(t('artist.noSongsToCollect'), 'warning');
      return;
    }
    const plName = t('artist.topSongsPlaylistName', { name: artistData?.name || t('artist.artistWord'), count: songs.length });
    const trackIds = songs.map((s: any) => s.id).join(',');
    forking = true;
    try {
      const res = await api.playlistFork(plName, false, trackIds);
      if (res?.code && res.code !== '000000') {
        showToast(res.msg || t('artist.forkFailedWithMsg', { message: res.msg }), 'error');
        return;
      }
      showToast(t('artist.forkSuccess', { name: plName }), 'success', 3500);
      window.dispatchEvent(new CustomEvent('wyyyy:playlist-created'));
    } catch (e: any) {
      showToast(t('artist.forkFailedWithMsg', { message: e?.message || e }), 'error');
    } finally {
      forking = false;
    }
  }

  async function handleBatchDownload() {
    if (!songs.length) return;
    showToast(t('artist.submittingDownloadBatch', { name: artistData?.name || t('artist.artistWord') }), 'info', 2000);
    let submitCount = 0;
    for (const s of songs) {
      try {
        await api.downloadSingle(String(s.id));
        submitCount++;
      } catch {}
    }
    showToast(t('artist.submittedDownloadCount', { count: submitCount, total: songs.length }), 'success');
    window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
  }

  async function handleBatchCache() {
    if (!songs.length) return;
    cachingBatch = true;
    showToast(t('artist.cachingBatchStart', { name: artistData?.name || t('artist.artistWord') }), 'info', 2000);
    let successCount = 0;
    for (const s of songs) {
      try {
        const res = await cacheTrackToBrowser({
          id: s.id,
          name: s.name,
          artist: formatArtist(s.artist || s.ar || s.artists || artistData?.name || ''),
          cover: s.picUrl || s.al?.picUrl || artistData?.picUrl || DEFAULT_VINYL_COVER,
          album: s.album || s.al?.name || ''
        });
        if (res.success) successCount++;
      } catch {}
    }
    cachingBatch = false;
    showToast(t('artist.cachingBatchComplete', { success: successCount, total: songs.length }), 'success');
  }

  async function handleDownloadSingle(id: string, name?: string) {
    try {
      const res = await api.downloadSingle(id);
      const task = res?.data;
      const songName = task?.name || name || t('common.unknownSong');
      if (task?.status === 'SKIP') {
        showToast(t('download.skippedWithName', { name: songName, reason: task.errorMsg || t('download.skipReasonPreviewOrExist') }), 'warning', 3000);
      } else if (task?.status === 'FAILED') {
        showToast(t('download.failedWithName', { name: songName, reason: task.errorMsg || t('download.failReasonExecuteError') }), 'error', 3000);
      } else {
        showToast(t('download.submitSuccessWithName', { name: songName }), 'info', 2000);
      }
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.requestFailed', { error: e?.message || e }), 'error');
    }
  }

  async function handleCacheTrack(s: any) {
    cachingTrackId = s.id;
    try {
      const res = await cacheTrackToBrowser({
        id: s.id,
        name: s.name,
        artist: formatArtist(s.artist || s.ar || s.artists || artistData?.name || ''),
        cover: s.picUrl || s.al?.picUrl || artistData?.picUrl || DEFAULT_VINYL_COVER,
        album: s.album || s.al?.name || ''
      });
      showToast(res.msg || (res.success ? t('search.cachedToBrowser') : t('common.failed')), res.success ? 'success' : 'error');
    } catch (e: any) {
      showToast(t('search.cacheFailedWithMsg', { message: e?.message || e }), 'error');
    } finally {
      cachingTrackId = null;
    }
  }
</script>

<!-- 🖥️ PC 桌面端：歌手热门 50 首宽屏大表 (Artist Detail View) -->
<div class="flex flex-col gap-2.5 select-none animate-fade-in" data-testid="desktop-artist-detail">
  <!-- 1. 顶部面包屑导航 (与右上角控制胶囊同排对齐，0 额外垂直留白) -->
  <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)] min-h-[34px] pr-[215px]">
    <button
      type="button"
      data-testid="btn-back-search"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-main)] border border-[var(--btn-secondary-border)] cursor-pointer transition-colors font-medium shrink-0"
      onclick={onBackToSearch}
    >
      <span>←</span>
      <span>{t('artist.backToSearch')}</span>
    </button>
    <span class="opacity-40 shrink-0">/</span>
    <span class="truncate font-semibold text-[var(--text-main)]">
      {t('artist.top50Breadcrumb', { name: artistData?.name || t('artist.artistWord'), id: artistId })}
    </span>
  </div>

  {#if loading && !artistData}
    <div class="py-20 text-center flex flex-col items-center gap-3 text-xs text-[var(--text-muted)]">
      <span class="text-3xl animate-spin">⏳</span>
      <span>{t('artist.fetchingTop50')}</span>
    </div>
  {:else if artistData}
    <!-- 2. 精致紧凑 Hero 横幅区 -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 sm:p-4 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] shadow-sm">
      <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-md shrink-0 border border-[var(--border-subtle)] bg-black/20">
        <img
          src={formatCoverUrl(artistData.picUrl || artistData.img1v1Url, 300)}
          alt={artistData.name}
          class="w-full h-full object-cover"
        />
      </div>
      <div class="flex-1 min-w-0 flex flex-col gap-1.5">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-pink-500/20 text-pink-400 border border-pink-500/30">
            {t('common.artist')}
          </span>
          <span class="text-xs text-[var(--text-muted)] font-mono">ID: {artistData.id}</span>
        </div>
        <h1 class="text-lg sm:text-xl font-bold text-[var(--text-main)] truncate tracking-tight">
          {artistData.name}
        </h1>
        <p class="text-xs text-[var(--text-secondary)] flex items-center gap-3">
          <span>{t('artist.hotSongCount', { count: songs.length })}</span>
          <span>{t('artist.albumCount', { count: artistData.albumSize || 0 })}</span>
          <span>{t('artist.songCount', { count: artistData.musicSize || 0 })}</span>
        </p>

        <!-- 快捷操作按钮组 -->
        <div class="flex items-center gap-2 pt-0.5 flex-wrap">
          <button
            type="button"
            data-testid="btn-artist-play-all"
            class="btn-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
            onclick={handlePlayAll}
          >
            <span>▶️</span>
            <span>{t('playlist.playAll')}</span>
          </button>
          <button
            type="button"
            data-testid="btn-artist-fork"
            class="btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
            disabled={forking}
            onclick={handleForkToPlaylist}
            title={t('artist.forkTooltip')}
          >
            <span>{forking ? '⏳' : '⭐'}</span>
            <span>{forking ? t('artist.forking') : t('artist.collectAsPlaylist')}</span>
          </button>
          <button
            type="button"
            class="btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
            disabled={cachingBatch}
            onclick={handleBatchCache}
            title={t('artist.cacheTooltip')}
          >
            <span>{cachingBatch ? '⏳' : '⚡'}</span>
            <span>{cachingBatch ? t('artist.caching') : t('artist.offlineCache')}</span>
          </button>
          <button
            type="button"
            class="btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
            onclick={handleBatchDownload}
            title={t('artist.downloadAllTooltip')}
          >
            <span>🖥️</span>
            <span>{t('download.batchDownload')}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 3. 宽屏歌曲大表格 (高度自适应视口，表头 Sticky 吸顶，无外层滚动) -->
    <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] overflow-hidden shadow-sm flex flex-col">
      <div class="overflow-x-auto max-h-[calc(100vh-325px)] min-h-[240px] overflow-y-auto custom-table-scroll">
        <table class="w-full table-fixed text-left border-collapse text-xs">
          <!-- 吸顶表头 -->
          <thead class="sticky top-0 z-10 bg-[var(--card-header-bg)] backdrop-blur-xl border-b border-[var(--border-color)] text-[var(--text-muted)]">
            <tr>
              <th class="w-12 py-3 pl-4 font-semibold">#</th>
              <th class="py-3 px-3 font-semibold">{t('search.tableTitle')}</th>
              <th class="py-3 px-3 font-semibold w-36 lg:w-44">{t('common.artist')}</th>
              <th class="py-3 px-3 font-semibold w-36 lg:w-44 hidden md:table-cell">{t('common.album')}</th>
              <th class="py-3 pr-4 text-right font-semibold w-48">{t('search.tableActions')}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--border-subtle)]">
            {#each songs as s, idx (s.id)}
              {@const artistName = formatArtist(s.artist || s.ar || s.artists || artistData.name || '')}
              {@const status = getTrackSourceStatus(s.id, s.isLocal, curTrack)}
              {@const isPlayingThis = isSameTrack(curTrack, s)}
              <tr class="hover:bg-[var(--card-header-hover)] transition-colors group {isPlayingThis ? 'bg-red-500/10' : ''}">
                <!-- 序号 -->
                <td class="py-2.5 pl-4 text-[var(--text-muted)] font-mono text-[11px] w-12">
                  {#if isPlayingThis && playing}
                    <span class="text-red-500 animate-pulse">▶</span>
                  {:else}
                    {idx + 1}
                  {/if}
                </td>

                <!-- 标题 + 徽章 + Like -->
                <td class="py-2.5 px-3 min-w-0">
                  <div class="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      class="font-semibold text-[var(--text-main)] truncate max-w-[200px] xl:max-w-md group-hover:text-red-400 transition-colors bg-transparent border-none p-0 cursor-pointer text-left"
                      onclick={() => onSong ? onSong(String(s.id)) : (onPlayQueue && onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: s.picUrl || s.al?.picUrl || artistData?.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }]))}
                    >
                      {s.name}
                    </button>
                    <TrackSourceBadge id={s.id} isLocal={s.isLocal} {curTrack} class="shrink-0" />
                    {#if onToggleLike}
                      <TrackLikeBtn liked={likedSet.has(Number(s.id))} onclick={() => onToggleLike(Number(s.id), s.name, artistName)} />
                    {/if}
                  </div>
                </td>

                <!-- 歌手 -->
                <td class="py-2.5 px-3 text-[var(--text-secondary)] truncate w-36 lg:w-44" title={artistName}>
                  {artistName || t('common.variousArtists')}
                </td>

                <!-- 专辑 -->
                <td class="py-2.5 px-3 text-[var(--text-muted)] truncate w-36 lg:w-44 hidden md:table-cell">
                  {#if (s.al?.id || s.album?.id) && onAlbum}
                    <button
                      type="button"
                      class="text-left bg-transparent border-none p-0 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer truncate max-w-[140px]"
                      onclick={() => onAlbum(String(s.al?.id || s.album?.id))}
                    >
                      {s.al?.name || s.album?.name || s.album || t('search.tab.song')}
                    </button>
                  {:else}
                    <span class="truncate block max-w-[140px]">{s.al?.name || s.album?.name || s.album || t('search.tab.song')}</span>
                  {/if}
                </td>

                <!-- 操作按钮组 -->
                <td class="py-2.5 pr-4 text-right w-48">
                  <div class="inline-flex items-center gap-1.5 justify-end">
                    <!-- 播放 -->
                    <SlotBtn
                      onclick={() => onPlayQueue && onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: s.picUrl || s.al?.picUrl || artistData?.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                      title={isPlayingThis && playing ? t('player.pause') : t('search.listenNow')}
                    >
                      {isPlayingThis && playing ? '⏸' : '▶'}
                    </SlotBtn>

                    <!-- 下载到电脑 -->
                    <SlotBtn
                      onclick={() => handleDownloadSingle(String(s.id), s.name)}
                      title={t('search.downloadTrackToServer')}
                    >
                      📥
                    </SlotBtn>

                    <!-- 加入歌单 -->
                    <SlotBtn
                      onclick={() => addToPlaylistSong = { id: Number(s.id), name: s.name, artist: artistName }}
                      title={t('playlist.addTo')}
                    >
                      ➕
                    </SlotBtn>

                    <!-- 离线缓存 -->
                    <SlotBtn
                      onclick={() => handleCacheTrack(s)}
                      title={t('search.cacheToBrowserTooltip')}
                    >
                      {cachingTrackId === s.id ? '⏳' : '⚡'}
                    </SlotBtn>

                    <!-- 定位 -->
                    {#if status.isServer && onReveal}
                      <SlotBtn
                        onclick={() => onReveal({ id: s.id, name: s.name, artist: artistName })}
                        title={t('player.revealOnDisk')}
                      >
                        📂
                      </SlotBtn>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  {#if addToPlaylistSong}
    <AddToPlaylistModal
      song={addToPlaylistSong}
      onClose={() => addToPlaylistSong = null}
      {showToast}
    />
  {/if}
</div>

<style>
  .custom-table-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-table-scroll::-webkit-scrollbar-thumb {
    background: var(--border-color, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
  }
</style>
