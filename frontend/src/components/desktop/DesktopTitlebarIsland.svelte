<script lang="ts">
  import { t } from '../../lib/i18n';
  import { formatCoverUrl, formatArtist, DEFAULT_VINYL_COVER } from '../../lib/utils';
  import type { Track } from '../../lib/types';

  let {
    curTrack = null,
    playing = false,
    onTogglePlay,
    onOpenLyric
  } = $props<{
    curTrack?: Track | null;
    playing?: boolean;
    onTogglePlay?: () => void;
    onOpenLyric?: () => void;
  }>();

  function handleIslandClick() {
    if (curTrack && onOpenLyric) {
      onOpenLyric();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wyy:toggle-lyric-modal'));
    }
  }

  function handlePlayClick(e: MouseEvent) {
    e.stopPropagation();
    onTogglePlay?.();
  }
</script>

<!-- 🏝️ PC 桌面端专属：Window Controls Overlay (WCO) 顶栏沉浸灵动岛 (Dynamic Island)
     贯通顶部 38px 避让系统交通灯与右侧窗口按钮，彻底消灭穿模并提供类似 iOS / macOS 顶层灵动视效 -->
<header
  data-testid="desktop-titlebar-island"
  class="fixed top-0 inset-x-0 z-30 flex items-center justify-center select-none transition-colors duration-200 wco-drag-region bg-[var(--bg-color)]/95 backdrop-blur-md border-b border-[var(--border-subtle)]"
  style="
    height: var(--wco-height, env(titlebar-area-height, 38px));
    padding-left: max(80px, var(--wco-left, 80px));
    padding-right: max(120px, var(--wco-right, 120px));
  "
>
  <!-- 居中灵动岛药丸主体 (Dynamic Island Pill) -->
  {#if curTrack}
    <!-- 🎵 播放中动态岛态：唱片旋转 + 歌曲名 + 歌手 + 声波律动柱 + 微播放控制器 -->
    <div
      role="button"
      tabindex="0"
      data-testid="titlebar-island-active"
      class="group wco-no-drag relative flex items-center gap-2 h-7 px-2 rounded-full bg-[var(--card-bg)]/85 hover:bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--primary-color)]/40 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer pointer-events-auto select-none overflow-hidden max-w-[340px]"
      onclick={handleIslandClick}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleIslandClick(); } }}
      title={t('player.expandLyric')}
    >
      <!-- 微型黑胶旋转唱片 -->
      <div class="relative w-5 h-5 rounded-full shrink-0 overflow-hidden ring-1 ring-black/20 dark:ring-white/10 shadow-xs flex items-center justify-center bg-black/60">
        <img
          src={formatCoverUrl(curTrack.cover, 50) || DEFAULT_VINYL_COVER}
          alt={curTrack.name}
          class="w-full h-full object-cover transition-transform duration-500 {playing ? 'animate-[spin_8s_linear_infinite]' : 'opacity-85'}"
        />
        <!-- 黑胶唱心微孔 -->
        <span class="absolute w-1.5 h-1.5 rounded-full bg-[var(--bg-color)] border border-white/40 pointer-events-none" aria-hidden="true"></span>
      </div>

      <!-- 歌曲名与歌手 -->
      <div class="flex items-baseline gap-1.5 min-w-0 flex-1 overflow-hidden">
        <span class="text-[11px] font-semibold text-[var(--text-main)] truncate max-w-[130px] sm:max-w-[170px]">
          {curTrack.name}
        </span>
        {#if curTrack.artist}
          <span class="text-[10px] text-[var(--text-muted)] truncate max-w-[70px] hidden sm:inline">
            {formatArtist(curTrack.artist)}
          </span>
        {/if}
      </div>

      <!-- 右侧：动感声波律动柱 -->
      <div class="flex items-center gap-0.5 h-3 shrink-0 px-0.5" aria-hidden="true">
        <span class="w-0.5 bg-[var(--primary-color)] rounded-full transition-all duration-150 {playing ? 'h-3 animate-[pulse_0.6s_ease-in-out_infinite]' : 'h-1.5 opacity-40'}"></span>
        <span class="w-0.5 bg-[var(--primary-color)] rounded-full transition-all duration-150 {playing ? 'h-2 animate-[pulse_0.8s_ease-in-out_infinite_0.2s]' : 'h-1 opacity-40'}"></span>
        <span class="w-0.5 bg-[var(--primary-color)] rounded-full transition-all duration-150 {playing ? 'h-2.5 animate-[pulse_0.7s_ease-in-out_infinite_0.4s]' : 'h-1.5 opacity-40'}"></span>
      </div>

      <!-- 悬停时外溢播放/暂停微操作按钮 -->
      <button
        type="button"
        data-testid="btn-island-toggle-play"
        class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-white/10 hover:bg-[var(--primary-color)] text-[var(--text-main)] hover:text-white transition-all cursor-pointer border-none shrink-0"
        onclick={handlePlayClick}
        title={playing ? t('player.pause') : t('player.play')}
      >
        {playing ? '⏸' : '▶'}
      </button>
    </div>
  {:else}
    <!-- 🪟 闲置极简呼吸岛态 (Ambient Mode) -->
    <div
      role="button"
      tabindex="0"
      data-testid="titlebar-island-idle"
      class="group wco-no-drag flex items-center gap-1.5 h-7 px-3 rounded-full bg-[var(--card-bg)]/60 hover:bg-[var(--card-bg)]/80 border border-[var(--border-subtle)] hover:border-[var(--border-color)] shadow-xs transition-all duration-300 pointer-events-auto select-none cursor-default"
      title="WYY · Whatever You Yearn"
    >
      <span class="text-xs leading-none select-none">🎵</span>
      <span class="text-[11px] font-medium tracking-tight text-[var(--text-secondary)] group-hover:text-[var(--text-main)] transition-colors">
        WYY · Whatever You Yearn
      </span>
    </div>
  {/if}
</header>
