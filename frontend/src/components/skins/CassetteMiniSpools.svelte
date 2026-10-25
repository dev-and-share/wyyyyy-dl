<script lang="ts">
  import { DEFAULT_VINYL_COVER, formatCoverUrl } from '../../lib/utils';
  import { calculateTapeRadii } from './cassetteHelper';

  let {
    cover = DEFAULT_VINYL_COVER,
    playing = false,
    progressRatio = 0,
    size = 'md',
    onclick
  } = $props<{
    cover?: string;
    playing?: boolean;
    progressRatio?: number;
    size?: 'sm' | 'md';
    onclick?: () => void;
  }>();

  let formattedCover = $derived(formatCoverUrl(cover, 100));
  let radii = $derived(calculateTapeRadii(progressRatio, size === 'sm' ? 6 : 8, size === 'sm' ? 14 : 18));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="relative shrink-0 flex items-center justify-between px-1.5 rounded-lg bg-[#0e1014] border border-white/15 shadow-inner cursor-pointer select-none transition-transform hover:scale-102 active:scale-97 {size === 'sm' ? 'w-16 h-10' : 'w-20 h-11'}"
  {onclick}
  title="点击展开全屏复古磁带随身听"
>
  <!-- 左轴轮 -->
  <div class="relative flex items-center justify-center">
    <div
      class="rounded-full bg-[#3b2416] border border-[#2b180d] transition-all duration-300"
      style="width: {radii.left * 2}px; height: {radii.left * 2}px;"
    ></div>
    <div
      class="absolute w-4 h-4 rounded-full bg-neutral-200 border border-neutral-400 flex items-center justify-center shadow-xs {playing ? 'animate-[spin_4s_linear_infinite]' : ''}"
    >
      <div class="w-1.5 h-1.5 rounded-full bg-neutral-900"></div>
    </div>
  </div>

  <!-- 中心迷你封面贴纸 -->
  <div class="w-4 h-4 rounded-xs overflow-hidden shadow-xs border border-white/20">
    <img
      src={formattedCover}
      alt="磁带标签"
      class="w-full h-full object-cover"
      referrerpolicy="no-referrer"
      onerror={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER;
      }}
    />
  </div>

  <!-- 右轴轮 -->
  <div class="relative flex items-center justify-center">
    <div
      class="rounded-full bg-[#3b2416] border border-[#2b180d] transition-all duration-300"
      style="width: {radii.right * 2}px; height: {radii.right * 2}px;"
    ></div>
    <div
      class="absolute w-4 h-4 rounded-full bg-neutral-200 border border-neutral-400 flex items-center justify-center shadow-xs {playing ? 'animate-[spin_4s_linear_infinite]' : ''}"
    >
      <div class="w-1.5 h-1.5 rounded-full bg-neutral-900"></div>
    </div>
  </div>
</div>
