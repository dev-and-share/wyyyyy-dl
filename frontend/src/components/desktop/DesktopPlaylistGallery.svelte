<script lang="ts">
  import { onMount } from 'svelte';
  import {
    myPlaylists,
    loadMyPlaylists,
    isFavoritePlaylist,
    sortPlaylistsByPlayCount,
    getPlaylistPlayCount
  } from '../../lib/playlist.svelte';
  import { DEFAULT_VINYL_COVER } from '../../lib/utils';

  let {
    onSelectPlaylist,
    onPlayPlaylist,
    showToast
  } = $props<{
    onSelectPlaylist: (id: string) => void;
    onPlayPlaylist?: (id: string, name: string) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let filter = $state<'all' | 'created' | 'subscribed'>('all');
  let searchKeyword = $state('');
  let parseInput = $state('');
  let loading = $state(false);

  onMount(() => {
    if (myPlaylists.length === 0) {
      handleRefresh();
    }
  });

  async function handleRefresh() {
    loading = true;
    try {
      await loadMyPlaylists();
      showToast('歌单库已同步', 'success', 1500);
    } catch (e: any) {
      showToast('加载歌单失败: ' + (e?.message || e), 'error');
    } finally {
      loading = false;
    }
  }

  function handleParseSubmit() {
    const raw = parseInput.trim();
    if (!raw) {
      showToast('请输入歌单 ID 或链接', 'warning');
      return;
    }
    const match = raw.match(/id=([0-9]+)/) || raw.match(/^([0-9]+)$/);
    if (match?.[1]) {
      onSelectPlaylist(match[1]);
    } else {
      showToast('未能识别有效歌单 ID，请检查输入', 'warning');
    }
  }

  const filteredPlaylists = $derived(() => {
    let list = myPlaylists;
    if (filter === 'created') list = list.filter(p => !p.subscribed);
    if (filter === 'subscribed') list = list.filter(p => p.subscribed);

    const kw = searchKeyword.trim().toLowerCase();
    if (kw) {
      list = list.filter(p => (p.name || '').toLowerCase().includes(kw));
    }
    return sortPlaylistsByPlayCount(list);
  });
</script>

<!-- 🖥️ PC 桌面端：歌单封面画廊 (Gallery View) -->
<div class="flex flex-col gap-5 select-none animate-fade-in" data-testid="desktop-playlist-gallery">
  <!-- 1. 顶部操作栏：快速输入解析 (右侧预留 lg:pr-[220px] 避开右上角浮动控制胶囊) -->
  <div class="flex items-center gap-3 p-3.5 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] shadow-sm lg:pr-[220px]">
    <!-- 快捷解析框 -->
    <div class="flex items-center gap-2 flex-1 max-w-xl">
      <input
        type="text"
        placeholder="输入或粘贴歌单 ID / 链接 (回车解析)"
        class="flex-1 min-w-0 px-3.5 py-2 rounded-xl text-xs bg-[var(--input-bg)] text-[var(--text-main)] border border-[var(--input-border)] focus:outline-none focus:border-red-500 transition-colors"
        bind:value={parseInput}
        onkeydown={(e) => e.key === 'Enter' && handleParseSubmit()}
      />
      <button
        type="button"
        class="btn-primary shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
        onclick={handleParseSubmit}
      >
        解析详情
      </button>
    </div>
  </div>

  <!-- 2. 分类标签与歌单检索栏 (同排对齐：左侧分类 Tab，右侧搜索与刷新) -->
  <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-2.5">
    <!-- 分类过滤 -->
    <div class="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        class="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border-none {filter === 'all' ? 'bg-red-500/15 text-red-400 font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => filter = 'all'}
      >
        全部 ({myPlaylists.length})
      </button>
      <button
        type="button"
        class="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border-none {filter === 'created' ? 'bg-red-500/15 text-red-400 font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => filter = 'created'}
      >
        我创建的 ({myPlaylists.filter(p => !p.subscribed).length})
      </button>
      <button
        type="button"
        class="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border-none {filter === 'subscribed' ? 'bg-red-500/15 text-red-400 font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => filter = 'subscribed'}
      >
        我收藏的 ({myPlaylists.filter(p => p.subscribed).length})
      </button>
    </div>

    <!-- 筛选过滤与刷新 -->
    <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
      <input
        type="text"
        placeholder="搜索本地缓存歌单..."
        class="w-36 sm:w-44 lg:w-52 px-3 py-1.5 rounded-xl text-xs bg-[var(--input-bg)] text-[var(--text-main)] border border-[var(--input-border)] focus:outline-none focus:border-red-500 transition-colors"
        bind:value={searchKeyword}
      />
      <button
        type="button"
        class="p-2 rounded-xl text-xs bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--btn-secondary-border)] transition-colors cursor-pointer"
        onclick={handleRefresh}
        title="重新从网易云同步歌单"
      >
        {loading ? '⏳' : '🔄'}
      </button>
    </div>
  </div>

  <!-- 3. 画廊封面自适应网格 -->
  {#if filteredPlaylists().length > 0}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
      {#each filteredPlaylists() as pl (pl.id)}
        {@const isFav = isFavoritePlaylist(pl)}
        {@const playCount = getPlaylistPlayCount(pl.id)}
        <div
          data-testid="gallery-card-{pl.id}"
          class="group flex flex-col gap-2 p-3 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--card-header-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-1"
          role="button"
          tabindex="0"
          onclick={() => onSelectPlaylist(String(pl.id))}
          onkeydown={(e) => e.key === 'Enter' && onSelectPlaylist(String(pl.id))}
        >
          <!-- 封面图容器 -->
          <div class="relative w-full aspect-square rounded-xl overflow-hidden bg-black/20">
            <img
              src={pl.coverImgUrl || DEFAULT_VINYL_COVER}
              alt={pl.name}
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <!-- 悬浮播放按钮 -->
            {#if onPlayPlaylist}
              <button
                type="button"
                class="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-sm shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 cursor-pointer border-none"
                onclick={(e) => {
                  e.stopPropagation();
                  onPlayPlaylist(String(pl.id), pl.name);
                }}
                title="立即播放整张歌单"
              >
                ▶
              </button>
            {/if}

            <!-- 收藏/红心标记 -->
            {#if isFav}
              <span class="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-500/90 text-white backdrop-blur-xs">
                ❤️ 喜欢
              </span>
            {/if}
          </div>

          <!-- 歌单信息 -->
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="font-semibold text-xs text-[var(--text-main)] truncate group-hover:text-red-400 transition-colors" title={pl.name}>
              {pl.name}
            </span>
            <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>{pl.trackCount || 0} 首</span>
              {#if playCount > 0}
                <span class="text-amber-400/80 font-medium">🔥 {playCount}</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="py-16 text-center flex flex-col items-center gap-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)]">
      <span class="text-4xl">📁</span>
      <span class="text-sm font-medium text-[var(--text-secondary)]">
        {searchKeyword ? '没有找到匹配的歌单' : '暂无歌单数据'}
      </span>
      <button
        type="button"
        class="btn-secondary text-xs px-4 py-1.5 rounded-xl cursor-pointer"
        onclick={handleRefresh}
      >
        🔄 从网易云同步
      </button>
    </div>
  {/if}
</div>
