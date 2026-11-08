<script lang="ts">
  import { t } from '../../lib/i18n';
  import { formatCoverUrl, formatArtist, DEFAULT_VINYL_COVER } from '../../lib/utils';
  import { playerStore } from '../../lib/player/playerStore.svelte';
  import { parseLrc, getActiveLyric, type LrcLine } from '../../lib/player/lyricParser';
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

  // 🎵 1. 解析当前播放曲目歌词行
  const parsedLyrics = $derived.by<LrcLine[]>(() => {
    const rawLyric = curTrack?.lyric || playerStore.activeTrack?.lyric;
    if (!rawLyric) return [];
    return parseLrc(rawLyric);
  });

  // 🎙️ 2. 根据播放器实时时间检索当前正在唱的歌词句
  const activeLyric = $derived.by<string>(() => {
    if (!parsedLyrics.length) return '';
    const time = playerStore.curTime || 0;
    const res = getActiveLyric(parsedLyrics, time);
    return res.currentText?.trim() || '';
  });

  // 歌词走马灯文本：若当前句存在则优先展示歌词，否则回退到歌曲名与歌手
  const isDisplayingLyric = $derived(Boolean(activeLyric && playing));

  // 📐 3. 自适应走马灯位移计算（固定岛宽，长文本平滑往复流动，短文本静止稳定）
  let textContainerEl: HTMLDivElement | undefined = $state();
  let textEl: HTMLDivElement | undefined = $state();
  let overflowOffset = $state(0);

  $effect(() => {
    // 监听歌词或曲目变化，动态检测视窗溢出
    const _trackKey = `${curTrack?.id}-${activeLyric}-${isDisplayingLyric}`;
    if (textContainerEl && textEl) {
      const containerW = textContainerEl.clientWidth;
      const textW = textEl.scrollWidth;
      const diff = textW - containerW;
      overflowOffset = diff > 4 ? diff + 8 : 0;
    } else {
      overflowOffset = 0;
    }
  });

  const marqueeDuration = $derived(Math.max(6, Math.min(14, Math.round(overflowOffset / 18))));

  function handleIslandClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (onOpenLyric) {
      onOpenLyric();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wyy:toggle-lyric-modal'));
    }
  }

  function handlePlayClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (onTogglePlay) {
      onTogglePlay();
    } else {
      playerStore.togglePlay();
    }
  }
</script>

<!-- 🏝️ PC 桌面端专属：Window Controls Overlay (WCO) 顶栏沉浸灵动岛 (Dynamic Island)
     固化顶部 38px 避让系统交通灯与右侧窗口按钮，彻底消灭穿模并提供类似 iOS / macOS 顶层灵动视效 -->
<header
  data-testid="desktop-titlebar-island"
  class="fixed top-0 inset-x-0 z-30 flex items-center justify-center select-none transition-colors duration-200 bg-[var(--bg-color)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] pointer-events-none"
  style="
    height: var(--wco-height, env(titlebar-area-height, 38px));
    padding-left: max(80px, var(--wco-left, 80px));
    padding-right: max(120px, var(--wco-right, 120px));
  "
