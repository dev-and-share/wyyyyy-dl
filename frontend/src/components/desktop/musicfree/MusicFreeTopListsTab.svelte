<script lang="ts">
  import { onMount } from 'svelte';
  import { musicFreeStore } from '../../../lib/musicfree/musicFreeStore.svelte';
  import { DEFAULT_VINYL_COVER } from '../../../lib/utils';
  import { getTrackSourceStatus, isSameTrack } from '../../../lib/player/trackStatus.svelte';
  import { cacheTrackToBrowser } from '../../../lib/pwaCache.svelte';
  import AddToPlaylistModal from '../../AddToPlaylistModal.svelte';

  let {
    curTrack = null,
    playing = false,
    onPlayQueue,
    showToast
  } = $props<{
    curTrack?: any;
    playing?: boolean;
    onPlayQueue?: (tracks: any[], opts?: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let loading = $state(false);
  let topListGroups = $state<Array<{
    pluginId: string;
    pluginName: string;
    subGroups: Array<{
      groupTitle: string;
      charts: any[];
    }>;
  }>>([]);
  let selectedTopList = $state<any>(null);
  let detailLoading = $state(false);
  let chartTracks = $state<any[]>([]);
  let addToPlaylistSong = $state<any>(null);

  onMount(async () => {
    await loadCharts();
  });

  async function loadCharts() {
    loading = true;
    try {
      const groups = await musicFreeStore.getTopLists();
      topListGroups = groups;
    } catch (e: any) {
      showToast('获取排行榜失败: ' + (e?.message || e), 'error');
    } finally {
      loading = false;
    }
  }

  async function handleSelectChart(pluginId: string, chart: any) {
    if (!chart || (chart.id == null && !chart.topId)) {
      showToast('该榜单缺少有效 ID', 'warning');
      return;
    }
    selectedTopList = { ...chart, _pluginId: pluginId };
    detailLoading = true;
    chartTracks = [];
    try {
      const detail = await musicFreeStore.getTopListDetail(pluginId, chart);
      chartTracks = Array.isArray(detail?.musicList) ? detail.musicList : (Array.isArray(detail) ? detail : []);
    } catch (e: any) {
      showToast('获取榜单曲目失败: ' + (e?.message || e), 'error');
    } finally {
      detailLoading = false;
    }
  }

  function handlePlayAll() {
    if (!chartTracks.length || !onPlayQueue || !selectedTopList) return;
    const queue = chartTracks.map((t) => ({
      id: t.id || `mf_${selectedTopList._pluginId}_${t.rawId || Math.random()}`,
      name: t.title || t.name,
      artist: t.artist,
      album: t.album,
      cover: t.artwork || t.cover || DEFAULT_VINYL_COVER,
      raw: t,
      _isMusicFree: true,
      _pluginHash: selectedTopList._pluginId
    }));
    onPlayQueue(queue, { startIndex: 0, isExplicitTrack: true });
    showToast(`开始播放排行榜「${selectedTopList.title || selectedTopList.name}」`, 'info');
  }

  function handlePlaySingle(t: any) {
    if (!onPlayQueue || !selectedTopList) return;
    const track = {
      id: t.id || `mf_${selectedTopList._pluginId}_${t.rawId || Math.random()}`,
      name: t.title || t.name,
      artist: t.artist,
      album: t.album,
      cover: t.artwork || t.cover || DEFAULT_VINYL_COVER,
      raw: t,
      _isMusicFree: true,
      _pluginHash: selectedTopList._pluginId
    };
    onPlayQueue([track], { startIndex: 0, isExplicitTrack: true });
  }

  async function handleCache(t: any) {
    if (!selectedTopList) return;
    const track = {
      id: t.id || `mf_${selectedTopList._pluginId}_${t.rawId || Math.random()}`,
      name: t.title || t.name,
      artist: t.artist,
      album: t.album,
      cover: t.artwork || t.cover || DEFAULT_VINYL_COVER,
      raw: t,
      _isMusicFree: true,
      _pluginHash: selectedTopList._pluginId
    };
    const res = await cacheTrackToBrowser(track);
    showToast(res.msg, res.success ? 'success' : 'error');
  }
</script>

<div class="space-y-4">
  {#if selectedTopList}
    <!-- 排行榜详情视图 -->
    <div class="space-y-4">
      <button
        type="button"
        class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0"
        onclick={() => selectedTopList = null}
      >
        <span>←</span> <span>返回排行榜列表</span>
      </button>

      <div class="flex items-center gap-4 p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)]">
        <img
          src={selectedTopList.coverImg || selectedTopList.artwork || DEFAULT_VINYL_COVER}
          alt={selectedTopList.title || selectedTopList.name}
          class="w-20 h-20 rounded-xl object-cover shadow-md"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h2 class="text-base font-bold text-[var(--text-main)] truncate">
              {selectedTopList.title || selectedTopList.name}
            </h2>
            <span class="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">
              官方榜单
            </span>
          </div>
          <p class="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">
            {selectedTopList.description || '该榜单由音源插件提供'}
          </p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              disabled={detailLoading || !chartTracks.length}
              class="btn-primary text-xs px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 !bg-purple-600 hover:!bg-purple-500"
              onclick={handlePlayAll}
            >
              <span>▶ 播放全部</span>
            </button>
            <span class="text-xs text-[var(--text-muted)]">共 {chartTracks.length} 首歌曲</span>
          </div>
        </div>
      </div>

      <!-- 曲目列表 -->
      {#if detailLoading}
        <div class="py-16 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2">
          <div class="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <span>正在获取榜单曲目...</span>
        </div>
      {:else}
        <div class="flex flex-col gap-1.5">
          {#each chartTracks as t, idx (t.id || idx)}
            {@const isCur = isSameTrack(curTrack, t.id)}
            {@const status = getTrackSourceStatus(t.id, false, curTrack)}
            <div
              class="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-subtle)] hover:border-purple-500/40 transition-all group"
            >
              <span class="w-6 text-center text-xs text-[var(--text-muted)] font-mono">{idx + 1}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-[var(--text-main)] truncate {isCur ? 'text-purple-400' : ''}">
                    {t.title || t.name}
                  </span>
                  {#if status.isServer}
                    <span class="text-[10px] px-1 rounded bg-emerald-500/15 text-emerald-400">🖥️ 本地</span>
                  {:else if status.isPhone}
                    <span class="text-[10px] px-1 rounded bg-blue-500/15 text-blue-400">📱 离线</span>
                  {/if}
                </div>
                <div class="text-[11px] text-[var(--text-secondary)] truncate">
                  {t.artist || '未知歌手'}
                </div>
              </div>

              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  class="px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer border-none bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                  onclick={() => handlePlaySingle(t)}
                >
                  {isCur && playing ? '播放中' : '播放'}
                </button>
                <button
                  type="button"
                  disabled={status.isPhone}
                  class="px-2 py-1 rounded-lg text-xs font-medium cursor-pointer border-none bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] disabled:opacity-50"
                  onclick={() => handleCache(t)}
                  title="离线缓存"
                >
                  📱
                </button>
                <button
                  type="button"
                  class="px-2 py-1 rounded-lg text-xs font-medium cursor-pointer border-none bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)]"
                  onclick={() => addToPlaylistSong = { ...t, id: t.id || `mf_${selectedTopList._pluginId}_${t.rawId}`, _isMusicFree: true }}
                  title="加入歌单"
                >
                  ➕
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <!-- 排行榜卡片列表 -->
    {#if loading}
      <div class="py-20 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-3">
        <div class="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin"></div>
        <span>正在加载各音源排行榜...</span>
      </div>
    {:else if topListGroups.length === 0}
      <div class="py-20 text-center text-xs text-[var(--text-muted)] p-8 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)]">
        当前已启用的音源插件暂未提供官方排行榜接口。可在「插件管理」中导入包含榜单功能的音源插件。
      </div>
    {:else}
      {#each topListGroups as group (group.pluginId)}
        <div class="space-y-4">
          <div class="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
            <h3 class="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
              <span>🏆</span> <span>{group.pluginName} 官方榜单</span>
            </h3>
            <span class="text-xs text-[var(--text-muted)]">
              {group.subGroups.reduce((acc, sg) => acc + sg.charts.length, 0)} 个排行榜
            </span>
          </div>

          {#each group.subGroups as subGroup}
            <div class="space-y-2">
              <div class="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5 pl-1">
                <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                <span>{subGroup.groupTitle}</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {#each subGroup.charts as chart}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="group p-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-subtle)] hover:border-purple-500/40 hover:-translate-y-1 transition-all cursor-pointer shadow-xs"
                    onclick={() => handleSelectChart(group.pluginId, chart)}
                  >
                    <div class="relative aspect-square rounded-xl overflow-hidden mb-2 bg-black/10">
                      <img
                        src={chart.coverImg || chart.artwork || DEFAULT_VINYL_COVER}
                        alt={chart.title || chart.name}
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    <div class="text-xs font-semibold text-[var(--text-main)] truncate group-hover:text-purple-400">
                      {chart.title || chart.name}
                    </div>
                    {#if chart.description}
                      <div class="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                        {chart.description}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  {/if}

  {#if addToPlaylistSong}
    <AddToPlaylistModal song={addToPlaylistSong} onClose={() => addToPlaylistSong = null} {showToast} />
  {/if}
</div>
