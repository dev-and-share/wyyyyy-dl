<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './lib/api';
  import { probeForPwaUpdate, isAudioCurrentlyPlaying } from './lib/pwa';
  import { applyTheme, getInitialTheme, type ThemeMode } from './lib/theme';
  import { showToast } from './lib/toast.svelte';
  import { routerState, switchTab, jumpToAlbum, jumpToPlaylist, jumpToDownloadTasks, initRouter, toggleSidebarCollapse } from './lib/router.svelte';
  import { layoutState, initLayoutWatcher } from './lib/layout.svelte';
  import { likeState, initLikeList, toggleLike } from './lib/likeStore.svelte';
  import { taskState, startTaskPolling, initDownloadedSet, getActiveDownloadingCount } from './lib/taskStore.svelte';
  import { fetchGeoProxyConfig } from './lib/geoProxyStore.svelte';
  import { sheetState, globalUiState, openSettings, closeSettings, toggleTheme, setThemeMode } from './lib/ui.svelte';
  import { executeReveal, type RevealResult } from './lib/revealHelper';
  import { playPlaylistTracks } from './lib/playerHelper';
  import { playerStore, type SetQueueOptions } from './lib/playerStore.svelte';
  import type { Track } from './lib/types';
  import { t } from './lib/i18n';

  import TopBar from './components/TopBar.svelte';
  import DesktopSidebar from './components/desktop/DesktopSidebar.svelte';
  import DesktopTitlebarIsland from './components/desktop/DesktopTitlebarIsland.svelte';
  import DesktopPlaylistView from './components/desktop/DesktopPlaylistView.svelte';
  import DesktopSearchView from './components/desktop/DesktopSearchView.svelte';
  import DesktopDownloadMgrView from './components/desktop/DesktopDownloadMgrView.svelte';
  import DesktopMusicFreeView from './components/desktop/DesktopMusicFreeView.svelte';
  import PlaylistTab from './components/PlaylistTab.svelte';
  import SearchTab from './components/SearchTab.svelte';
  import DownloadMgrTab from './components/DownloadMgrTab.svelte';
  import GlobalAudioPlayer from './components/GlobalAudioPlayer.svelte';
  import RevealModal from './components/RevealModal.svelte';
  import SongDetailModal from './components/SongDetailModal.svelte';
  import PullToRefresh from './components/sp/PullToRefresh.svelte';
  import BottomSheet from './components/BottomSheet.svelte';
  import ToastContainer from './components/ToastContainer.svelte';
  import SettingsDrawer from './components/SettingsDrawer.svelte';
  import BottomTabBar from './components/sp/BottomTabBar.svelte';
  import ScrollToTopFab from './components/sp/ScrollToTopFab.svelte';
  import { skin } from './lib/skinStore.svelte';
  import { authStore } from './lib/authStore.svelte';
  import { setupImmersiveDblClick } from './lib/player/immersiveDblClick';
  import SeasonParticleCanvas from './components/skins/effects/SeasonParticleCanvas.svelte';
  import RainParticleCanvas from './components/skins/effects/RainParticleCanvas.svelte';

  // ---------- 全局状态 ----------
  let repeat = $state(false);
  let themeMode = $derived(globalUiState.themeMode);
  let revealData: RevealResult | null = $state(null);
  let viewingSongId: string | null = $state(null);
  let showSettings = $derived(globalUiState.showSettings);
  let showPlayerPeq = $state(false);
  let isPlayerMinimized = $state(false);

  // ---------- 播放器状态桥接 (供各 Tab 感知) ----------
  let curTrack: Track | null = $state(null);
  let playing = $state(false);
  let setQueue: (tracks: Track[], optionsOrIdx?: number | SetQueueOptions, maybePlaylistId?: string | number | null) => void = $state(() => {});
  let togglePlayerPlay: () => void = $state(() => {});
  let isPlayerOverlayOpen = $state(false);

  let hasActivePlayerBar = $derived(layoutState.isDesktop && !!curTrack && !isPlayerMinimized);
  let isAnyOverlayOpen = $derived(isPlayerOverlayOpen || !!revealData || !!sheetState.data || showSettings);

  // 🛡️ 按需挂载已访问过的 Tab，避免首屏同时挂载隐藏的搜索/本地管理/插件面板引发 iOS 内存峰值
  let visitedTabs = $state<Record<string, boolean>>({ [routerState.tab]: true });
  $effect(() => {
    const activeTab = routerState.tab;
    if (activeTab && !visitedTabs[activeTab]) {
      visitedTabs[activeTab] = true;
    }
  });

  // 🛡️ 打开应用或切回前台时，延迟挂载物理粒子背景，等页面状态与 DOM 完全稳定后再渲染
  let isEffectsReady = $state(false);
  $effect(() => {
    let timer = 0;
    const updateReadyState = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        isEffectsReady = false;
        if (timer) clearTimeout(timer);
      } else {
        if (timer) clearTimeout(timer);
        timer = window.setTimeout(() => {
          isEffectsReady = true;
        }, 800);
      }
    };
    updateReadyState();
    document.addEventListener('visibilitychange', updateReadyState);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', updateReadyState);
    };
  });

  // 🍂 动态地平线偏移高度：展开播放栏时抬高，收起或最小化时落回屏幕底端
  let particleBottomOffset = $derived(
    hasActivePlayerBar
      ? 76
      : (!layoutState.isDesktop ? (curTrack && !isPlayerMinimized ? 70 : 56) : 0)
  );

  async function handleReveal(item: any) {
    try {
      revealData = await executeReveal(item);
    } catch (e: any) {
      showToast(t('common.locateFailed', { error: e.message || e }), 'error');
    }
  }

  onMount(() => {
    applyTheme(globalUiState.themeMode);
    const stopRouter = initRouter();
    const stopLayout = initLayoutWatcher();
    startTaskPolling();
    initDownloadedSet();
    initLikeList();
    fetchGeoProxyConfig();
    authStore.fetchProfile();

    api.getRepeat().then((j: any) => {
      if (j?.code === '000000') repeat = j.data === true;
    }).catch(() => {});

    // Listen to download submission event to refresh tasks
    const onDownloadSubmit = () => startTaskPolling();
    window.addEventListener('wyy:download-submitted', onDownloadSubmit);

    // Listen to global reveal events
    const onGlobalReveal = (e: any) => {
      if (e?.detail) handleReveal(e.detail);
    };
    window.addEventListener('wyy:reveal', onGlobalReveal);

    // 🌌 注册空白区域快速双击切换沉浸模式（PC 端关闭双击避免与窗口/选词冲突，SP 移动端保留双触切换）
    const cleanupImmersiveDblClick = setupImmersiveDblClick();

    // 🛡️ 启动 1.5 秒后在非播放状态下静默探查是否有新版本（不打扰用户，仅激活设置红点与更新按钮）
    const probeTimer = setTimeout(() => {
      if (!playerStore.playing && !isAudioCurrentlyPlaying()) {
        probeForPwaUpdate().catch(() => {});
      }
    }, 1500);

    return () => {
      clearTimeout(probeTimer);
      stopRouter();
      stopLayout();
      cleanupImmersiveDblClick();
      window.removeEventListener('wyy:download-submitted', onDownloadSubmit);
      window.removeEventListener('wyy:reveal', onGlobalReveal);
    };
  });

  async function handleRefresh() {
    try {
      await initLikeList();
      if (!playerStore.playing && !isAudioCurrentlyPlaying()) {
        // 🛡️ 仅静默探查是否存在新版本供设置菜单顶部按钮高亮提示，严禁擅自激活或自动刷新页面！
        await probeForPwaUpdate();
      }
    } catch (e: any) {
      console.warn('[App] Refresh check failed:', e);
    }
  }
