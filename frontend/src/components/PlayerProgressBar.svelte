<script lang="ts">
  import { formatTime } from '../lib/utils';

  let {
    curTime = 0,
    duration = 0,
    progressRatio = 0,
    onSeek,
    skinId = 'vinyl'
  } = $props<{
    curTime: number;
    duration: number;
    progressRatio: number;
    onSeek: (e: MouseEvent) => void;
    skinId?: string;
  }>();

  let hoverRatio = $state<number | null>(null);
  let hoverTime = $derived(hoverRatio !== null && duration > 0 ? hoverRatio * duration : 0);

  function handleMouseMove(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (rect.width > 0) {
      hoverRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    }
  }

  function handleMouseLeave() {
    hoverRatio = null;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="flex items-center gap-2.5 w-full select-none">
  <!-- 当前播放时间 -->
  <span
    class="text-[11px] font-mono tabular-nums min-w-[36px] text-center shrink-0 {skinId === 'winamp' || skinId === 'cassette'
      ? 'text-[#10b981] font-bold drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]'
      : skinId === 'aurora'
        ? 'text-[var(--skin-accent,#ef4444)] font-medium'
        : skinId === 'spring'
          ? 'text-emerald-400 font-medium'
          : 'text-[var(--text-muted)]'}"
  >
    {formatTime(curTime)}
  </span>

  <div
    class="group relative flex-1 h-4 flex items-center cursor-pointer"
    onclick={onSeek}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
  >
    <!-- 背景轨 -->
    <div
      class="w-full h-1 group-hover:h-1.5 rounded-full transition-all duration-150 {skinId === 'winamp'
        ? 'bg-[#0b140d] border border-[#1b3d22]'
        : skinId === 'cassette'
          ? 'bg-[#15171c] border border-white/10'
          : skinId === 'spring'
            ? 'bg-emerald-950/60 border border-emerald-500/20'
            : 'bg-black/10 dark:bg-white/15'}"
    ></div>

    <!-- 播放进度填充 -->
    <div
      class="absolute left-0 h-1 group-hover:h-1.5 rounded-full transition-all duration-75 pointer-events-none {skinId === 'winamp'
        ? 'bg-gradient-to-r from-emerald-600 to-[#10b981]'
        : skinId === 'aurora'
          ? 'bg-gradient-to-r from-[var(--skin-dominant,#8b5cf6)] to-[var(--skin-accent,#ef4444)] shadow-[0_0_8px_var(--skin-glow,rgba(239,68,68,0.5))]'
          : skinId === 'cassette'
            ? 'bg-gradient-to-r from-amber-700 to-emerald-500'
            : skinId === 'spring'
              ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
              : 'bg-gradient-to-r from-red-500 to-amber-500'}"
      style="width: {progressRatio * 100}%;"
    ></div>

    <!-- 拖拽/悬浮滑块手柄 -->
    <div
      class="absolute w-2.5 h-2.5 -ml-1 rounded-full shadow-md scale-90 group-hover:scale-125 transition-all duration-150 pointer-events-none {skinId === 'winamp'
        ? 'rounded-xs w-2 h-3.5 -ml-1 bg-neutral-300 border border-neutral-700 opacity-90'
        : 'bg-white opacity-0 group-hover:opacity-100'}"
      style="left: {progressRatio * 100}%;"
    ></div>

    <!-- 🖱️ PC 端 Hover 时间预览气泡 -->
    {#if hoverRatio !== null && duration > 0}
      <div
        class="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-[rgba(15,23,42,0.95)] text-white text-[10px] font-mono shadow-xl border border-white/15 pointer-events-none transition-opacity duration-150 select-none"
        style="left: {hoverRatio * 100}%;"
      >
        {formatTime(hoverTime)}
      </div>
    {/if}
  </div>

  <!-- 总时长 -->
  <span
    class="text-[11px] font-mono tabular-nums min-w-[36px] text-center shrink-0 {skinId === 'winamp' || skinId === 'cassette'
      ? 'text-[#10b981]/70 font-bold'
      : skinId === 'aurora'
        ? 'text-[var(--skin-accent,#ef4444)]/80 font-medium'
        : skinId === 'spring'
          ? 'text-emerald-400/80 font-medium'
          : 'text-[var(--text-muted)]'}"
  >
    {formatTime(duration)}
  </span>
</div>
