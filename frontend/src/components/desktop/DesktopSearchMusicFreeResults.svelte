<script lang="ts">
  import { DEFAULT_VINYL_COVER } from '../../lib/utils';
  import { getTrackSourceStatus, isSameTrack, getTrackPlayActionLabel, isVipOrPaidTrack } from '../../lib/player/trackStatus.svelte';
  import { musicFreeStore } from '../../lib/musicfree/musicFreeStore.svelte';
  import { musicFreeAdapter } from '../../lib/adapters/musicFreeAdapter';
  import { api } from '../../lib/api';
  import { startTaskPolling } from '../../lib/taskStore.svelte';
  import { cacheTrackToBrowser } from '../../lib/pwaCache.svelte';
  import SlotBtn from '../SlotBtn.svelte';
  import TrackSourceBadge from '../TrackSourceBadge.svelte';
  import TrackLikeBtn from '../TrackLikeBtn.svelte';
  import { isTrackLiked, toggleLike } from '../../lib/likeStore.svelte';
  import { openSheet } from '../../lib/ui.svelte';
  import { t } from '../../lib/i18n';

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
        window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
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
    <div class="text-xs text-[var(--text-muted)] px-1 mb-1.5 flex items-center justify-between gap-1">
      <span class="truncate">找到 {results.length} 首歌曲</span>
      <span class="text-[11px] opacity-70 hidden sm:inline shrink-0">提示：需先下载/缓存后方可加入本地歌单</span>
    </div>

    <div class="flex flex-col gap-1.5">
      {#each results as item, idx (item.id || item.rawId || idx)}
        {@const title = getSafeTitle(item)}
        {@const artist = getSafeArtist(item)}
        {@const cover = item.artwork || item.picUrl || DEFAULT_VINYL_COVER}
        {@const pName = item._pluginPlatform || item.pluginName || '外部音源'}
        {@const trackId = item.id || `mf_${item._pluginId || item.pluginHash}_${item.rawId || title}`}
        {@const isCur = isSameTrack(curTrack, trackId)}
        {@const isVip = isVipOrPaidTrack(item)}
        {@const status = getTrackSourceStatus(trackId, false, curTrack, true, title, artist)}
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
            <div class="text-xs sm:text-sm font-semibold truncate min-w-0 mb-1 flex items-center gap-1.5 {isCur ? 'text-purple-400 font-bold' : isVip ? 'text-[var(--text-secondary)] opacity-80' : 'text-[var(--text-main)]'}" title={title}>
              <span class="truncate">{title}</span>
              {#if isVip}
                <span class="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase shrink-0 shadow-2xs select-none" title="版权付费歌曲">
                  VIP
                </span>
              {/if}
            </div>
            <!-- 音源平台标签 + 歌手 + 专辑 -->
            <div class="text-[11px] sm:text-xs text-[var(--text-secondary)] truncate flex items-center gap-1.5 min-w-0">
              <span class="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-md bg-purple-500/15 text-purple-400 font-medium shrink-0">
                {pName}
              </span>
              <TrackSourceBadge
                id={trackId}
                name={title}
                {artist}
                item={item}
                isServer={status.isServer}
                isPhone={status.isPhone}
                {curTrack}
                class="shrink-0"
              />
              <TrackLikeBtn liked={isTrackLiked(trackId, item.title, artist)} onclick={() => toggleLike(trackId, item.title, artist, item)} />
              <span class="truncate">{artist}</span>
              {#if item.album}
                <span class="opacity-40 shrink-0">•</span>
                <span class="truncate opacity-80">{item.album}</span>
              {/if}
            </div>
          </div>

          <!-- 💻 桌面端快捷操作 (>= sm，平排按钮) -->
          <div class="hidden sm:inline-flex items-center justify-end gap-1.5 shrink-0">
            <SlotBtn
              playing={isCur && playing}
              onclick={() => handlePlay(item)}
            >
              {getTrackPlayActionLabel({ isPlaying: isCur && playing, isLocal: status.isLocal, variant: 'desktop' })}
            </SlotBtn>

            {#if status.isServer}
              <SlotBtn onclick={() => window.dispatchEvent(new CustomEvent('wyy:reveal', { detail: { id: trackId, name: title, artist } }))}>
                {t('common.reveal')}
              </SlotBtn>
            {:else}
              <SlotBtn onclick={() => handleDownload(item)}>
                {actionLoadingId === item.id ? '⏳' : t('download.downloadSingle')}
              </SlotBtn>
            {/if}

            <SlotBtn onclick={() => handleCache(item)}>
              {status.isPhone ? t('search.cachedShort') : actionLoadingId === item.id ? '⏳' : t('search.cacheShort')}
            </SlotBtn>

            <SlotBtn onclick={() => handleAdd(item)}>
              ➕
            </SlotBtn>
          </div>

          <!-- 📱 移动端 SP 精简操作 (只留 试听 + ··· 抽屉，绝不挤压歌名与歌手) -->
          <div class="inline-flex sm:hidden items-center justify-end gap-1.5 shrink-0">
            <SlotBtn
              playing={isCur && playing}
              onclick={() => handlePlay(item)}
            >
              {isCur && playing ? '⏸' : '▶ 试听'}
            </SlotBtn>
            <button
              type="button"
              class="w-7 h-7 rounded-lg flex items-center justify-center bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs cursor-pointer active:scale-95"
              onclick={() => openSheet({
                title: title,
                subtitle: `${artist} · ${pName}`,
                actions: [
                  {
                    label: isCur && playing ? '⏸ 暂停试听' : '▶️ 试听歌曲',
                    style: 'primary',
                    onclick: () => handlePlay(item)
                  },
                  ...(status.isServer ? [{
                    label: '🔍 ' + t('common.reveal'),
                    style: 'default' as const,
                    onclick: () => window.dispatchEvent(new CustomEvent('wyy:reveal', { detail: { id: trackId, name: title, artist } }))
                  }] : [{
                    label: '📥 ' + t('download.downloadSingle'),
                    style: 'default' as const,
                    onclick: () => handleDownload(item)
                  }]),
                  {
                    label: status.isPhone ? '📱 ' + t('search.cachedShort') : '📱 ' + t('search.cacheShort'),
                    style: 'default',
                    onclick: () => handleCache(item)
                  },
                  {
                    label: '➕ ' + t('playlist.addTo'),
                    style: 'default',
                    onclick: () => handleAdd(item)
                  }
                ]
              })}
              title={t('common.moreActions')}
              aria-label={t('common.moreActions')}
            >
              ···
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