</script>

<!-- 📱 手机端下拉刷新指示器 (模态框/抽屉打开时自动禁用避免手势冲突) -->
<PullToRefresh disabled={isAnyOverlayOpen} onRefresh={handleRefresh} />

<!-- 🌸 四季全屏动态物理粒子层 (樱花漫天飘落与地面积累 / 飞蝶 / 枫叶层叠 / 初雪积雪；延迟预热挂载，避开首屏加载峰值) -->
{#if isEffectsReady && (skin.current === 'sakura' || skin.current === 'summer' || skin.current === 'autumn' || skin.current === 'winter') && !isPlayerOverlayOpen}
  <div class="fixed inset-0 pointer-events-none z-[30] overflow-hidden" aria-hidden="true">
    <SeasonParticleCanvas skinId={skin.current} {playing} bottomOffset={particleBottomOffset} />
  </div>
{:else if isEffectsReady && skin.current === 'rain' && !isPlayerOverlayOpen}
  <!-- 🌧️ 雨夜全屏动态物理雨滴与水痕流淌层 (非沉浸普通模式下如同冬雪般全屏玻璃流淌) -->
  <div class="fixed inset-0 pointer-events-none z-[30] overflow-hidden" aria-hidden="true">
    <RainParticleCanvas {playing} bottomOffset={particleBottomOffset} />
  </div>
{/if}

<!-- 🏝️ PC 桌面端专属：Window Controls Overlay (WCO) 顶栏沉浸灵动岛 -->
{#if layoutState.isDesktop && layoutState.wco.visible}
  <DesktopTitlebarIsland
    {curTrack}
    {playing}
    sidebarCollapsed={routerState.sidebarCollapsed}
    onTogglePlay={() => {
      if (typeof togglePlayerPlay === 'function') {
        togglePlayerPlay();
      } else if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wyy:toggle-play'));
      }
    }}
    onOpenLyric={() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wyy:toggle-lyric-modal'));
      }
    }}
  />
{/if}

