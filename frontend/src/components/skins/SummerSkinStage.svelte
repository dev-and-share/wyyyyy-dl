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
  data-testid="skin-stage-summer"
  class="relative z-10 flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[440px] w-full md:w-auto shrink-0 select-none"
>
  <!-- 向日葵花盘唱机与藤蔓唱臂 -->
  <div class="relative w-[180px] h-[180px] md:w-[260px] md:h-[260px] flex items-center justify-center">
    <!-- 蔚蓝晴空向日葵唱臂 -->
    <div
      class="absolute -top-3 right-2 md:-top-4 md:right-4 z-20 pointer-events-none transition-transform duration-600 ease-[cubic-bezier(0.4,0,0.2,1)] origin-[18px_18px] md:origin-[24px_24px]"
      style="transform: rotate({playing ? '21deg' : '0deg'});"
      title="Summer Azure Tonearm"
    >
      <svg
        class="w-[70px] h-[100px] md:w-[95px] md:h-[135px] drop-shadow-md"
        viewBox="0 0 95 135"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="24" cy="24" r="14" fill="#0369a1" stroke="#38bdf8" stroke-width="2" />
        <circle cx="24" cy="24" r="7" fill="#0c4a6e" />
        <path
          d="M24 24 C28 45 22 75 34 85 L28 115"
          stroke="url(#arm-summer-grad)"
          stroke-width="3.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <!-- 晴空飞蝶小叶饰 -->
        <path d="M26 55 Q35 50 32 60 Z" fill="#38bdf8" />
        <rect x="22" y="112" width="12" height="18" rx="2" fill="#0284c7" stroke="#38bdf8" stroke-width="1" />
        <circle cx="28" cy="126" r="2" fill="#facc15" />

        <defs>
          <linearGradient id="arm-summer-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#bae6fd" />
            <stop offset="45%" stop-color="#38bdf8" />
            <stop offset="80%" stop-color="#0284c7" />
            <stop offset="100%" stop-color="#facc15" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <!-- 盛夏蔚蓝与向日葵花瓣唱片本体 -->
    <div
      class="w-[150px] h-[150px] md:w-[230px] md:h-[230px] rounded-full p-2 relative flex items-center justify-center shadow-[0_12px_36px_rgba(0,0,0,0.6),0_0_0_8px_rgba(56,189,248,0.35)] transition-all duration-300"
      style="background: radial-gradient(circle, #0ea5e9 0%, #0284c7 45%, #073860 100%);"
    >
      <!-- 环绕蔚蓝唱盘起舞的夏蝶与向日葵金光 -->
      <div class="absolute -inset-3 pointer-events-none {playing ? 'animate-[spin_32s_linear_infinite]' : ''}">
        <span class="absolute -top-1 left-1/3 text-xs select-none opacity-90 drop-shadow-[0_2px_8px_rgba(56,189,248,0.7)] rotate-12">🦋</span>
        <span class="absolute bottom-1 right-1/3 text-[10px] select-none opacity-80 drop-shadow-[0_2px_6px_rgba(250,204,21,0.7)] -rotate-45">🌻</span>
      </div>

      <!-- 晴空蔚蓝与向日葵金相间同心声槽 -->
      <div
        class="absolute -inset-1 rounded-full pointer-events-none opacity-30 {playing ? 'animate-[spin_40s_linear_infinite]' : ''}"
        style="background: repeating-conic-gradient(from 0deg, #38bdf8 0deg 8deg, transparent 8deg 15deg, #facc15 15deg 18deg, transparent 18deg 30deg);"
      ></div>

      <!-- 中心旋转封面 -->
      <div
        class="w-[90px] h-[90px] md:w-[136px] md:h-[136px] rounded-full overflow-hidden p-1 bg-[#082f49] ring-2 ring-sky-400/60 shadow-inner flex items-center justify-center z-10"
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

      <div class="absolute w-3.5 h-3.5 rounded-full bg-sky-950 border border-sky-400/90 z-20 shadow-sm pointer-events-none"></div>
    </div>
  </div>

  <!-- 歌曲元信息与快捷栏 -->
  <div class="flex flex-col items-center text-center max-w-[340px] w-full">
    <h4 class="text-base md:text-lg font-bold text-sky-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.4)] truncate max-w-full px-2" title={track?.name}>
      {track?.name || t('player.noTrackPlaying')}
    </h4>
    <div class="text-xs md:text-sm text-sky-200/80 truncate max-w-full mt-1 px-2" title={formatArtist(track?.artist)}>
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
