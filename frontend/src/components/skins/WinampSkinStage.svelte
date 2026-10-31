<script lang="ts">
  import { formatArtist, formatCoverUrl, DEFAULT_VINYL_COVER } from '../../lib/utils';
  import type { SkinStageProps } from './skinTypes';
  import TrackQuickActions from '../TrackQuickActions.svelte';
  import WinampMiniVisualizer from './WinampMiniVisualizer.svelte';
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

  function formatDigitalTime(sec: number) {
    const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  }

  // 10 频段 EQ 刻度
  const EQ_BANDS = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
</script>

<div
  data-testid="skin-stage-winamp"
  class="flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[460px] w-full md:w-auto shrink-0 select-none"
>
  <!-- Winamp 主机机架 (钛金拉丝金属质感 + 3D凹凸边框) -->
  <div
    class="w-[290px] md:w-[360px] rounded-lg bg-gradient-to-b from-[#343b47] via-[#242932] to-[#181b22] p-2 border-t-2 border-l-2 border-white/20 border-b-2 border-r-2 border-black/80 shadow-2xl flex flex-col gap-2"
  >
    <!-- Winamp 顶栏标题栏 -->
    <div class="flex items-center justify-between px-2 py-1 rounded bg-[#10141a] border border-black/40">
      <div class="flex items-center gap-1.5">
        <span class="text-amber-400 text-xs font-bold">⚡</span>
        <span class="text-[11px] font-mono font-bold tracking-widest text-neutral-300">WINAMP 2.95</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1 rounded border border-emerald-800">
          STEREO
        </span>
        <span class="text-[9px] font-mono text-amber-300 bg-amber-950/80 px-1 rounded border border-amber-800">
          128K
        </span>
      </div>
    </div>

    <!-- Winamp 经典绿色荧光点阵屏 (LCD Display) -->
    <div class="p-2 rounded bg-[#061008] border-2 border-[#132c18] shadow-[inset_0_2px_8px_rgba(0,0,0,0.9)] flex flex-col gap-1.5">
      <!-- 歌名滚动栏 -->
      <div class="flex items-center justify-between gap-2 overflow-hidden">
        <span
          class="text-xs font-mono font-bold text-[#10b981] truncate tracking-wide drop-shadow-[0_0_6px_rgba(16,185,129,0.7)]"
          title={track?.name}
        >
          {track?.name ? `1. ${track.name} - ${formatArtist(track.artist)}` : 'WINAMP - READY'}
        </span>
      </div>

      <!-- 频谱仪与数码时间 -->
      <div class="flex items-center justify-between pt-0.5">
        <!-- 频谱动画 -->
        <WinampMiniVisualizer {playing} barCount={10} />

        <!-- 经典绿色 7 段荧光数码时间 -->
        <div class="flex items-baseline gap-1 text-[#10b981] font-mono drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]">
          <span class="text-lg md:text-xl font-bold tracking-widest tabular-nums">
            {formatDigitalTime(currentTime)}
          </span>
          <span class="text-[10px] text-emerald-500/80">/ {formatDigitalTime(duration)}</span>
        </div>
      </div>
    </div>

    <!-- 迷你封面与 Winamp 均衡器滑块机架 -->
    <div class="flex items-center gap-2.5 p-1.5 rounded bg-[#151920] border border-white/5">
      <!-- 像素风唱片封面 -->
      <div class="w-12 h-12 md:w-14 md:h-14 rounded overflow-hidden shrink-0 border border-white/20 shadow-md">
        <img
          src={formatCoverUrl(track?.cover, 120)}
          alt={t('player.cover')}
          class="w-full h-full object-cover"
          referrerpolicy="no-referrer"
          onerror={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER;
          }}
        />
      </div>

      <!-- 10 频段 EQ 静态/模拟面板 -->
      <div class="flex-1 flex flex-col justify-between h-12 md:h-14">
        <div class="flex justify-between items-center text-[8px] font-mono text-neutral-400 px-0.5">
          <span>GRAPHIC EQUALIZER</span>
          <span class="text-emerald-400">ON</span>
        </div>
        <div class="flex justify-between items-center h-7 px-1 bg-[#0b0e12] rounded border border-white/5">
          {#each EQ_BANDS as b, idx}
            <div class="flex flex-col items-center h-full justify-center w-2 relative">
              <div class="w-0.5 h-full bg-neutral-700 rounded-full"></div>
              <!-- 推子旋钮 -->
              <div
                class="absolute w-2 h-1 bg-neutral-300 rounded-xs border border-black shadow-xs transition-transform"
                style="top: {(idx % 3) * 6 + 4}px;"
              ></div>
            </div>
          {/each}
        </div>
        <div class="flex justify-between text-[7px] font-mono text-neutral-500 px-0.5">
          <span>60Hz</span>
          <span>1K</span>
          <span>16K</span>
        </div>
      </div>
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
