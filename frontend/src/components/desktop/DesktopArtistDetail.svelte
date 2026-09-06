<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER, getApiCache, setApiCache } from '../../lib/utils';
  import SlotBtn from '../SlotBtn.svelte';
  import TrackLikeBtn from '../TrackLikeBtn.svelte';
  import TrackSourceBadge from '../TrackSourceBadge.svelte';
  import AddToPlaylistModal from '../AddToPlaylistModal.svelte';
  import { cacheTrackToBrowser } from '../../lib/pwaCache.svelte';
  import { getTrackSourceStatus } from '../../lib/trackStatus.svelte';

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
        showToast(res.msg || '获取歌手信息失败', 'warning');
        return;
      }
      artistData = res?.data?.artist || res?.data || res;
      setApiCache(cacheKey, res.data);
    } catch (e: any) {
      loading = false;
      showToast('获取歌手失败: ' + (e?.message || e), 'error');
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
    showToast(`已开始播放《${artistData?.name || '歌手'}》热门 50 首`, 'success', 2000);
  }

  async function handleForkToPlaylist() {
    if (!songs.length) {
      showToast('当前歌手无曲目可收藏', 'warning');
      return;
    }
    const plName = `《${artistData?.name || '歌手'}》热门 ${songs.length} 首`;
    const trackIds = songs.map((s: any) => s.id).join(',');
    forking = true;
    try {
      const res = await api.playlistFork(plName, false, trackIds);
      if (res?.code && res.code !== '000000') {
        showToast(res.msg || '收藏为歌单失败', 'error');
        return;
      }
      showToast(`已成功将热门曲目收藏为新歌单：${plName}`, 'success', 3500);
      window.dispatchEvent(new CustomEvent('wyyyy:playlist-created'));
    } catch (e: any) {
      showToast('收藏为歌单失败: ' + (e?.message || e), 'error');
    } finally {
      forking = false;
    }
  }

  async function handleBatchDownload() {
    if (!songs.length) return;
    showToast(`开始提交《${artistData?.name || '歌手'}》热门歌曲下载任务...`, 'info', 2000);
    let submitCount = 0;
    for (const s of songs) {
      try {
        await api.downloadSingle(String(s.id));
        submitCount++;
      } catch {}
    }
    showToast(`已提交 ${submitCount}/${songs.length} 首歌曲下载`, 'success');
    window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
  }

  async function handleBatchCache() {
    if (!songs.length) return;
    cachingBatch = true;
    showToast(`开始批量离线缓存《${artistData?.name || '歌手'}》热门曲目...`, 'info', 2000);
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
    showToast(`批量缓存完成：已缓存 ${successCount}/${songs.length} 首`, 'success');
  }

  async function handleDownloadSingle(id: string, name?: string) {
    try {
      const res = await api.downloadSingle(id);
      const task = res?.data;
      if (task?.status === 'SKIP') {
        showToast(`已跳过《${task.name || name || '歌曲'}》: ${task.errorMsg || '已存在'}`, 'warning', 3000);
      } else if (task?.status === 'FAILED') {
        showToast(`下载失败《${task.name || name || '歌曲'}》: ${task.errorMsg || '下载异常'}`, 'error', 3000);
      } else {
        showToast(`已提交下载: 《${task?.name || name || '歌曲'}》`, 'info', 2000);
      }
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast('下载请求异常: ' + (e?.message || e), 'error');
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
      showToast(res.msg || (res.success ? '已缓存到浏览器' : '缓存失败'), res.success ? 'success' : 'error');
    } catch (e: any) {
      showToast('缓存失败: ' + (e?.message || e), 'error');
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
      <span>返回搜索结果</span>
    </button>
    <span class="opacity-40 shrink-0">/</span>
    <span class="truncate font-semibold text-[var(--text-main)]">
      {artistData?.name || '歌手'} (ID: {artistId}) 热门 50 首
    </span>
  </div>

  {#if loading && !artistData}
    <div class="py-20 text-center flex flex-col items-center gap-3 text-xs text-[var(--text-muted)]">
      <span class="text-3xl animate-spin">⏳</span>
      <span>正在获取歌手热门 50 首曲目...</span>
    </div>
  {:else if artistData}
    <!-- 2. 精致紧凑 Hero 横幅区 -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 sm:p-4 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] shadow-sm">
      <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-md shrink-0 border border-[var(--border-subtle)] bg-black/20">
        <img
          src={artistData.picUrl || artistData.img1v1Url || DEFAULT_VINYL_COVER}
          alt={artistData.name}
          class="w-full h-full object-cover"
        />
      </div>
      <div class="flex-1 min-w-0 flex flex-col gap-1.5">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-pink-500/20 text-pink-400 border border-pink-500/30">
            歌手
          </span>
          <span class="text-xs text-[var(--text-muted)] font-mono">ID: {artistData.id}</span>
        </div>
        <h1 class="text-lg sm:text-xl font-bold text-[var(--text-main)] truncate tracking-tight">
          {artistData.name}
        </h1>
        <p class="text-xs text-[var(--text-secondary)] flex items-center gap-3">
          <span>热门曲目: <strong class="text-red-400">{songs.length}</strong> 首</span>
          <span>专辑: <strong class="text-[var(--text-main)]">{artistData.albumSize || 0}</strong></span>
          <span>单曲: <strong class="text-[var(--text-main)]">{artistData.musicSize || 0}</strong></span>
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
            <span>播放全部</span>
          </button>
          <button
            type="button"
            data-testid="btn-artist-fork"
            class="btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
            disabled={forking}
            onclick={handleForkToPlaylist}
            title="将这 50 首曲目一键收藏到你的网易云歌单中"
          >
            <span>{forking ? '⏳' : '⭐'}</span>
            <span>{forking ? '收藏中...' : '收藏为歌单'}</span>
          </button>
          <button
            type="button"
            class="btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
            disabled={cachingBatch}
            onclick={handleBatchCache}
            title="离线缓存全部 50 首至浏览器"
          >
            <span>{cachingBatch ? '⏳' : '⚡'}</span>
            <span>{cachingBatch ? '缓存中...' : '离线缓存'}</span>
          </button>
          <button
            type="button"
            class="btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
            onclick={handleBatchDownload}
            title="全部下载到服务器电脑磁盘"
          >
            <span>🖥️</span>
            <span>全部下载</span>
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
              <th class="py-3 px-3 font-semibold">标题</th>
              <th class="py-3 px-3 font-semibold w-36 lg:w-44">歌手</th>
              <th class="py-3 px-3 font-semibold w-36 lg:w-44 hidden md:table-cell">专辑</th>
              <th class="py-3 pr-4 text-right font-semibold w-48">快捷操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--border-subtle)]">
            {#each songs as s, idx (s.id)}
              {@const artistName = formatArtist(s.artist || s.ar || s.artists || artistData.name || '')}
              {@const status = getTrackSourceStatus(s.id, s.isLocal, curTrack)}
              {@const isPlayingThis = !!(curTrack && (String(curTrack.id) === String(s.id) || (curTrack.name && curTrack.name === s.name)))}
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
                  {artistName || '群星'}
                </td>

                <!-- 专辑 -->
                <td class="py-2.5 px-3 text-[var(--text-muted)] truncate w-36 lg:w-44 hidden md:table-cell">
                  {#if (s.al?.id || s.album?.id) && onAlbum}
                    <button
                      type="button"
                      class="text-left bg-transparent border-none p-0 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer truncate max-w-[140px]"
                      onclick={() => onAlbum(String(s.al?.id || s.album?.id))}
                    >
                      {s.al?.name || s.album?.name || s.album || '单曲'}
                    </button>
                  {:else}
                    <span class="truncate block max-w-[140px]">{s.al?.name || s.album?.name || s.album || '单曲'}</span>
                  {/if}
                </td>

                <!-- 操作按钮组 -->
                <td class="py-2.5 pr-4 text-right w-48">
                  <div class="inline-flex items-center gap-1.5 justify-end">
                    <!-- 播放 -->
                    <SlotBtn
                      onclick={() => onPlayQueue && onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: s.picUrl || s.al?.picUrl || artistData?.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                      title={isPlayingThis && playing ? '暂停当前播放' : '立即试听播放'}
                    >
                      {isPlayingThis && playing ? '⏸' : '▶'}
                    </SlotBtn>

                    <!-- 下载到电脑 -->
                    <SlotBtn
                      onclick={() => handleDownloadSingle(String(s.id), s.name)}
                      title="下载到电脑服务器"
                    >
                      📥
                    </SlotBtn>

                    <!-- 加入歌单 -->
                    <SlotBtn
                      onclick={() => addToPlaylistSong = { id: Number(s.id), name: s.name, artist: artistName }}
                      title="添加到我的歌单"
                    >
                      ➕
                    </SlotBtn>

                    <!-- 离线缓存 -->
                    <SlotBtn
                      onclick={() => handleCacheTrack(s)}
                      title="离线缓存到浏览器"
                    >
                      {cachingTrackId === s.id ? '⏳' : '⚡'}
                    </SlotBtn>

                    <!-- 定位 -->
                    {#if status.isServer && onReveal}
                      <SlotBtn
                        onclick={() => onReveal({ id: s.id, name: s.name, artist: artistName })}
                        title="在电脑文件管理器中定位"
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
