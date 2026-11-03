<script lang="ts">
  import { t } from '../../lib/i18n';
  import { jumpToDownloadTasks, type ActiveTab } from '../../lib/router.svelte';
  import DesktopSidebarPlaylists from './DesktopSidebarPlaylists.svelte';

  let {
    tab,
    currentPlaylistId = '',
    collapsed = false,
    downloadingCount = 0,
    hasPlayerBar = false,
    onSwitchTab,
    onViewPlaylist,
    onPlayPlaylist,
    onToggleCollapse,
    onOpenDownloadTasks,
    showToast
  } = $props<{
    tab: ActiveTab;
    currentPlaylistId?: string;
    collapsed: boolean;
    downloadingCount?: number;
    hasPlayerBar?: boolean;
    onSwitchTab: (tab: ActiveTab) => void;
    onViewPlaylist?: (id: string) => void;
    onPlayPlaylist?: (id: string, name: string) => void;
    onToggleCollapse: () => void;
    onOpenDownloadTasks?: () => void;
    showToast?: (m: string, t?: string) => void;
  }>();

  const isRecommendActive = $derived(tab === 'playlist' && currentPlaylistId === 'daily-recommend');
  const isPlaylistActive = $derived(tab === 'playlist' && currentPlaylistId !== 'daily-recommend');

  function handlePlaylistClick(plId: string | number) {
    if (onViewPlaylist) {
      onViewPlaylist(String(plId));
    }
    onSwitchTab('playlist');
  }
</script>

<!-- PC Desktop Left Sidebar (Visible >= 1024px) -->
<aside
  data-testid="desktop-sidebar"
  class="hidden lg:flex flex-col shrink-0 select-none bg-[var(--card-bg)] backdrop-blur-xl border-r border-[var(--border-color)] transition-[width,height] duration-200 ease-in-out self-start sticky top-0 overflow-hidden {collapsed ? 'w-[58px]' : 'w-[224px]'}"
  style="height: {hasPlayerBar ? 'calc(100vh - 74px)' : '100vh'}; max-height: {hasPlayerBar ? 'calc(100vh - 74px)' : '100vh'};"
