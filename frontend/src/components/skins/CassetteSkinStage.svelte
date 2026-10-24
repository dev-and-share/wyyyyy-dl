<script lang="ts">
  import { formatArtist, formatCoverUrl, DEFAULT_VINYL_COVER } from '../../lib/utils';
  import type { SkinStageProps } from './skinTypes';
  import { calculateTapeRadii } from './cassetteHelper';
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

  let progress = $derived(duration > 0 ? currentTime / duration : 0);
  let tapeRadii = $derived(calculateTapeRadii(progress, 16, 42));

  function formatTimeCode(sec: number) {
    const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  }
</script>

<div
  data-testid="skin-stage-cassette"
  class="flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[460px] w-full md:w-auto shrink-0 select-none"
>
  <!-- 磁带机外壳（圆角矩形 + 螺丝 + 标签 + 观察窗） -->
  <div
    class="relative w-[280px] h-[178px] md:w-[350px] md:h-[220px] rounded-2xl bg-gradient-to-b from-[#252830] via-[#1c1e24] to-[#121317] p-2.5 md:p-3 shadow-2xl border border-white/10 flex flex-col justify-between"
  >
    <!-- 四角精密螺丝 -->
    <div class="absolute top-2 left-2 w-2 h-2 rounded-full bg-neutral-400 border border-neutral-600 shadow-inner flex items-center justify-center"><div class="w-1.5 h-0.5 bg-neutral-700"></div></div>
    <div class="absolute top-2 right-2 w-2 h-2 rounded-full bg-neutral-400 border border-neutral-600 shadow-inner flex items-center justify-center"><div class="w-1.5 h-0.5 bg-neutral-700 rotate-90"></div></div>
    <div class="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-neutral-400 border border-neutral-600 shadow-inner flex items-center justify-center"><div class="w-1.5 h-0.5 bg-neutral-700 rotate-45"></div></div>
    <div class="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-neutral-400 border border-neutral-600 shadow-inner flex items-center justify-center"><div class="w-1.5 h-0.5 bg-neutral-700 rotate-12"></div></div>

    <!-- 磁带标签贴纸（复古纸质，印歌名与歌手） -->
    <div
      class="w-full rounded-lg bg-[#e2dcce] dark:bg-[#d9d2c2] text-neutral-800 px-3 py-1.5 border border-black/15 shadow-sm flex items-center justify-between gap-2 overflow-hidden"
    >
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <!-- 迷你封面印花 -->
        <img
          src={formatCoverUrl(track?.cover, 100)}
          alt="贴纸封面"
          class="w-6 h-6 rounded object-cover shrink-0 border border-neutral-400 shadow-xs"
          referrerpolicy="no-referrer"
          onerror={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER;
          }}
        />
        <div class="min-w-0 flex-1">
          <div class="text-[11px] md:text-xs font-bold truncate leading-tight font-mono text-neutral-900" title={track?.name}>
            {track?.name || 'SIDE A / UNTITLED'}
          </div>
          <div class="text-[9px] md:text-[10px] text-neutral-600 truncate leading-none font-mono mt-0.5">
            {formatArtist(track?.artist) || 'STEREO'}
          </div>
        </div>
      </div>
      <div class="shrink-0 text-right">
        <span class="text-[9px] font-mono font-bold tracking-wider px-1 py-0.5 rounded bg-black/10 text-neutral-700">
          TYPE II
        </span>
      </div>
    </div>

    <!-- 磁带核心视窗（双轴轮 + 磁带卷 + 观察窗刻度） -->
    <div
      class="w-full flex-1 my-1.5 rounded-lg bg-[#0a0c0f]/90 border border-white/5 relative flex items-center justify-around px-4 overflow-hidden"
    >
      <!-- 中间刻度线 -->
      <div class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 border-x border-white/5 flex flex-col justify-between py-1 text-[8px] font-mono text-neutral-500 items-center pointer-events-none opacity-40">
        <span>100</span>
        <span>50</span>
        <span>0</span>
      </div>

      <!-- 左轴轮（供带盘，随播放缩径） -->
      <div class="relative flex items-center justify-center">
        <!-- 褐色磁带圈 -->
        <div
          class="rounded-full bg-[#3b2416] transition-all duration-300 border border-[#2b180d] shadow-inner"
          style="width: {tapeRadii.left * 2}px; height: {tapeRadii.left * 2}px;"
        ></div>
        <!-- 白色机械六齿轮 -->
        <div
          class="absolute w-8 h-8 md:w-9 md:h-9 rounded-full bg-neutral-200 border-2 border-neutral-400 flex items-center justify-center shadow-md {playing ? 'animate-[spin_4s_linear_infinite]' : ''}"
        >
          <div class="w-4 h-4 rounded-full bg-neutral-900 border border-neutral-600 flex items-center justify-center">
            <div class="w-1.5 h-1.5 rounded-full bg-neutral-400"></div>
          </div>
          <!-- 齿爪轮廓 -->
          <div class="absolute inset-0.5 border border-dashed border-neutral-500 rounded-full"></div>
        </div>
      </div>

      <!-- 右轴轮（收带盘，随播放增径） -->
      <div class="relative flex items-center justify-center">
        <!-- 褐色磁带圈 -->
        <div
          class="rounded-full bg-[#3b2416] transition-all duration-300 border border-[#2b180d] shadow-inner"
          style="width: {tapeRadii.right * 2}px; height: {tapeRadii.right * 2}px;"
        ></div>
        <!-- 白色机械六齿轮 -->
        <div
          class="absolute w-8 h-8 md:w-9 md:h-9 rounded-full bg-neutral-200 border-2 border-neutral-400 flex items-center justify-center shadow-md {playing ? 'animate-[spin_4s_linear_infinite]' : ''}"
        >
          <div class="w-4 h-4 rounded-full bg-neutral-900 border border-neutral-600 flex items-center justify-center">
            <div class="w-1.5 h-1.5 rounded-full bg-neutral-400"></div>
          </div>
          <!-- 齿爪轮廓 -->
          <div class="absolute inset-0.5 border border-dashed border-neutral-500 rounded-full"></div>
        </div>
      </div>
    </div>

    <!-- 底部：机械导轮与 LCD 计数器 -->
    <div class="w-full flex items-center justify-between px-2 pt-0.5">
      <div class="flex items-center gap-1.5">
        <div class="w-3 h-3 rounded-full bg-neutral-600 border border-neutral-400 shadow-inner"></div>
        <span class="text-[9px] font-mono text-neutral-400 tracking-wider">A-SIDE</span>
      </div>

      <!-- 复古 LCD 荧光计数器 -->
      <div
        class="px-2 py-0.5 rounded bg-black/60 border border-neutral-800 flex items-center gap-1 text-[11px] font-mono tabular-nums tracking-widest"
        style="color: var(--skin-accent, #10b981); text-shadow: 0 0 8px var(--skin-accent, #10b981);"
      >
        <span>{formatTimeCode(currentTime)}</span>
        <span class="opacity-40">/</span>
        <span class="opacity-60">{formatTimeCode(duration)}</span>
      </div>

      <div class="flex items-center gap-1.5">
        <span class="text-[9px] font-mono text-neutral-400 tracking-wider">DOLBY NR</span>
        <div class="w-3 h-3 rounded-full bg-neutral-600 border border-neutral-400 shadow-inner"></div>
      </div>
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
