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

  // 播放进度 (0 ~ 1)
  let progress = $derived(duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0);
  // 激光拾音头滑轨位移 (内圈 24px 到外圈 70px)
  let laserOffset = $derived(24 + progress * 46);

  function formatCdTime(sec: number) {
    const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  }
</script>

<div
  data-testid="skin-stage-cd"
  class="relative z-10 flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[460px] w-full md:w-auto shrink-0 select-none"
>
  <!-- 💽 千禧 CD 随身听机身 (经典 Discman 工业设计 · 彩虹全息镭射盘面) -->
  <div
    class="relative w-[300px] h-[210px] md:w-[380px] md:h-[260px] rounded-[32px] bg-gradient-to-b from-[#223344] via-[#14212e] to-[#0a111a] p-3 md:p-4 border-2 border-sky-400/30 shadow-[0_20px_50px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.2)] flex items-center justify-between gap-3 overflow-hidden"
  >
    <!-- 左侧：全息彩虹镭射 CD 旋转碟仓 -->
    <div class="relative w-[170px] h-[170px] md:w-[220px] md:h-[220px] rounded-full bg-[#0d1622] border-2 border-white/15 p-2 shadow-inner flex items-center justify-center overflow-hidden">
      <!-- 径向激光头导轨与微动拾音头 -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="w-1 h-36 bg-neutral-800 rounded-full"></div>
        <!-- 拾音头小滑块 (随进度平稳步进) -->
        <div
          class="absolute w-3.5 h-5 rounded-xs bg-slate-300 border border-neutral-700 shadow-md transition-all duration-300 flex items-center justify-center"
          style="transform: translateY({laserOffset - 48}px);"
        >
          <div class="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_5px_#f43f5e]"></div>
        </div>
      </div>

      <!-- CD 光盘本体 (全息彩虹镭射衍射环) -->
      <div
        class="w-[150px] h-[150px] md:w-[195px] md:h-[195px] rounded-full p-2 relative flex items-center justify-center shadow-lg border border-white/20 {playing ? 'animate-[spin_4s_linear_infinite]' : ''}"
        style="
          background: conic-gradient(
            from 0deg,
            #cbd5e1 0deg,
            #38bdf8 45deg,
            #ec4899 90deg,
            #facc15 135deg,
            #4ade80 180deg,
            #38bdf8 225deg,
            #a855f7 270deg,
            #f43f5e 315deg,
            #cbd5e1 360deg
          );
        "
      >
        <!-- 镜面反光遮罩层 -->
        <div class="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.45)_0%,transparent_60%)] pointer-events-none"></div>

        <!-- 唱片中心镜面圆环与专辑封面 (纯净通透，无任何假物遮挡) -->
        <div class="w-14 h-14 md:w-18 md:h-18 rounded-full bg-slate-900 border-2 border-white/40 shadow-inner flex items-center justify-center relative overflow-hidden">
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
          <div class="absolute w-3 h-3 rounded-full bg-[#1e293b] border border-white/60"></div>
        </div>
      </div>
    </div>

    <!-- 右侧：千禧绿色背光长条 LCD 线控屏 (纯正数码点阵波形与状态指示) -->
    <div class="flex-1 flex flex-col justify-between h-[170px] md:h-[220px] py-1">
      <!-- 绿色点阵液晶屏 (LCD Display) -->
      <div class="p-2.5 rounded-2xl bg-[#031508] border-2 border-[#155e28] shadow-[inset_0_2px_8px_rgba(0,0,0,0.9)] flex flex-col justify-between flex-1">
        <!-- 顶栏状态指示灯 (ESP / 防震 / 电池) -->
        <div class="flex items-center justify-between text-[7px] md:text-[8px] font-mono text-[#4ade80] opacity-90 border-b border-[#155e28]/60 pb-1">
          <span class="font-bold">DISCMAN 45s</span>
          <span class="bg-[#14532d] px-1 rounded text-[6px]">ESP · ON</span>
        </div>

        <!-- 中部：随音乐真实跳动的千禧 LCD 点阵波形柱 -->
        <div class="flex flex-col items-center justify-center py-2">
          <div class="flex items-end gap-1 h-6">
            {#each audioVisualizer.bands.slice(0, 7) as bVal}
              <div
                class="w-1.5 bg-[#4ade80] rounded-xs transition-[height] duration-75 shadow-[0_0_4px_#22c55e]"
                style="height: {Math.max(15, Math.round((playing ? bVal : 0.15) * 100))}%;"
              ></div>
            {/each}
          </div>
          <span class="text-[7px] font-mono text-emerald-400/80 mt-1.5 tracking-wider">
            {playing ? 'COMPACT DISC DIGITAL' : 'PAUSED'}
          </span>
        </div>

        <!-- 底栏：曲目序号与数字时间 -->
        <div class="flex items-baseline justify-between pt-1 border-t border-[#155e28]/60 text-[#4ade80] font-mono">
          <span class="text-[10px] font-bold">TR 01</span>
          <span class="text-xs md:text-sm font-bold tracking-widest tabular-nums drop-shadow-[0_0_4px_#4ade80]">
            {formatCdTime(currentTime)}
          </span>
        </div>
      </div>

      <!-- 实体操作按键区 (微动金属触感) -->
      <div class="flex justify-between items-center px-1 pt-2">
        <div class="w-6 h-6 rounded-full bg-neutral-700 border border-white/20 shadow-xs flex items-center justify-center text-[8px] text-neutral-300">
          ⏮
        </div>
        <div class="w-7 h-7 rounded-full bg-sky-600 border border-white/30 shadow-md flex items-center justify-center text-[10px] text-white font-bold">
          {playing ? '⏸' : '▶'}
        </div>
        <div class="w-6 h-6 rounded-full bg-neutral-700 border border-white/20 shadow-xs flex items-center justify-center text-[8px] text-neutral-300">
          ⏭
        </div>
      </div>
    </div>
  </div>

  <!-- 歌曲元信息与快捷操作栏 -->
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
