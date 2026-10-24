<script lang="ts">
  import type { Track } from '../lib/types';
  import PlayerBarDesktop from './desktop/PlayerBarDesktop.svelte';
  import PlayerBarMobile from './sp/PlayerBarMobile.svelte';
  import { DEFAULT_VINYL_COVER, formatCoverUrl } from '../lib/utils';
  import { skin } from '../lib/skinStore.svelte';

  let {
    curTrack,
    queue,
    playing,
    curTime,
    duration,
    playMode,
    vol = $bindable(0.85),
    likedSet = new Set<number>(),
    onTogglePlay,
    onPrev,
    onNext,
    onToggleMode,
    onSeek,
    onLyric,
    onPeq,
    onQueue,
    onClearQueue,
    onToggleLike = () => {},
    minimized = $bindable(false)
  } = $props<{
    curTrack: Track | null;
    queue: Track[];
    playing: boolean;
    curTime: number;
    duration: number;
    playMode: 'list' | 'single' | 'shuffle';
    vol: number;
    likedSet?: Set<number>;
    minimized?: boolean;
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    onToggleMode: () => void;
    onSeek: (e: MouseEvent) => void;
    onLyric: () => void;
    onPeq: () => void;
    onQueue: () => void;
    onClearQueue: () => void;
    onToggleLike?: () => void;
  }>();

  // 环形进度计算 (半径 r=23, 周长 2*pi*23 ≈ 144.513)
  const RING_CIRCUMFERENCE = 144.513;
  let progressRatio = $derived(duration > 0 ? Math.min(1, Math.max(0, curTime / duration)) : 0);
  let ringDashOffset = $derived(RING_CIRCUMFERENCE * (1 - progressRatio));

  // 同步当前播放曲目封面颜色到皮肤调色板
  $effect(() => {
    skin.updatePalette(curTrack?.cover);
  });
</script>

{#if queue.length > 0 && curTrack}
  {#if minimized}
    <!-- 💽 最小化悬浮窗：根据当前皮肤适配外观 (PC & SP 通用) -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="player-minimized-bubble fixed right-[18px] cursor-pointer select-none transition-all duration-250 hover:scale-110 hover:-translate-y-0.5 active:scale-95 animate-[scaleUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)] z-[9999]"
      style="{skin.cssVars}"
      onclick={() => minimized = false}
      title="点击展开播放器 ({skin.current} 皮肤模式, 进度 {Math.round(progressRatio * 100)}%)"
    >
      {#if skin.current === 'winamp'}
        <!-- Winamp 迷你机箱挂件 -->
        <div class="w-15 h-13 rounded-md bg-gradient-to-b from-[#343b47] to-[#1c1f26] border-2 border-white/30 shadow-2xl p-1 flex flex-col justify-between items-center">
          <div class="w-full flex items-center justify-between px-0.5">
            <span class="text-amber-400 text-[10px] font-bold">⚡</span>
            <span class="text-[8px] font-mono font-bold text-emerald-400">{Math.round(progressRatio * 100)}%</span>
          </div>
          <div class="w-7 h-7 rounded-xs overflow-hidden border border-white/20 shadow-xs">
            <img src={formatCoverUrl(curTrack?.cover, 60)} alt="封面" class="w-full h-full object-cover" />
          </div>
          <div class="w-full h-1 bg-[#0b140d] rounded-xs overflow-hidden">
            <div class="h-full bg-emerald-500" style="width: {progressRatio * 100}%;"></div>
          </div>
        </div>
      {:else if skin.current === 'cassette'}
        <!-- 复古磁带微型卡夹 -->
        <div class="w-16 h-11 rounded-lg bg-[#181a1f] border border-white/20 shadow-2xl p-1 flex items-center justify-around">
          <div class="w-4 h-4 rounded-full bg-[#3b2416] border border-neutral-600 flex items-center justify-center">
            <div class="w-2 h-2 rounded-full bg-white {playing ? 'animate-[spin_4s_linear_infinite]' : ''}"></div>
          </div>
          <div class="w-5 h-5 rounded overflow-hidden border border-white/30">
            <img src={formatCoverUrl(curTrack?.cover, 60)} alt="封面" class="w-full h-full object-cover" />
          </div>
          <div class="w-4 h-4 rounded-full bg-[#3b2416] border border-neutral-600 flex items-center justify-center">
            <div class="w-2 h-2 rounded-full bg-white {playing ? 'animate-[spin_4s_linear_infinite]' : ''}"></div>
          </div>
        </div>
      {:else if skin.current === 'aurora'}
        <!-- 灵动极光呼吸发光晶球 -->
        <div
          class="w-14 h-14 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/30 p-1 flex items-center justify-center shadow-2xl"
          style="box-shadow: 0 0 24px var(--skin-glow, rgba(239, 68, 68, 0.45));"
        >
          <div class="w-11 h-11 rounded-xl overflow-hidden shadow-inner">
            <img src={formatCoverUrl(curTrack?.cover, 80)} alt="封面" class="w-full h-full object-cover {playing ? 'scale-105' : ''}" />
          </div>
        </div>
      {:else}
        <!-- 经典黑胶环形进度微型球 -->
        <div class="w-14 h-14 rounded-full bg-[rgba(15,23,42,0.94)] backdrop-blur-2xl shadow-[0_12px_32px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.15)] flex items-center justify-center">
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
      {/if}
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
        {likedSet}
        {onTogglePlay}
        {onPrev}
        {onNext}
        {onToggleMode}
        {onSeek}
        {onLyric}
        {onPeq}
        {onQueue}
        {onToggleLike}
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
        {likedSet}
        {onTogglePlay}
        {onPrev}
        {onNext}
        {onToggleMode}
        {onSeek}
        {onLyric}
        {onPeq}
        {onQueue}
        {onToggleLike}
        onMinimize={() => minimized = true}
      />
    </div>
  {/if}
{/if}
