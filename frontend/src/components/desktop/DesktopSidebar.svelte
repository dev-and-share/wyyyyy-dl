<script lang="ts">
  import { myPlaylists, isFavoritePlaylist } from '../../lib/playlist.svelte';

  let {
    tab,
    collapsed = false,
    downloadingCount = 0,
    onSwitchTab,
    onViewPlaylist,
    onToggleCollapse,
    onSwitchToLegacyTabs,
    showToast
  } = $props<{
    tab: 'playlist' | 'search' | 'download-mgr';
    collapsed: boolean;
    downloadingCount?: number;
    onSwitchTab: (tab: 'playlist' | 'search' | 'download-mgr') => void;
    onViewPlaylist?: (id: string) => void;
    onToggleCollapse: () => void;
    onSwitchToLegacyTabs: () => void;
    showToast?: (m: string, t?: string) => void;
  }>();

  // 歌单分类：创建 vs 收藏
  const createdPlaylists = $derived(myPlaylists.filter(p => !p.subscribed));
  const subscribedPlaylists = $derived(myPlaylists.filter(p => p.subscribed));

  function handlePlaylistClick(plId: string | number) {
    if (onViewPlaylist) {
      onViewPlaylist(String(plId));
    }
    onSwitchTab('playlist');
  }
</script>

<!-- 🖥️ PC 桌面级左侧常驻/折叠边栏 (仅在 >= 1024px 显示) -->
<aside
  data-testid="desktop-sidebar"
  class="hidden lg:flex flex-col shrink-0 select-none bg-[var(--card-bg)] backdrop-blur-xl border-r border-[var(--border-color)] transition-[width] duration-200 ease-in-out {collapsed ? 'w-[58px]' : 'w-[220px]'}"
