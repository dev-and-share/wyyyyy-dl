<script lang="ts">
  import { DEFAULT_VINYL_COVER } from '../lib/utils';
  import type { Track } from '../lib/types';
  import PlayerBarDesktop from './PlayerBarDesktop.svelte';
  import PlayerBarMobile from './PlayerBarMobile.svelte';

  let {
    curTrack,
    queue = [],
    playing = false,
    curTime = 0,
    duration = 0,
    playMode = 'list',
    vol = $bindable(0.8),
    onTogglePlay,
    onPrev,
    onNext,
    onToggleMode,
    onSeek,
    onLyric,
    onPeq,
    onQueue,
    onClearQueue
  } = $props<{
    curTrack: Track | null;
    queue: Track[];
    playing: boolean;
    curTime: number;
    duration: number;
    playMode: 'list' | 'single' | 'shuffle';
    vol?: number;
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    onToggleMode: () => void;
    onSeek: (e: MouseEvent) => void;
    onLyric: () => void;
    onPeq: () => void;
    onQueue: () => void;
    onClearQueue: () => void;
  }>();

  let minimized = $state(false);

  // 环形进度计算 (半径 r=23, 周长 2*pi*23 ≈ 144.513)
  const RING_CIRCUMFERENCE = 144.513;
  let progressRatio = $derived(duration > 0 ? Math.min(1, Math.max(0, curTime / duration)) : 0);
  let ringDashOffset = $derived(RING_CIRCUMFERENCE * (1 - progressRatio));
</script>

{#if queue.length > 0 && curTrack}
  {#if minimized}
    <!-- 💽 最小化：微型黑胶悬浮球 + 环形进度光圈 (PC & SP 通用) -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="floating-vinyl-bubble" onclick={() => minimized = false} title="点击展开播放控制栏 (进度 {Math.round(progressRatio * 100)}%)">
      <svg class="vinyl-progress-ring" viewBox="0 0 54 54">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="100%" stop-color="#f97316" />
          </linearGradient>
        </defs>
        <circle class="ring-bg" cx="27" cy="27" r="23" />
        <circle
          class="ring-progress"
          cx="27"
          cy="27"
          r="23"
          stroke="url(#ringGrad)"
          stroke-dasharray="{RING_CIRCUMFERENCE}"
          stroke-dashoffset="{ringDashOffset}"
        />
      </svg>
      <div class="bubble-vinyl-wrapper">
        <img
          src={curTrack?.cover || DEFAULT_VINYL_COVER}
          alt="封面"
          class="bubble-vinyl-cover"
          class:playing={playing}
          referrerpolicy="no-referrer"
          onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
        />
        <div class="bubble-center-dot"></div>
      </div>
    </div>
  {:else}
    <!-- 🖥️ PC 桌面端 (宽屏显示) -->
    <div class="desktop-wrapper">
      <PlayerBarDesktop
        {curTrack}
        {queue}
        {playing}
        {curTime}
        {duration}
        {playMode}
        bind:vol
        {progressRatio}
        {ringDashOffset}
        {onTogglePlay}
        {onPrev}
        {onNext}
        {onToggleMode}
        {onSeek}
        {onLyric}
        {onPeq}
        {onQueue}
        onMinimize={() => minimized = true}
      />
    </div>

    <!-- 📱 SP 移动端 (窄屏显示) -->
    <div class="mobile-wrapper">
      <PlayerBarMobile
        {curTrack}
        {queue}
        {playing}
        {curTime}
        {duration}
        {playMode}
        bind:vol
        {progressRatio}
        {ringDashOffset}
        {onTogglePlay}
        {onPrev}
        {onNext}
        {onToggleMode}
        {onSeek}
        {onLyric}
        {onPeq}
        {onQueue}
        onMinimize={() => minimized = true}
      />
    </div>
  {/if}
{/if}

<style>
  .floating-vinyl-bubble {
    position: fixed;
    right: 18px;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(15, 23, 42, 0.94);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.15);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
    animation: bubblePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .floating-vinyl-bubble:hover {
    transform: scale(1.1) translateY(-2px);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(239, 68, 68, 0.35);
  }

  .floating-vinyl-bubble:active {
    transform: scale(0.95);
  }

  @keyframes bubblePop {
    from { transform: scale(0.4) translateY(20px); opacity: 0; }
    to   { transform: scale(1) translateY(0); opacity: 1; }
  }

  .vinyl-progress-ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
    pointer-events: none;
  }

  .ring-bg {
    fill: none;
    stroke: rgba(255, 255, 255, 0.1);
    stroke-width: 3;
  }

  .ring-progress {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.25s ease;
  }

  .bubble-vinyl-wrapper {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.6);
  }

  .bubble-vinyl-cover {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .bubble-vinyl-cover.playing {
    animation: spinVinyl 16s linear infinite;
  }

  .bubble-center-dot {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #0f172a;
    border: 2px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
  }

  @keyframes spinVinyl {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  @media (min-width: 769px) {
    .desktop-wrapper {
      display: block;
    }
    .mobile-wrapper {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .desktop-wrapper {
      display: none;
    }
    .mobile-wrapper {
      display: block;
    }
  }
</style>
