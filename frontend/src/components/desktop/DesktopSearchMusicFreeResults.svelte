<script lang="ts">
  import { DEFAULT_VINYL_COVER } from '../../lib/utils';
  import { getTrackSourceStatus, isSameTrack } from '../../lib/player/trackStatus.svelte';
  import { musicFreeStore } from '../../lib/musicfree/musicFreeStore.svelte';
  import { musicFreeAdapter } from '../../lib/adapters/musicFreeAdapter';
  import { api } from '../../lib/api';
  import { startTaskPolling } from '../../lib/taskStore.svelte';
  import { cacheTrackToBrowser } from '../../lib/pwaCache.svelte';

  let {
    results = [],
    loading = false,
    curTrack = null,
    playing = false,
    onPlayQueue,
    onOpenAddToPlaylist,
    showToast
  } = $props<{
    results: any[];
    loading?: boolean;
    curTrack?: any;
    playing?: boolean;
    onPlayQueue?: (tracks: any[], opts?: any) => void;
    onOpenAddToPlaylist?: (track: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let actionLoadingId = $state<string | null>(null);

  function getSafeTitle(item: any): string {
    return item?.title || item?.name || item?.songName || item?.songname || item?.musicName || '未知歌曲';
  }

  function getSafeArtist(item: any): string {
    return item?.artist || item?.singer || item?.author || '未知歌手';
  }

  function buildSearchTrack(item: any) {
    const pluginId = item._pluginId || item.pluginHash;
    const rawTrack = { ...(item.raw || item), _pluginId: pluginId, _isMusicFree: true };
    return musicFreeAdapter.normalizeTrack(rawTrack, {
      id: item.id || `mf_${pluginId}_${item.rawId || getSafeTitle(item) || Math.random()}`,
      name: getSafeTitle(item),
      artist: getSafeArtist(item),
      al: { name: item.album || '', picUrl: item.artwork || item.picUrl || DEFAULT_VINYL_COVER },
      cover: item.artwork || item.picUrl || DEFAULT_VINYL_COVER,
      raw: rawTrack,
      _isMusicFree: true,
      _pluginHash: pluginId
    } as any);
  }

  function handlePlay(item: any) {
    if (!onPlayQueue) return;
    onPlayQueue([buildSearchTrack(item)], { startIndex: 0, isExplicitTrack: true });
  }

  async function handleDownload(item: any) {
    const pluginId = item._pluginId || item.pluginHash;
    actionLoadingId = item.id;
    const songName = getSafeTitle(item);
    try {
      showToast(`正在解析「${songName}」音源直链...`, 'info');
      const media = await musicFreeStore.resolveMediaSource(pluginId, item.raw || item);
      if (!media || !media.url) {
        showToast('获取音源直链失败，可能该音源不支持直接下载', 'error');
        return;
      }
      const res = await api.downloadCustom({
        id: item.id,
        name: songName,
        artist: getSafeArtist(item),
        album: item.album,
        url: media.url,
        coverUrl: item.artwork || item.picUrl,
        headers: media.headers
      });
      if (res?.code === '000000') {
        showToast(`已提交「${songName}」下载任务到服务器`, 'success');
        startTaskPolling();
        window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
      } else {
        showToast(res?.msg || '提交下载任务失败', 'error');
      }
    } catch (e: any) {
      showToast('下载失败: ' + (e.message || e), 'error');
    } finally {
      actionLoadingId = null;
    }
  }

  async function handleCache(item: any) {
    actionLoadingId = item.id;
    try {
      const res = await cacheTrackToBrowser(buildSearchTrack(item));
      showToast(res.msg, res.success ? 'success' : 'error');
    } catch (e: any) {
      showToast('离线缓存失败: ' + (e.message || e), 'error');
    } finally {
      actionLoadingId = null;
    }
  }

  function handleAdd(item: any) {
    if (!onOpenAddToPlaylist) return;
    onOpenAddToPlaylist(buildSearchTrack(item));
  }
</script>

<div class="flex flex-col gap-2">
  {#if loading}
    <div class="py-20 text-center flex flex-col items-center gap-3 text-xs text-[var(--text-muted)]">
      <div class="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin"></div>
      <span>正在通过 MusicFree 插件跨源并行检索中...</span>
    </div>
  {:else if results.length === 0}
    <div class="py-20 text-center text-xs text-[var(--text-muted)]">
      未检索到插件音源结果，请尝试更换关键词或在「发现中心」检查插件启用状态
    </div>
  {:else}
    <div class="text-xs text-[var(--text-muted)] px-1 mb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
      <span>跨平台插件音源检索共找到 {results.length} 首歌曲</span>
      <span class="text-[11px] opacity-70">提示：需先下载/缓存后方可加入本地歌单</span>
    </div>

    <div class="flex flex-col gap-1.5">
      {#each results as item, idx (item.id || item.rawId || idx)}
        {@const title = getSafeTitle(item)}
        {@const artist = getSafeArtist(item)}
        {@const cover = item.artwork || item.picUrl || DEFAULT_VINYL_COVER}
        {@const pName = item._pluginPlatform || item.pluginName || '外部音源'}
        {@const trackId = item.id || `mf_${item._pluginId || item.pluginHash}_${item.rawId || title}`}
        {@const isCur = isSameTrack(curTrack, trackId)}
        {@const status = getTrackSourceStatus(trackId, false, curTrack)}
        <div
          class="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-subtle)] hover:border-purple-500/40 hover:bg-purple-500/[0.03] transition-all group select-none {isCur ? 'border-purple-500/50 bg-purple-500/[0.05]' : ''}"
        >
          <!-- 封面 & 播放按钮 -->
          <div class="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden shrink-0 bg-black/10">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <img
              src={cover}
              alt={title}
              referrerpolicy="no-referrer"
              class="w-full h-full object-cover cursor-pointer"
              loading="lazy"
              onclick={() => handlePlay(item)}
              onerror={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                if (el.src !== DEFAULT_VINYL_COVER) el.src = DEFAULT_VINYL_COVER;
              }}
            />
            <button
              type="button"
              class="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none {isCur && playing ? '!opacity-100' : ''}"
              onclick={() => handlePlay(item)}
            >
              {#if isCur && playing}
                <span class="text-xs sm:text-sm">⏸</span>
              {:else}
                <span class="text-xs sm:text-sm ml-0.5">▶</span>
              {/if}
            </button>
          </div>

          <!-- 歌曲信息 (点击整块可直接播放试听) -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="flex-1 min-w-0 cursor-pointer overflow-hidden py-0.5"
            onclick={() => handlePlay(item)}
          >
            <!-- 歌名独立一行，确保无论屏幕多小都清晰完整可见 -->
            <div class="text-xs sm:text-sm font-semibold text-[var(--text-main)] truncate min-w-0 mb-1 {isCur ? 'text-purple-400 font-bold' : ''}" title={title}>
              {title}
            </div>
            <!-- 音源平台标签 + 歌手 + 专辑 -->
            <div class="text-[11px] sm:text-xs text-[var(--text-secondary)] truncate flex items-center gap-1.5 min-w-0">
              <span class="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-md bg-purple-500/15 text-purple-400 font-medium shrink-0">
                {pName}
              </span>
              {#if status.isServer}
                <span class="text-[9px] sm:text-[10px] px-1 rounded-md bg-emerald-500/15 text-emerald-400 font-medium shrink-0" title="已下载到电脑磁盘">
                  🖥️
                </span>
              {:else if status.isPhone}
                <span class="text-[9px] sm:text-[10px] px-1 rounded-md bg-blue-500/15 text-blue-400 font-medium shrink-0" title="已离线缓存至浏览器">
                  📱
                </span>
              {/if}
              <span class="truncate">{artist}</span>
              {#if item.album}
                <span class="opacity-40 shrink-0">•</span>
                <span class="truncate opacity-80">{item.album}</span>
              {/if}
            </div>
          </div>

          <!-- 操作按钮栏 (移动端精简图标，桌面端完整文本) -->
          <div class="flex items-center gap-1 sm:gap-2 shrink-0">
            <!-- 试听 / 播放 (移动端点击整行或封面即可播放，桌面端显示独立按钮) -->
            <button
              type="button"
              class="hidden sm:flex px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-medium cursor-pointer border-none transition-all items-center gap-1 {isCur && playing ? 'bg-purple-600 text-white' : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'}"
              onclick={() => handlePlay(item)}
            >
              <span>{isCur && playing ? '播放中' : '试听'}</span>
            </button>

            <!-- 下载到电脑 -->
            <button
              type="button"
              disabled={actionLoadingId === item.id || status.isServer}
              class="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-medium cursor-pointer border-none transition-all bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] disabled:opacity-50 flex items-center gap-1"
              title={status.isServer ? '已存在于电脑磁盘中' : '下载完整音频与歌词到电脑磁盘'}
              onclick={() => handleDownload(item)}
            >
              <span>{status.isServer ? '🖥️' : '⬇️'}</span>
              <span class="hidden sm:inline">{status.isServer ? '已存' : '下载'}</span>
            </button>

            <!-- 离线缓存到浏览器 -->
            <button
              type="button"
              disabled={actionLoadingId === item.id || status.isPhone}
              class="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-medium cursor-pointer border-none transition-all bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] disabled:opacity-50 flex items-center gap-1"
              title={status.isPhone ? '已离线缓存到浏览器' : '将音频缓存到浏览器 Cache'}
              onclick={() => handleCache(item)}
            >
              <span>📱</span>
              <span class="hidden sm:inline">{status.isPhone ? '已存' : '缓存'}</span>
            </button>

            <!-- 添加到歌单 -->
            <button
              type="button"
              class="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-medium cursor-pointer border-none transition-all bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] flex items-center gap-1"
              title="添加到歌单 (仅限已下载/已缓存歌曲存入本地歌单)"
              onclick={() => handleAdd(item)}
            >
              <span>➕</span>
              <span class="hidden sm:inline">歌单</span>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
