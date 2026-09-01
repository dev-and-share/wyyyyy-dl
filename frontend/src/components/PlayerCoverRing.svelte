<script lang="ts">
  import { DEFAULT_VINYL_COVER } from '../lib/utils';

  let {
    cover = DEFAULT_VINYL_COVER,
    playing = false,
    ringDashOffset = 0,
    size = 'md',
    onclick
  } = $props<{
    cover?: string;
    playing?: boolean;
    ringDashOffset?: number;
    size?: 'sm' | 'md';
    onclick?: () => void;
  }>();

  const RING_CIRCUMFERENCE = 144.513;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="relative shrink-0 flex items-center justify-center cursor-pointer select-none {size === 'sm' ? 'w-11 h-11' : 'w-11.5 h-11.5'}"
  {onclick}
  title="点击展开全屏歌词与大黑胶"
>
  <svg class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none rounded-full" viewBox="0 0 50 50">
    <circle class="fill-none stroke-black/5 dark:stroke-white/10" stroke-width="2.5" cx="25" cy="25" r="23" />
    <circle
      class="fill-none transition-[stroke-dashoffset] duration-200 ease-linear"
      stroke-width="2.5"
      stroke-linecap="round"
      cx="25"
      cy="25"
      r="23"
      stroke="url(#playerCoverRingGrad)"
      stroke-dasharray="{RING_CIRCUMFERENCE}"
      stroke-dashoffset="{ringDashOffset}"
    />
    <defs>
      <linearGradient id="playerCoverRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ef4444" />
        <stop offset="100%" stop-color="#f97316" />
      </linearGradient>
    </defs>
  </svg>
  <img
    src={cover || DEFAULT_VINYL_COVER}
    alt="封面"
    class="rounded-full object-cover shadow-sm transition-transform duration-300 {size === 'sm' ? 'w-9.5 h-9.5' : 'w-10 h-10'} {playing ? 'animate-[spin_16s_linear_infinite]' : ''}"
    referrerpolicy="no-referrer"
    onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
  />
</div>
