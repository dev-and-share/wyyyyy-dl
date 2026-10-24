<script lang="ts">
  import { formatArtist, DEFAULT_VINYL_COVER, formatCoverUrl } from '../../lib/utils';
  import type { SkinStageProps } from './skinTypes';
  import TrackQuickActions from '../TrackQuickActions.svelte';

  let {
    track,
    playing,
    currentTime,
    duration,
    palette,
    isLiked = false,
    onToggleLike = () => {},
    onOpenComments = () => {},
    onAddToPlaylist = () => {}
  }: SkinStageProps = $props();
</script>

<div
  data-testid="skin-stage-vinyl"
  class="flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[440px] w-full md:w-auto shrink-0 select-none relative"
>
  <!-- 黑胶转盘容器（含唱臂） -->
  <div class="relative w-[180px] h-[180px] md:w-[260px] md:h-[260px] flex items-center justify-center">
    <!-- 唱臂装置（右上角枢轴） -->
    <div
      class="absolute -top-3 right-2 md:-top-4 md:right-4 z-20 pointer-events-none transition-transform duration-600 ease-[cubic-bezier(0.4,0,0.2,1)] origin-[18px_18px] md:origin-[24px_24px]"
      style="transform: rotate({playing ? '21deg' : '0deg'});"
      title="黑胶唱臂"
    >
      <svg
        class="w-[70px] h-[100px] md:w-[95px] md:h-[135px] drop-shadow-md"
        viewBox="0 0 95 135"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- 唱臂基座 -->
        <circle cx="24" cy="24" r="14" fill="#334155" stroke="#64748b" stroke-width="2" />
        <circle cx="24" cy="24" r="7" fill="#0f172a" />
        <!-- 唱臂杆（金属银质感渐变） -->
        <path
          d="M24 24 L34 85 L28 115"
          stroke="url(#arm-metal-grad)"
          stroke-width="3.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <!-- 唱头/唱针 -->
        <rect x="22" y="112" width="12" height="18" rx="2" fill="#e11d48" stroke="#f43f5e" stroke-width="1" />
        <circle cx="28" cy="126" r="1.5" fill="#f8fafc" />

        <defs>
          <linearGradient id="arm-metal-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#cbd5e1" />
            <stop offset="50%" stop-color="#94a3b8" />
            <stop offset="100%" stop-color="#e2e8f0" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <!-- 黑胶唱片本体（同心圆沟槽 + 旋转中心封面） -->
    <div
      class="w-[150px] h-[150px] md:w-[230px] md:h-[230px] rounded-full p-2 relative flex items-center justify-center bg-[#0a0d14] shadow-[var(--immersive-ring-shadow)] transition-all duration-300"
      style="background: radial-gradient(circle, #1a202c 0%, #0d1117 55%, #05070a 100%);"
    >
      <!-- 唱片同心圆声槽细纹（内衬层） -->
      <div
        class="absolute inset-1.5 rounded-full pointer-events-none opacity-40"
        style="background: repeating-radial-gradient(circle, transparent 0px, transparent 2px, rgba(255,255,255,0.06) 3px, transparent 4px);"
      ></div>

      <!-- 唱片静态反光高光层（不随旋转） -->
      <div
        class="absolute inset-0 rounded-full pointer-events-none opacity-25"
        style="background: conic-gradient(from 45deg, transparent 0deg, rgba(255,255,255,0.3) 45deg, transparent 90deg, transparent 180deg, rgba(255,255,255,0.3) 225deg, transparent 270deg);"
      ></div>

      <!-- 中心圆标旋转封面 -->
      <div
        class="w-[90px] h-[90px] md:w-[136px] md:h-[136px] rounded-full overflow-hidden p-1 bg-[#1e293b] ring-2 ring-black/40 shadow-inner flex items-center justify-center z-10"
      >
        <img
          src={formatCoverUrl(track?.cover, 400)}
          class="w-full h-full rounded-full object-cover shadow-inner {playing ? 'animate-[spin_20s_linear_infinite]' : ''}"
          alt="黑胶封面"
          referrerpolicy="no-referrer"
          onerror={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER;
          }}
        />
      </div>

      <!-- 中心转轴微孔 -->
      <div class="absolute w-3.5 h-3.5 rounded-full bg-neutral-900 border border-neutral-700/80 z-20 shadow-sm pointer-events-none"></div>
    </div>
  </div>

  <!-- 歌曲元信息与快捷栏 -->
  <div class="flex flex-col items-center text-center max-w-[340px] w-full">
    <!-- 歌名 -->
    <h4 class="text-base md:text-lg font-bold text-[var(--text-main)] truncate max-w-full px-2" title={track?.name}>
      {track?.name || '未在播放'}
    </h4>

    <!-- 歌手名 -->
    <div class="text-xs md:text-sm text-[var(--text-secondary)] truncate max-w-full mt-1 px-2" title={formatArtist(track?.artist)}>
      {formatArtist(track?.artist) || '未知歌手'}
    </div>

    <!-- PC 宽屏专属（hidden md:flex）：歌名下方横排 -->
    <div class="hidden md:flex mt-3">
      <TrackQuickActions
        {track}
        {isLiked}
        layout="row"
        {onToggleLike}
        {onOpenComments}
        {onAddToPlaylist}
      />
    </div>
  </div>
</div>
