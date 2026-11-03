<script lang="ts">
  import { DEFAULT_VINYL_COVER } from '../../lib/utils';
  import { getTrackSourceStatus, isSameTrack } from '../../lib/player/trackStatus.svelte';
  import { musicFreeStore } from '../../lib/musicfree/musicFreeStore.svelte';
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

  function handlePlay(item: any) {
    if (!onPlayQueue) return;
    const pluginId = item._pluginId || item.pluginHash;
    const track = {
      id: item.id || `mf_${pluginId}_${item.rawId || item.title || Math.random()}`,
      name: item.title || item.name,
      artist: item.artist || '未知歌手',
      album: item.album || '',
      cover: item.artwork || item.picUrl || DEFAULT_VINYL_COVER,
      raw: item.raw || item,
      _isMusicFree: true,
      _pluginHash: pluginId
    };
    onPlayQueue([track], { startIndex: 0, isExplicitTrack: true });
  }

  async function handleDownload(item: any) {
    const pluginId = item._pluginId || item.pluginHash;
    actionLoadingId = item.id;
    const songName = item.title || item.name || '未知歌曲';
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
        artist: item.artist,
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
    const pluginId = item._pluginId || item.pluginHash;
    actionLoadingId = item.id;
    try {
      const track = {
        id: item.id || `mf_${pluginId}_${item.rawId || item.title || Math.random()}`,
        name: item.title || item.name,
        artist: item.artist || '未知歌手',
        album: item.album || '',
        cover: item.artwork || item.picUrl || DEFAULT_VINYL_COVER,
        raw: item.raw || item,
        _isMusicFree: true,
        _pluginHash: pluginId
      };
      const res = await cacheTrackToBrowser(track);
      showToast(res.msg, res.success ? 'success' : 'error');
    } catch (e: any) {
      showToast('离线缓存失败: ' + (e.message || e), 'error');
    } finally {
      actionLoadingId = null;
    }
  }

  function handleAdd(item: any) {
    if (!onOpenAddToPlaylist) return;
    const pluginId = item._pluginId || item.pluginHash;
    onOpenAddToPlaylist({
      id: item.id || `mf_${pluginId}_${item.rawId || item.title}`,
      name: item.title || item.name,
      artist: item.artist || '未知歌手',
      album: item.album || '',
      cover: item.artwork || item.picUrl || DEFAULT_VINYL_COVER,
      raw: item.raw || item,
      _isMusicFree: true,
      _pluginHash: pluginId
    });
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
    <div class="text-xs text-[var(--text-muted)] px-1 mb-1 flex items-center justify-between">
      <span>跨平台插件音源检索共找到 {results.length} 首歌曲</span>
      <span class="text-[11px] opacity-70">提示：需先下载/缓存后方可加入本地歌单</span>
    </div>

    <div class="flex flex-col gap-1.5">
      {#each results as item, idx (item.id || item.rawId || idx)}
        {@const title = item.title || item.name || '未知歌曲'}
        {@const artist = item.artist || '未知歌手'}
        {@const cover = item.artwork || item.picUrl || DEFAULT_VINYL_COVER}
        {@const pName = item._pluginPlatform || item.pluginName || '外部音源'}
        {@const trackId = item.id || `mf_${item._pluginId || item.pluginHash}_${item.rawId || title}`}
        {@const isCur = isSameTrack(curTrack, trackId)}
        {@const status = getTrackSourceStatus(trackId, false, curTrack)}
        <div
          class="flex items-center gap-3 p-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-subtle)] hover:border-purple-500/40 hover:bg-purple-500/[0.03] transition-all group select-none {isCur ? 'border-purple-500/50 bg-purple-500/[0.05]' : ''}"
        >
          <!-- 封面 & 播放按钮 -->
          <div class="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/10">
            <img
              src={cover}
              alt={title}
              class="w-full h-full object-cover"
              loading="lazy"
            />
            <button
              type="button"
              class="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none {isCur && playing ? '!opacity-100' : ''}"
              onclick={() => handlePlay(item)}
            >
              {#if isCur && playing}
                <span class="text-sm">⏸</span>
              {:else}
                <span class="text-sm ml-0.5">▶</span>
              {/if}
            </button>
          </div>

          <!-- 歌曲信息 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-semibold text-[var(--text-main)] truncate {isCur ? 'text-purple-400 font-bold' : ''}">
                {title}
              </span>
              <!-- 音源归属标签 -->
              <span class="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-500/15 text-purple-400 font-medium shrink-0">
                {pName}
              </span>
              <!-- 存储状态徽标 -->
              {#if status.isServer}
                <span class="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-400 font-medium shrink-0" title="已下载到电脑磁盘">
                  🖥️ 本地已存
                </span>
              {:else if status.isPhone}
                <span class="text-[10px] px-1.5 py-0.2 rounded-md bg-blue-500/15 text-blue-400 font-medium shrink-0" title="已离线缓存至浏览器">
                  📱 浏览器缓存
                </span>
              {/if}
            </div>
            <div class="text-xs text-[var(--text-secondary)] truncate flex items-center gap-2">
              <span>{item.artist || '未知歌手'}</span>
              {#if item.album}
                <span class="opacity-40">•</span>
                <span class="truncate opacity-80">{item.album}</span>
              {/if}
            </div>
          </div>

          <!-- 操作按钮栏 -->
          <div class="flex items-center gap-2 shrink-0">
            <!-- 试听 / 播放 -->
            <button
              type="button"
              class="px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer border-none transition-all flex items-center gap-1 {isCur && playing ? 'bg-purple-600 text-white' : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'}"
              onclick={() => handlePlay(item)}
            >
              <span>{isCur && playing ? '播放中' : '试听'}</span>
            </button>

            <!-- 下载到电脑 -->
            <button
              type="button"
              disabled={actionLoadingId === item.id || status.isServer}
              class="px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer border-none transition-all bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] disabled:opacity-50"
              title={status.isServer ? '已存在于电脑磁盘中' : '下载完整音频与歌词到电脑磁盘'}
              onclick={() => handleDownload(item)}
            >
              {status.isServer ? '🖥️ 已存' : '⬇️ 下载'}
            </button>

            <!-- 离线缓存到浏览器 -->
            <button
              type="button"
              disabled={actionLoadingId === item.id || status.isPhone}
              class="px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer border-none transition-all bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] disabled:opacity-50"
              title={status.isPhone ? '已离线缓存到浏览器' : '将音频缓存到浏览器 Cache'}
              onclick={() => handleCache(item)}
            >
              {status.isPhone ? '📱 已存' : '📱 缓存'}
            </button>

            <!-- 添加到歌单 -->
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer border-none transition-all bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]"
              title="添加到歌单 (仅限已下载/已缓存歌曲存入本地歌单)"
              onclick={() => handleAdd(item)}
            >
              ➕ 歌单
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