>
  <!-- 1. Top Bar: Logo & Collapse Button -->
  <div class="flex flex-col border-b border-[var(--border-color)] shrink-0 wco-drag-region">
    <div class="w-full shrink-0" style="height: env(titlebar-area-height, 0px);"></div>
    <div class="h-12 flex items-center px-3 justify-between gap-1 overflow-hidden shrink-0">
      {#if !collapsed}
        <div class="flex items-center gap-2 min-w-0 pl-0.5">
          <span class="text-lg leading-none shrink-0">🎵</span>
          <span class="font-bold text-sm text-[var(--text-main)] tracking-tight truncate">
            {t('topbar.title')}
          </span>
        </div>
      {:else}
        <div class="w-full flex justify-center" title={t('topbar.title')}>
          <span class="text-lg leading-none">🎵</span>
        </div>
      {/if}

      <button
        type="button"
        data-testid="btn-toggle-sidebar"
        class="wco-no-drag p-1 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-hover-bg)] transition-colors cursor-pointer border-none bg-transparent shrink-0"
        onclick={onToggleCollapse}
        title={collapsed ? t('sidebar.expandTooltip') : t('sidebar.collapseTooltip')}
        aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
      >
        {collapsed ? '»' : '«'}
      </button>
    </div>
  </div>

  <!-- 2. Main Navigation Area -->
  <nav class="p-1.5 flex flex-col gap-1 border-b border-[var(--border-color)] shrink-0">
    <!-- Playlists -->
    <button
      type="button"
      data-testid="sidebar-tab-playlist"
      class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none transition-all duration-150 {isPlaylistActive ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-sm' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)]'} {collapsed ? 'justify-center px-0' : ''}"
      onclick={() => {
        if (currentPlaylistId === 'daily-recommend') {
          onViewPlaylist ? onViewPlaylist('') : onSwitchTab('playlist');
        } else {
          onSwitchTab('playlist');
        }
      }}
      title={t('topbar.playlist')}
    >
      <span class="text-[15px] leading-none shrink-0">📁</span>
      {#if !collapsed}
        <span class="truncate flex-1 text-left">{t('topbar.playlist')}</span>
      {/if}
    </button>

    <!-- Daily Recommend -->
    <button
      type="button"
      data-testid="sidebar-tab-recommend"
      class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none transition-all duration-150 {isRecommendActive ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-sm' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)]'} {collapsed ? 'justify-center px-0' : ''}"
      onclick={() => {
        if (onViewPlaylist) {
          onViewPlaylist('daily-recommend');
        } else {
          onSwitchTab('playlist');
        }
      }}
      title={t('recommend.dailyExclusive')}
    >
      <span class="text-[15px] leading-none shrink-0">📅</span>
      {#if !collapsed}
        <span class="truncate flex-1 text-left">{t('recommend.dailyRecommendShort')}</span>
      {/if}
    </button>

    <!-- Search -->
    <button
      type="button"
      data-testid="sidebar-tab-search"
      class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none transition-all duration-150 {tab === 'search' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-sm' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)]'} {collapsed ? 'justify-center px-0' : ''}"
      onclick={() => onSwitchTab('search')}
      title={t('topbar.search')}
    >
      <span class="text-[15px] leading-none shrink-0">🔍</span>
      {#if !collapsed}
        <span class="truncate flex-1 text-left">{t('topbar.search')}</span>
      {/if}
    </button>

    <!-- Local & Downloads -->
    <div
      class="flex items-center gap-1 rounded-lg transition-all duration-150 relative {tab === 'download-mgr' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-sm' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)]'}"
    >
      <button
        type="button"
        data-testid="sidebar-tab-download-mgr"
        class="flex-1 flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none bg-transparent text-inherit transition-all duration-150 {collapsed ? 'justify-center px-0 w-full' : ''}"
        onclick={() => onSwitchTab('download-mgr')}
        title={t('sidebar.localAndDownload')}
      >
        <span class="text-[15px] leading-none shrink-0">📥</span>
        {#if !collapsed}
          <span class="truncate flex-1 text-left">{t('topbar.local')}</span>
        {/if}
      </button>

      {#if !collapsed && downloadingCount > 0}
        <button
          type="button"
          data-testid="sidebar-downloading-badge"
          class="mr-2 bg-red-500 hover:bg-red-600 active:scale-95 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold leading-none animate-pulse border-none cursor-pointer transition-transform shrink-0"
          onclick={(e) => {
            e.stopPropagation();
            if (onOpenDownloadTasks) onOpenDownloadTasks();
            else jumpToDownloadTasks();
          }}
          title={t('drawer.tasks')}
        >
          {downloadingCount}
        </button>
      {:else if collapsed && downloadingCount > 0}
        <button
          type="button"
          data-testid="sidebar-downloading-badge-collapsed"
          class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-[var(--card-bg)] animate-ping border-none p-0 cursor-pointer"
          onclick={(e) => {
            e.stopPropagation();
            if (onOpenDownloadTasks) onOpenDownloadTasks();
            else jumpToDownloadTasks();
          }}
          title={t('drawer.tasks')}
        ></button>
      {/if}
    </div>

    <!-- 🧩 MusicFree Plugins -->
    <button
      type="button"
      data-testid="sidebar-tab-musicfree"
      class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none transition-all duration-150 {tab === 'musicfree' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-sm' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-bg)]'} {collapsed ? 'justify-center px-0' : ''}"
      onclick={() => onSwitchTab('musicfree')}
      title="发现中心 (MusicFree 广场与插件)"
    >
      <span class="text-[15px] leading-none shrink-0">🧩</span>
      {#if !collapsed}
        <span class="truncate flex-1 text-left">发现中心</span>
      {/if}
    </button>
  </nav>

  <!-- 3. Playlist Quick Navigation -->
  {#if !collapsed}
    <DesktopSidebarPlaylists
      onPlaylistClick={handlePlaylistClick}
      {onPlayPlaylist}
    />
  {:else}
    <!-- Compact shortcuts in collapsed state -->
    <div class="flex flex-col items-center gap-2 pt-2">
      <button
        type="button"
        class="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs cursor-pointer border-none text-[var(--text-secondary)] hover:text-[var(--text-main)]"
        title={t('playlist.myPlaylists')}
        onclick={() => onSwitchTab('playlist')}
      >
        📂
      </button>
    </div>
  {/if}

  <!-- 4. Bottom Version Info -->
  <div
    class="px-3 py-1.5 border-t border-[var(--border-color)] flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] opacity-60 hover:opacity-100 transition-opacity shrink-0 select-none {collapsed ? 'justify-center py-1' : ''}"
    data-testid="sidebar-version-info"
  >
    {#if !collapsed}
      <span class="truncate">{t('topbar.title')}</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded bg-[var(--btn-secondary-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] leading-none">v{__APP_VERSION__}</span>
    {:else}
      <span class="text-[9px] cursor-default font-semibold" title="{t('topbar.title')} v{__APP_VERSION__}">v{__APP_VERSION__}</span>
    {/if}
  </div>
</aside>