<!-- 页面整体容器：在宽屏 (>= 1024px) 锁定视口左侧边栏固定右侧独立滚动，窄屏竖屏自由流动 -->
<div class="min-h-screen flex flex-col lg:flex-row lg:h-screen lg:max-h-screen lg:overflow-hidden">
  <!-- 💻 PC 桌面侧边栏 (仅 >= 1024px 挂载，杜绝移动端隐式挂载后台组件) -->
  {#if layoutState.isDesktop}
    <div class="hidden lg:contents">
      <DesktopSidebar
        tab={routerState.tab}
        currentPlaylistId={routerState.playlistId}
        collapsed={routerState.sidebarCollapsed}
        downloadingCount={getActiveDownloadingCount()}
        hasPlayerBar={hasActivePlayerBar}
        onSwitchTab={switchTab}
        onViewPlaylist={jumpToPlaylist}
        onPlayPlaylist={(id: string, name: string) => playPlaylistTracks(id, name, setQueue, showToast)}
        onToggleCollapse={toggleSidebarCollapse}
        onOpenDownloadTasks={jumpToDownloadTasks}
        {showToast}
      />
    </div>
  {/if}

  <!-- 📱 页面主内容区 (全宽独立滚动区，滚动条始终紧贴屏幕最右侧) -->
  <div
    class="flex-1 flex flex-col min-w-0 app-main-container relative lg:overflow-y-auto w-full transition-[height] duration-200"
    style="height: {layoutState.isDesktop ? (hasActivePlayerBar ? 'calc(100vh - 74px)' : '100vh') : 'auto'};"
  >
    <!-- 💻 桌面端独立 WCO 顶栏安全占位区 (与侧边栏对齐，避免右侧窗口控制按钮与视图头部重叠) -->
    <div class="w-full shrink-0 hidden lg:block pointer-events-none" style="height: var(--wco-height, env(titlebar-area-height, 0px));"></div>

    <!-- 内容居中容器 (限制最大宽度 max-w-[1400px] 居中) -->
    <div class="w-full max-w-[1400px] mx-auto px-0 md:px-4 pt-0 md:pt-4 pb-8 lg:pb-0 relative flex flex-col min-w-0">
      <!-- 顶栏导航 -->
      <TopBar
        tab={routerState.tab} {themeMode} {repeat}
        isDesktopLayout={layoutState.isDesktop}
        onSwitchTab={switchTab}
        onToggleTheme={toggleTheme}
        onToggleRepeat={() => { repeat = !repeat; api.setRepeat(repeat); }}
        onRefresh={handleRefresh}
        onOpenSettings={openSettings}
      />

      <!-- 内容区 (按视口分支挂载 PC 或 SP 组件，杜绝双份 DOM 与后台隐藏哨兵死循环；已访问 Tab 保活瞬时切换) -->
      <div class="flex flex-col gap-1 md:gap-3 px-3.5 sm:px-4 md:px-0 pb-[140px] md:pb-[80px] lg:pb-4">
        <!-- 📁 歌单 Tab -->
        {#if visitedTabs['playlist'] || routerState.tab === 'playlist'}
          <div style="display: {routerState.tab === 'playlist' ? 'contents' : 'none'};">
            {#if layoutState.isDesktop}
              <div class="w-full">
                <DesktopPlaylistView
                  playlistId={routerState.playlistId}
                  playlistTrigger={routerState.playlistTrigger}
                  {curTrack}
                  {playing}
                  likedSet={likeState.likedSet}
                  downloadedSet={taskState.downloadedSet}
                  onToggleLike={toggleLike}
                  onPlayQueue={setQueue}
                  onSong={(sid: string) => { viewingSongId = sid; }}
                  onAlbum={jumpToAlbum}
                  onReveal={handleReveal}
                  {showToast}
                />
              </div>
            {:else}
              <div class="w-full">
                <PlaylistTab
                  playlistId={routerState.playlistId}
                  playlistTrigger={routerState.playlistTrigger}
                  {curTrack} {playing}
                  likedSet={likeState.likedSet} downloadedSet={taskState.downloadedSet}
                  onToggleLike={toggleLike} onPlayQueue={setQueue} onAlbum={jumpToAlbum} onReveal={handleReveal}
                  onSong={(sid: string) => { viewingSongId = sid; }}
                  {showToast}
                />
              </div>
            {/if}
          </div>
        {/if}

        <!-- 🔍 搜索 Tab -->
        {#if visitedTabs['search'] || routerState.tab === 'search'}
          <div style="display: {routerState.tab === 'search' ? 'contents' : 'none'};">
            {#if layoutState.isDesktop}
              <div class="w-full">
                <DesktopSearchView
                  {curTrack} {playing}
                  downloadedSet={taskState.downloadedSet} likedSet={likeState.likedSet}
                  onToggleLike={toggleLike} onPlayQueue={setQueue} onAlbum={jumpToAlbum} onPlaylist={jumpToPlaylist}
                  onSong={(sid: string) => { viewingSongId = sid; }} onReveal={handleReveal}
                  {showToast}
                />
              </div>
            {:else}
              <div class="w-full">
                <SearchTab
                  albumId={routerState.albumId}
                  albumTrigger={routerState.albumTrigger}
                  {curTrack} {playing}
                  downloadedSet={taskState.downloadedSet} likedSet={likeState.likedSet}
                  onToggleLike={toggleLike} onPlayQueue={setQueue} onAlbum={jumpToAlbum} onPlaylist={jumpToPlaylist}
                  onSong={(sid: string) => { viewingSongId = sid; }} onReveal={handleReveal}
                  {showToast}
                />
              </div>
            {/if}
          </div>
        {/if}

        <!-- 📥 本地管理 Tab -->
        {#if visitedTabs['download-mgr'] || routerState.tab === 'download-mgr'}
          <div style="display: {routerState.tab === 'download-mgr' ? 'contents' : 'none'};">
            {#if layoutState.isDesktop}
              <div class="w-full">
                <DesktopDownloadMgrView
                  {curTrack} {playing}
                  tasksTrigger={routerState.downloadTasksTrigger}
                  onPlayQueue={setQueue}
                  onPlaylist={jumpToPlaylist}
                  onReveal={handleReveal}
                  {showToast}
                />
              </div>
            {:else}
              <div class="w-full">
                <DownloadMgrTab
                  {curTrack} {playing}
                  onPlayQueue={setQueue}
                  onPlaylist={jumpToPlaylist}
                  onReveal={handleReveal}
                  {showToast}
                />
              </div>
            {/if}
          </div>
        {/if}

        <!-- 🧩 MusicFree 插件管理 Tab -->
        {#if visitedTabs['musicfree'] || routerState.tab === 'musicfree'}
          <div style="display: {routerState.tab === 'musicfree' ? 'contents' : 'none'};">
            <div class="w-full">
              <DesktopMusicFreeView
                {curTrack} {playing}
                onPlayQueue={setQueue}
                {showToast}
              />
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- 🎬 全局原生音频核心与控制层 (SP 大触控 / PC 优雅三段式 / 歌词 / PEQ) -->
<GlobalAudioPlayer
  bind:curTrack
  bind:playing
  bind:setQueue
  bind:togglePlay={togglePlayerPlay}
  bind:isOverlayOpen={isPlayerOverlayOpen}
  bind:showPeq={showPlayerPeq}
  bind:isPlayerMinimized
  likedSet={likeState.likedSet}
  onToggleLike={toggleLike}
  onReveal={handleReveal}
/>

<!-- 📂 文件定位弹窗 -->
{#if revealData}
  <RevealModal
    path={revealData.path}
    msg={revealData.msg}
    songId={revealData.songId}
    songName={revealData.songName}
    isServer={revealData.isServer}
    isPhone={revealData.isPhone}
    onClose={() => revealData = null}
    {showToast}
  />
{/if}

<!-- 🎧 单曲详情与音质弹窗 -->
{#if viewingSongId}
  <SongDetailModal
    songId={viewingSongId}
    likedSet={likeState.likedSet}
    onToggleLike={toggleLike}
    onPlayQueue={setQueue}
    onTogglePlay={togglePlayerPlay}
    onAlbum={jumpToAlbum}
    onClose={() => viewingSongId = null}
    {showToast}
  />
{/if}

<!-- ⚙️ 全局系统设置抽屉 -->
{#if showSettings}
  <SettingsDrawer
    {repeat}
    {themeMode}
    onToggleRepeat={() => { repeat = !repeat; api.setRepeat(repeat); }}
    onSelectTheme={(mode) => setThemeMode(mode)}
    onOpenPeq={() => { showPlayerPeq = true; }}
    onClose={() => closeSettings()}
    {showToast}
  />
{/if}

<!-- 🔔 全局 Toast 浮动提示容器 -->
<ToastContainer />

<!-- 🌐 Global Bottom Sheet -->
<BottomSheet />

<!-- 📱 移动端固定底栏 Tab Bar -->
<BottomTabBar tab={routerState.tab} onSwitchTab={switchTab} />

<!-- 📱 滚动回顶悬浮按钮 -->
<ScrollToTopFab />