>
  <!-- 1. 顶栏：Logo 与折叠切换按钮 -->
  <div class="h-14 flex items-center px-3 border-b border-[var(--border-color)] justify-between gap-1 overflow-hidden shrink-0">
    {#if !collapsed}
      <div class="flex items-center gap-2 min-w-0 pl-1">
        <span class="text-lg leading-none shrink-0">🎵</span>
        <span class="font-bold text-sm text-[var(--text-main)] tracking-tight truncate">
          网易云下载器
        </span>
      </div>
    {:else}
      <div class="w-full flex justify-center" title="网易云下载器">
        <span class="text-lg leading-none">🎵</span>
      </div>
    {/if}

    <button
      type="button"
      data-testid="btn-toggle-sidebar"
      class="p-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-hover-bg)] transition-colors cursor-pointer border-none bg-transparent shrink-0"
      onclick={onToggleCollapse}
      title={collapsed ? '展开边栏 (宽屏展开)' : '收起边栏 (紧凑纯图标)'}
      aria-label={collapsed ? '展开边栏' : '收起边栏'}
    >
      {collapsed ? '»' : '«'}
    </button>
  </div>

  <!-- 2. 主导航区 -->
  <nav class="p-2 flex flex-col gap-1 border-b border-[var(--border-color)] shrink-0">
    <!-- 歌单 -->
    <button
      type="button"
      data-testid="sidebar-tab-playlist"
      class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all duration-150 {tab === 'playlist' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-sm' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)]'} {collapsed ? 'justify-center px-0' : ''}"
      onclick={() => onSwitchTab('playlist')}
      title="歌单"
    >
      <span class="text-base leading-none shrink-0">📁</span>
      {#if !collapsed}
        <span class="truncate flex-1 text-left">歌单</span>
      {/if}
    </button>

    <!-- 搜索 -->
    <button
      type="button"
      data-testid="sidebar-tab-search"
      class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all duration-150 {tab === 'search' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-sm' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)]'} {collapsed ? 'justify-center px-0' : ''}"
      onclick={() => onSwitchTab('search')}
      title="搜索"
    >
      <span class="text-base leading-none shrink-0">🔍</span>
      {#if !collapsed}
        <span class="truncate flex-1 text-left">搜索</span>
      {/if}
    </button>

    <!-- 本地 -->
    <button
      type="button"
      data-testid="sidebar-tab-download-mgr"
      class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all duration-150 relative {tab === 'download-mgr' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-sm' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)]'} {collapsed ? 'justify-center px-0' : ''}"
      onclick={() => onSwitchTab('download-mgr')}
      title="本地与下载"
    >
      <span class="text-base leading-none shrink-0">📥</span>
      {#if !collapsed}
        <span class="truncate flex-1 text-left">本地</span>
        {#if downloadingCount > 0}
          <span class="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold leading-none animate-pulse">
            {downloadingCount}
          </span>
        {/if}
      {:else if downloadingCount > 0}
        <span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[var(--card-bg)] animate-ping"></span>
      {/if}
    </button>
  </nav>

  <!-- 3. 歌单快速导航列表 (展开时展示完整列表，折叠时图标居中模式) -->
  <div class="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-3 min-h-0 custom-scrollbar">
    {#if !collapsed}
      <!-- 创建的歌单 -->
      {#if createdPlaylists.length > 0}
        <div class="flex flex-col gap-0.5">
          <div class="px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
            <span>我的歌单</span>
            <span class="text-[10px] opacity-70">{createdPlaylists.length}</span>
          </div>
          {#each createdPlaylists as pl (pl.id)}
            <button
              type="button"
              class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)] cursor-pointer border-none bg-transparent transition-colors group"
              onclick={() => handlePlaylistClick(pl.id)}
              title={pl.name}
            >
              <span class="shrink-0 text-xs text-[var(--text-muted)] group-hover:text-red-400">
                {isFavoritePlaylist(pl) ? '❤️' : '📂'}
              </span>
              <span class="truncate flex-1">{pl.name}</span>
              {#if typeof pl.trackCount === 'number'}
                <span class="text-[10px] text-[var(--text-muted)] shrink-0">{pl.trackCount}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}

      <!-- 收藏的歌单 -->
      {#if subscribedPlaylists.length > 0}
        <div class="flex flex-col gap-0.5">
          <div class="px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
            <span>收藏歌单</span>
            <span class="text-[10px] opacity-70">{subscribedPlaylists.length}</span>
          </div>
          {#each subscribedPlaylists as pl (pl.id)}
            <button
              type="button"
              class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)] cursor-pointer border-none bg-transparent transition-colors group"
              onclick={() => handlePlaylistClick(pl.id)}
              title={pl.name}
            >
              <span class="shrink-0 text-xs text-[var(--text-muted)] group-hover:text-amber-400">
                ⭐
              </span>
              <span class="truncate flex-1">{pl.name}</span>
              {#if typeof pl.trackCount === 'number'}
                <span class="text-[10px] text-[var(--text-muted)] shrink-0">{pl.trackCount}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}

      {#if createdPlaylists.length === 0 && subscribedPlaylists.length === 0}
        <div class="px-2 py-4 text-center text-xs text-[var(--text-muted)]">
          暂无本地歌单缓存
        </div>
      {/if}
    {:else}
      <!-- 折叠态下的紧凑快捷方式 -->
      <div class="flex flex-col items-center gap-2 pt-2">
        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs cursor-pointer border-none text-[var(--text-secondary)] hover:text-[var(--text-main)]"
          title="我的歌单"
          onclick={() => onSwitchTab('playlist')}
        >
          📂
        </button>
      </div>
    {/if}
  </div>

  <!-- 4. 底部工具与版本回退区 -->
  <div class="p-2 border-t border-[var(--border-color)] flex flex-col gap-1.5 shrink-0">
    <button
      type="button"
      data-testid="btn-sidebar-legacy-tabs"
      class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)] cursor-pointer border-none bg-transparent transition-colors {collapsed ? 'justify-center' : ''}"
      onclick={onSwitchToLegacyTabs}
      title="切换为精简 Tab 折叠模式 (旧版 PC 交互)"
    >
      <span class="text-xs shrink-0">↩️</span>
      {#if !collapsed}
        <span class="truncate">切换精简版</span>
      {/if}
    </button>
  </div>
</aside>

<style>
  /* 优雅边栏微滚动条 */
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: var(--border-color, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted, rgba(255, 255, 255, 0.25));
  }
</style>
