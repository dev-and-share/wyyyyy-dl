<script lang="ts">
  import { myPlaylists, isFavoritePlaylist } from '../../lib/playlist.svelte';

  let {
    tab,
    collapsed = false,
    downloadingCount = 0,
    onSwitchTab,
    onViewPlaylist,
    onPlayPlaylist,
    onToggleCollapse,
    onSwitchToLegacyTabs,
    showToast
  } = $props<{
    tab: 'playlist' | 'search' | 'download-mgr';
    collapsed: boolean;
    downloadingCount?: number;
    onSwitchTab: (tab: 'playlist' | 'search' | 'download-mgr') => void;
    onViewPlaylist?: (id: string) => void;
    onPlayPlaylist?: (id: string, name: string) => void;
    onToggleCollapse: () => void;
    onSwitchToLegacyTabs?: () => void;
    showToast?: (m: string, t?: string) => void;
  }>();

  // 歌单分类：创建 vs 收藏
  const createdPlaylists = $derived(myPlaylists.filter(p => !p.subscribed));
  const subscribedPlaylists = $derived(myPlaylists.filter(p => p.subscribed));

  // 侧栏歌单搜索过滤
  let sidebarSearchKw = $state('');
  const filteredCreated = $derived(
    sidebarSearchKw.trim()
      ? createdPlaylists.filter(p => p.name?.toLowerCase().includes(sidebarSearchKw.trim().toLowerCase()))
      : createdPlaylists
  );
  const filteredSubscribed = $derived(
    sidebarSearchKw.trim()
      ? subscribedPlaylists.filter(p => p.name?.toLowerCase().includes(sidebarSearchKw.trim().toLowerCase()))
      : subscribedPlaylists
  );

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
  class="hidden lg:flex flex-col shrink-0 select-none bg-[var(--card-bg)] backdrop-blur-xl border-r border-[var(--border-color)] transition-[width] duration-200 ease-in-out self-start sticky top-0 h-[calc(100vh-74px)] max-h-[calc(100vh-74px)] overflow-hidden {collapsed ? 'w-[58px]' : 'w-[220px]'}"
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

  <!-- 3. 歌单快速导航列表：搜索框 + 各占 50% 的两个独立滚动区 -->
  <div class="flex-1 min-h-0 flex flex-col px-2 py-2 gap-0 overflow-hidden">
    {#if !collapsed}
      <!-- 搜索过滤框（固定高度，不滚动）-->
      <div class="relative mb-1.5 shrink-0">
        <input
          type="text"
          placeholder="搜索歌单..."
          class="w-full pl-6 pr-2 py-1 rounded-lg text-[11px] bg-[var(--input-bg)] text-[var(--text-main)] border border-[var(--input-border)] focus:outline-none focus:border-red-400/60 transition-colors"
          bind:value={sidebarSearchKw}
        />
        <span class="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] opacity-40 pointer-events-none">🔍</span>
        {#if sidebarSearchKw}
          <button
            type="button"
            class="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer p-0 bg-transparent border-none leading-none"
            onclick={() => sidebarSearchKw = ''}
          >✕</button>
        {/if}
      </div>

      <!-- 我的歌单：占 50% 高度，独立滚动 -->
      <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar border-b border-[var(--border-subtle)] pb-1 mb-1">
        {#if filteredCreated.length > 0}
          <div class="px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between sticky top-0 bg-[var(--card-bg-solid,#111827)] z-10 border-b border-[var(--border-subtle)]/30">
            <span>我的歌单</span>
            <span class="text-[10px] opacity-70">{filteredCreated.length}</span>
          </div>
          {#each filteredCreated as pl (pl.id)}
            <div class="group relative flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)] transition-colors">
              <button
                type="button"
                class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer bg-transparent border-none p-0 text-inherit"
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
              {#if onPlayPlaylist}
                <button
                  type="button"
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[9px] flex items-center justify-center transition-all duration-150 cursor-pointer border-none shadow-md"
                  onclick={(e) => { e.stopPropagation(); onPlayPlaylist(String(pl.id), pl.name); }}
                  title="立即播放此歌单"
                >▶</button>
              {/if}
            </div>
          {/each}
        {:else}
          <div class="px-2 py-3 text-center text-xs text-[var(--text-muted)]">
            {sidebarSearchKw ? '无匹配' : '暂无歌单'}
          </div>
        {/if}
      </div>

      <!-- 收藏歌单：占 50% 高度，独立滚动 -->
      <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar pt-0.5">
        {#if filteredSubscribed.length > 0}
          <div class="px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between sticky top-0 bg-[var(--card-bg-solid,#111827)] z-10 border-b border-[var(--border-subtle)]/30">
            <span>收藏歌单</span>
            <span class="text-[10px] opacity-70">{filteredSubscribed.length}</span>
          </div>
          {#each filteredSubscribed as pl (pl.id)}
            <div class="group relative flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)] transition-colors">
              <button
                type="button"
                class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer bg-transparent border-none p-0 text-inherit"
                onclick={() => handlePlaylistClick(pl.id)}
                title={pl.name}
              >
                <span class="shrink-0 text-xs text-[var(--text-muted)] group-hover:text-amber-400">⭐</span>
                <span class="truncate flex-1">{pl.name}</span>
                {#if typeof pl.trackCount === 'number'}
                  <span class="text-[10px] text-[var(--text-muted)] shrink-0">{pl.trackCount}</span>
                {/if}
              </button>
              {#if onPlayPlaylist}
                <button
                  type="button"
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[9px] flex items-center justify-center transition-all duration-150 cursor-pointer border-none shadow-md"
                  onclick={(e) => { e.stopPropagation(); onPlayPlaylist(String(pl.id), pl.name); }}
                  title="立即播放此歌单"
                >▶</button>
              {/if}
            </div>
          {/each}
        {:else}
          <div class="px-2 py-3 text-center text-xs text-[var(--text-muted)]">
            {sidebarSearchKw ? '无匹配' : '暂无收藏歌单'}
          </div>
        {/if}
      </div>
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

  <!-- 4. 底部版本信息区 -->
  <div
    class="p-2.5 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] opacity-60 hover:opacity-100 transition-opacity shrink-0 select-none {collapsed ? 'justify-center' : ''}"
    data-testid="sidebar-version-info"
  >
    {#if !collapsed}
      <span class="truncate">网易云下载器</span>
      <span class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--btn-secondary-bg)] border border-[var(--border-color)] text-[var(--text-secondary)]">v{__APP_VERSION__}</span>
    {:else}
      <span class="text-[10px] cursor-default font-semibold" title="网易云下载器 v{__APP_VERSION__}">v{__APP_VERSION__}</span>
    {/if}
  </div>
</aside>

<style>
  /* 优雅边栏微滚动条 */
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: var(--border-color, rgba(255, 255, 255, 0.15)) transparent;
    overscroll-behavior: contain;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: var(--border-color, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted, rgba(255, 255, 255, 0.35));
  }
</style>
