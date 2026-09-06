<script lang="ts">
  import { onMount } from 'svelte';
  import {
    allTracks,
    pageSize,
    getPaged,
    getTotalPages,
    getPlaylist,
    getCurPage,
    loadPlaylistDetail,
    incPage,
    recordPlaylistPlay
  } from '../../lib/playlist.svelte';
  import { api } from '../../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER } from '../../lib/utils';
  import SlotBtn from '../SlotBtn.svelte';
  import TrackLikeBtn from '../TrackLikeBtn.svelte';
  import TrackSourceBadge from '../TrackSourceBadge.svelte';
  import AddToPlaylistModal from '../AddToPlaylistModal.svelte';
  import { cacheTrackToBrowser } from '../../lib/pwaCache.svelte';
  import { getTrackSourceStatus } from '../../lib/trackStatus.svelte';

  let {
    playlistId,
    curTrack = null,
    playing = false,
    likedSet,
    downloadedSet = new Set<number>(),
    onBackToGallery,
    onToggleLike,
    onPlayQueue,
    onAlbum,
    onReveal,
    showToast
  } = $props<{
    playlistId: string;
    curTrack?: any;
    playing?: boolean;
    likedSet: Set<number>;
    downloadedSet?: Set<number>;
    onBackToGallery: () => void;
    onToggleLike: (id: number, name: string) => void;
    onPlayQueue: (tracks: any[], idx?: number) => void;
    onAlbum?: (albumId: string) => void;
    onReveal?: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let paged = $derived(getPaged());
  let totalPages = $derived(getTotalPages());
  let playlist = $derived(getPlaylist());
  let curPage = $derived(getCurPage());

  let loading = $state(false);
  let cachingTrackId = $state<number | null>(null);
  let addToPlaylistSong = $state<{ id: number; name: string; artist: string } | null>(null);

  onMount(() => {
    if (playlistId) {
      loadData(playlistId);
    }
  });

  $effect(() => {
    if (playlistId && String(playlist?.id) !== String(playlistId)) {
      loadData(playlistId);
    }
  });

  async function loadData(id: string) {
    loading = true;
    try {
      await loadPlaylistDetail(id);
    } catch (e: any) {
      showToast(e?.message || '获取歌单详情失败', 'error');
    } finally {
      loading = false;
    }
  }

  async function handlePlayAll() {
    if (!allTracks.length) return;
    if (playlist?.id) recordPlaylistPlay(playlist.id);
    const queue = allTracks.map((t: any) => {
      const status = getTrackSourceStatus(t.id, t.isLocal, curTrack);
      return {
        id: t.id,
        name: t.name,
        artist: formatArtist(t),
        cover: t.al?.picUrl || DEFAULT_VINYL_COVER,
        isLocal: status.isLocal
      };
    });
    onPlayQueue(queue, 0);
    showToast(`已开始播放《${playlist?.name || '歌单'}》(${queue.length} 首)`, 'success', 2000);
  }

  async function handleDownloadAll() {
    if (!playlistId) return;
    try {
      await api.downloadPlaylist(playlistId);
      showToast('已提交批量下载任务', 'success', 2000);
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast('下载请求失败: ' + (e?.message || e), 'error');
    }
  }

  async function handleDownloadSingle(id: string, name?: string) {
    try {
      const res = await api.downloadSingle(id);
      const task = res?.data;
      if (task?.status === 'SKIP') {
        showToast(`已跳过《${task.name || name || '歌曲'}》: ${task.errorMsg || '试听片段或已存在'}`, 'warning', 4000);
      } else if (task?.status === 'FAILED') {
        showToast(`下载失败《${task.name || name || '歌曲'}》: ${task.errorMsg || '下载失败'}`, 'error', 4000);
      } else {
        showToast(`已提交下载: 《${task?.name || name || '歌曲'}》`, 'info', 2000);
      }
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast('下载异常: ' + (e?.message || e), 'error');
    }
  }

  async function handleCache(t: any) {
    cachingTrackId = t.id;
    try {
      const res = await cacheTrackToBrowser({
        id: t.id,
        name: t.name,
        artist: formatArtist(t),
        cover: t.al?.picUrl || DEFAULT_VINYL_COVER,
        album: t.al?.name || t.album
      });
      showToast(res.msg || (res.success ? '已缓存到浏览器' : '缓存失败'), res.success ? 'success' : 'error');
    } catch (e: any) {
      showToast('缓存失败: ' + (e?.message || e), 'error');
    } finally {
      cachingTrackId = null;
    }
  }
</script>

<!-- 🖥️ PC 桌面端：歌单详情宽屏大表 (Detail View) -->
<div class="flex flex-col gap-4 select-none animate-fade-in" data-testid="desktop-playlist-detail">
  <!-- 1. 顶部面包屑导航 -->
  <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
    <button
      type="button"
      data-testid="btn-back-gallery"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-main)] border border-[var(--btn-secondary-border)] cursor-pointer transition-colors font-medium"
      onclick={onBackToGallery}
    >
      <span>←</span>
      <span>返回歌单画廊</span>
    </button>
    <span class="opacity-40">/</span>
    <span class="truncate font-semibold text-[var(--text-main)]">{playlist?.name || '歌单详情'}</span>
  </div>

  {#if loading && !playlist}
    <div class="py-20 text-center flex flex-col items-center gap-3 text-xs text-[var(--text-muted)]">
      <span class="text-3xl animate-spin">⏳</span>
      <span>正在加载歌单内容...</span>
    </div>
  {:else if playlist}
    <!-- 2. Hero 横幅区 -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-5 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] shadow-sm">
      <img
        src={playlist.coverImgUrl || DEFAULT_VINYL_COVER}
        alt={playlist.name}
        class="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover shadow-lg shrink-0 border border-[var(--border-subtle)]"
      />
      <div class="flex-1 min-w-0 flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
            歌单
          </span>
          <span class="text-xs text-[var(--text-muted)]">ID: {playlist.id}</span>
        </div>
        <h1 class="text-xl sm:text-2xl font-bold text-[var(--text-main)] truncate tracking-tight">
          {playlist.name}
        </h1>
        <p class="text-xs text-[var(--text-secondary)] flex items-center gap-3">
          <span>创建者: <strong class="text-[var(--text-main)]">{playlist.creator || '网易云音乐'}</strong></span>
          <span>共 <strong class="text-red-400">{allTracks.length}</strong> 首歌曲</span>
        </p>

        <!-- 快捷操作按钮组 -->
        <div class="flex items-center gap-2.5 pt-1 flex-wrap">
          <button
            type="button"
            data-testid="btn-detail-play-all"
            class="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-md"
            onclick={handlePlayAll}
          >
            <span>▶️</span>
            <span>播放全部</span>
          </button>
          <button
            type="button"
            data-testid="btn-detail-download-all"
            class="btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            onclick={handleDownloadAll}
          >
            <span>🖥️</span>
            <span>全部下载到电脑</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 3. 宽屏歌曲大表格 (表头 Sticky 吸顶) -->
    <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] overflow-hidden shadow-sm">
      <div class="overflow-x-auto max-h-[600px] overflow-y-auto custom-table-scroll">
        <table class="w-full text-left border-collapse text-xs">
          <!-- 吸顶表头 -->
          <thead class="sticky top-0 z-10 bg-[var(--card-header-bg)] backdrop-blur-xl border-b border-[var(--border-color)] text-[var(--text-muted)]">
            <tr>
              <th class="w-12 py-3 pl-4 font-semibold">#</th>
              <th class="py-3 px-3 font-semibold">标题</th>
              <th class="py-3 px-3 font-semibold w-40">歌手</th>
              <th class="py-3 px-3 font-semibold w-44 hidden md:table-cell">专辑</th>
              <th class="py-3 pr-4 text-right font-semibold w-56">快捷操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--border-subtle)]">
            {#each paged as t, i (t.id)}
              {@const idx = (curPage - 1) * pageSize + i + 1}
              {@const status = getTrackSourceStatus(t.id, t.isLocal, curTrack)}
              {@const artist = formatArtist(t)}
              {@const isPlayingThis = !!(curTrack && (String(curTrack.id) === String(t.id) || (curTrack.name && curTrack.name === t.name)))}
              <tr class="hover:bg-[var(--card-header-hover)] transition-colors group {isPlayingThis ? 'bg-red-500/10' : ''}">
                <!-- 序号 -->
                <td class="py-2.5 pl-4 text-[var(--text-muted)] font-mono text-[11px]">
                  {#if isPlayingThis && playing}
                    <span class="text-red-500 animate-pulse">▶</span>
                  {:else}
                    {idx}
                  {/if}
                </td>

                <!-- 标题 + Badge + Like -->
                <td class="py-2.5 px-3 min-w-0">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="font-semibold text-[var(--text-main)] truncate max-w-xs xl:max-w-md group-hover:text-red-400 transition-colors">
                      {t.name}
                    </span>
                    <TrackSourceBadge id={t.id} isLocal={t.isLocal} {curTrack} class="shrink-0" />
                    <TrackLikeBtn liked={likedSet.has(Number(t.id))} onclick={() => onToggleLike(Number(t.id), t.name)} />
                  </div>
                </td>

                <!-- 歌手 -->
                <td class="py-2.5 px-3 text-[var(--text-secondary)] truncate">
                  {artist || '群星'}
                </td>

                <!-- 专辑 -->
                <td class="py-2.5 px-3 text-[var(--text-muted)] truncate hidden md:table-cell">
                  {#if t.al?.id && onAlbum}
                    <button
                      type="button"
                      class="text-left bg-transparent border-none p-0 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer truncate max-w-[160px]"
                      onclick={() => onAlbum?.(String(t.al.id))}
                    >
                      {t.al.name || '单曲'}
                    </button>
                  {:else}
                    <span>{t.al?.name || '单曲'}</span>
                  {/if}
                </td>

                <!-- 操作栏 -->
                <td class="py-2.5 pr-4 text-right whitespace-nowrap">
                  <div class="inline-flex items-center justify-end gap-1.5">
                    <SlotBtn
                      playing={isPlayingThis && playing}
                      onclick={() => onPlayQueue([{ id: t.id, name: t.name, artist, cover: t.al?.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                    >
                      {isPlayingThis && playing ? '⏸ 暂停' : (status.isLocal ? '▶ 本地' : '▶ 试听')}
                    </SlotBtn>

                    {#if status.isServer}
                      <SlotBtn onclick={() => onReveal && onReveal({ id: t.id, name: t.name, artist })}>
                        📂 定位
                      </SlotBtn>
                    {:else}
                      <SlotBtn onclick={() => handleDownloadSingle(String(t.id), t.name)}>
                        📥 下载
                      </SlotBtn>
                    {/if}

                    <SlotBtn onclick={() => handleCache(t)}>
                      {status.isPhone ? '✅ 缓存' : cachingTrackId === t.id ? '⏳' : '📲 缓存'}
                    </SlotBtn>

                    <SlotBtn onclick={() => addToPlaylistSong = { id: t.id, name: t.name, artist }}>
                      ➕
                    </SlotBtn>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- 分页控制 -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)] bg-[var(--card-bg)]">
        <button
          type="button"
          class="btn-secondary px-3 py-1 text-xs rounded-lg cursor-pointer"
          disabled={curPage <= 1}
          onclick={() => incPage(-1)}
        >
          上一页
        </button>
        <span class="text-xs text-[var(--text-secondary)]">
          第 <strong class="text-[var(--text-main)]">{curPage}</strong> / {totalPages} 页 (共 {allTracks.length} 首)
        </span>
        <button
          type="button"
          class="btn-secondary px-3 py-1 text-xs rounded-lg cursor-pointer"
          disabled={curPage >= totalPages}
          onclick={() => incPage(1)}
        >
          下一页
        </button>
      </div>
    </div>
  {:else}
    <div class="py-16 text-center text-xs text-[var(--text-muted)]">
      未找到歌单信息
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
