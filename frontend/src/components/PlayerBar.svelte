<script lang="ts">
  import type { Track } from '../lib/types';
  import PlayerBarDesktop from './PlayerBarDesktop.svelte';
  import PlayerBarMobile from './PlayerBarMobile.svelte';
  import { DEFAULT_VINYL_COVER } from '../lib/utils';

  let {
    curTrack,
    queue,
    playing,
    curTime,
    duration,
    playMode,
    vol = $bindable(0.85),
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
    vol: number;
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
    <div
      class="fixed right-[18px] bottom-[calc(16px+env(safe-area-inset-bottom,0px))] w-14 h-14 rounded-full bg-[rgba(15,23,42,0.94)] dark:bg-[rgba(15,23,42,0.94)] backdrop-blur-2xl shadow-[0_12px_32px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.15)] z-[9999] flex items-center justify-center cursor-pointer select-none transition-all duration-250 hover:scale-110 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(239,68,68,0.35)] active:scale-95 animate-[scaleUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)]"
      onclick={() => minimized = false}
      title="点击展开播放控制栏 (进度 {Math.round(progressRatio * 100)}%)"
    >
      <svg class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 54 54">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="100%" stop-color="#f97316" />
          </linearGradient>
        </defs>
        <circle class="fill-none stroke-white/10 stroke-[3]" cx="27" cy="27" r="23" />
        <circle
          class="fill-none stroke-[3] stroke-linecap-round transition-[stroke-dashoffset] duration-250 ease-out"
          cx="27"
          cy="27"
          r="23"
          stroke="url(#ringGrad)"
          stroke-dasharray="{RING_CIRCUMFERENCE}"
          stroke-dashoffset="{ringDashOffset}"
        />
      </svg>
      <div class="relative w-11 h-11 rounded-full overflow-hidden flex items-center justify-center shadow-[inset_0_0_0_2px_rgba(0,0,0,0.6)]">
        <img
          src={curTrack?.cover || DEFAULT_VINYL_COVER}
          alt="封面"
          class="w-full h-full rounded-full object-cover {playing ? 'animate-[spin_16s_linear_infinite]' : ''}"
          referrerpolicy="no-referrer"
          onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
        />
        <div class="absolute w-2 h-2 rounded-full bg-[#0f172a] border-2 border-white/80 shadow-[0_0_4px_rgba(0,0,0,0.8)]"></div>
      </div>
    </div>
  {:else}
    <!-- 🖥️ PC 桌面端 (宽屏显示) -->
    <div class="hidden md:block">
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
    <div class="block md:hidden">
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
