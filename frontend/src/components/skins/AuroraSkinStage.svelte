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

<!-- 极光背景流体色球（绝对定位铺满沉浸背景舞台） -->
<div
  class="absolute inset-0 pointer-events-none overflow-hidden z-0"
  aria-hidden="true"
>
  <!-- 色球 1：Dominant 色系漂移 -->
  <div
    class="aurora-orb orb-1 absolute -top-1/4 -left-1/4 w-[320px] h-[320px] md:w-[500px] md:h-[500px] rounded-full blur-[80px] md:blur-[100px] opacity-60 mix-blend-screen transition-colors duration-1000"
    style="background: var(--skin-dominant, #1e293b); animation-play-state: {playing ? 'running' : 'paused'};"
  ></div>

  <!-- 色球 2：Accent 色系漂移 -->
  <div
    class="aurora-orb orb-2 absolute top-1/3 -right-1/4 w-[280px] h-[280px] md:w-[440px] md:h-[440px] rounded-full blur-[70px] md:blur-[90px] opacity-55 mix-blend-screen transition-colors duration-1000"
    style="background: var(--skin-accent, #ef4444); animation-play-state: {playing ? 'running' : 'paused'};"
  ></div>

  <!-- 色球 3：Muted 色系（移动端隐藏以保障低端机帧率） -->
  <div
    class="aurora-orb orb-3 hidden md:block absolute -bottom-1/4 left-1/3 w-[380px] h-[380px] rounded-full blur-[90px] opacity-40 mix-blend-screen transition-colors duration-1000"
    style="background: var(--skin-muted, #94a3b8); animation-play-state: {playing ? 'running' : 'paused'};"
  ></div>
</div>

<div
  data-testid="skin-stage-aurora"
  class="relative z-10 flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[440px] w-full md:w-auto shrink-0 select-none"
>
  <!-- 现代流光圆角方形封面 -->
  <div class="relative w-[150px] h-[150px] md:w-[230px] md:h-[230px] flex items-center justify-center">
    <!-- 封面光晕层 -->
    <div
      class="absolute inset-2 rounded-3xl transition-all duration-700 pointer-events-none {playing ? 'scale-105 opacity-90' : 'scale-95 opacity-50'}"
      style="box-shadow: 0 0 60px var(--skin-glow, rgba(239, 68, 68, 0.45));"
    ></div>

    <div
      class="w-full h-full rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/20 bg-neutral-900 transition-transform duration-500 {playing ? 'scale-102' : 'scale-98'}"
    >
      <img
        src={formatCoverUrl(track?.cover, 400)}
        class="w-full h-full object-cover transition-all duration-700 {playing ? 'contrast-105' : 'brightness-90'}"
        alt={t('player.cover')}
        referrerpolicy="no-referrer"
        onerror={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER;
        }}
      />
    </div>
  </div>

  <!-- 歌曲元信息与快捷栏 -->
  <div class="flex flex-col items-center text-center max-w-[340px] w-full">
    <!-- 歌名 -->
    <h4 class="text-base md:text-lg font-bold text-[var(--text-main)] truncate max-w-full px-2" title={track?.name}>
      {track?.name || t('player.noTrackPlaying')}
    </h4>

    <!-- 歌手名 -->
    <div class="text-xs md:text-sm text-[var(--text-secondary)] truncate max-w-full mt-1 px-2" title={formatArtist(track?.artist)}>
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
  @keyframes drift1 {
    0% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(60px, 40px) scale(1.15); }
    100% { transform: translate(0, 0) scale(1); }
  }

  @keyframes drift2 {
    0% { transform: translate(0, 0) scale(1.1); }
    50% { transform: translate(-50px, -35px) scale(0.95); }
    100% { transform: translate(0, 0) scale(1.1); }
  }

  @keyframes drift3 {
    0% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(40px, -45px) scale(1.1); }
    100% { transform: translate(0, 0) scale(1); }
  }

  .orb-1 {
    animation: drift1 18s ease-in-out infinite;
    will-change: transform;
  }
  .orb-2 {
    animation: drift2 22s ease-in-out infinite;
    will-change: transform;
  }
  .orb-3 {
    animation: drift3 26s ease-in-out infinite;
    will-change: transform;
  }

  @media (prefers-reduced-motion: reduce) {
    .aurora-orb {
      animation: none !important;
    }
  }
</style>
