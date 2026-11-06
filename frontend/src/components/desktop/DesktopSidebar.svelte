<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../lib/i18n';
  import { jumpToDownloadTasks, type ActiveTab, AppRoute, SpecialRouteId, isDailyRecommendRoute } from '../../lib/router.svelte';
  import { geoProxyState, fetchGeoProxyConfig } from '../../lib/geoProxyStore.svelte';
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

  const isRecommendActive = $derived(tab === AppRoute.PLAYLIST && isDailyRecommendRoute(currentPlaylistId));
  const isPlaylistActive = $derived(tab === AppRoute.PLAYLIST && !isDailyRecommendRoute(currentPlaylistId));

  onMount(() => {
    if (!geoProxyState.loaded) {
      fetchGeoProxyConfig();
    }
  });

  const proxyTooltipSummary = $derived.by(() => {
    if (!geoProxyState.enabled) return '';
    const parts = [t('settings.geoProxy.sectionTitle')];
    if (geoProxyState.fallbackDirect) {
      parts.push(`[${t('settings.geoProxy.fallbackDirectTitle')}]`);
    } else {
      parts.push(`[${t('settings.geoProxy.activeBadge')}]`);
    }
    if (geoProxyState.activeProxy) {
      parts.push(`${t('settings.geoProxy.outIpLabel')} ${geoProxyState.activeProxy}`);
    }
    if (geoProxyState.activeLocation) {
      parts.push(`(${geoProxyState.activeLocation})`);
    }
    if (geoProxyState.activeLatencyMs !== null) {
      parts.push(`${geoProxyState.activeLatencyMs}ms`);
    }
    return parts.join(' ');
  });

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
        if (isDailyRecommendRoute(currentPlaylistId)) {
          onViewPlaylist ? onViewPlaylist('') : onSwitchTab(AppRoute.PLAYLIST);
        } else {
          onSwitchTab(AppRoute.PLAYLIST);
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
          onViewPlaylist(SpecialRouteId.DAILY_RECOMMEND);
        } else {
          onSwitchTab(AppRoute.PLAYLIST);
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
      title="MusicFree发现中心 (MusicFree 广场与插件)"
    >
      <span class="text-[15px] leading-none shrink-0">🧩</span>
      {#if !collapsed}
        <span class="truncate flex-1 text-left">发现</span>
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
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-[9px] px-1.5 py-0.5 rounded bg-[var(--btn-secondary-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] leading-none">v{__APP_VERSION__}</span>
        {#if geoProxyState.enabled}
          <div
            class="relative group/proxy inline-flex items-center justify-center cursor-pointer"
            data-testid="sidebar-geo-proxy-icon"
            role="status"
            aria-label={proxyTooltipSummary}
            title={proxyTooltipSummary}
          >
            <span
              class="flex items-center justify-center w-4 h-4 rounded transition-all duration-150 {geoProxyState.fallbackDirect
                ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                : 'text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25'}"
            >
              <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </span>
            <span
              class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full {geoProxyState.fallbackDirect ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}"
            ></span>

            <!-- Tooltip 浮层详情卡片 (向上展开) -->
            <div
              data-testid="sidebar-proxy-tooltip"
              class="absolute bottom-full right-0 mb-2 w-[200px] p-2.5 rounded-xl bg-neutral-900/95 dark:bg-neutral-950/95 text-neutral-200 border border-neutral-700/60 shadow-2xl backdrop-blur-md opacity-0 invisible group-hover/proxy:opacity-100 group-hover/proxy:visible transition-all duration-150 pointer-events-none z-50 flex flex-col gap-1.5 font-sans text-left select-text"
            >
              <!-- 顶部状态栏 -->
              <div class="flex items-center justify-between border-b border-white/10 pb-1.5">
                <div class="flex items-center gap-1.5 font-semibold text-xs text-white">
                  <span>🌐</span>
                  <span>{t('settings.geoProxy.tooltipTitle')}</span>
                </div>
                <span class="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium {geoProxyState.fallbackDirect ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}">
                  {geoProxyState.fallbackDirect ? t('settings.geoProxy.fallbackDirectTitle') : t('settings.geoProxy.activeBadge')}
                </span>
              </div>

              <!-- 详情列表 -->
              <div class="flex flex-col gap-1 text-[11px] leading-tight text-neutral-300">
                <div class="flex items-start justify-between gap-1.5">
                  <span class="text-neutral-400 shrink-0">{t('settings.geoProxy.outIpLabel')}</span>
                  <span class="font-mono text-white text-right break-all">
                    {geoProxyState.activeProxy || t('settings.geoProxy.notLockedTitle')}
                  </span>
                </div>

                {#if geoProxyState.activeLocation}
                  <div class="flex items-start justify-between gap-1.5">
                    <span class="text-neutral-400 shrink-0">{t('settings.geoProxy.locationLabel')}</span>
                    <span class="text-right text-neutral-200 truncate max-w-[125px]" title={geoProxyState.activeLocation}>
                      {geoProxyState.activeLocation}
                    </span>
                  </div>
                {/if}

                {#if geoProxyState.activeLatencyMs !== null}
                  <div class="flex items-center justify-between gap-1.5">
                    <span class="text-neutral-400 shrink-0">{t('settings.geoProxy.latencyLabel')}</span>
                    <span class="font-mono font-bold text-emerald-400 text-[10px]">
                      {geoProxyState.activeLatencyMs} ms
                    </span>
                  </div>
                {/if}

                <div class="flex items-center justify-between gap-1.5">
                  <span class="text-neutral-400 shrink-0">{t('settings.geoProxy.modeLabel')}</span>
                  <span class="text-neutral-300">
                    {geoProxyState.mode === 'custom' ? t('settings.geoProxy.modeCustom') : t('settings.geoProxy.modePool')}
                  </span>
                </div>
              </div>

              <!-- 小指示三角 -->
              <div class="absolute -bottom-1 right-2 w-2 h-2 bg-neutral-900 border-r border-b border-neutral-700/60 rotate-45"></div>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex items-center gap-1 shrink-0">
        <span class="text-[9px] cursor-default font-semibold" title="{t('topbar.title')} v{__APP_VERSION__}">v{__APP_VERSION__}</span>
        {#if geoProxyState.enabled}
          <div
            class="relative group/proxy inline-flex items-center justify-center cursor-pointer"
            data-testid="sidebar-geo-proxy-icon"
            role="status"
            aria-label={proxyTooltipSummary}
            title={proxyTooltipSummary}
          >
            <span
              class="flex items-center justify-center w-3.5 h-3.5 rounded transition-all duration-150 {geoProxyState.fallbackDirect
                ? 'text-amber-400 bg-amber-500/15'
                : 'text-emerald-400 bg-emerald-500/15'}"
            >
              <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </span>
            <span
              class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full {geoProxyState.fallbackDirect ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}"
            ></span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</aside>
