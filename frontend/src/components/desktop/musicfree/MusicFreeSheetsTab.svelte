<script lang="ts">
  import { onMount } from 'svelte';
  import { musicFreeStore } from '../../../lib/musicfree/musicFreeStore.svelte';
  import { musicFreeAdapter } from '../../../lib/adapters/musicFreeAdapter';
  import { DEFAULT_VINYL_COVER, getApiCache, setApiCache } from '../../../lib/utils';
  import { getTrackSourceStatus, getTrackPlayActionLabel, isSameTrack, isVipOrPaidTrack } from '../../../lib/player/trackStatus.svelte';
  import { jumpToMusicFreeSearch } from '../../../lib/router.svelte';
  import { cacheTrackToBrowser } from '../../../lib/pwaCache.svelte';
  import TrackSourceBadge from '../../TrackSourceBadge.svelte';
  import TrackLikeBtn from '../../TrackLikeBtn.svelte';
  import { isTrackLiked, toggleLike } from '../../../lib/likeStore.svelte';
  import { filterAndSortSheetPlugins, normalizeTags, buildSheetTrack, extractSheets, extractSheetTracks } from '../../../lib/musicfree/sheetHelpers';
  import { downloadExternalTrack } from '../../../lib/musicfree/downloadHelper';
  import SlotBtn from '../../SlotBtn.svelte';
  import { t } from '../../../lib/i18n';
  import AddToPlaylistModal from '../../AddToPlaylistModal.svelte';

  let { curTrack = null, playing = false, onPlayQueue, showToast } = $props<{
    curTrack?: any;
    playing?: boolean;
    onPlayQueue?: (tracks: any[], opts?: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let loading = $state(false);
  let emptyPluginIds = $state<Set<string>>(new Set());
  let sheetPlugins = $derived(filterAndSortSheetPlugins(musicFreeStore.plugins, emptyPluginIds));
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
  let showAllTags = $state(false);
  let displayLimit = $state(100);

  onMount(async () => {
    if (sheetPlugins.length > 0) {
      selectedPluginId = sheetPlugins[0].id;
      await loadTagsAndSheets();
    }
  });

  async function handlePluginChange(newPluginId: string) {
    selectedPluginId = newPluginId;
    selectedSheet = null;
    showAllTags = false;
    await loadTagsAndSheets();
  }

  async function loadTagsAndSheets(force = false) {
    if (!selectedPluginId) return;
    const tagCacheKey = `mf_sheet_tags_${selectedPluginId}`;
    const cachedTags = getApiCache(tagCacheKey);
    let hasTagCache = false;

    if (cachedTags?.data && Array.isArray(cachedTags.data) && cachedTags.data.length > 0) {
      tags = cachedTags.data;
      selectedTag = tags[0];
      hasTagCache = true;
      const tagId = selectedTag?.id ?? 'all';
      const sheetCacheKey = `mf_sheets_${selectedPluginId}_${tagId}`;
      const cachedSheets = getApiCache(sheetCacheKey);
      if (cachedSheets?.data && Array.isArray(cachedSheets.data) && cachedSheets.data.length > 0) {
        sheets = cachedSheets.data;
        loading = false;
        const isStale = !cachedSheets.timestamp || (Date.now() - cachedSheets.timestamp > 3600 * 1000);
        if (!isStale && !force) return;
      }
    }

    if (!hasTagCache) {
      loading = true;
      tags = [];
      selectedTag = null;
      sheets = [];
    }

    try {
      let rawTags: any = null;
      try {
        rawTags = await musicFreeStore.getRecommendSheetTags(selectedPluginId);
      } catch (err: any) {
        console.warn('获取推荐歌单标签异常，使用默认全部标签:', err);
      }
      tags = normalizeTags(rawTags);
      setApiCache(tagCacheKey, tags);
      selectedTag = tags[0];
      await loadSheets(selectedTag, force);
    } catch (e: any) {
      console.warn('获取歌单广场失败:', e);
      if (!sheets.length) markCurrentPluginEmptyAndFallback();
    } finally {
      loading = false;
    }
  }

  async function markCurrentPluginEmptyAndFallback() {
    if (!selectedPluginId) return;
    const currentId = selectedPluginId;
    const fallbackName = currentPluginName;
    const nextEmpty = new Set(emptyPluginIds);
    nextEmpty.add(currentId);
    emptyPluginIds = nextEmpty;
    const remaining = sheetPlugins.filter((p) => p.id !== currentId && !nextEmpty.has(p.id));
    if (remaining.length > 0) {
      showToast(`音源「${fallbackName}」暂无有效歌单，已自动切换`, 'info');
      await handlePluginChange(remaining[0].id);
    } else {
      sheets = [];
    }
  }

  async function loadSheets(tag: any, force = false) {
    if (!selectedPluginId) return;
    selectedTag = tag;
    const tagId = tag?.id ?? 'all';
    const sheetCacheKey = `mf_sheets_${selectedPluginId}_${tagId}`;
    const cachedSheets = getApiCache(sheetCacheKey);

    if (cachedSheets?.data && Array.isArray(cachedSheets.data) && cachedSheets.data.length > 0 && !force) {
      sheets = cachedSheets.data;
      loading = false;
      const isStale = !cachedSheets.timestamp || (Date.now() - cachedSheets.timestamp > 3600 * 1000);
      if (!isStale) return;
    } else {
      loading = true;
    }

    try {
      const res = await musicFreeStore.getRecommendSheetsByTag(selectedPluginId, tag, 1);
      const newSheets = extractSheets(res, selectedPluginId);
      if (newSheets.length > 0) {
        sheets = newSheets;
        setApiCache(sheetCacheKey, newSheets);
      } else if (!sheets.length && (!tag || tag.title === '全部')) {
        markCurrentPluginEmptyAndFallback();
      }
    } catch (e: any) {
      console.warn('加载歌单列表失败:', e);
      if (!sheets.length) {
        sheets = [];
        markCurrentPluginEmptyAndFallback();
      }
    } finally {
      loading = false;
    }
  }

  async function handleSelectSheet(sheet: any, force = false) {
    const pluginId = sheet._pluginId || selectedPluginId;
    const sheetId = sheet.id ?? sheet.sheetId ?? sheet.title;
    selectedSheet = { ...sheet, _pluginId: pluginId };
    displayLimit = 100;

    const detailCacheKey = `mf_sheet_detail_${pluginId}_${sheetId}`;
    const cached = getApiCache(detailCacheKey);

    if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0 && !force) {
      sheetTracks = cached.data;
      sheetDetailLoading = false;
      const isStale = !cached.timestamp || (Date.now() - cached.timestamp > 1800 * 1000);
      if (!isStale) return;
    } else {
      sheetDetailLoading = true;
      sheetTracks = [];
    }

    try {
      const detail = await musicFreeStore.getMusicSheetInfo(pluginId, sheet, 1);
      const newTracks = extractSheetTracks(detail, pluginId, currentPluginName);
      if (newTracks.length > 0) {
        sheetTracks = newTracks;
        setApiCache(detailCacheKey, newTracks);
      }
    } catch (e: any) {
      console.error('[MusicFree] 加载歌单详情失败:', e);
      if (!sheetTracks.length) showToast('获取歌单详情失败: ' + (e?.message || e), 'error');
    } finally {
      sheetDetailLoading = false;
    }
  }

  function buildTrack(t: any) {
    return buildSheetTrack(t, selectedSheet, selectedPluginId, currentPluginName, musicFreeAdapter, DEFAULT_VINYL_COVER);
  }

  function handlePlayAll() {
    if (!sheetTracks.length || !onPlayQueue || !selectedSheet) return;
    onPlayQueue(sheetTracks.map(buildTrack), { startIndex: 0, isExplicitTrack: true });
    showToast(`开始播放「${selectedSheet.title || selectedSheet.name}」`, 'info');
  }

  function handlePlaySingle(t: any) {
    if (!onPlayQueue || !selectedSheet) return;
    onPlayQueue([buildTrack(t)], { startIndex: 0, isExplicitTrack: true });
  }

  async function handleCache(t: any) {
    if (!selectedSheet) return;
    const res = await cacheTrackToBrowser(buildTrack(t));
    showToast(res.msg, res.success ? 'success' : 'error');
  }

  async function handleDownload(t: any) {
    await downloadExternalTrack(buildTrack(t), t, selectedPluginId);
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
      {:else if sheetTracks.length === 0}
        <div class="p-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-color)] rounded-xl">
          歌单曲目为空或解析异常，请尝试更换其他歌单
        </div>
      {:else}
        <div class="flex flex-col gap-1.5">
          {#each sheetTracks.slice(0, displayLimit) as trackItem, idx (trackItem.id || idx)}
            {@const trackObj = buildTrack(trackItem)}
            {@const isCur = isSameTrack(curTrack, trackObj) || isSameTrack(curTrack, trackItem)}
            {@const isVip = isVipOrPaidTrack(trackItem) || isVipOrPaidTrack(trackObj)}
            {@const status = getTrackSourceStatus(trackObj.id, false, curTrack, true, trackItem.title || trackItem.name, trackItem.artist)}
            {@const isLiked = isTrackLiked(trackObj.id, trackItem.title || trackItem.name, trackItem.artist)}
            <div
              class="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-subtle)] hover:border-purple-500/40 transition-all group {isVip ? 'opacity-90' : ''}"
            >
              <span class="w-6 text-center text-xs text-[var(--text-muted)] font-mono">{idx + 1}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold truncate {isCur ? 'text-purple-400' : isVip ? 'text-[var(--text-secondary)] opacity-80' : 'text-[var(--text-main)]'}">
                    {trackItem.title || trackItem.name}
                  </span>
                  {#if isVip}
                    <span class="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase shrink-0 shadow-2xs select-none" title="版权付费歌曲，可点击右侧「聚合搜」跨源播放">
                      VIP
                    </span>
                  {/if}
                  <TrackSourceBadge
                    id={trackObj.id}
                    name={trackItem.title || trackItem.name}
                    artist={trackItem.artist}
                    item={trackObj}
                    isServer={status.isServer}
                    isPhone={status.isPhone}
                    curTrack={curTrack}
                    class="shrink-0"
                  />
                  <TrackLikeBtn
                    liked={isLiked}
                    onclick={() => toggleLike(trackObj.id, trackItem.title || trackItem.name, trackItem.artist, trackObj)}
                  />
                </div>
                <div class="text-[11px] text-[var(--text-secondary)] truncate">
                  {trackItem.artist || '未知歌手'}
                </div>
              </div>

              <div class="inline-flex items-center justify-end gap-1.5 shrink-0">
                <SlotBtn
                  playing={isCur && playing}
                  onclick={() => handlePlaySingle(trackItem)}
                >
                  {getTrackPlayActionLabel({ isPlaying: isCur && playing, isLocal: status.isLocal, variant: 'desktop' })}
                </SlotBtn>
                <SlotBtn
                  onclick={() => jumpToMusicFreeSearch(`${trackItem.title || trackItem.name} ${trackItem.artist || ''}`)}
                  title="跳转至「MusicFree 聚合」跨多音源检索可用版本"
                >
                  🧩 聚合搜
                </SlotBtn>
                {#if status.isServer}
                  <SlotBtn onclick={() => window.dispatchEvent(new CustomEvent('wyy:reveal', { detail: { id: trackObj.id, name: trackItem.title || trackItem.name, artist: trackItem.artist } }))}>
                    {t('common.reveal')}
                  </SlotBtn>
                {:else}
                  <SlotBtn onclick={() => handleDownload(trackItem)}>
                    {t('download.downloadSingle')}
                  </SlotBtn>
                {/if}
                <SlotBtn onclick={() => handleCache(trackItem)}>
                  {status.isPhone ? t('search.cachedShort') : t('search.cacheShort')}
                </SlotBtn>
                <SlotBtn onclick={() => addToPlaylistSong = buildTrack(trackItem)}>
                  ➕
                </SlotBtn>
              </div>
            </div>
          {/each}

          {#if sheetTracks.length > displayLimit}
            <div class="pt-3 pb-2 flex justify-center">
              <button
                type="button"
                class="px-5 py-2 rounded-xl text-xs font-medium bg-[var(--btn-secondary-bg)] hover:bg-purple-600 hover:text-white transition-all cursor-pointer border-none text-[var(--text-secondary)] shadow-xs"
                onclick={() => displayLimit += 100}
              >
                展开更多歌曲 (已展示 {Math.min(displayLimit, sheetTracks.length)} / 共 {sheetTracks.length} 首) ▾
              </button>
            </div>
          {/if}
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
      <div class="space-y-2.5">
        <div class="flex items-center justify-between flex-wrap gap-1">
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-[var(--text-muted)] font-medium">音源选择：</span>
            <span class="text-[11px] text-[var(--text-muted)] opacity-70">
              ({sheetPlugins.length}/{musicFreeStore.plugins.length} 个插件支持歌单广场)
            </span>
          </div>
          {#if musicFreeStore.plugins.length > sheetPlugins.length}
            <span class="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              其余为纯搜歌/歌词/网盘源
            </span>
          {/if}
        </div>

        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {#each sheetPlugins as pl}
            <button
              type="button"
              class="px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all shrink-0 {selectedPluginId === pl.id ? 'bg-purple-600 text-white shadow-sm' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
              onclick={() => handlePluginChange(pl.id)}
            >
              {pl.name}
            </button>
          {/each}
        </div>

        {#if tags.length > 0}
          <div class="space-y-1.5 pt-1 border-t border-[var(--border-subtle)]">
            <!-- 单行横向滚动模式（默认，不霸占屏幕空间） -->
            <div class="flex items-center gap-1.5">
              <div class="flex-1 min-w-0 overflow-x-auto flex items-center gap-1.5 no-scrollbar py-0.5">
                {#each tags as tg}
                  <button
                    type="button"
                    class="px-2.5 py-0.5 rounded-lg text-xs cursor-pointer border-none transition-colors shrink-0 {selectedTag === tg ? 'bg-purple-500/20 text-purple-400 font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
                    onclick={() => loadSheets(tg)}
                  >
                    {tg.title || tg.name || tg}
                  </button>
                {/each}
              </div>

              {#if tags.length > 6}
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-lg text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--btn-secondary-bg)] border-none shrink-0 cursor-pointer"
                  onclick={() => showAllTags = !showAllTags}
                >
                  {showAllTags ? '收起 ▴' : `分类(${tags.length}) ▾`}
                </button>
              {/if}
            </div>

            <!-- 点击展开时展示的分类弹层面板 -->
            {#if showAllTags}
              <div class="flex items-center gap-1.5 flex-wrap p-2.5 rounded-xl bg-black/10 dark:bg-white/5 border border-[var(--border-subtle)] max-h-48 overflow-y-auto">
                {#each tags as tg}
                  <button
                    type="button"
                    class="px-2.5 py-0.5 rounded-lg text-xs cursor-pointer border-none transition-colors {selectedTag === tg ? 'bg-purple-500/20 text-purple-400 font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
                    onclick={() => {
                      loadSheets(tg);
                      showAllTags = false;
                    }}
                  >
                    {tg.title || tg.name || tg}
                  </button>
                {/each}
              </div>
            {/if}
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
