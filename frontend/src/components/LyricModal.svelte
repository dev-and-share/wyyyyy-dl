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
  import { skin } from '../lib/skinStore.svelte';
  import VinylSkinStage from './skins/VinylSkinStage.svelte';
  import AuroraSkinStage from './skins/AuroraSkinStage.svelte';
  import CassetteSkinStage from './skins/CassetteSkinStage.svelte';
  import WinampSkinStage from './skins/WinampSkinStage.svelte';
  import SpringSkinStage from './skins/SpringSkinStage.svelte';
  import SakuraSkinStage from './skins/SakuraSkinStage.svelte';
  import SummerSkinStage from './skins/SummerSkinStage.svelte';
  import AutumnSkinStage from './skins/AutumnSkinStage.svelte';
  import WinterSkinStage from './skins/WinterSkinStage.svelte';
  import SeasonParticleCanvas from './skins/effects/SeasonParticleCanvas.svelte';
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

  // 🌙 沉浸式 3 秒自动渐隐机制
  let uiVisible = $state(true);
  let hideTimer: any = null;

  function kickHideTimer() {
    uiVisible = true;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      uiVisible = false;
    }, 3200);
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
    aurora: AuroraSkinStage,
    cassette: CassetteSkinStage,
    winamp: WinampSkinStage,
    spring: SpringSkinStage,
    sakura: SakuraSkinStage,
    summer: SummerSkinStage,
    autumn: AutumnSkinStage,
    winter: WinterSkinStage
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
  class="fixed inset-0 w-screen h-screen z-[100000] overflow-hidden flex flex-col select-none bg-[image:var(--immersive-bg)] bg-[var(--bg-color)] transition-colors duration-500 text-white overscroll-none touch-none"
  style="{skin.cssVars} color-scheme: dark; transform: translateY({dragOffsetY}px); transition: {isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.18, 0.89, 0.32, 1.15), opacity 0.3s'}; opacity: {1 - Math.min(dragOffsetY / 420, 0.5)}; overscroll-behavior: none; touch-action: none; -webkit-overflow-scrolling: auto;"
  onclick={toggleUi}
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  ontouchcancel={handleTouchEnd}
>
  <!-- 动态全屏皮肤流光层（铺满 100vw × 100vh 大画布） -->
  {#if skin.current === 'aurora'}
    <div class="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      <div
        class="aurora-orb orb-1 absolute -top-1/4 -left-1/4 w-[55vw] h-[55vw] min-w-[380px] min-h-[380px] rounded-full blur-[90px] md:blur-[130px] opacity-60 mix-blend-screen transition-colors duration-1000"
        style="background: var(--skin-dominant, #7c3aed); animation-play-state: {playing ? 'running' : 'paused'};"
      ></div>
      <div
        class="aurora-orb orb-2 absolute top-1/3 -right-1/4 w-[50vw] h-[50vw] min-w-[340px] min-h-[340px] rounded-full blur-[80px] md:blur-[120px] opacity-55 mix-blend-screen transition-colors duration-1000"
        style="background: var(--skin-accent, #db2777); animation-play-state: {playing ? 'running' : 'paused'};"
      ></div>
      <div
        class="aurora-orb orb-3 hidden md:block absolute -bottom-1/4 left-1/3 w-[45vw] h-[45vw] min-w-[300px] min-h-[300px] rounded-full blur-[90px] md:blur-[130px] opacity-40 mix-blend-screen transition-colors duration-1000"
        style="background: var(--skin-muted, #2563eb); animation-play-state: {playing ? 'running' : 'paused'};"
      ></div>
    </div>
  {:else if skin.current === 'spring'}
    <div class="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      <div
        class="spring-pollen absolute -top-10 left-1/4 w-[50vw] h-[50vw] min-w-[340px] min-h-[340px] rounded-full blur-[100px] md:blur-[140px] bg-emerald-500/20 opacity-70 mix-blend-screen"
        style="animation-play-state: {playing ? 'running' : 'paused'};"
      ></div>
      <div
        class="spring-pollen absolute -bottom-10 right-1/4 w-[55vw] h-[55vw] min-w-[380px] min-h-[380px] rounded-full blur-[110px] md:blur-[150px] bg-teal-400/20 opacity-60 mix-blend-screen"
        style="animation-play-state: {playing ? 'running' : 'paused'};"
      ></div>
    </div>
  {:else if skin.current === 'sakura' || skin.current === 'summer' || skin.current === 'autumn' || skin.current === 'winter'}
    <!-- 四季动态全屏微风物理粒子画布 -->
    <SeasonParticleCanvas skinId={skin.current} {playing} bottomOffset={110} />
  {/if}

  <!-- 顶部轻盈浮空区域：下拉手势指示器 + 皮肤切换 + 关闭按钮 -->
  <div class="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 md:px-8 pt-[max(12px,env(safe-area-inset-top,0px))] transition-all duration-300 {uiVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}">
    <!-- 左上角：皮肤切换入口 -->
    <button
      type="button"
      class="interactive-el w-9 h-9 rounded-full flex items-center justify-center text-sm bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white backdrop-blur-md border border-white/15 shadow-md transition-all cursor-pointer"
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

    <!-- 右上角：关闭沉浸页按钮 -->
    <button
      type="button"
      class="interactive-el w-9 h-9 rounded-full flex items-center justify-center text-sm bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white backdrop-blur-md border border-white/15 shadow-md transition-all cursor-pointer"
      onclick={onClose}
      title={t('common.close')}
    >
      <PlayerIcon name="close" size={15} />
    </button>
  </div>

  <!-- 中间主体：动态皮肤舞台 + 满宽无遮挡滚动歌词 -->
  <div class="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden px-4 md:px-12 pt-[max(56px,calc(env(safe-area-inset-top,0px)+34px))] pb-32 md:pb-28 gap-3 md:gap-10 max-w-[1240px] w-full mx-auto items-center justify-center">
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

    <!-- 滚动歌词展示面板（完全恢复 100% 满宽，左侧不再有任何违和遮挡） -->
    <div class="w-full flex-1 min-h-0 flex flex-col" onclick={() => kickHideTimer()}>
      <LyricPanel {track} {currentTime} {onSeekTime} skinId={skin.current} />
    </div>
  </div>

  <!-- 底部：全屏沉浸播放控制条（上下两层结构 + 3秒自动渐隐） -->
  <div
    class="interactive-el absolute bottom-0 inset-x-0 z-20 w-full px-4 md:px-12 pt-6 pb-[max(14px,env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center gap-2 transition-all duration-500 {uiVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}"
  >
    <!-- 第一层：轻量级歌曲互动横栏 (喜欢、评论、加歌单、EQ) -->
    <div class="w-full max-w-[640px] flex items-center justify-between px-2 text-white/80">
      <div class="flex items-center gap-3">
        <!-- ❤️ 喜欢 -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-xs cursor-pointer {isLiked ? 'text-red-400' : 'text-white/80'}"
          onclick={() => { onToggleLike(); kickHideTimer(); }}
          title={isLiked ? t('player.likeRemove') : t('player.likeAdd')}
        >
          <PlayerIcon name="heart" liked={isLiked} size={15} />
          <span class="text-[11px] font-medium">{t('player.like')}</span>
        </button>

        <!-- 💬 评论 -->
        {#if track?.id}
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-xs cursor-pointer text-white/80"
            onclick={() => { showCommentModal = true; kickHideTimer(); }}
            title={t('comment.view')}
          >
            <span class="text-xs">💬</span>
            <span class="text-[11px] font-medium">{t('comment.view')}</span>
          </button>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        <!-- ➕ 收藏到歌单 -->
        <button
          type="button"
          class="w-7.5 h-7.5 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-emerald-400 transition-all cursor-pointer"
          onclick={() => { handleAddToPlaylist(); kickHideTimer(); }}
          title={t('playlist.collectTo')}
        >
          <PlayerIcon name="plus" size={15} />
        </button>

        <!-- 🎚️ PEQ -->
        {#if platform.canUseAudioProcessing}
          <button
            type="button"
            class="w-7.5 h-7.5 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white transition-all cursor-pointer"
            onclick={() => { onTogglePeq(); kickHideTimer(); }}
            title={t('player.peq')}
          >
            <PlayerIcon name="equalizer" size={15} />
          </button>
        {/if}
      </div>
    </div>

    <!-- 进度条 -->
    <div class="w-full max-w-[640px]" onclick={() => kickHideTimer()}>
      <PlayerProgressBar
        curTime={currentTime}
        {duration}
        progressRatio={duration ? (currentTime / duration) : 0}
        {onSeek}
        skinId={skin.current}
      />
    </div>

    <!-- 第二层：5个核心播控大拇指操作区 (大间距防误触) -->
    <div class="flex items-center justify-center gap-5 md:gap-8 pt-1">
      <!-- 循环模式 -->
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={() => { onToggleMode(); kickHideTimer(); }}
        title={t('player.toggleMode')}
      >
        <PlayerIcon name={playMode === 'single' ? 'repeat-1' : playMode === 'shuffle' ? 'shuffle' : 'repeat'} size={18} />
      </button>

      <!-- 上一首 -->
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
        onclick={() => { onPrev(); kickHideTimer(); }}
        title={t('player.previous')}
      >
        <PlayerIcon name="prev" size={19} />
      </button>

      <!-- 播放/暂停核心大键 -->
      <button
        type="button"
        class="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        onclick={() => { onTogglePlay(); kickHideTimer(); }}
        title={playing ? t('player.pause') : t('player.play')}
      >
        <PlayerIcon name={playing ? 'pause' : 'play'} size={21} />
      </button>

      <!-- 下一首 -->
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
        onclick={() => { onNext(); kickHideTimer(); }}
        title={t('player.next')}
      >
        <PlayerIcon name="next" size={19} />
      </button>

      <!-- 播放队列 -->
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={() => { onToggleDrawer(); kickHideTimer(); }}
        title={t('player.playlist')}
      >
        <PlayerIcon name="list" size={18} />
      </button>
    </div>
  </div>

  <!-- 沉浸模式极细贴底进度指示线 (当界面淡出时优雅静默发光，高 2px) -->
  <div
    class="absolute bottom-0 inset-x-0 h-[2px] bg-white/10 pointer-events-none transition-opacity duration-500 z-10 {uiVisible ? 'opacity-0' : 'opacity-100'}"
  >
    <div
      class="h-full bg-gradient-to-r from-red-500 to-rose-400 rounded-r-full transition-all duration-300"
      style="width: {duration ? Math.min(100, (currentTime / duration) * 100) : 0}%; box-shadow: 0 0 6px rgba(244, 63, 94, 0.6);"
    ></div>
  </div>
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

<style>
  /* ── 极光流动动画（大画布全屏） ───────────────────────── */
  @keyframes drift1 {
    0%   { transform: translate(0, 0) scale(1); }
    50%  { transform: translate(6vw, 4vh) scale(1.15); }
    100% { transform: translate(0, 0) scale(1); }
  }
  @keyframes drift2 {
    0%   { transform: translate(0, 0) scale(1.1); }
    50%  { transform: translate(-5vw, -3vh) scale(0.95); }
    100% { transform: translate(0, 0) scale(1.1); }
  }
  @keyframes drift3 {
    0%   { transform: translate(0, 0) scale(1); }
    50%  { transform: translate(4vw, -5vh) scale(1.1); }
    100% { transform: translate(0, 0) scale(1); }
  }

  .orb-1 { animation: drift1 18s ease-in-out infinite; will-change: transform; }
  .orb-2 { animation: drift2 22s ease-in-out infinite; will-change: transform; }
  .orb-3 { animation: drift3 26s ease-in-out infinite; will-change: transform; }

  /* ── 春日草木微粒动画（大画布全屏） ───────────────────── */
  @keyframes floatPollen {
    0%   { transform: translateY(0) scale(1); }
    50%  { transform: translateY(4vh) scale(1.08); }
    100% { transform: translateY(0) scale(1); }
  }
  .spring-pollen { animation: floatPollen 14s ease-in-out infinite; will-change: transform; }

  @media (prefers-reduced-motion: reduce) {
    .aurora-orb, .spring-pollen { animation: none !important; }
  }
</style>
