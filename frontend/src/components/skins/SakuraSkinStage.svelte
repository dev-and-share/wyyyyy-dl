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

<div
  data-testid="skin-stage-sakura"
  class="relative z-10 flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[440px] w-full md:w-auto shrink-0 select-none"
>
  <!-- 春樱和纸唱盘与落针 -->
  <div class="relative w-[180px] h-[180px] md:w-[260px] md:h-[260px] flex items-center justify-center">
    <!-- 樱枝淡金唱臂 -->
    <div
      class="absolute -top-3 right-2 md:-top-4 md:right-4 z-20 pointer-events-none transition-transform duration-600 ease-[cubic-bezier(0.4,0,0.2,1)] origin-[18px_18px] md:origin-[24px_24px]"
      style="transform: rotate({playing ? '21deg' : '0deg'});"
      title="Sakura Tonearm"
    >
      <svg
        class="w-[70px] h-[100px] md:w-[95px] md:h-[135px] drop-shadow-md"
        viewBox="0 0 95 135"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="24" cy="24" r="14" fill="#831843" stroke="#ff4081" stroke-width="2" />
        <circle cx="24" cy="24" r="7" fill="#500724" />
        <path
          d="M24 24 L34 85 L28 115"
          stroke="url(#arm-sakura-grad)"
          stroke-width="3.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <rect x="22" y="112" width="12" height="18" rx="2" fill="#ff4081" stroke="#ffe4e6" stroke-width="1" />
        <circle cx="28" cy="126" r="2" fill="#ffffff" />

        <defs>
          <linearGradient id="arm-sakura-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="35%" stop-color="#ffb6c1" />
            <stop offset="70%" stop-color="#ff4081" />
            <stop offset="100%" stop-color="#f43f5e" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <!-- 樱花和纸唱片本体 (更粉嫩优雅的夜樱底色) -->
    <div
      class="w-[150px] h-[150px] md:w-[230px] md:h-[230px] rounded-full p-2 relative flex items-center justify-center shadow-[0_12px_36px_rgba(0,0,0,0.6),0_0_0_8px_rgba(255,64,129,0.32)] transition-all duration-300"
      style="background: radial-gradient(circle, #5b1339 0%, #380b23 60%, #1a0410 100%);"
    >
      <!-- 唱盘外圈随音乐起伏环绕的落樱花瓣 -->
      <div class="absolute -inset-3 pointer-events-none {playing ? 'animate-[spin_25s_linear_infinite]' : ''}">
        <span class="absolute top-0 left-1/4 text-xs select-none opacity-85 drop-shadow-[0_2px_6px_rgba(255,64,129,0.6)] rotate-12">🌸</span>
        <span class="absolute bottom-2 right-1/4 text-[10px] select-none opacity-75 drop-shadow-[0_2px_6px_rgba(255,64,129,0.6)] -rotate-45">🌸</span>
        <span class="absolute top-1/2 -right-1 text-[11px] select-none opacity-65 drop-shadow-[0_2px_6px_rgba(255,64,129,0.6)] rotate-90">🌸</span>
      </div>

      <!-- 和纸同心粉金声槽 -->
      <div
        class="absolute inset-1.5 rounded-full pointer-events-none opacity-45"
        style="background: repeating-radial-gradient(circle, transparent 0px, transparent 2px, rgba(255,105,180,0.25) 3px, transparent 4px);"
      ></div>

      <!-- 中心旋转封面 -->
      <div
        class="w-[90px] h-[90px] md:w-[136px] md:h-[136px] rounded-full overflow-hidden p-1 bg-[#290412] ring-2 ring-pink-400/60 shadow-inner flex items-center justify-center z-10"
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

      <div class="absolute w-3.5 h-3.5 rounded-full bg-pink-950 border border-pink-400/80 z-20 shadow-sm pointer-events-none"></div>
    </div>
  </div>

  <!-- 歌曲元信息与快捷栏 -->
  <div class="flex flex-col items-center text-center max-w-[340px] w-full">
    <h4 class="text-base md:text-lg font-bold text-pink-300 drop-shadow-[0_0_10px_rgba(255,64,129,0.4)] truncate max-w-full px-2" title={track?.name}>
      {track?.name || t('player.noTrackPlaying')}
    </h4>
    <div class="text-xs md:text-sm text-pink-200/90 truncate max-w-full mt-1 px-2" title={formatArtist(track?.artist)}>
      {formatArtist(track?.artist) || t('player.unknownArtist')}
    </div>

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
