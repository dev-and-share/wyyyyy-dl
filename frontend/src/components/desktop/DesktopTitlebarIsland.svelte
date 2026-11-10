<script lang="ts">
  import { t } from '../../lib/i18n';
  import { formatCoverUrl, formatArtist, DEFAULT_VINYL_COVER } from '../../lib/utils';
  import { playerStore } from '../../lib/player/playerStore.svelte';
  import { parseLrc, getActiveLyric, type LrcLine } from '../../lib/player/lyricParser';
  import type { Track } from '../../lib/types';

  let {
    curTrack = null,
    playing = false,
    sidebarCollapsed = false,
    onTogglePlay,
    onOpenLyric
  } = $props<{
    curTrack?: Track | null;
    playing?: boolean;
    sidebarCollapsed?: boolean;
    onTogglePlay?: () => void;
    onOpenLyric?: () => void;
  }>();

  // 🎵 1. 曲目与播放状态双重保障（支持外部 props 绑定与 playerStore 单例实时感知）
  const effectiveTrack = $derived(curTrack || playerStore.activeTrack);
  const isPlaying = $derived(Boolean(playing ?? playerStore.playing));

  // 📝 2. 解析当前曲目歌词行
  const parsedLyrics = $derived.by<LrcLine[]>(() => {
    const rawLyric = effectiveTrack?.lyric;
    if (!rawLyric) return [];
    return parseLrc(rawLyric);
  });

  // 🎙️ 3. 实时检索正在唱的单句歌词
  const activeLyric = $derived.by<string>(() => {
    if (!parsedLyrics.length) return '';
    const time = playerStore.curTime || 0;
    const res = getActiveLyric(parsedLyrics, time);
    return res.currentText?.trim() || '';
  });

  // 歌词走马灯：曲目正在播放且匹配到有效歌词时展示
  const isDisplayingLyric = $derived(Boolean(activeLyric && isPlaying));

  // 📐 4. 自适应走马灯位移计算（固定岛宽，长文本平滑往复滚动，短文本静止居左）
  let textContainerEl: HTMLDivElement | undefined = $state();
  let textEl: HTMLDivElement | undefined = $state();
  let overflowOffset = $state(0);

  $effect(() => {
    // 监听歌词、曲目或播放状态切换
    const _trackKey = `${effectiveTrack?.id}-${activeLyric}-${isDisplayingLyric}`;
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
    // 仅单次触发播控总线，坚决杜绝因二次派发造成的即播即停 bug
    if (onTogglePlay) {
      onTogglePlay();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wyy:toggle-play'));
    }
  }
</script>

<!-- 🏝️ PC 桌面端专属：Window Controls Overlay (WCO) 顶栏沉浸灵动岛 (Dynamic Island)
     采用“左右拖拽区 + 中间完全独立 DOM 交互区”三栏架构，彻底消除原生 drag region 遮挡与点击失灵问题 -->
<header
  data-testid="desktop-titlebar-island"
  class="fixed top-0 inset-x-0 z-30 flex items-center justify-between select-none transition-colors duration-200 bg-[var(--wco-titlebar-bg,var(--bg-color))] backdrop-blur-md"
  style="
    height: var(--wco-height, env(titlebar-area-height, 38px));
    padding-left: max(80px, var(--wco-left, 80px));
    padding-right: max(120px, var(--wco-right, 120px));
  "
>
  <!-- 📏 顶栏底部分割线：左侧侧边栏上方完全通透一体无横切，仅在右侧主视窗呈现微弱界线 -->
  <div
    class="pointer-events-none absolute bottom-0 right-0 h-[1px] bg-[var(--border-subtle)] transition-[left] duration-200 ease-in-out"
    style="left: {sidebarCollapsed ? '58px' : '224px'};"
    aria-hidden="true"
  ></div>
  <!-- 🪟 左侧纯窗口拖拽区域 (交通灯与灵动岛之间，允许自由按住拖动窗口) -->
  <div class="flex-1 h-full wco-drag-region cursor-default" aria-hidden="true"></div>

  <!-- 🏝️ 居中灵动岛药丸 (物理独立于拖拽区，零底层 drag 遮挡，100% 独立响应点击) -->
  <div class="shrink-0 flex items-center justify-center wco-no-drag py-0.5">
    {#if effectiveTrack}
      {#if isPlaying}
        <!-- 🎵 播放展开岛态：320px 适度定宽 + 32px 舒适高度 + 唱片旋转 + 走马灯歌词/歌名 + 声波律动 + 暂停按钮 -->
        <div
          role="button"
          tabindex="0"
          data-testid="titlebar-island-active"
          class="wco-no-drag relative z-10 flex items-center gap-2.5 h-8 px-2.5 rounded-full bg-[var(--card-bg)]/90 hover:bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--primary-color)]/40 shadow-sm hover:shadow-md active:scale-[0.99] transition-all duration-300 cursor-pointer select-none overflow-hidden shrink-0 text-left outline-none pointer-events-auto"
          style="width: min(320px, calc(100vw - 220px));"
          onclick={handleIslandClick}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleIslandClick(e as any); } }}
          title={t('player.expandLyric')}
          aria-label="{effectiveTrack.name} - {activeLyric || effectiveTrack.artist || ''}"
        >
          <!-- 💽 微型黑胶旋转唱片 (22px) -->
          <div class="relative w-5.5 h-5.5 rounded-full shrink-0 overflow-hidden ring-1 ring-black/20 dark:ring-white/10 shadow-xs flex items-center justify-center bg-black/60 pointer-events-none">
            <img
              src={formatCoverUrl(effectiveTrack.cover, 50) || DEFAULT_VINYL_COVER}
              alt={effectiveTrack.name}
              class="w-full h-full object-cover animate-[spin_8s_linear_infinite]"
            />
            <span class="absolute w-1.5 h-1.5 rounded-full bg-[var(--bg-color)] border border-white/40 pointer-events-none" aria-hidden="true"></span>
          </div>

          <!-- 走马灯歌词 / 歌曲名主视窗 -->
          <div
            bind:this={textContainerEl}
            class="flex-1 min-w-0 overflow-hidden pointer-events-none relative flex items-center {overflowOffset > 0 ? 'island-marquee-mask' : ''}"
          >
            {#if isDisplayingLyric}
              {#key activeLyric}
                <div
                  bind:this={textEl}
                  class="inline-flex items-center gap-1.5 whitespace-nowrap will-change-transform {overflowOffset > 0 ? 'island-marquee-track' : ''}"
                  style="--marquee-offset: -{overflowOffset}px; --marquee-duration: {marqueeDuration}s;"
                >
                  <span class="text-[10px] text-[var(--primary-color)] shrink-0 font-bold leading-none animate-pulse">♪</span>
                  <span class="text-xs font-medium text-[var(--text-main)] tracking-tight">
                    {activeLyric}
                  </span>
                </div>
              {/key}
            {:else}
              {#key effectiveTrack.name}
                <div
                  bind:this={textEl}
                  class="inline-flex items-baseline gap-1.5 whitespace-nowrap will-change-transform {overflowOffset > 0 ? 'island-marquee-track' : ''}"
                  style="--marquee-offset: -{overflowOffset}px; --marquee-duration: {marqueeDuration}s;"
                >
                  <span class="text-xs font-semibold text-[var(--text-main)]">
                    {effectiveTrack.name}
                  </span>
                  {#if effectiveTrack.artist}
                    <span class="text-[10px] text-[var(--text-muted)]">
                      {formatArtist(effectiveTrack.artist)}
                    </span>
                  {/if}
                </div>
              {/key}
            {/if}
          </div>

          <!-- 动感声波柱 (12px) -->
          <div class="flex items-center gap-0.5 h-3 shrink-0 px-0.5 pointer-events-none" aria-hidden="true">
            <span class="w-0.5 bg-[var(--primary-color)] rounded-full h-3 animate-[pulse_0.6s_ease-in-out_infinite]"></span>
            <span class="w-0.5 bg-[var(--primary-color)] rounded-full h-2 animate-[pulse_0.8s_ease-in-out_infinite_0.2s]"></span>
            <span class="w-0.5 bg-[var(--primary-color)] rounded-full h-2.5 animate-[pulse_0.7s_ease-in-out_infinite_0.4s]"></span>
          </div>

          <!-- 暂停按钮 (26px 舒适按压) -->
          <button
            type="button"
            data-testid="btn-island-toggle-play"
            class="wco-no-drag relative z-20 w-6.5 h-6.5 rounded-full flex items-center justify-center bg-white/10 hover:bg-[var(--primary-color)] text-[var(--text-main)] hover:text-white active:scale-90 transition-all cursor-pointer border-none shrink-0 pointer-events-auto shadow-xs"
            onclick={handlePlayClick}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handlePlayClick(e as any); } }}
            title={t('player.pause')}
            aria-label={t('player.pause')}
          >
            <span class="pointer-events-none select-none text-[11px] leading-none">⏸</span>
          </button>
        </div>
      {:else}
        <!-- ⏸️ 暂停紧凑胶囊：锁定 176px 紧凑精致视野，消除多余空白 -->
        <div
          role="button"
          tabindex="0"
          data-testid="titlebar-island-paused"
          class="wco-no-drag relative z-10 flex items-center gap-2 h-7 px-2 rounded-full bg-[var(--card-bg)]/85 hover:bg-[var(--card-bg)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] shadow-xs hover:shadow-sm active:scale-[0.99] transition-all duration-300 cursor-pointer select-none overflow-hidden shrink-0 text-left outline-none pointer-events-auto"
          style="width: min(176px, calc(100vw - 220px));"
          onclick={handleIslandClick}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleIslandClick(e as any); } }}
          title={t('player.expandLyric')}
          aria-label="{effectiveTrack.name} - {effectiveTrack.artist || ''}"
        >
          <!-- 静态微型封面 (20px) -->
          <div class="relative w-5 h-5 rounded-full shrink-0 overflow-hidden ring-1 ring-black/20 dark:ring-white/10 shadow-xs flex items-center justify-center bg-black/60 pointer-events-none">
            <img
              src={formatCoverUrl(effectiveTrack.cover, 50) || DEFAULT_VINYL_COVER}
              alt={effectiveTrack.name}
              class="w-full h-full object-cover opacity-80"
            />
          </div>

          <!-- 歌曲名 (单行省略) -->
          <div class="flex-1 min-w-0 overflow-hidden pointer-events-none">
            <div class="text-[11px] font-medium text-[var(--text-main)] truncate" title={effectiveTrack.name}>
              {effectiveTrack.name}
            </div>
          </div>

          <!-- 播放按钮 (24px 显眼播放图标) -->
          <button
            type="button"
            data-testid="btn-island-toggle-play"
            class="wco-no-drag relative z-20 w-6 h-6 rounded-full flex items-center justify-center bg-white/10 hover:bg-[var(--primary-color)] text-[var(--text-main)] hover:text-white active:scale-90 transition-all cursor-pointer border-none shrink-0 pointer-events-auto shadow-xs"
            onclick={handlePlayClick}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handlePlayClick(e as any); } }}
            title={t('player.play')}
            aria-label={t('player.play')}
          >
            <span class="pointer-events-none select-none text-[11px] leading-none pl-0.5">▶</span>
          </button>
        </div>
      {/if}
    {:else}
      <!-- 🪟 闲置极简微胶囊：仅 96px，极致精致收敛 -->
      <div
        role="button"
        tabindex="0"
        data-testid="titlebar-island-idle"
        class="wco-no-drag relative z-10 flex items-center justify-center gap-1.5 h-6 px-2.5 rounded-full bg-[var(--card-bg)]/70 hover:bg-[var(--card-bg)]/90 border border-[var(--border-subtle)] hover:border-[var(--border-color)] shadow-xs hover:shadow-sm active:scale-[0.98] transition-all duration-300 pointer-events-auto select-none cursor-pointer outline-none shrink-0"
        style="width: 96px;"
        onclick={handleIslandClick}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleIslandClick(e as any); } }}
        title="WYY · Whatever You Yearn"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-[var(--primary-color)] animate-pulse" aria-hidden="true"></span>
        <span class="text-[11px] font-medium tracking-tight text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors">
          WYY
        </span>
      </div>
    {/if}
  </div>

  <!-- 🪟 右侧纯窗口拖拽区域 (灵动岛与系统窗口控件之间，允许自由按住拖动窗口) -->
  <div class="flex-1 h-full wco-drag-region cursor-default" aria-hidden="true"></div>
</header>

<style>
  /* 🌊 走马灯溢出端羽化遮罩（仅右端渐隐，保留首字 100% 清晰） */
  .island-marquee-mask {
    mask-image: linear-gradient(to right, black calc(100% - 12px), transparent 100%);
    -webkit-mask-image: linear-gradient(to right, black calc(100% - 12px), transparent 100%);
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
