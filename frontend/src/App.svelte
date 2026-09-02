<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './lib/api';
  import { checkForPwaUpdate } from './lib/pwa';
  import { applyTheme, getInitialTheme, switchToLegacy, type ThemeMode } from './lib/theme';
  import { showToast } from './lib/toast.svelte';
  import { routerState, switchTab, jumpToAlbum, jumpToPlaylist, initRouter } from './lib/router.svelte';
  import { likeState, initLikeList, toggleLike } from './lib/likeStore.svelte';
  import { taskState, startTaskPolling, initDownloadedSet } from './lib/taskStore.svelte';
  import { sheetState } from './lib/ui.svelte';
  import { executeReveal } from './lib/revealHelper';
  import type { Track } from './lib/types';

  import TopBar from './components/TopBar.svelte';
  import PlaylistTab from './components/PlaylistTab.svelte';
  import SearchTab from './components/SearchTab.svelte';
  import DownloadMgrTab from './components/DownloadMgrTab.svelte';
  import GlobalAudioPlayer from './components/GlobalAudioPlayer.svelte';
  import RevealModal from './components/RevealModal.svelte';
  import PullToRefresh from './components/PullToRefresh.svelte';
  import BottomSheet from './components/BottomSheet.svelte';
  import ToastContainer from './components/ToastContainer.svelte';

  // ---------- 全局状态 ----------
  let repeat = $state(false);
  let themeMode: ThemeMode = $state(getInitialTheme());
  let revealData: { path: string; msg: string } | null = $state(null);

  // ---------- 播放器状态桥接 (供各 Tab 感知) ----------
  let curTrack: Track | null = $state(null);
  let playing = $state(false);
  let setQueue: (tracks: Track[], idx?: number) => void = $state(() => {});
  let isPlayerOverlayOpen = $state(false);

  let isAnyOverlayOpen = $derived(isPlayerOverlayOpen || !!revealData || !!sheetState.data);

  async function handleReveal(item: any) {
    try {
      revealData = await executeReveal(item);
    } catch (e: any) {
      showToast('定位失败: ' + (e.message || e), 'error');
    }
  }

  function toggleTheme() {
    themeMode = themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'auto' : 'dark';
    applyTheme(themeMode);
  }

  onMount(() => {
    applyTheme(themeMode);
    const stopRouter = initRouter();
    startTaskPolling();
    initDownloadedSet();
    initLikeList();

    api.getRepeat().then((j: any) => {
      if (j?.code === '000000') repeat = j.data === true;
    }).catch(() => {});

    // 监听全局下载提交事件，立即拉取最新任务
    const onDownloadSubmit = () => startTaskPolling();
    window.addEventListener('wyyyy:download-submitted', onDownloadSubmit);

    // 监听 PWA 新版本就绪事件
    const onPwaUpdate = () => showToast('🎉 发现新版本！下拉即可更新', 'info', 6000);
    window.addEventListener('wyyyy:pwa-update-available', onPwaUpdate);

    return () => {
      stopRouter();
      window.removeEventListener('wyyyy:download-submitted', onDownloadSubmit);
      window.removeEventListener('wyyyy:pwa-update-available', onPwaUpdate);
    };
  });

  async function handleRefresh() {
    showToast('正在检查更新与刷新数据...', 'info', 1200);
    try {
      const hasUpdate = await checkForPwaUpdate();
      await initLikeList();
      if (hasUpdate) {
        showToast('检测到新版本，正在应用更新...', 'success', 1200);
      } else {
        showToast('已同步最新数据与应用状态', 'success', 1500);
      }
    } catch {
      window.location.reload();
    }
  }
</script>

<!-- 📱 手机端下拉刷新指示器 (模态框/抽屉打开时自动禁用避免手势冲突) -->
<PullToRefresh disabled={isAnyOverlayOpen} onRefresh={handleRefresh} />

<!-- 顶栏导航 -->
<TopBar
  tab={routerState.tab} {themeMode} {repeat}
  onSwitchTab={switchTab}
  onToggleTheme={toggleTheme}
  onToggleRepeat={() => { repeat = !repeat; api.setRepeat(repeat); }}
  onSwitchToLegacy={switchToLegacy}
/>

<!-- 内容区 (3 个 Tab 保持常驻 DOM，零重绘、零抖动、瞬时切换) -->
<div class="max-w-[900px] mx-auto flex flex-col gap-3 pb-[120px]">
  <div style="display: {routerState.tab === 'playlist' ? 'contents' : 'none'};">
    <PlaylistTab
      playlistId={routerState.playlistId} {curTrack} {playing}
      likedSet={likeState.likedSet} downloadedSet={taskState.downloadedSet}
      onToggleLike={toggleLike} onPlayQueue={setQueue} onAlbum={jumpToAlbum} onReveal={handleReveal}
      {showToast}
    />
  </div>
  <div style="display: {routerState.tab === 'search' ? 'contents' : 'none'};">
    <SearchTab
      albumId={routerState.albumId} {curTrack} {playing}
      downloadedSet={taskState.downloadedSet} likedSet={likeState.likedSet}
      onToggleLike={toggleLike} onPlayQueue={setQueue} onAlbum={jumpToAlbum} onPlaylist={jumpToPlaylist}
      onSong={(sid) => { routerState.playlistId = sid; switchTab('playlist'); }} onReveal={handleReveal}
      {showToast}
    />
  </div>
  <div style="display: {routerState.tab === 'download-mgr' ? 'contents' : 'none'};">
    <DownloadMgrTab {curTrack} {playing} onPlayQueue={setQueue} onReveal={handleReveal} {showToast} />
  </div>

  <!-- 底部低调版本号 -->
  <footer class="text-center text-[11px] text-[var(--text-muted)] font-mono py-3 select-none opacity-40 hover:opacity-80 transition-opacity">
    网易云音乐下载器 · PWA v{__APP_VERSION__}
  </footer>
</div>

<!-- 🎬 全局原生音频核心与控制层 (SP 大触控 / PC 优雅三段式 / 歌词 / PEQ) -->
<GlobalAudioPlayer
  bind:curTrack
  bind:playing
  bind:setQueue
  bind:isOverlayOpen={isPlayerOverlayOpen}
  likedSet={likeState.likedSet}
  onToggleLike={toggleLike}
  onReveal={handleReveal}
/>

<!-- 📂 文件定位弹窗 -->
{#if revealData}
  <RevealModal path={revealData.path} msg={revealData.msg} onClose={() => revealData = null} {showToast} />
{/if}

<!-- 🔔 全局 Toast 浮动提示容器 -->
<ToastContainer />

<!-- 🌐 Global Bottom Sheet -->
<BottomSheet />
