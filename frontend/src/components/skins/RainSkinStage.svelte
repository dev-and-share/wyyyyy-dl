<script lang="ts">
  import { formatArtist, DEFAULT_VINYL_COVER, formatCoverUrl } from '../../lib/utils';
  import type { SkinStageProps } from './skinTypes';
  import TrackQuickActions from '../TrackQuickActions.svelte';
  import { audioVisualizer } from '../../lib/player/audioVisualizer.svelte';
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

  // 低音水波涟漪扩散热度
  let rippleScale = $derived(playing ? 1 + audioVisualizer.bassEnergy * 0.22 : 1);
</script>

<div
  data-testid="skin-stage-rain"
  class="relative z-10 flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[440px] w-full md:w-auto shrink-0 select-none"
>
  <!-- 🌧️ 雨水镜面涟漪唱盘与冰蓝落针 -->
  <div class="relative w-[180px] h-[180px] md:w-[260px] md:h-[260px] flex items-center justify-center">
    <!-- 水晶触水唱臂 -->
    <div
      class="absolute -top-3 right-2 md:-top-4 md:right-4 z-20 pointer-events-none transition-transform duration-600 ease-[cubic-bezier(0.4,0,0.2,1)] origin-[18px_18px] md:origin-[24px_24px]"
      style="transform: rotate({playing ? '21deg' : '0deg'});"
      title="Raindrop Needle Arm"
    >
      <svg
        class="w-[70px] h-[100px] md:w-[95px] md:h-[135px] drop-shadow-md"
        viewBox="0 0 95 135"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="24" cy="24" r="14" fill="#0f2b48" stroke="#38bdf8" stroke-width="2" />
        <circle cx="24" cy="24" r="7" fill="#0369a1" />
        <path
          d="M24 24 L34 85 L28 115"
          stroke="url(#arm-rain-grad)"
          stroke-width="3.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <rect x="22" y="112" width="12" height="18" rx="2" fill="#38bdf8" stroke="#e0f2fe" stroke-width="1" />
        <!-- 晶莹水滴探针 -->
        <circle cx="28" cy="126" r="3.5" fill="#bae6fd" />

        <defs>
          <linearGradient id="arm-rain-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="30%" stop-color="#7dd3fc" />
            <stop offset="70%" stop-color="#38bdf8" />
            <stop offset="100%" stop-color="#0284c7" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <!-- 动态水波涟漪环绕层 (随真实重低音能量向外扩散) -->
    {#if playing}
      <div
        class="absolute inset-0 rounded-full border border-sky-400/40 pointer-events-none transition-transform duration-100 ease-out"
        style="transform: scale({rippleScale});"
      ></div>
      <div
        class="absolute -inset-4 rounded-full border border-sky-300/20 animate-ping opacity-60 pointer-events-none"
      ></div>
    {/if}

    <!-- 雨水镜面深邃唱片本体 -->
    <div
      class="w-[150px] h-[150px] md:w-[230px] md:h-[230px] rounded-full p-2 relative flex items-center justify-center shadow-[0_12px_36px_rgba(0,0,0,0.7),0_0_0_8px_rgba(56,189,248,0.25)] transition-all duration-300"
      style="background: radial-gradient(circle, #102a45 0%, #081726 65%, #030a12 100%);"
    >
      <!-- 唱片外圈伴随播放旋转的微润水光斑 -->
      <div class="absolute -inset-2 pointer-events-none {playing ? 'animate-[spin_25s_linear_infinite]' : ''}">
        <span class="absolute top-1 left-1/4 text-xs select-none opacity-80 drop-shadow-[0_2px_6px_rgba(56,189,248,0.8)]">💧</span>
        <span class="absolute bottom-2 right-1/4 text-[10px] select-none opacity-70 drop-shadow-[0_2px_6px_rgba(56,189,248,0.8)]">✨</span>
      </div>

      <!-- 中心专辑封面与水镜光泽 -->
      <div class="w-14 h-14 md:w-20 md:h-20 rounded-full border-2 border-sky-300/60 shadow-inner flex items-center justify-center relative overflow-hidden">
        <img
          src={formatCoverUrl(track?.cover, 120)}
          alt={t('player.cover')}
          class="w-full h-full object-cover {playing ? 'animate-[spin_16s_linear_infinite]' : ''}"
          referrerpolicy="no-referrer"
          onerror={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER;
          }}
        />
        <!-- 中心水波水银触点 -->
        <div class="absolute w-3.5 h-3.5 rounded-full bg-sky-200/90 border border-white/80 shadow-md"></div>
      </div>
    </div>
  </div>

  <!-- 歌曲元信息与快捷操作栏 (与其他皮肤完全一致的大气居中布局) -->
  <div class="flex flex-col items-center text-center max-w-[340px] w-full mt-1">
    <h4 class="text-base md:text-lg font-bold text-[var(--text-main)] truncate max-w-full px-2" title={track?.name}>
      {track?.name || t('player.noTrackPlaying')}
    </h4>
    <p class="text-xs md:text-sm text-[var(--text-secondary)] truncate max-w-full px-2 mt-0.5">
      {formatArtist(track?.artist)}
    </p>

    <div class="mt-2.5">
      <TrackQuickActions {track} {isLiked} {onToggleLike} {onOpenComments} {onAddToPlaylist} />
    </div>
  </div>
</div>
