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

  // 左右声道指针角度：基准 -28deg ~ +28deg (随真实音频 VU 电平跳动)
  let vuLeftAngle = $derived(
    playing ? -28 + audioVisualizer.vuLevel * 56 + (Math.sin(currentTime * 8) * 2) : -28
  );
  let vuRightAngle = $derived(
    playing ? -28 + Math.min(56, audioVisualizer.vuLevel * 58 + (Math.cos(currentTime * 7) * 2.5)) : -28
  );

  // 💡 双联真空管物理声学辉光采样 (与 Winamp 共享 Web Audio API 频域分析)
  // 覆盖：低音鼓点冲击 (Band 0~2)、嘹亮人声与管乐穿透 (Band 3~5)、综合电平 (vuLevel)
  // 歌声嘹亮、鼓声密集时强劲炽热爆发，静音/弱音时平滑暗降至待机微弱暗温！
  let leftEnergy = $derived(
    playing
      ? Math.min(1.0, (
          audioVisualizer.bassEnergy * 0.45 +
          audioVisualizer.vuLevel * 0.35 +
          ((audioVisualizer.bands[0] || 0) + (audioVisualizer.bands[1] || 0) + (audioVisualizer.bands[3] || 0)) * 0.28
        ))
      : 0
  );
  let rightEnergy = $derived(
    playing
      ? Math.min(1.0, (
          audioVisualizer.vuLevel * 0.40 +
          ((audioVisualizer.bands[3] || 0) + (audioVisualizer.bands[4] || 0) + (audioVisualizer.bands[5] || 0)) * 0.38 +
          (audioVisualizer.bands[7] || 0) * 0.18
        ))
      : 0
  );

  // 钨丝发光核心透明度：无声/静音时仅 0.22（微弱暗红余温），歌声与鼓声澎湃时飙升至 1.0（金白炽热）
  let leftCoreOpacity = $derived(playing ? 0.22 + leftEnergy * 0.78 : 0.18);
  let rightCoreOpacity = $derived(playing ? 0.22 + rightEnergy * 0.78 : 0.18);

  // 辉光光晕半径与漫射强弱 (随着声浪脉冲向外辐射)
  let leftGlowRadius = $derived(playing ? Math.round(3 + leftEnergy * 32) : 2);
  let rightGlowRadius = $derived(playing ? Math.round(3 + rightEnergy * 32) : 2);

  // 顶部幽蓝紫等离子受激微光 (只有在高能量声浪冲击时才显现)
  let leftPlasmaOpacity = $derived(playing ? Math.max(0, (leftEnergy - 0.25) * 1.1) : 0);
  let rightPlasmaOpacity = $derived(playing ? Math.max(0, (rightEnergy - 0.25) * 1.1) : 0);
</script>

<div
  data-testid="skin-stage-tube"
  class="relative z-10 flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[440px] w-full md:w-auto shrink-0 select-none"
