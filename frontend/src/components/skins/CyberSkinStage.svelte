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

  // 🤖 机器人随重低音能量剧烈点头摇摆 (Headbanging)
  let robotBounce = $derived(
    playing ? Math.sin(currentTime * 8) * (8 + audioVisualizer.bassEnergy * 16) : 0
  );
  let robotHeadTilt = $derived(
    playing ? Math.sin(currentTime * 4) * 12 : 0
  );

  // 3D 公路地平线无限推进位移
  let highwayProgress = $derived(playing ? (currentTime * 120) % 100 : 0);
</script>

<div
  data-testid="skin-stage-cyber"
  class="relative z-10 flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[460px] w-full md:w-auto shrink-0 select-none"
>
  <!-- 🌆 80s 蒸汽波车载机架 (百叶窗落日 + 3D 网格公路 + 打碟机器人 Rust-E) -->
  <div
    class="relative w-[300px] h-[210px] md:w-[380px] md:h-[260px] rounded-3xl bg-gradient-to-b from-[#24083e] via-[#150524] to-[#07010d] p-3 md:p-4 border-2 border-fuchsia-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(217,70,239,0.25)] flex flex-col justify-between overflow-hidden"
  >
    <!-- 远景：80s 经典横纹百叶窗落日与紫青光辉 -->
    <div class="absolute top-2 inset-x-0 flex flex-col items-center pointer-events-none opacity-85">
      <!-- 渐变落日圆盘 -->
      <div class="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-b from-amber-300 via-rose-500 to-fuchsia-600 shadow-[0_0_30px_rgba(244,63,94,0.6)] relative overflow-hidden flex flex-col justify-end">
        <!-- 百叶窗水平黑纹切线 -->
        <div class="w-full h-1 bg-black/60 mb-1"></div>
        <div class="w-full h-1.5 bg-black/60 mb-1"></div>
        <div class="w-full h-2 bg-black/70 mb-1"></div>
        <div class="w-full h-2.5 bg-black/80"></div>
      </div>
    </div>

    <!-- 近景底盘：3D 透视公路霓虹网格 (无限向前推进) -->
    <div class="absolute bottom-0 inset-x-0 h-24 md:h-28 overflow-hidden pointer-events-none [perspective:200px]">
      <div
        class="w-full h-full border-t-2 border-cyan-400 [transform:rotateX(60deg)] origin-bottom bg-[linear-gradient(to_bottom,transparent_0%,rgba(6,182,212,0.15)_100%)]"
        style="
          background-size: 24px 24px;
          background-image:
            linear-gradient(to right, rgba(6, 182, 212, 0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(217, 70, 239, 0.4) 1px, transparent 1px);
          background-position-y: {highwayProgress}px;
        "
      ></div>
    </div>

    <!-- 中部左侧：黑胶/霓虹数码唱盘 (带全息律动外圈) -->
    <div class="relative z-10 w-[120px] h-[120px] md:w-[150px] md:h-[150px] rounded-full p-1.5 border-2 border-cyan-400/50 bg-[#090214] shadow-[0_0_16px_rgba(6,182,212,0.4)] flex items-center justify-center mt-6">
      <img
        src={formatCoverUrl(track?.cover, 120)}
        alt={t('player.cover')}
        class="w-full h-full object-cover rounded-full {playing ? 'animate-[spin_12s_linear_infinite]' : ''}"
        referrerpolicy="no-referrer"
        onerror={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER;
        }}
      />
      <div class="absolute w-5 h-5 rounded-full bg-[#18042b] border-2 border-fuchsia-400 flex items-center justify-center text-[8px] text-fuchsia-300">
        ⚡
      </div>
    </div>

    <!-- 中部右侧：🤖 生锈铁皮显像管小机器人 "Rust-E" (随音乐摇头晃脑打碟) -->
    <div
      class="absolute right-3 md:right-6 bottom-4 z-20 flex flex-col items-center pointer-events-none transition-transform duration-75"
      style="transform: translateY({robotBounce}px) rotate({robotHeadTilt}deg);"
      title="Rust-E the Headbanging Synth Robot"
    >
      <!-- 天线与彩色电火花 -->
      <div class="relative flex justify-center w-full">
        <div class="w-1 h-3 bg-neutral-400 rounded-t-full"></div>
        {#if playing}
          <div class="absolute -top-2 w-2 h-2 rounded-full bg-cyan-300 animate-ping shadow-[0_0_6px_#67e8f9]"></div>
        {/if}
      </div>

      <!-- 机器人生锈显像管脑袋 (CRT 显示屏) -->
      <div class="relative w-16 h-12 md:w-20 md:h-14 rounded-xl bg-gradient-to-b from-[#3f3f46] via-[#27272a] to-[#18181b] border-2 border-neutral-500 shadow-xl p-1 flex items-center justify-center overflow-hidden">
        <!-- 铁皮螺丝与微生锈铆钉 -->
        <div class="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-amber-600"></div>
        <div class="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-amber-600"></div>

        <!-- 显像管发光屏幕与像素点阵表情 -->
        <div class="w-full h-full rounded-lg bg-[#051c14] border border-emerald-500/50 shadow-inner flex flex-col items-center justify-center relative overflow-hidden">
          <div class="text-emerald-400 font-mono font-bold text-xs md:text-sm tracking-widest drop-shadow-[0_0_6px_#34d399]">
            {#if playing}
              <span>⌐■-■</span>
            {:else}
              <span>-_- zZ</span>
            {/if}
          </div>
          <!-- CRT 扫描线质感 -->
          <div class="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.5)_2px,rgba(0,0,0,0.5)_4px)] pointer-events-none"></div>
        </div>

        <!-- 挂在头两侧的大耳机 -->
        <div class="absolute -left-2 top-2 w-2 h-7 rounded-l-md bg-amber-500 border border-amber-700 shadow-md"></div>
        <div class="absolute -right-2 top-2 w-2 h-7 rounded-r-md bg-amber-500 border border-amber-700 shadow-md"></div>
      </div>

      <!-- 机械手臂与打碟推子 -->
      <div class="flex items-center gap-1 mt-1">
        <div class="w-3 h-5 rounded-sm bg-neutral-600 border border-neutral-800 rotate-12"></div>
        <div class="w-8 h-2 rounded-full bg-cyan-400/80 shadow-[0_0_6px_#22d3ee]"></div>
        <div class="w-3 h-5 rounded-sm bg-neutral-600 border border-neutral-800 -rotate-12"></div>
      </div>
    </div>

    <!-- 底部：赛博车载荧光律动灯条 (实时音频频段流光) -->
    <div class="relative z-10 flex items-center justify-between gap-1 px-2 py-1 bg-[#120320]/80 rounded-lg border border-fuchsia-500/30 backdrop-blur-xs">
      <div class="flex items-center gap-1 text-[8px] font-mono text-cyan-300">
        <span>EQ</span>
        <span class="text-fuchsia-400 font-bold">SYNTH 84</span>
      </div>
      <!-- 动态荧光跳动柱条 -->
      <div class="flex items-end gap-1 h-3">
        {#each audioVisualizer.bands.slice(0, 6) as val, idx}
          <div
            class="w-1.5 rounded-xs transition-[height] duration-75"
            style="
              height: {Math.max(20, Math.round(val * 100))}%;
              background: {idx % 2 === 0 ? '#22d3ee' : '#d946ef'};
              box-shadow: 0 0 4px {idx % 2 === 0 ? '#22d3ee' : '#d946ef'};
            "
          ></div>
        {/each}
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
