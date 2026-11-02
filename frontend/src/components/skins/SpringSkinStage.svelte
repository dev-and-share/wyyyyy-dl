<script lang="ts">
  import { formatArtist, DEFAULT_VINYL_COVER, formatCoverUrl } from '../../lib/utils';
  import type { SkinStageProps } from './skinTypes';
  import TrackQuickActions from '../TrackQuickActions.svelte';
  import { t } from '../../lib/i18n/index.svelte';

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

<!-- Spring 皮肤：色球效果已提升到 LyricModal 全屏层，此处仅渲染唱盘内容 -->
<div
  data-testid="skin-stage-spring"
  class="relative z-10 flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[440px] w-full md:w-auto shrink-0 select-none"
>
  <!-- 翡翠竹韵唱盘与落针 -->
  <div class="relative w-[180px] h-[180px] md:w-[260px] md:h-[260px] flex items-center justify-center">
    <!-- 春竹唱臂 -->
    <div
      class="absolute -top-3 right-2 md:-top-4 md:right-4 z-20 pointer-events-none transition-transform duration-600 ease-[cubic-bezier(0.4,0,0.2,1)] origin-[18px_18px] md:origin-[24px_24px]"
      style="transform: rotate({playing ? '21deg' : '0deg'});"
      title="Bamboo Tonearm"
    >
      <svg
        class="w-[70px] h-[100px] md:w-[95px] md:h-[135px] drop-shadow-md"
        viewBox="0 0 95 135"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="24" cy="24" r="14" fill="#064e3b" stroke="#10b981" stroke-width="2" />
        <circle cx="24" cy="24" r="7" fill="#022c22" />
        <path
          d="M24 24 L34 85 L28 115"
          stroke="url(#arm-bamboo-grad)"
          stroke-width="3.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <rect x="22" y="112" width="12" height="18" rx="2" fill="#10b981" stroke="#34d399" stroke-width="1" />
        <circle cx="28" cy="126" r="1.5" fill="#ecfdf5" />

        <defs>
          <linearGradient id="arm-bamboo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#34d399" />
            <stop offset="50%" stop-color="#059669" />
            <stop offset="100%" stop-color="#10b981" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <!-- 翡翠唱片本体 -->
    <div
      class="w-[150px] h-[150px] md:w-[230px] md:h-[230px] rounded-full p-2 relative flex items-center justify-center shadow-[0_12px_36px_rgba(0,0,0,0.6),0_0_0_8px_rgba(52,211,153,0.18)] transition-all duration-300"
      style="background: radial-gradient(circle, #064e3b 0%, #022c22 60%, #011a14 100%);"
    >
      <!-- 翡翠同心圆声槽细纹 -->
      <div
        class="absolute inset-1.5 rounded-full pointer-events-none opacity-40"
        style="background: repeating-radial-gradient(circle, transparent 0px, transparent 2px, rgba(52,211,153,0.15) 3px, transparent 4px);"
      ></div>

      <!-- 中心旋转封面 -->
      <div
        class="w-[90px] h-[90px] md:w-[136px] md:h-[136px] rounded-full overflow-hidden p-1 bg-[#022c22] ring-2 ring-emerald-500/40 shadow-inner flex items-center justify-center z-10"
      >
        <img
          src={formatCoverUrl(track?.cover, 400)}
          class="w-full h-full rounded-full object-cover shadow-inner {playing ? 'animate-[spin_20s_linear_infinite]' : ''}"
          alt={t('player.cover')}
          referrerpolicy="no-referrer"
          onerror={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER;
          }}
        />
      </div>

      <div class="absolute w-3.5 h-3.5 rounded-full bg-emerald-950 border border-emerald-500/80 z-20 shadow-sm pointer-events-none"></div>
    </div>
  </div>

  <!-- 歌曲元信息与快捷栏 -->
  <div class="flex flex-col items-center text-center max-w-[340px] w-full">
    <!-- 歌名 -->
    <h4 class="text-base md:text-lg font-bold text-emerald-400 truncate max-w-full px-2" title={track?.name}>
      {track?.name || t('player.noTrackPlaying')}
    </h4>

    <!-- 歌手名 -->
    <div class="text-xs md:text-sm text-emerald-300/80 truncate max-w-full mt-1 px-2" title={formatArtist(track?.artist)}>
      {formatArtist(track?.artist) || t('player.unknownArtist')}
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

<style>
  /* Spring 皮肤粒子动画已移至 LyricModal 全屏色球层 */
</style>
