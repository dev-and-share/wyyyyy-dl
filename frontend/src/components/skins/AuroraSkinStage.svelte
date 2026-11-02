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

<!-- Aurora 皮肤：色球效果已提升到 LyricModal 全屏层，此处仅渲染封面内容 -->
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
  /* Aurora 皮肤的 orb 动画已移至 LyricModal，此处保留 scale 工具类 */
  .scale-102 { transform: scale(1.02); }
  .scale-98  { transform: scale(0.98); }
</style>