>
  <!-- 🪟 顶栏全域窗口拖拽背景层 (仅响应空白处拖动，不阻断中间灵动岛交互) -->
  <div class="absolute inset-0 wco-drag-region pointer-events-auto" aria-hidden="true"></div>

  <!-- 居中灵动岛药丸主体 (脱离拖拽层阻断，全域支持点击与走马灯歌词) -->
  {#if curTrack}
    <!-- 🎵 播放中动态岛态：定宽 500px 宽裕胶囊，彻底消除长短抖动 + 唱片旋转 + 走马灯歌词/歌名 + 声波律动柱 + 微播放控制器 -->
    <div
      role="button"
      tabindex="0"
      data-testid="titlebar-island-active"
      class="wco-no-drag relative z-10 flex items-center gap-2.5 h-7 px-2.5 rounded-full bg-[var(--card-bg)]/90 hover:bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--primary-color)]/40 shadow-sm hover:shadow-md active:scale-[0.99] transition-colors duration-200 cursor-pointer pointer-events-auto select-none overflow-hidden shrink-0 text-left outline-none"
      style="width: min(500px, calc(100vw - 220px));"
      onclick={handleIslandClick}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleIslandClick(e as any); } }}
      title={t('player.expandLyric')}
      aria-label="{curTrack.name} - {activeLyric || curTrack.artist || ''}"
    >
      <!-- 微型黑胶旋转唱片 -->
      <div class="relative w-5 h-5 rounded-full shrink-0 overflow-hidden ring-1 ring-black/20 dark:ring-white/10 shadow-xs flex items-center justify-center bg-black/60 pointer-events-none">
        <img
          src={formatCoverUrl(curTrack.cover, 50) || DEFAULT_VINYL_COVER}
          alt={curTrack.name}
          class="w-full h-full object-cover transition-transform duration-500 {playing ? 'animate-[spin_8s_linear_infinite]' : 'opacity-85'}"
        />
        <!-- 黑胶唱心微孔 -->
        <span class="absolute w-1.5 h-1.5 rounded-full bg-[var(--bg-color)] border border-white/40 pointer-events-none" aria-hidden="true"></span>
      </div>

      <!-- 走马灯歌词 / 歌曲名主视窗 (定宽宽裕视窗) -->
      <div
        bind:this={textContainerEl}
        class="island-marquee-mask flex-1 min-w-0 overflow-hidden pointer-events-none relative flex items-center"
      >
        {#if isDisplayingLyric}
          <!-- 🎙️ 实时走马灯歌词 (Live Lyrics Marquee) -->
          {#key activeLyric}
            <div
              bind:this={textEl}
              class="inline-flex items-center gap-1.5 whitespace-nowrap will-change-transform {overflowOffset > 0 ? 'island-marquee-track' : ''}"
              style="--marquee-offset: -{overflowOffset}px; --marquee-duration: {marqueeDuration}s;"
            >
              <span class="text-[10px] text-[var(--primary-color)] shrink-0 font-bold leading-none animate-pulse">♪</span>
              <span class="text-[11px] font-medium text-[var(--text-main)] tracking-tight">
                {activeLyric}
              </span>
            </div>
          {/key}
        {:else}
          <!-- 🎵 歌曲名与歌手回退视图 -->
          {#key curTrack.name}
            <div
              bind:this={textEl}
              class="inline-flex items-baseline gap-1.5 whitespace-nowrap will-change-transform {overflowOffset > 0 ? 'island-marquee-track' : ''}"
              style="--marquee-offset: -{overflowOffset}px; --marquee-duration: {marqueeDuration}s;"
            >
              <span class="text-[11px] font-semibold text-[var(--text-main)]">
                {curTrack.name}
              </span>
              {#if curTrack.artist}
                <span class="text-[10px] text-[var(--text-muted)]">
                  {formatArtist(curTrack.artist)}
                </span>
              {/if}
            </div>
          {/key}
        {/if}
      </div>

      <!-- 右侧：动感声波律动柱 -->
      <div class="flex items-center gap-0.5 h-3 shrink-0 px-0.5 pointer-events-none" aria-hidden="true">
        <span class="w-0.5 bg-[var(--primary-color)] rounded-full transition-all duration-150 {playing ? 'h-3 animate-[pulse_0.6s_ease-in-out_infinite]' : 'h-1.5 opacity-40'}"></span>
        <span class="w-0.5 bg-[var(--primary-color)] rounded-full transition-all duration-150 {playing ? 'h-2 animate-[pulse_0.8s_ease-in-out_infinite_0.2s]' : 'h-1 opacity-40'}"></span>
        <span class="w-0.5 bg-[var(--primary-color)] rounded-full transition-all duration-150 {playing ? 'h-2.5 animate-[pulse_0.7s_ease-in-out_infinite_0.4s]' : 'h-1.5 opacity-40'}"></span>
      </div>

      <!-- 悬停/常驻微型播放与暂停按钮 (独立响应点击) -->
      <button
        type="button"
        data-testid="btn-island-toggle-play"
        class="wco-no-drag w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-white/10 hover:bg-[var(--primary-color)] text-[var(--text-main)] hover:text-white transition-all cursor-pointer border-none shrink-0 pointer-events-auto"
        onclick={handlePlayClick}
        title={playing ? t('player.pause') : t('player.play')}
      >
        {playing ? '⏸' : '▶'}
      </button>
    </div>
  {:else}
    <!-- 🪟 闲置极简呼吸岛态 (定宽 260px) -->
    <div
      role="button"
      tabindex="0"
      data-testid="titlebar-island-idle"
      class="wco-no-drag relative z-10 flex items-center justify-center gap-1.5 h-7 px-3.5 rounded-full bg-[var(--card-bg)]/70 hover:bg-[var(--card-bg)]/90 border border-[var(--border-subtle)] hover:border-[var(--border-color)] shadow-xs hover:shadow-sm active:scale-[0.98] transition-colors duration-200 pointer-events-auto select-none cursor-pointer outline-none shrink-0"
      style="width: min(260px, calc(100vw - 220px));"
      onclick={handleIslandClick}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleIslandClick(e as any); } }}
      title="WYY · Whatever You Yearn"
    >
      <span class="text-xs leading-none select-none">🎵</span>
      <span class="text-[11px] font-medium tracking-tight text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors">
        WYY · Whatever You Yearn
      </span>
    </div>
  {/if}
</header>

<style>
  /* 🌊 走马灯两端羽化渐隐遮罩 */
  .island-marquee-mask {
    mask-image: linear-gradient(to right, transparent 0px, black 8px, black calc(100% - 8px), transparent 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0px, black 8px, black calc(100% - 8px), transparent 100%);
  }

  /* 💫 走马灯流动：当歌词超出时优雅往复滚动 */
  .island-marquee-track {
    animation: island-marquee-flow var(--marquee-duration, 8s) ease-in-out infinite alternate;
  }

  @keyframes island-marquee-flow {
    0%, 25% {
      transform: translateX(0);
    }
    75%, 100% {
      transform: translateX(var(--marquee-offset, 0px));
    }
  }
</style>
