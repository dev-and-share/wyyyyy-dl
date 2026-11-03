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
  let emptyPluginIds = $state<Set<string>>(new Set());

  const INVALID_KEYWORD_BLACKLIST = [
    '歌曲宝', '书音', '6yueting', '好听轻音乐', '爱听', '种子', 'audiomack', '有声', '评书'
  ];

  let sheetPlugins = $derived(
    (() => {
      const seen = new Set<string>();
      const list = musicFreeStore.plugins.filter((p) => {
        if (!p.enabled || !p.instance || typeof p.instance.getRecommendSheetsByTag !== 'function') return false;
        const n = (p.name || '').trim();
        if (!n || seen.has(n) || emptyPluginIds.has(p.id)) return false;
        // 彻底过滤已知无歌单数据的纯搜歌或失效小众源
        const lower = n.toLowerCase();
        if (INVALID_KEYWORD_BLACKLIST.some((kw) => lower.includes(kw.toLowerCase()))) {
          return false;
        }
        seen.add(n);
        return true;
      });
      const priorityWeights: Record<string, number> = {
        '小秋音乐': 100,
        'QQ音乐': 99,
        '小蜗音乐': 95,
        '酷我音乐': 94,
        '小狗音乐': 90,
        '酷狗音乐': 89,
        '网易音乐': 85,
        '小云音乐': 84,
        '猫耳FM': 80,
        '小蜜音乐': 75,
        '咪咕音乐': 74
      };
      return list.sort((a, b) => {
        const weightA = priorityWeights[a.name.trim()] || 0;
        const weightB = priorityWeights[b.name.trim()] || 0;
        return weightB - weightA;
      });
    })()
  );
  let selectedPluginId = $state<string>('');
  const selectedPlugin = $derived(sheetPlugins.find((p) => p.id === selectedPluginId));
  const currentPluginName = $derived(selectedPlugin?.name || '未知音源');
  let tags = $state<any[]>([]);
  let selectedTag = $state<any>(null);
  let sheets = $state<any[]>([]);
  let selectedSheet = $state<any>(null);
  let sheetDetailLoading = $state(false);
  let sheetTracks = $state<any[]>([]);
  let addToPlaylistSong = $state<any>(null);

  onMount(async () => {
    if (sheetPlugins.length > 0) {
      selectedPluginId = sheetPlugins[0].id;
      await loadTagsAndSheets();
    }
  });

  async function handlePluginChange(newPluginId: string) {
    selectedPluginId = newPluginId;
    selectedSheet = null;
    await loadTagsAndSheets();
  }

  function normalizeTags(rawTags: any): any[] {
    if (!rawTags) return [{ id: undefined, title: '全部' }];
    const result: any[] = [];
    if (Array.isArray(rawTags.pinned)) {
      for (const p of rawTags.pinned) {
        if (p && (p.id != null || p.title || p.name)) {
          result.push({ id: p.id, title: p.title || p.name });
        }
      }
    }
    const container = Array.isArray(rawTags) ? rawTags : (Array.isArray(rawTags.data) ? rawTags.data : []);
    for (const item of container) {
      if (item && Array.isArray(item.data)) {
        for (const sub of item.data) {
          if (sub && (sub.id != null || sub.title || sub.name)) {
            result.push({ id: sub.id, title: sub.title || sub.name });
          }
        }
      } else if (item && (item.id != null || item.title || item.name)) {
        result.push({ id: item.id, title: item.title || item.name });
      }
    }
    const seen = new Set<string>();
    const unique = result.filter(tag => {
      const key = `${tag.id}_${tag.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (unique.length === 0 || !unique.some(t => t.title === '全部')) {
      unique.unshift({ id: undefined, title: '全部' });
    }
    return unique;
  }

  async function loadTagsAndSheets() {
    if (!selectedPluginId) return;
    loading = true;
    tags = [];
    selectedTag = null;
    sheets = [];
    try {
      let rawTags: any = null;
      try {
        rawTags = await musicFreeStore.getRecommendSheetTags(selectedPluginId);
      } catch (err: any) {
        console.warn('获取推荐歌单标签异常，使用默认全部标签:', err);
      }
      tags = normalizeTags(rawTags);
      selectedTag = tags[0];
      await loadSheets(selectedTag);
    } catch (e: any) {
      console.warn('获取歌单广场失败:', e);
      markCurrentPluginEmptyAndFallback();
    } finally {
      loading = false;
    }
  }

  async function markCurrentPluginEmptyAndFallback() {
    if (!selectedPluginId) return;
    const currentId = selectedPluginId;
    const nextEmpty = new Set(emptyPluginIds);
    nextEmpty.add(currentId);
    emptyPluginIds = nextEmpty;
    const remaining = sheetPlugins.filter((p) => p.id !== currentId && !nextEmpty.has(p.id));
    if (remaining.length > 0) {
      showToast(`音源「${currentPluginName}」暂无有效歌单，已自动切换`, 'info');
      await handlePluginChange(remaining[0].id);
    } else {
      sheets = [];
    }
  }

  async function loadSheets(tag: any) {
    if (!selectedPluginId) return;
    loading = true;
    selectedTag = tag;
    try {
      const res = await musicFreeStore.getRecommendSheetsByTag(selectedPluginId, tag, 1);
      const rawData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      // 过滤无效条目（必须包含 title 或 name）
      sheets = rawData.filter((item: any) => item && (item.title || item.name));
      // 若该音源在默认/全部标签下均返回空，自动标记为空源并切换到健康源
      if (sheets.length === 0 && (!tag || tag.title === '全部')) {
        markCurrentPluginEmptyAndFallback();
      }
    } catch (e: any) {
      console.warn('加载歌单列表失败:', e);
      sheets = [];
      markCurrentPluginEmptyAndFallback();
    } finally {
      loading = false;
    }
  }

  async function handleSelectSheet(sheet: any) {
    selectedSheet = { ...sheet, _pluginId: selectedPluginId };
    sheetDetailLoading = true;
    sheetTracks = [];
    try {
      const detail = await musicFreeStore.getMusicSheetInfo(selectedPluginId, sheet, 1);
      sheetTracks = Array.isArray(detail?.musicList) ? detail.musicList : (Array.isArray(detail) ? detail : []);
    } catch (e: any) {
      showToast('获取歌单详情失败: ' + (e?.message || e), 'error');
    } finally {
      sheetDetailLoading = false;
    }
  }

  function handlePlayAll() {
    if (!sheetTracks.length || !onPlayQueue || !selectedSheet) return;
    const queue = sheetTracks.map((t) => ({
      id: t.id || `mf_${selectedSheet._pluginId}_${t.rawId || Math.random()}`,
      name: t.title || t.name,
      artist: t.artist,
      album: t.album,
      cover: t.artwork || t.cover || DEFAULT_VINYL_COVER,
      raw: t,
      _isMusicFree: true,
      _pluginHash: selectedSheet._pluginId
    }));
    onPlayQueue(queue, { startIndex: 0, isExplicitTrack: true });
    showToast(`开始播放「${selectedSheet.title || selectedSheet.name}」`, 'info');
  }

  function handlePlaySingle(t: any) {
    if (!onPlayQueue || !selectedSheet) return;
    const track = {
      id: t.id || `mf_${selectedSheet._pluginId}_${t.rawId || Math.random()}`,
      name: t.title || t.name,
      artist: t.artist,
      album: t.album,
      cover: t.artwork || t.cover || DEFAULT_VINYL_COVER,
      raw: t,
      _isMusicFree: true,
      _pluginHash: selectedSheet._pluginId
    };
    onPlayQueue([track], { startIndex: 0, isExplicitTrack: true });
  }

  async function handleCache(t: any) {
    if (!selectedSheet) return;
    const track = {
      id: t.id || `mf_${selectedSheet._pluginId}_${t.rawId || Math.random()}`,
      name: t.title || t.name,
      artist: t.artist,
      album: t.album,
      cover: t.artwork || t.cover || DEFAULT_VINYL_COVER,
      raw: t,
      _isMusicFree: true,
      _pluginHash: selectedSheet._pluginId
    };
    const res = await cacheTrackToBrowser(track);
    showToast(res.msg, res.success ? 'success' : 'error');
  }
</script>

<div class="space-y-4">
  {#if selectedSheet}
    <!-- 歌单详情视图 -->
    <div class="space-y-4">
      <button
        type="button"
        class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0"
        onclick={() => selectedSheet = null}
      >
        <span>←</span> <span>返回歌单广场</span>
      </button>

      <div class="flex items-center gap-4 p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)]">
        <img
          src={selectedSheet.coverImg || selectedSheet.artwork || DEFAULT_VINYL_COVER}
          alt={selectedSheet.title || selectedSheet.name}
          referrerpolicy="no-referrer"
          class="w-20 h-20 rounded-xl object-cover shadow-md"
          onerror={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            if (el.src !== DEFAULT_VINYL_COVER) el.src = DEFAULT_VINYL_COVER;
          }}
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h2 class="text-base font-bold text-[var(--text-main)] truncate">
              {selectedSheet.title || selectedSheet.name}
            </h2>
            <span class="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">
              插件歌单
            </span>
          </div>
          <p class="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">
            {selectedSheet.description || selectedSheet.artist || '来自插件的精选歌单'}
          </p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              disabled={sheetDetailLoading || !sheetTracks.length}
              class="btn-primary text-xs px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 !bg-purple-600 hover:!bg-purple-500"
              onclick={handlePlayAll}
            >
              <span>▶ 播放全部</span>
            </button>
            <span class="text-xs text-[var(--text-muted)]">共 {sheetTracks.length} 首歌曲</span>
          </div>
        </div>
      </div>

      <!-- 歌曲列表 -->
      {#if sheetDetailLoading}
        <div class="py-16 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2">
          <div class="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <span>正在加载歌单曲目...</span>
        </div>
      {:else}
        <div class="flex flex-col gap-1.5">
          {#each sheetTracks as t, idx (t.id || idx)}
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
                  onclick={() => addToPlaylistSong = { ...t, id: t.id || `mf_${selectedSheet._pluginId}_${t.rawId}`, _isMusicFree: true }}
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
    <!-- 歌单广场主视图 -->
    {#if sheetPlugins.length === 0}
      <div class="py-20 text-center text-xs text-[var(--text-muted)] p-8 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)]">
        当前已启用的音源插件暂未提供歌单广场接口。请在「插件管理」中启用具有歌单推荐功能的音源插件。
      </div>
    {:else}
      <!-- 插件来源切换 & 标签栏 -->
      <div class="space-y-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-[var(--text-muted)] font-medium">音源选择：</span>
          {#each sheetPlugins as pl}
            <button
              type="button"
              class="px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all {selectedPluginId === pl.id ? 'bg-purple-600 text-white shadow-sm' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
              onclick={() => handlePluginChange(pl.id)}
            >
              {pl.name}
            </button>
          {/each}
        </div>

        {#if tags.length > 0}
          <div class="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[var(--border-subtle)]">
            {#each tags as tg}
              <button
                type="button"
                class="px-2.5 py-0.5 rounded-lg text-xs cursor-pointer border-none transition-colors {selectedTag === tg ? 'bg-purple-500/20 text-purple-400 font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
                onclick={() => loadSheets(tg)}
              >
                {tg.title || tg.name || tg}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- 歌单网格 -->
      {#if loading}
        <div class="py-20 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-3">
          <div class="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin"></div>
          <span>正在加载歌单广场...</span>
        </div>
      {:else if sheets.length === 0}
        <div class="py-16 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2.5">
          <span class="text-3xl">📻</span>
          <span class="font-semibold text-sm text-[var(--text-secondary)]">当前音源「{currentPluginName}」暂无有效歌单数据</span>
          <span class="text-[11px] opacity-75 max-w-md">
            部分音源仅支持检索或远端接口已失效。推荐点击上方切换至「小秋音乐 (QQ)」、「小蜗音乐 (酷我)」或「小狗音乐 (酷狗)」等主流音源。
          </span>
        </div>
      {:else}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {#each sheets as sheet}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="group p-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-subtle)] hover:border-purple-500/40 hover:-translate-y-1 transition-all cursor-pointer shadow-xs"
              onclick={() => handleSelectSheet(sheet)}
            >
              <div class="relative aspect-square rounded-xl overflow-hidden mb-2 bg-black/10">
                <img
                  src={sheet.coverImg || sheet.artwork || DEFAULT_VINYL_COVER}
                  alt={sheet.title || sheet.name}
                  referrerpolicy="no-referrer"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  onerror={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    if (el.src !== DEFAULT_VINYL_COVER) el.src = DEFAULT_VINYL_COVER;
                  }}
                />
              </div>
              <div class="text-xs font-semibold text-[var(--text-main)] truncate group-hover:text-purple-400">
                {sheet.title || sheet.name}
              </div>
              {#if sheet.artist || sheet.playCount}
                <div class="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                  {sheet.artist || `播放: ${sheet.playCount}`}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}

  {#if addToPlaylistSong}
    <AddToPlaylistModal song={addToPlaylistSong} onClose={() => addToPlaylistSong = null} {showToast} />
  {/if}
</div>
