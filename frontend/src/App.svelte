<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './lib/api';
  import { checkForPwaUpdate, isAudioCurrentlyPlaying, getPendingUpdateVersion } from './lib/pwa';
  import { applyTheme, getInitialTheme, type ThemeMode } from './lib/theme';
  import { showToast } from './lib/toast.svelte';
  import { routerState, switchTab, jumpToAlbum, jumpToPlaylist, jumpToDownloadTasks, initRouter, toggleSidebarCollapse } from './lib/router.svelte';
  import { layoutState, initLayoutWatcher } from './lib/layout.svelte';
  import { likeState, initLikeList, toggleLike } from './lib/likeStore.svelte';
  import { taskState, startTaskPolling, initDownloadedSet, getActiveDownloadingCount } from './lib/taskStore.svelte';
  import { fetchGeoProxyConfig } from './lib/geoProxyStore.svelte';
  import { sheetState, globalUiState, openSettings, closeSettings, toggleTheme, setThemeMode } from './lib/ui.svelte';
  import { executeReveal } from './lib/revealHelper';
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
  let revealData: { path: string; msg: string } | null = $state(null);
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

    // Listen to PWA update available event (精简提醒，附带版本信息)
    const onPwaUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ version?: string }>;
      const v = customEvent.detail?.version || getPendingUpdateVersion() || '';
      const text = v ? t('app.pwaUpdateFoundWithVer', { version: v }) : t('app.pwaUpdateFound');
      showToast(text, 'info', 5000);
    };
    window.addEventListener('wyy:pwa-update-available', onPwaUpdate);

    // 🌌 注册空白区域快速双击切换沉浸模式（PC 端关闭双击避免与窗口/选词冲突，SP 移动端保留双触切换）
    const cleanupImmersiveDblClick = setupImmersiveDblClick();

    return () => {
      stopRouter();
      stopLayout();
      cleanupImmersiveDblClick();
      window.removeEventListener('wyy:download-submitted', onDownloadSubmit);
      window.removeEventListener('wyy:reveal', onGlobalReveal);
      window.removeEventListener('wyy:pwa-update-available', onPwaUpdate);
    };
  });

  async function handleRefresh() {
    showToast(t('app.checkingUpdate'), 'info', 1200);
    try {
      if (playerStore.playing || isAudioCurrentlyPlaying()) {
        // 🎵 正在播放中，安全跳过应用更新检查，仅同步歌单与收藏，绝不打断当前播放状态
        await initLikeList();
        showToast(t('app.syncSuccess'), 'success', 1500);
        return;
      }
      const hasUpdate = await checkForPwaUpdate();
      await initLikeList();
      if (hasUpdate) {
        const v = getPendingUpdateVersion() || '';
        const msg = v ? t('app.versionUpdated', { version: v }) : t('app.applyingUpdate');
        showToast(msg, 'success', 2500);
        setTimeout(() => {
          if (!playerStore.playing && !isAudioCurrentlyPlaying()) {
            window.location.reload();
          }
        }, 1200);
      } else {
        showToast(t('app.syncSuccess'), 'success', 1500);
      }
    } catch (e: any) {
      console.warn('[App] Refresh check failed:', e);
      showToast(t('common.failed'), 'warning', 1500);
    }
  }
</script>

<!-- 📱 手机端下拉刷新指示器 (模态框/抽屉打开时自动禁用避免手势冲突) -->
<PullToRefresh disabled={isAnyOverlayOpen} onRefresh={handleRefresh} />

<!-- 🌸 四季全屏动态物理粒子层 (樱花漫天飘落与地面积累 / 飞蝶 / 枫叶层叠 / 初雪积雪) -->
{#if (skin.current === 'sakura' || skin.current === 'summer' || skin.current === 'autumn' || skin.current === 'winter') && !isPlayerOverlayOpen}
  <div class="fixed inset-0 pointer-events-none z-[30] overflow-hidden" aria-hidden="true">
    <SeasonParticleCanvas skinId={skin.current} {playing} bottomOffset={particleBottomOffset} />
  </div>
{:else if skin.current === 'rain' && !isPlayerOverlayOpen}
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
  <!-- 💻 PC 桌面侧边栏 (>= 1024px 显示) -->
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

      <!-- 内容区 (3 个 Tab 保持常驻 DOM，零重绘、零抖动、瞬时切换；移动端统一预留 px-3.5 黄金呼吸边距，消灭死贴屏幕边缘) -->
      <div class="flex flex-col gap-1 md:gap-3 px-3.5 sm:px-4 md:px-0 pb-[140px] md:pb-[80px] lg:pb-4">
    <!-- 📁 歌单 Tab -->
    <div style="display: {routerState.tab === 'playlist' ? 'contents' : 'none'};">
      <!-- 💻 PC 桌面端专属：去手风琴画廊与宽屏大表格 (>= 1024px) -->
      <div class="hidden lg:block w-full">
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
      <!-- 📱 移动端 / 窄屏：保留原有折叠手风琴卡片 (< 1024px) -->
      <div class="block lg:hidden w-full">
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
    </div>

    <!-- 🔍 搜索 Tab -->
    <div style="display: {routerState.tab === 'search' ? 'contents' : 'none'};">
      <!-- 💻 PC 桌面端专属：去手风琴全宽搜索中心 (>= 1024px) -->
      <div class="hidden lg:block w-full">
        <DesktopSearchView
          {curTrack} {playing}
          downloadedSet={taskState.downloadedSet} likedSet={likeState.likedSet}
          onToggleLike={toggleLike} onPlayQueue={setQueue} onAlbum={jumpToAlbum} onPlaylist={jumpToPlaylist}
          onSong={(sid: string) => { viewingSongId = sid; }} onReveal={handleReveal}
          {showToast}
        />
      </div>
      <!-- 📱 移动端 / 窄屏：保留原有折叠手风琴卡片 (< 1024px) -->
      <div class="block lg:hidden w-full">
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
    </div>

    <!-- 📥 本地管理 Tab -->
    <div style="display: {routerState.tab === 'download-mgr' ? 'contents' : 'none'};">
      <!-- 💻 PC 桌面端专属：本地管理双栏工作台 (>= 1024px) -->
      <div class="hidden lg:block w-full">
        <DesktopDownloadMgrView
          {curTrack} {playing}
          tasksTrigger={routerState.downloadTasksTrigger}
          onPlayQueue={setQueue}
          onPlaylist={jumpToPlaylist}
          onReveal={handleReveal}
          {showToast}
        />
      </div>
      <!-- 📱 移动端 / 窄屏：保留原有单列折叠手风琴 (< 1024px) -->
      <div class="block lg:hidden w-full">
        <DownloadMgrTab
          {curTrack} {playing}
          onPlayQueue={setQueue}
          onPlaylist={jumpToPlaylist}
          onReveal={handleReveal}
          {showToast}
        />
      </div>
    </div>

    <!-- 🧩 MusicFree 插件管理 Tab -->
    <div style="display: {routerState.tab === 'musicfree' ? 'contents' : 'none'};">
      <div class="w-full">
        <DesktopMusicFreeView
          {curTrack} {playing}
          onPlayQueue={setQueue}
          {showToast}
        />
      </div>
    </div>
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
  <RevealModal path={revealData.path} msg={revealData.msg} onClose={() => revealData = null} {showToast} />
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
