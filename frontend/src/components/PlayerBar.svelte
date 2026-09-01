<script lang="ts">
  import { formatTime, formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';
  import type { Track } from '../lib/types';

  let {
    curTrack,
    queue = [],
    playing = false,
    curTime = 0,
    duration = 0,
    playMode = 'list',
    onTogglePlay,
    onPrev,
    onNext,
    onToggleMode,
    onSeek,
    onLyric,
    onPeq,
    onQueue,
    onClearQueue
  } = $props<{
    curTrack: Track | null;
    queue: Track[];
    playing: boolean;
    curTime: number;
    duration: number;
    playMode: 'list' | 'single' | 'shuffle';
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    onToggleMode: () => void;
    onSeek: (e: MouseEvent) => void;
    onLyric: () => void;
    onPeq: () => void;
    onQueue: () => void;
    onClearQueue: () => void;
  }>();

  let vol = $state(0.8);
  let minimized = $state(false);
  let showSpVol = $state(false);

  // 环形进度计算 (半径 r=23, 周长 2*pi*23 ≈ 144.513)
  const RING_CIRCUMFERENCE = 144.513;
  let progressRatio = $derived(duration > 0 ? Math.min(1, Math.max(0, curTime / duration)) : 0);
  let ringDashOffset = $derived(RING_CIRCUMFERENCE * (1 - progressRatio));
</script>

{#if queue.length > 0 && curTrack}
  {#if minimized}
    <!-- 💽 最小化：微型黑胶悬浮球 + 环形进度光圈 (PC & SP 通用) -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="floating-vinyl-bubble" onclick={() => minimized = false} title="点击展开播放控制栏 (进度 {Math.round(progressRatio * 100)}%)">
      <svg class="vinyl-progress-ring" viewBox="0 0 54 54">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="100%" stop-color="#f97316" />
          </linearGradient>
        </defs>
        <circle class="ring-bg" cx="27" cy="27" r="23" />
        <circle
          class="ring-progress"
          cx="27"
          cy="27"
          r="23"
          stroke="url(#ringGrad)"
          stroke-dasharray="{RING_CIRCUMFERENCE}"
          stroke-dashoffset="{ringDashOffset}"
        />
      </svg>
      <div class="bubble-vinyl-wrapper">
        <img
          src={curTrack?.cover || DEFAULT_VINYL_COVER}
          alt="封面"
          class="bubble-vinyl-cover"
          class:playing={playing}
          referrerpolicy="no-referrer"
          onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
        />
        <div class="bubble-center-dot"></div>
      </div>
    </div>
  {:else}
    <!-- =========================================================================
         🖥️ 1. PC 桌面端专属：经典优雅三段式播放栏 (完全物理隔离，绝不互相干扰)
         ========================================================================= -->
    <div class="pc-player-bar">
      <div class="pc-bar-inner">
        <!-- 1.1 左侧：黑胶封面与歌曲元信息 -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="pc-left-section" onclick={onLyric} title="点击展开全屏歌词与大黑胶">
          <div class="pc-cover-wrapper">
            <svg class="pc-cover-ring" viewBox="0 0 50 50">
              <circle class="pc-ring-bg" cx="25" cy="25" r="23" />
              <circle
                class="pc-ring-progress"
                cx="25"
                cy="25"
                r="23"
                stroke="url(#pcRingGradBar)"
                stroke-dasharray="{RING_CIRCUMFERENCE}"
                stroke-dashoffset="{ringDashOffset}"
              />
              <defs>
                <linearGradient id="pcRingGradBar" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#ef4444" />
                  <stop offset="100%" stop-color="#f97316" />
                </linearGradient>
              </defs>
            </svg>
            <img
              src={curTrack?.cover || DEFAULT_VINYL_COVER}
              alt="封面"
              class="pc-cover-img"
              class:playing={playing}
              referrerpolicy="no-referrer"
              onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
            />
          </div>
          <div class="pc-meta-text">
            <div class="pc-title-row">
              <span class="pc-song-title">{curTrack?.name || '未在播放'}</span>
              {#if curTrack?.isLocal}
                <span class="audio-source-badge badge-server" title="🖥️ 本地已下载">🖥️</span>
              {/if}
            </div>
            <div class="pc-song-artist">{formatArtist(curTrack?.artist) || '未知歌手'}</div>
          </div>
        </div>

        <!-- 1.2 中间：核心控制按键 + 全宽进度条 -->
        <div class="pc-center-section">
          <div class="pc-main-controls">
            <button
              class="pc-ctrl-btn"
              onclick={onToggleMode}
              title={playMode === 'single' ? '单曲循环' : (playMode === 'shuffle' ? '随机播放' : '列表循环')}
            >
              {playMode === 'single' ? '🔂' : (playMode === 'shuffle' ? '🔀' : '🔁')}
            </button>
            <button class="pc-ctrl-btn" onclick={onPrev} title="上一首">⏮</button>
            <button class="pc-ctrl-btn pc-play-btn" onclick={onTogglePlay} title={playing ? '暂停' : '播放'}>
              {playing ? '⏸' : '▶'}
            </button>
            <button class="pc-ctrl-btn" onclick={onNext} title="下一首">⏭</button>
          </div>
          <!-- 进度条区 -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="pc-progress-container">
            <span class="pc-time-stamp">{formatTime(curTime)}</span>
            <div class="pc-progress-bar-wrapper" onclick={onSeek}>
              <div class="pc-progress-bar-bg"></div>
              <div class="pc-progress-bar-fill" style="width: {progressRatio * 100}%;"></div>
              <div class="pc-progress-bar-handle" style="left: {progressRatio * 100}%;"></div>
            </div>
            <span class="pc-time-stamp">{formatTime(duration)}</span>
          </div>
        </div>

        <!-- 1.3 右侧：功能控制与平滑音量条 -->
        <div class="pc-right-section">
          <button class="pc-action-btn" onclick={onLyric} title="全屏沉浸歌词">🎤</button>
          <button class="pc-action-btn" onclick={onPeq} title="5段参量均衡器 (PEQ)">🎛️</button>
          <button class="pc-action-btn pc-playlist-btn" onclick={onQueue} title="当前播放列表">
            📜
            <span class="badge-count-pill">{queue.length}</span>
          </button>
          <div class="pc-volume-wrap">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="pc-vol-icon" onclick={() => { vol = vol > 0 ? 0 : 0.8; }} title="静音切换">
              {vol === 0 ? '🔇' : vol < 0.4 ? '🔉' : '🔊'}
            </span>
            <input type="range" min="0" max="1" step="0.02" bind:value={vol} class="pc-volume-slider" />
          </div>
          <button class="pc-action-btn pc-close-btn" onclick={() => minimized = true} title="收起为黑胶悬浮球">✕</button>
        </div>
      </div>
    </div>

    <!-- =========================================================================
         📱 2. SP 移动端专属：大触控三排悬浮卡片 (封面顶格靠左，完全独立排版)
         ========================================================================= -->
    <div class="sp-player-card">
      <!-- 2.1 第一排：左侧黑胶封面绝对顶格靠左 + 歌名；右侧快捷工具图标 -->
      <div class="sp-row-top">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="sp-header-left" onclick={onLyric} title="点击展开全屏播放器与歌词">
          <div class="sp-cover-wrapper">
            <svg class="sp-cover-ring" viewBox="0 0 50 50">
              <circle class="sp-ring-bg" cx="25" cy="25" r="23" />
              <circle
                class="sp-ring-progress"
                cx="25"
                cy="25"
                r="23"
                stroke="url(#spRingGradBar)"
                stroke-dasharray="{RING_CIRCUMFERENCE}"
                stroke-dashoffset="{ringDashOffset}"
              />
              <defs>
                <linearGradient id="spRingGradBar" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#ef4444" />
                  <stop offset="100%" stop-color="#f97316" />
                </linearGradient>
              </defs>
            </svg>
            <img
              src={curTrack?.cover || DEFAULT_VINYL_COVER}
              alt="封面"
              class="sp-cover-img"
              class:playing={playing}
              referrerpolicy="no-referrer"
              onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
            />
          </div>
          <div class="sp-meta-text">
            <div class="sp-title-row">
              <span class="sp-song-title">{curTrack?.name || '未在播放'}</span>
              {#if curTrack?.isLocal}
                <span class="audio-source-badge badge-server" title="🖥️ 本地已下载">🖥️</span>
              {/if}
            </div>
            <div class="sp-song-artist">{formatArtist(curTrack?.artist) || '未知歌手'}</div>
          </div>
        </div>

        <!-- 右侧快捷按键 -->
        <div class="sp-header-right">
          <button class="sp-touch-btn" onclick={onLyric} title="全屏沉浸歌词">🎤</button>
          <button class="sp-touch-btn" onclick={onPeq} title="5段参量均衡器 (PEQ)">🎛️</button>
          <button class="sp-touch-btn sp-playlist-touch-btn" onclick={onQueue} title="当前播放列表">
            📜
            <span class="badge-count-pill">{queue.length}</span>
          </button>
          <!-- 移动端音量竖立弹出滑块 -->
          <div class="sp-vol-popup-wrap">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button
              class="sp-touch-btn"
              onclick={() => showSpVol = !showSpVol}
              title={vol === 0 ? '静音' : `音量 ${Math.round(vol * 100)}%`}
            >
              {vol === 0 ? '🔇' : vol < 0.4 ? '🔉' : '🔊'}
            </button>
            {#if showSpVol}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="vol-popup-overlay" onclick={() => showSpVol = false}></div>
              <div class="vol-popup-panel">
                <span class="vol-popup-label">{Math.round(vol * 100)}%</span>
                <input
                  type="range"
                  min="0" max="1" step="0.02"
                  bind:value={vol}
                  class="vol-popup-slider"
                />
                <span class="vol-popup-icon">{vol === 0 ? '🔇' : '🔊'}</span>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- 2.2 第二排：全宽大触控进度条 -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sp-row-progress">
        <span class="sp-time-stamp">{formatTime(curTime)}</span>
        <div class="sp-progress-bar-wrapper" onclick={onSeek}>
          <div class="sp-progress-bar-bg"></div>
          <div class="sp-progress-bar-fill" style="width: {progressRatio * 100}%;"></div>
          <div class="sp-progress-bar-handle" style="left: {progressRatio * 100}%;"></div>
        </div>
        <span class="sp-time-stamp">{formatTime(duration)}</span>
      </div>

      <!-- 2.3 第三排：5个超大触控控制按键 -->
      <div class="sp-row-controls">
        <button
          class="sp-ctrl-btn sp-sub-btn"
          onclick={onToggleMode}
          title={playMode === 'single' ? '单曲循环' : (playMode === 'shuffle' ? '随机播放' : '列表循环')}
        >
          {playMode === 'single' ? '🔂' : (playMode === 'shuffle' ? '🔀' : '🔁')}
        </button>
        <button class="sp-ctrl-btn sp-side-btn" onclick={onPrev} title="上一首">⏮</button>
        <button class="sp-ctrl-btn sp-play-btn" onclick={onTogglePlay} title={playing ? '暂停' : '播放'}>
          {playing ? '⏸' : '▶'}
        </button>
        <button class="sp-ctrl-btn sp-side-btn" onclick={onNext} title="下一首">⏭</button>
        <button class="sp-ctrl-btn sp-sub-btn" onclick={() => minimized = true} title="收起为黑胶悬浮球">
          ✕
        </button>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* ==========================================================================
     💽 微型黑胶悬浮球 (Floating Vinyl Bubble) - PC & SP 通用
     ========================================================================== */
  .floating-vinyl-bubble {
    position: fixed;
    right: 18px;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(15, 23, 42, 0.94);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.15);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
    animation: bubblePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .floating-vinyl-bubble:hover {
    transform: scale(1.1) translateY(-2px);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(239, 68, 68, 0.35);
  }

  .floating-vinyl-bubble:active {
    transform: scale(0.95);
  }

  @keyframes bubblePop {
    from { transform: scale(0.4) translateY(20px); opacity: 0; }
    to   { transform: scale(1) translateY(0); opacity: 1; }
  }

  .vinyl-progress-ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
    pointer-events: none;
  }

  .ring-bg {
    fill: none;
    stroke: rgba(255, 255, 255, 0.1);
    stroke-width: 3;
  }

  .ring-progress {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.25s ease;
  }

  .bubble-vinyl-wrapper {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.6);
  }

  .bubble-vinyl-cover {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .bubble-vinyl-cover.playing {
    animation: spinVinyl 16s linear infinite;
  }

  .bubble-center-dot {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #0f172a;
    border: 2px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
  }

  @keyframes spinVinyl {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* ==========================================================================
     🖥️ PC 桌面端播放器样式 (屏幕宽度 > 768px 显示，否则绝对隐藏)
     ========================================================================== */
  .pc-player-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 74px;
    background: rgba(15, 23, 42, 0.96);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    z-index: 9998;
    padding: 0 24px;
    display: flex;
    align-items: center;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .pc-bar-inner {
    width: 100%;
    max-width: 1280px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }

  /* 1.1 PC 左侧：歌曲信息 */
  .pc-left-section {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 180px;
    max-width: 320px;
    cursor: pointer;
    user-select: none;
  }

  .pc-cover-wrapper {
    position: relative;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pc-cover-ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
    pointer-events: none;
    border-radius: 50%;
  }

  .pc-ring-bg {
    fill: none;
    stroke: transparent;
    stroke-width: 2.5;
  }

  .pc-ring-progress {
    fill: none;
    stroke-width: 2.5;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.2s linear;
  }

  .pc-cover-img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  .pc-cover-img.playing {
    animation: spinVinyl 16s linear infinite;
  }

  .pc-meta-text {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    flex: 1;
  }

  .pc-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
  }

  .pc-song-title {
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4;
  }

  .pc-song-artist {
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  .audio-source-badge {
    padding: 1px 6px;
    font-size: 10px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .badge-server {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  /* 1.2 PC 中间：控制按键 + 进度条 */
  .pc-center-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 2;
    max-width: 580px;
    gap: 6px;
  }

  .pc-main-controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .pc-ctrl-btn {
    background: transparent;
    border: none;
    color: #cbd5e1;
    font-size: 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .pc-ctrl-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
    transform: scale(1.08);
  }

  .pc-ctrl-btn:active {
    transform: scale(0.94);
  }

  .pc-play-btn {
    width: 38px;
    height: 38px;
    background: #ef4444 !important;
    color: #ffffff !important;
    font-size: 16px;
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.45);
  }

  .pc-play-btn:hover {
    background: #dc2626 !important;
    box-shadow: 0 6px 18px rgba(239, 68, 68, 0.6);
    transform: scale(1.08);
  }

  .pc-progress-container {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .pc-time-stamp {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: #94a3b8;
    min-width: 36px;
    text-align: center;
  }

  .pc-progress-bar-wrapper {
    position: relative;
    flex: 1;
    height: 16px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .pc-progress-bar-bg {
    position: absolute;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
    transition: height 0.15s ease;
  }

  .pc-progress-bar-fill {
    position: absolute;
    height: 4px;
    background: linear-gradient(90deg, #ef4444, #f97316);
    border-radius: 2px;
    transition: height 0.15s ease;
  }

  .pc-progress-bar-handle {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.4);
    transform: translate(-50%, 0);
    opacity: 0;
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .pc-progress-bar-wrapper:hover .pc-progress-bar-bg,
  .pc-progress-bar-wrapper:hover .pc-progress-bar-fill {
    height: 6px;
  }

  .pc-progress-bar-wrapper:hover .pc-progress-bar-handle {
    opacity: 1;
    transform: translate(-50%, 0) scale(1.2);
  }

  /* 1.3 PC 右侧：功能控制与音量条 */
  .pc-right-section {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    flex: 1;
    min-width: 220px;
    max-width: 320px;
  }

  .pc-action-btn {
    background: transparent;
    border: none;
    color: #cbd5e1;
    font-size: 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    transition: all 0.2s ease;
    position: relative;
  }

  .pc-action-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
  }

  .pc-playlist-btn {
    position: relative;
  }

  .badge-count-pill {
    position: absolute;
    top: -2px;
    right: -2px;
    background: #ef4444;
    color: #ffffff;
    font-size: 9px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 10px;
    border: 1px solid rgba(0, 0, 0, 0.4);
  }

  .pc-volume-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .pc-vol-icon {
    font-size: 15px;
    cursor: pointer;
    user-select: none;
  }

  .pc-volume-slider {
    width: 78px;
    height: 4px;
    accent-color: #ef4444;
    cursor: pointer;
  }

  .pc-close-btn {
    font-size: 13px;
    color: #64748b;
    border-radius: 50%;
    width: 28px;
    height: 28px;
  }
  .pc-close-btn:hover {
    color: #f87171;
    background: rgba(239, 68, 68, 0.15);
  }

  /* ==========================================================================
     📱 SP 移动端专属播放器样式 (屏幕宽度 <= 768px 显示，否则绝对隐藏)
     ========================================================================== */
  .sp-player-card {
    position: fixed;
    bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    left: 10px;
    right: 10px;
    border-radius: 20px;
    background: var(--card-bg-solid, #121826);
    box-shadow: 0 16px 44px rgba(0, 0, 0, 0.45), 0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.18);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
    z-index: 9998;
    padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px)) 2px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* 2.1 SP 第一排：封面顶格靠左 + 歌名；右侧快捷按键 */
  .sp-row-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0 2px 0 0;
  }

  .sp-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
    overflow: hidden;
  }

  .sp-cover-wrapper {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
  }

  .sp-cover-ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
    pointer-events: none;
    border-radius: 50%;
  }

  .sp-ring-bg {
    fill: none;
    stroke: transparent;
    stroke-width: 2.5;
  }

  .sp-ring-progress {
    fill: none;
    stroke-width: 2.5;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.2s linear;
  }

  .sp-cover-img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
    margin: 0;
    padding: 0;
  }

  .sp-cover-img.playing {
    animation: spinVinyl 16s linear infinite;
  }

  .sp-meta-text {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    flex: 1;
  }

  .sp-title-row {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow: hidden;
  }

  .sp-song-title {
    font-size: 14.5px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.25;
  }

  .sp-song-artist {
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  .sp-header-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .sp-touch-btn {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
    font-size: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .sp-touch-btn:active {
    transform: scale(0.92);
    background: rgba(255, 255, 255, 0.16);
  }

  .sp-playlist-touch-btn {
    position: relative;
  }

  /* 音量竖立弹窗 */
  .sp-vol-popup-wrap {
    position: relative;
    display: inline-flex;
  }

  .vol-popup-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
  }

  .vol-popup-panel {
    position: absolute;
    bottom: calc(100% + 10px);
    right: 50%;
    transform: translateX(50%);
    background: var(--card-bg-solid, #1e293b);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.18));
    border-radius: 14px;
    padding: 14px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    z-index: 10000;
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.6);
    animation: volPopIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes volPopIn {
    from { opacity: 0; transform: translateX(50%) scale(0.85) translateY(8px); }
    to   { opacity: 1; transform: translateX(50%) scale(1) translateY(0); }
  }

  .vol-popup-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary, #94a3b8);
  }

  .vol-popup-icon {
    font-size: 15px;
  }

  .vol-popup-slider {
    writing-mode: vertical-lr;
    direction: rtl;
    appearance: slider-vertical;
    -webkit-appearance: slider-vertical;
    width: 6px;
    height: 110px;
    accent-color: #ef4444;
    cursor: pointer;
  }

  /* 2.2 SP 第二排：全宽进度条 */
  .sp-row-progress {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 4px;
  }

  .sp-time-stamp {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: #94a3b8;
    min-width: 34px;
    text-align: center;
  }

  .sp-progress-bar-wrapper {
    position: relative;
    flex: 1;
    height: 24px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .sp-progress-bar-bg {
    position: absolute;
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.18);
    border-radius: 3px;
  }

  .sp-progress-bar-fill {
    position: absolute;
    height: 6px;
    background: linear-gradient(90deg, #ef4444, #f97316);
    border-radius: 3px;
  }

  .sp-progress-bar-handle {
    position: absolute;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    transform: translate(-50%, 0);
  }

  /* 2.3 SP 第三排：大触控控制按键组 */
  .sp-row-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 2px 4px;
  }

  .sp-ctrl-btn {
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    user-select: none;
  }

  .sp-ctrl-btn:active {
    transform: scale(0.92);
  }

  .sp-sub-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #ffffff;
    font-size: 17px;
  }

  .sp-side-btn {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: #ffffff;
    font-size: 20px;
  }

  .sp-play-btn {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: #ef4444;
    color: #ffffff;
    font-size: 22px;
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.5);
  }

  /* ==========================================================================
     📐 响应式物理隔离 (Desktop vs Mobile)
     ========================================================================== */
  @media (min-width: 769px) {
    .pc-player-bar {
      display: flex !important;
    }
    .sp-player-card {
      display: none !important;
    }
  }

  @media (max-width: 768px) {
    .pc-player-bar {
      display: none !important;
    }
    .sp-player-card {
      display: flex !important;
    }
  }
</style>
