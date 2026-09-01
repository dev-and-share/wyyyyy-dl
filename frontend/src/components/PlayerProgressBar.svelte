<script lang="ts">
  import { formatTime } from '../lib/utils';

  let {
    curTime = 0,
    duration = 0,
    progressRatio = 0,
    onSeek
  } = $props<{
    curTime: number;
    duration: number;
    progressRatio: number;
    onSeek: (e: MouseEvent) => void;
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
  <span class="text-[11px] font-mono tabular-nums text-[var(--text-muted)] min-w-[36px] text-center shrink-0">
    {formatTime(curTime)}
  </span>
  <div
    class="group relative flex-1 h-4 flex items-center cursor-pointer"
    onclick={onSeek}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
  >
    <!-- 背景轨 -->
    <div class="w-full h-1 group-hover:h-1.5 bg-black/10 dark:bg-white/15 rounded-full transition-all duration-150"></div>
    <!-- 播放进度填充 -->
    <div
      class="absolute left-0 h-1 group-hover:h-1.5 bg-gradient-to-r from-red-500 to-amber-500 rounded-full transition-all duration-75 pointer-events-none"
      style="width: {progressRatio * 100}%;"
    ></div>
    <!-- 拖拽/悬浮滑块手柄 -->
    <div
      class="absolute w-2.5 h-2.5 -ml-1 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-125 transition-all duration-150 pointer-events-none"
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
  <span class="text-[11px] font-mono tabular-nums text-[var(--text-muted)] min-w-[36px] text-center shrink-0">
    {formatTime(duration)}
  </span>
</div>
