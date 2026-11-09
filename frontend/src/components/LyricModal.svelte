<script lang="ts">
  import { onMount } from 'svelte';
  import { formatArtist, platform, formatCoverUrl } from '../lib/utils';
  import { showToast } from '../lib/toast.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import PlayerProgressBar from './PlayerProgressBar.svelte';
  import PlayerIcon from './PlayerIcon.svelte';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte';
  import SongCommentModal from './SongCommentModal.svelte';
  import LyricPanel from './LyricPanel.svelte';
  import TrackQuickActions from './TrackQuickActions.svelte';
  import SkinPickerSheet from './SkinPickerSheet.svelte';
  import ImmersiveMiniPlayer from './ImmersiveMiniPlayer.svelte';
  import LyricBottomBar from './LyricBottomBar.svelte';
  import { skin, setImmersiveThemeColor } from '../lib/skinStore.svelte';
  import VinylSkinStage from './skins/VinylSkinStage.svelte';
  import AuroraSkinStage from './skins/AuroraSkinStage.svelte';
  import CassetteSkinStage from './skins/CassetteSkinStage.svelte';
  import WinampSkinStage from './skins/WinampSkinStage.svelte';
  import SpringSkinStage from './skins/SpringSkinStage.svelte';
  import SakuraSkinStage from './skins/SakuraSkinStage.svelte';
  import SummerSkinStage from './skins/SummerSkinStage.svelte';
  import AutumnSkinStage from './skins/AutumnSkinStage.svelte';
  import WinterSkinStage from './skins/WinterSkinStage.svelte';
  import TubeSkinStage from './skins/TubeSkinStage.svelte';
  import CdSkinStage from './skins/CdSkinStage.svelte';
  import CyberSkinStage from './skins/CyberSkinStage.svelte';
  import RainSkinStage from './skins/RainSkinStage.svelte';
  import ImmersiveBackgroundStage from './skins/ImmersiveBackgroundStage.svelte';
  import type { SkinId } from './skins/skinTypes';

  let {
    track,
    currentTime,
    duration,
    playing,
    playMode,
    vol = $bindable(0.8),
    isLiked,
    onTogglePlay,
    onPrev,
    onNext,
    onToggleMode,
    onSeek,
    onSeekTime,
    onToggleLike,
    onTogglePeq,
    onToggleDrawer,
    onClose
  } = $props<{
    track: any;
    currentTime: number;
    duration: number;
    playing: boolean;
    playMode: 'list' | 'single' | 'shuffle';
    vol?: number;
    isLiked: boolean;
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    onToggleMode: () => void;
    onSeek: (e: MouseEvent) => void;
    onSeekTime: (time: number) => void;
    onToggleLike: () => void;
    onTogglePeq: () => void;
    onToggleDrawer: () => void;
    onClose: () => void;
  }>();

  let showSkinPicker = $state(false);
  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);
  let showCommentModal = $state(false);

  // 🐱 复古胆机专属爱猫全景大背景：浅三花小步舞曲猫 Minuet (暂停时从 3 种随机抬头神态整张大图中抽取)
  const TUBE_PAUSE_BG_VARIATIONS = [
    '/assets/skins/tube_minuet_pause_1.png',
    '/assets/skins/tube_minuet_pause_2.png',
    '/assets/skins/tube_minuet_pause_3.png'
  ];
  let pauseTubeBgIndex = $state(0);
  let currentPauseTubeBgSrc = $derived(
    TUBE_PAUSE_BG_VARIATIONS[pauseTubeBgIndex] || '/assets/skins/tube_minuet_pause_1.png'
  );

  // 当从播放变为暂停时，随机抽取下一次抬头的猫咪全景大图
  let prevPlaying = $state(false);
  $effect(() => {
    if (prevPlaying && !playing) {
      const nextIdx = (pauseTubeBgIndex + 1 + Math.floor(Math.random() * 2)) % TUBE_PAUSE_BG_VARIATIONS.length;
      pauseTubeBgIndex = nextIdx;
    }
    prevPlaying = playing;
  });

  // 🌙 沉浸式空间分区感应机制 (方案 A：左侧舞台稳固操控小播放器，贴底快速唤起大底栏)
  let uiVisible = $state(true);
  let hideTimer: any = null;
  let isHoveringBottomControls = $state(false);
  let isHoveringMiniControls = $state(false);

  function kickHideTimer() {
    uiVisible = true;
    clearTimeout(hideTimer);
    if (isHoveringBottomControls || isHoveringMiniControls) {
      return;
    }
    hideTimer = setTimeout(() => {
      if (!isHoveringBottomControls && !isHoveringMiniControls) {
        uiVisible = false;
      }
    }, 3200);
  }

  function handleControlsMouseEnter() {
    isHoveringBottomControls = true;
    clearTimeout(hideTimer);
    uiVisible = true;
  }

  function handleControlsMouseLeave() {
    isHoveringBottomControls = false;
    kickHideTimer();
  }

  function handleBottomZoneEnter() {
    isHoveringBottomControls = true;
    clearTimeout(hideTimer);
    uiVisible = true;
  }

  let lastMoveTime = 0;
  function handleMouseMove(e: MouseEvent) {
    if (uiVisible) {
      // 大播放器已显示时：正常防抖延长时间，悬停时保持显示
      const now = Date.now();
      if (now - lastMoveTime > 200) {
        lastMoveTime = now;
        if (!isHoveringBottomControls) {
          kickHideTimer();
        }
      }
      return;
    }

    // 🌙 沉浸静默态 (uiVisible === false)：空间分区响应
    // 1. 鼠标明确移向屏幕最底边 (距底部 48px 以内) 或最顶边 (距顶部 48px 以内)：意图为操作长进度条/播控/顶栏 -> 顺滑唤起大播放器
    if (typeof window !== 'undefined' && (e.clientY >= window.innerHeight - 48 || e.clientY < 48)) {
      handleBottomZoneEnter();
      return;
    }

    // 2. 鼠标移向左侧舞台或小播放器区域：意图为微雕控制台 -> 绝对不唤起大底栏，小播放器稳如泰山
    if (isHoveringMiniControls || e.clientX < 480 || (e.target as HTMLElement | null)?.closest?.('[data-testid="immersive-mini-player-container"]')) {
      return;
    }
  }

  function toggleUi(e?: MouseEvent) {
    // 若点击的是交互式按键，则不在这层拦截
    const target = e?.target as HTMLElement | null;
    if (target && (target.closest('button') || target.closest('input') || target.closest('.interactive-el'))) {
      kickHideTimer();
      return;
    }
    if (uiVisible) {
      uiVisible = false;
      isHoveringBottomControls = false;
      clearTimeout(hideTimer);
    } else {
      kickHideTimer();
    }
  }

  // 📱 下拉阻尼手势关闭 (Swipe-down to Dismiss)
  let modalContainerEl = $state<HTMLDivElement | null>(null);
  let touchStartY = 0;
  let touchStartX = 0;
  let dragOffsetY = $state(0);
  let isDragging = $state(false);
  let isSwipeDownGesture = false;

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, input, select, textarea, .interactive-el')) {
      return;
    }
    const lyricScrollEl = target?.closest('#lyricModalContent') as HTMLElement | null;
    if (lyricScrollEl && lyricScrollEl.scrollTop > 5) {
      return;
    }
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    isDragging = true;
    isSwipeDownGesture = false;
    kickHideTimer();
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (dragOffsetY > 110) {
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(12);
        }
      } catch {}
      onClose();
    }
    dragOffsetY = 0;
    isSwipeDownGesture = false;
  }

  const STAGES = {
    vinyl: VinylSkinStage,
    cassette: CassetteSkinStage,
    cd: CdSkinStage,
    tube: TubeSkinStage,
    winamp: WinampSkinStage,
    cyber: CyberSkinStage,
    aurora: AuroraSkinStage,
    rain: RainSkinStage,
    sakura: SakuraSkinStage,
    summer: SummerSkinStage,
    autumn: AutumnSkinStage,
    winter: WinterSkinStage,
    spring: SpringSkinStage
  };

  let Stage = $derived(STAGES[skin.current] || VinylSkinStage);

  // 切歌或封面变动时更新主题色调色板
  $effect(() => {
    skin.updatePalette(track?.cover);
  });

  function handleAddToPlaylist() {
    if (track) {
      addToPlaylistSong = { id: track.id, name: track.name, artist: formatArtist(track.artist) };
    }
  }

  onMount(() => {
    setImmersiveThemeColor(true);
    kickHideTimer();

    // 🛡️ 锁定根节点与底层视图滚动，彻底杜绝 iOS / PWA 双层橡皮筋穿透下拉
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevBodyTouchAction = document.body.style.touchAction;
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none';

    // 📱 显式在捕获阶段以 non-passive 绑定 touchmove，确保 e.preventDefault() 100% 拦截视口下拉
    const onTouchMoveNonPassive = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - touchStartY;
      const deltaX = currentX - touchStartX;

      // 只要发生明显纵向下划趋势，无论速度多快，立即强力阻止 PWA 视口弹跳
      if (deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX) * 0.7) {
        isSwipeDownGesture = true;
        if (e.cancelable) {
          e.preventDefault();
          e.stopPropagation();
        }
        // 平滑阻尼位移
        dragOffsetY = Math.pow(deltaY, 0.85);
      }
    };

    window.addEventListener('touchmove', onTouchMoveNonPassive, { passive: false, capture: true });

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSkinPicker) {
          showSkinPicker = false;
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      setImmersiveThemeColor(false);
      clearTimeout(hideTimer);
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.body.style.touchAction = prevBodyTouchAction;
      window.removeEventListener('touchmove', onTouchMoveNonPassive, { capture: true });
      window.removeEventListener('keydown', handleKey);
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={modalContainerEl}
  class="fixed inset-0 w-screen h-screen z-[100000] overflow-hidden flex flex-col select-none bg-[image:var(--immersive-bg)] bg-[var(--wco-titlebar-bg,#0a0e1a)] transition-colors duration-500 text-white overscroll-none touch-none"
  style="{skin.cssVars} color-scheme: dark; transform: translateY({dragOffsetY}px); transition: {isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.18, 0.89, 0.32, 1.15), opacity 0.3s'}; opacity: {1 - Math.min(dragOffsetY / 420, 0.5)}; overscroll-behavior: none; touch-action: none; -webkit-overflow-scrolling: auto;"
  onclick={toggleUi}
  onmousemove={handleMouseMove}
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  ontouchcancel={handleTouchEnd}
>
  <!-- 全屏沉浸式背景舞台层 (大背景铺满 + 四季流光 + 微暗角 + 物理粒子) -->
  <ImmersiveBackgroundStage skinId={skin.current} {playing} {currentPauseTubeBgSrc} />

  <!-- 顶部轻盈浮空区域：下拉手势指示器 + 皮肤切换 + 关闭按钮 (全面适配 PWA WCO 窗口控制遮罩) -->
  <div
    class="absolute top-0 inset-x-0 z-30 flex items-center justify-between transition-all duration-300 wco-drag-region {uiVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}"
    style="
      padding-top: max(14px, var(--wco-height, env(titlebar-area-height, 0px)), env(safe-area-inset-top, 0px));
      padding-left: max(16px, var(--wco-left, env(titlebar-area-x, 0px)), env(safe-area-inset-left, 0px));
      padding-right: max(16px, var(--wco-right, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw))), env(safe-area-inset-right, 0px));
    "
  >
    <!-- 左上角：皮肤切换入口 (避开 macOS 交通灯 🔴🟡🟢) -->
    <button
      type="button"
      class="interactive-el wco-no-drag w-9 h-9 rounded-full flex items-center justify-center text-sm bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white backdrop-blur-md border border-white/15 shadow-md transition-all cursor-pointer"
      onclick={() => { showSkinPicker = true; kickHideTimer(); }}
      title={t('player.skin')}
      data-testid="btn-open-skin-picker"
    >
      <span>🎨</span>
    </button>

    <!-- 顶部中央：下拉手势收起指示条 (Pull indicator) -->
    <div class="flex flex-col items-center justify-center py-1 opacity-70">
      <div class="w-9 h-1 rounded-full bg-white/40"></div>
    </div>

    <!-- 右上角：关闭沉浸页按钮 (避开 Chrome / Windows 窗口控制按钮) -->
    <button
      type="button"
      class="interactive-el wco-no-drag w-9 h-9 rounded-full flex items-center justify-center text-sm bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white backdrop-blur-md border border-white/15 shadow-md transition-all cursor-pointer"
      onclick={onClose}
      title={t('common.close')}
    >
      <PlayerIcon name="close" size={15} />
    </button>
  </div>

  <!-- 中间主体：动态皮肤舞台 + 满宽无遮挡滚动歌词 -->
  <div
    class="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden px-4 md:px-12 pb-32 md:pb-28 gap-3 md:gap-10 max-w-[1240px] w-full mx-auto items-center justify-center"
    style="padding-top: max(56px, calc(var(--wco-height, env(titlebar-area-height, 0px)) + 36px), calc(env(safe-area-inset-top, 0px) + 36px));"
  >
    <!-- 左侧列：动态皮肤舞台 + PC 宽屏专属低调 mini 播放器控制面板 -->
    <div class="flex flex-col items-center justify-center shrink-0 max-w-[440px] w-full md:w-auto self-center">
      <!-- 动态皮肤舞台插槽（黑胶/极光/磁带/Winamp/四季） -->
      <Stage
        {track}
        {playing}
        {currentTime}
        {duration}
        palette={skin.palette}
        {isLiked}
        {onToggleLike}
        onOpenComments={() => showCommentModal = true}
        onAddToPlaylist={handleAddToPlaylist}
      />

      <!-- PC 宽屏专属：低调 mini 播放器控制面板（大播放器渐隐时优雅显现，互斥呈现，彻底消除双播放器冲突） -->
      <div
        data-testid="immersive-mini-player-container"
        class="hidden md:flex flex-col items-center w-full mt-3 transition-all duration-500 {uiVisible ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 pointer-events-auto scale-100'}"
        onmouseenter={() => { isHoveringMiniControls = true; }}
        onmouseleave={() => { isHoveringMiniControls = false; }}
      >
        <ImmersiveMiniPlayer
          {playing}
          curTime={currentTime}
          {duration}
          {playMode}
          skinId={skin.current}
          {onTogglePlay}
          {onPrev}
          {onNext}
          {onToggleMode}
          {onSeek}
          {onSeekTime}
          {onToggleDrawer}
        />
      </div>
    </div>

    <!-- 滚动歌词展示面板（严格限制在视口高度内，隔离外层滚动，沉浸式以歌词为核心舒展居中） -->
    <div
      class="w-full flex-1 min-w-0 min-h-0 h-full max-h-full flex flex-col overflow-hidden self-stretch relative"
      onclick={() => kickHideTimer()}
    >
      <LyricPanel {track} {currentTime} {onSeekTime} skinId={skin.current} />
    </div>
  </div>

  <!-- 底部：全屏沉浸播放控制条与贴底感应展开线 -->
  <LyricBottomBar
    {track} {currentTime} {duration} {playing} {playMode} {isLiked} {uiVisible}
    skinId={skin.current} {onTogglePlay} {onPrev} {onNext} {onToggleMode} {onSeek}
    {onToggleLike} {onTogglePeq} {onToggleDrawer} onAddToPlaylist={handleAddToPlaylist}
    onOpenComments={() => showCommentModal = true}
    onMouseEnterControls={handleControlsMouseEnter}
    onMouseLeaveControls={handleControlsMouseLeave}
    onBottomZoneEnter={handleBottomZoneEnter}
    onKickTimer={kickHideTimer}
  />
</div>

{#if showSkinPicker}
  <SkinPickerSheet onClose={() => showSkinPicker = false} />
{/if}

{#if addToPlaylistSong}
  <AddToPlaylistModal
    song={addToPlaylistSong}
    onClose={() => addToPlaylistSong = null}
    {showToast}
  />
{/if}

{#if showCommentModal && track?.id}
  <SongCommentModal
    songId={track.id}
    songName={track.name}
    onClose={() => showCommentModal = false}
  />
{/if}