>
  <!-- 📻 复古胡桃木发烧友胆机机台 (匠人级精密金属与温热真空管) -->
  <div
    class="relative w-[300px] h-[210px] md:w-[380px] md:h-[250px] rounded-3xl bg-gradient-to-b from-[#3a1806] via-[#240e03] to-[#140601] p-3.5 md:p-4.5 border-2 border-[#78350f]/60 shadow-[0_20px_50px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.2)] flex flex-col justify-between"
  >
    <!-- 上半部：中央对称双联发光真空管与温热辉光 -->
    <div class="relative flex items-center justify-center gap-8 md:gap-12 pt-2">
      <!-- 电子管 1 (左声道 · 偏低音重击与底鼓) -->
      <div class="relative flex flex-col items-center">
        <!-- 💡 外部漫反射温润环境光晕 (有声浪时向外辐射，无声时柔顺收敛) -->
        <div
          class="absolute -inset-3 rounded-full pointer-events-none transition-all duration-100 ease-out"
          style="
            background: radial-gradient(circle, rgba(245, 158, 11, {leftEnergy * 0.45}) 0%, rgba(217, 119, 6, {leftEnergy * 0.18}) 45%, transparent 70%);
            transform: scale({0.8 + leftEnergy * 0.35});
          "
        ></div>

        <!-- 玻璃管身与内部钨丝 -->
        <div
          class="w-9 h-16 md:w-12 md:h-20 rounded-t-full bg-gradient-to-b from-white/20 via-amber-200/10 to-amber-950/40 border border-white/30 shadow-lg relative flex flex-col items-center justify-end p-1 overflow-hidden"
          style="box-shadow: 0 0 {leftGlowRadius * 0.6}px rgba(245, 158, 11, {leftEnergy * 0.4});"
        >
          <!-- 钨丝发光核心 (随歌声与鼓点声浪真实呼吸爆发) -->
          <div
            class="w-2 md:w-2.5 h-8 md:h-11 rounded-full bg-amber-500 relative flex items-center justify-center transition-all duration-75 ease-out"
            style="
              opacity: {leftCoreOpacity};
              box-shadow: 0 0 {leftGlowRadius}px #f59e0b, 0 0 {leftGlowRadius * 1.8}px #d97706, 0 0 {leftGlowRadius * 2.8}px rgba(245, 158, 11, 0.4);
            "
          >
            <!-- 钨丝内层白热化核心 (歌声嘹亮时白炽金发亮) -->
            <div
              class="w-0.5 md:w-1 h-6 md:h-9 rounded-full bg-amber-100 transition-opacity duration-75"
              style="opacity: {Math.max(0, (leftEnergy - 0.2) * 1.25)}; box-shadow: 0 0 6px #ffffff;"
            ></div>
          </div>

          <!-- 顶部激发蓝紫等离子冷光 (大声浪与高频冲击时显现) -->
          <div
            class="absolute top-1 w-5 h-2.5 rounded-full bg-indigo-400 blur-[2px] transition-opacity duration-100 pointer-events-none"
            style="opacity: {leftPlasmaOpacity};"
          ></div>
        </div>
        <!-- 黄铜金属管座 -->
        <div class="w-11 md:w-14 h-3 bg-gradient-to-r from-[#78350f] via-[#d97706] to-[#78350f] rounded-xs border-t border-amber-200/50 shadow-xs"></div>
      </div>

      <!-- 电子管 2 (右声道 · 偏人声嘹亮与穿透力) -->
      <div class="relative flex flex-col items-center">
        <!-- 💡 外部漫反射温润环境光晕 -->
        <div
          class="absolute -inset-3 rounded-full pointer-events-none transition-all duration-100 ease-out"
          style="
            background: radial-gradient(circle, rgba(245, 158, 11, {rightEnergy * 0.45}) 0%, rgba(217, 119, 6, {rightEnergy * 0.18}) 45%, transparent 70%);
            transform: scale({0.8 + rightEnergy * 0.35});
          "
        ></div>

        <div
          class="w-9 h-16 md:w-12 md:h-20 rounded-t-full bg-gradient-to-b from-white/20 via-amber-200/10 to-amber-950/40 border border-white/30 shadow-lg relative flex flex-col items-center justify-end p-1 overflow-hidden"
          style="box-shadow: 0 0 {rightGlowRadius * 0.6}px rgba(245, 158, 11, {rightEnergy * 0.4});"
        >
          <div
            class="w-2 md:w-2.5 h-8 md:h-11 rounded-full bg-amber-500 relative flex items-center justify-center transition-all duration-75 ease-out"
            style="
              opacity: {rightCoreOpacity};
              box-shadow: 0 0 {rightGlowRadius}px #f59e0b, 0 0 {rightGlowRadius * 1.8}px #d97706, 0 0 {rightGlowRadius * 2.8}px rgba(245, 158, 11, 0.4);
            "
          >
            <div
              class="w-0.5 md:w-1 h-6 md:h-9 rounded-full bg-amber-100 transition-opacity duration-75"
              style="opacity: {Math.max(0, (rightEnergy - 0.2) * 1.25)}; box-shadow: 0 0 6px #ffffff;"
            ></div>
          </div>

          <div
            class="absolute top-1 w-5 h-2.5 rounded-full bg-indigo-400 blur-[2px] transition-opacity duration-100 pointer-events-none"
            style="opacity: {rightPlasmaOpacity};"
          ></div>
        </div>
        <div class="w-11 md:w-14 h-3 bg-gradient-to-r from-[#78350f] via-[#d97706] to-[#78350f] rounded-xs border-t border-amber-200/50 shadow-xs"></div>
      </div>
    </div>

    <!-- 下半部：双联暖光指针 VU 表 (真实音频分贝电平驱动) -->
    <div class="grid grid-cols-2 gap-3 p-1.5 md:p-2 rounded-2xl bg-[#120803] border border-amber-900/50 shadow-inner">
      <!-- 左声道 VU 表 (CH 1) -->
      <div class="relative h-14 md:h-16 rounded-xl bg-[#fef3c7] dark:bg-[#fde68a] border-2 border-[#78350f] p-1 overflow-hidden shadow-inner flex flex-col justify-between">
        <div class="flex items-center justify-between text-[7px] md:text-[8px] font-mono font-bold text-amber-950 px-1 opacity-80">
          <span>-20</span>
          <span>-10</span>
          <span>-5</span>
          <span>0</span>
          <span class="text-rose-600">+3</span>
        </div>
        <div class="text-[8px] font-mono font-bold text-amber-900/60 text-center tracking-widest">
          VU · L
        </div>
        <!-- 模拟物理指针 (真实惯性摆动) -->
        <div
          class="absolute bottom-[-6px] left-1/2 w-0.5 h-12 md:h-14 bg-neutral-900 origin-bottom transition-transform duration-75 ease-out rounded-full shadow-xs"
          style="transform: translateX(-50%) rotate({vuLeftAngle}deg);"
        >
          <div class="w-1.5 h-1.5 rounded-full bg-amber-900 -ml-0.5 mt-auto"></div>
        </div>
      </div>

      <!-- 右声道 VU 表 (CH 2) -->
      <div class="relative h-14 md:h-16 rounded-xl bg-[#fef3c7] dark:bg-[#fde68a] border-2 border-[#78350f] p-1 overflow-hidden shadow-inner flex flex-col justify-between">
        <div class="flex items-center justify-between text-[7px] md:text-[8px] font-mono font-bold text-amber-950 px-1 opacity-80">
          <span>-20</span>
          <span>-10</span>
          <span>-5</span>
          <span>0</span>
          <span class="text-rose-600">+3</span>
        </div>
        <div class="text-[8px] font-mono font-bold text-amber-900/60 text-center tracking-widest">
          VU · R
        </div>
        <div
          class="absolute bottom-[-6px] left-1/2 w-0.5 h-12 md:h-14 bg-neutral-900 origin-bottom transition-transform duration-75 ease-out rounded-full shadow-xs"
          style="transform: translateX(-50%) rotate({vuRightAngle}deg);"
        >
          <div class="w-1.5 h-1.5 rounded-full bg-amber-900 -ml-0.5 mt-auto"></div>
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
