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

  // 环形进度计算 (半径 r=23, 周长 2*pi*23 ≈ 144.513)
  const RING_CIRCUMFERENCE = 144.513;
  let progressRatio = $derived(duration > 0 ? Math.min(1, Math.max(0, curTime / duration)) : 0);
  let ringDashOffset = $derived(RING_CIRCUMFERENCE * (1 - progressRatio));
</script>

{#if queue.length > 0 && curTrack}
  {#if minimized}
    <!-- 💽 最小化：微型黑胶悬浮球 + 环形进度光圈 -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="floating-vinyl-bubble" onclick={() => minimized = false} title="点击展开播放控制栏 (进度 {Math.round(progressRatio * 100)}%)">
      <!-- 环形动态进度条 SVG -->
      <svg class="vinyl-progress-ring" viewBox="0 0 54 54">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="100%" stop-color="#f97316" />
          </linearGradient>
        </defs>
        <!-- 轨道底圈 -->
        <circle class="ring-bg" cx="27" cy="27" r="23" />
        <!-- 动态高亮进度圈 -->
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

      <!-- 旋转黑胶封面图片 -->
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
    <!-- 🎬 完整展开播放栏 (PC三段式 / SP大触控三排) -->
    <div class="bottom-audio-bar">
      <div class="audio-bar-inner">
        <!-- 1. 左侧：歌曲信息与黑胶封面 -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="audio-left-section" onclick={onLyric} title="点击展开全屏播放器与歌词">
          <!-- 封面外圈同样支持环形进度圈 -->
          <div class="vinyl-cover-wrapper">
            <svg class="inner-cover-ring" viewBox="0 0 50 50">
              <circle class="inner-ring-bg" cx="25" cy="25" r="23" />
              <circle
                class="inner-ring-progress"
                cx="25"
                cy="25"
                r="23"
                stroke="url(#ringGradBar)"
                stroke-dasharray="144.513"
                stroke-dashoffset="{ringDashOffset}"
              />
              <defs>
                <linearGradient id="ringGradBar" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#ef4444" />
                  <stop offset="100%" stop-color="#f97316" />
                </linearGradient>
              </defs>
            </svg>
            <img
              src={curTrack?.cover || DEFAULT_VINYL_COVER}
              alt="封面"
              class="audio-cover"
              class:playing={playing}
              referrerpolicy="no-referrer"
              onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
            />
          </div>
          <div class="audio-text">
            <div class="audio-title-row">
              <span class="audio-title">{curTrack?.name || '未在播放'}</span>
              {#if curTrack?.isLocal}
                <span class="audio-source-badge icon-only badge-server pc-only" title="🖥️ 本地已下载">🖥️</span>
              {/if}
            </div>
            <div class="audio-artist">{formatArtist(curTrack?.artist) || '未知歌手'}</div>
          </div>
        </div>

        <!-- 2. 中间：进度条与主控键 -->
        <div class="audio-center-section">
          <!-- 进度条区 -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="audio-progress-container">
            <span class="time-stamp">{formatTime(curTime)}</span>
            <div class="progress-bar-wrapper" onclick={onSeek}>
              <div class="progress-bar-bg"></div>
              <div class="progress-bar-fill" style="width: {progressRatio * 100}%;"></div>
              <div class="progress-bar-handle" style="left: {progressRatio * 100}%;"></div>
            </div>
            <span class="time-stamp">{formatTime(duration)}</span>
          </div>

          <!-- 核心控制按键 -->
          <div class="audio-main-controls">
            <button
              class="ctrl-btn sub-btn sp-touch-sub-btn"
              onclick={onToggleMode}
              title={playMode === 'single' ? '单曲循环' : (playMode === 'shuffle' ? '随机播放' : '列表循环')}
            >
              {playMode === 'single' ? '🔂' : (playMode === 'shuffle' ? '🔀' : '🔁')}
            </button>
            <button class="ctrl-btn sub-btn sp-touch-side-btn" onclick={onPrev} title="上一首">⏮</button>
            <button class="ctrl-btn play-main-btn sp-touch-play-btn" onclick={onTogglePlay} title={playing ? '暂停' : '播放'}>
              {playing ? '⏸' : '▶'}
            </button>
            <button class="ctrl-btn sub-btn sp-touch-side-btn" onclick={onNext} title="下一首">⏭</button>
            <button class="ctrl-btn sub-btn sp-touch-sub-btn sp-only-flex" onclick={() => minimized = true} title="收起为黑胶悬浮球">
              ✕
            </button>
          </div>
        </div>

        <!-- 3. 右侧：功能控制区 -->
        <div class="audio-right-section">
          <button class="ctrl-btn sub-btn sp-touch-top-action" onclick={onLyric} title="全屏沉浸歌词">🎤</button>
          <button class="ctrl-btn sub-btn sp-touch-top-action" onclick={onPeq} title="5段参量均衡器 (PEQ)">🎛️</button>
          <button class="ctrl-btn sub-btn playlist-btn-wrap sp-touch-top-action" onclick={onQueue} title="当前播放列表">
            📜
            <span class="badge-count-pill">{queue.length}</span>
          </button>

          <!-- PC 端音量滑块与收起按钮 -->
          <div class="volume-container pc-only">
            <span class="vol-icon" onclick={() => { vol = vol > 0 ? 0 : 0.8; }} title="静音切换">
              {vol === 0 ? '🔇' : '🔊'}
            </span>
            <input type="range" min="0" max="1" step="0.05" bind:value={vol} class="volume-slider" style="width: 70px;" />
          </div>
          <button class="ctrl-btn mini-close-btn pc-only" onclick={() => minimized = true} title="收起为黑胶悬浮球">✕</button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* --------------------------------------------------------------------------
     💽 微型黑胶悬浮球 (Floating Vinyl Bubble) + 动态环形进度条
     -------------------------------------------------------------------------- */
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
    from { transform: scale(0.5) translateY(20px); opacity: 0; }
    to { transform: scale(1) translateY(0); opacity: 1; }
  }

  /* SVG 环形进度圈 */
  .vinyl-progress-ring {
    position: absolute;
    top: 0;
    left: 0;
    width: 56px;
    height: 56px;
    transform: rotate(-90deg);
    pointer-events: none;
  }

  .ring-bg {
    fill: none;
    stroke: rgba(255, 255, 255, 0.12);
    stroke-width: 3.5;
  }

  .ring-progress {
    fill: none;
    stroke-width: 3.5;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.2s linear;
    filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.7));
  }

  /* 悬浮球内部黑胶封面 */
  .bubble-vinyl-wrapper {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.6);
  }

  .bubble-vinyl-cover {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .bubble-vinyl-cover.playing {
    animation: spin 16s linear infinite;
  }

  .bubble-center-dot {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #0f172a;
    border: 2px solid #fff;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
    pointer-events: none;
  }

  /* --------------------------------------------------------------------------
     🎵 现代三段式音频播放器 (PC 极简横排 / SP 移动端大按键三排布局)
     -------------------------------------------------------------------------- */
  .bottom-audio-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 74px;
    background: rgba(15, 23, 42, 0.97);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    border-top: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.65), 0 -2px 12px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    z-index: 9998;
    padding: 0 24px;
    display: flex;
    align-items: center;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .audio-bar-inner {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  /* 1. 左侧歌曲元信息与带进度环的黑胶封面 */
  .audio-left-section {
    display: flex;
    align-items: center;
    gap: 14px;
    flex: 1;
    min-width: 0;
    max-width: 320px;
    cursor: pointer;
    user-select: none;
  }

  .vinyl-cover-wrapper {
    position: relative;
    width: 46px;
    height: 46px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .inner-cover-ring {
    position: absolute;
    inset: -2px;
    width: 50px;
    height: 50px;
    transform: rotate(-90deg);
    pointer-events: none;
  }
  .inner-ring-bg {
    fill: none;
    stroke: rgba(255, 255, 255, 0.1);
    stroke-width: 2.5;
  }
  .inner-ring-progress {
    fill: none;
    stroke-width: 2.5;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.2s linear;
  }

  .audio-cover {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    background: transparent;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  }

  .audio-cover.playing {
    animation: spin 16s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .audio-text {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    flex: 1;
  }

  .audio-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    width: 100%;
    min-width: 0;
  }

  .audio-title {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
    display: block;
    max-width: 100%;
  }

  .audio-artist {
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
    display: block;
    max-width: 100%;
  }

  /* 2. 中间 PC 控制器与进度条 */
  .audio-center-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex: 2;
    max-width: 580px;
  }

  .audio-progress-container {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .time-stamp {
    font-size: 11px;
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
    font-family: Consolas, monospace;
    min-width: 36px;
    text-align: center;
    user-select: none;
  }

  .progress-bar-wrapper {
    position: relative;
    flex: 1;
    height: 18px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .progress-bar-bg {
    position: absolute;
    left: 0;
    right: 0;
    height: 4px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.12);
    transition: height 0.15s ease;
  }

  .progress-bar-wrapper:hover .progress-bar-bg {
    height: 6px;
  }

  .progress-bar-fill {
    position: absolute;
    left: 0;
    height: 4px;
    border-radius: 4px;
    background: linear-gradient(90deg, #ef4444, #f97316);
    pointer-events: none;
    transition: height 0.15s ease;
  }

  .progress-bar-wrapper:hover .progress-bar-fill {
    height: 6px;
  }

  .progress-bar-handle {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
    top: 50%;
    transform: translate(-50%, -50%) scale(0);
    pointer-events: none;
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .progress-bar-wrapper:hover .progress-bar-handle {
    transform: translate(-50%, -50%) scale(1);
  }

  .audio-main-controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .ctrl-btn {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    user-select: none;
  }

  .ctrl-btn.sub-btn {
    color: #cbd5e1;
    font-size: 16px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }
  .ctrl-btn.sub-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .ctrl-btn.play-main-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #ffffff;
    font-size: 18px;
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.45);
  }
  .ctrl-btn.play-main-btn:hover {
    transform: scale(1.06);
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6);
  }
  .ctrl-btn.play-main-btn:active {
    transform: scale(0.96);
  }

  /* 3. 右侧功能区 */
  .audio-right-section {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    justify-content: flex-end;
    min-width: 160px;
  }

  .playlist-btn-wrap {
    position: relative;
    font-size: 16px;
  }

  .badge-count-pill {
    position: absolute;
    top: -4px;
    right: -6px;
    background: #ef4444;
    color: white;
    font-size: 9px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 10px;
    line-height: 1;
  }

  .volume-container {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .vol-icon {
    font-size: 14px;
    cursor: pointer;
    color: #94a3b8;
  }

  .ctrl-btn.mini-close-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    font-size: 12px;
    color: #64748b;
  }
  .ctrl-btn.mini-close-btn:hover {
    color: #f87171;
    background: rgba(239, 68, 68, 0.1);
  }

  .sp-only-flex {
    display: none;
  }

  /* --------------------------------------------------------------------------
     📱 移动端 (SP) 超大触控靶心布局 (彻底解决按错/难按问题)
     -------------------------------------------------------------------------- */
  @media (max-width: 768px) {
    .pc-only {
      display: none !important;
    }
    .sp-only-flex {
      display: inline-flex !important;
    }

    .bottom-audio-bar {
      height: auto !important;
      min-height: 148px !important;
      bottom: calc(10px + env(safe-area-inset-bottom, 0px)) !important;
      left: 10px !important;
      right: 10px !important;
      padding: 12px 14px calc(10px + env(safe-area-inset-bottom, 0px)) 14px !important;
      border-radius: 20px !important;
      background: rgba(18, 24, 38, 0.98) !important;
      box-shadow: 0 16px 44px rgba(0, 0, 0, 0.75), 0 4px 16px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.18) !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      display: block !important;
    }

    .audio-bar-inner {
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
      width: 100% !important;
      position: relative !important;
    }

    /* 1. 第一排：左侧大封面+歌名 (严格限制宽度避让右侧按钮，彻底杜绝重叠覆盖) */
    .audio-left-section {
      display: flex !important;
      align-items: center !important;
      max-width: calc(100% - 150px) !important;
      width: calc(100% - 150px) !important;
      gap: 10px !important;
      min-width: 0 !important;
      overflow: hidden !important;
    }

    .vinyl-cover-wrapper {
      width: 48px !important;
      height: 48px !important;
    }
    .audio-cover {
      width: 42px !important;
      height: 42px !important;
    }

    .audio-title {
      font-size: 14.5px !important;
      font-weight: 700 !important;
      line-height: 1.2 !important;
    }

    .audio-artist {
      font-size: 12px !important;
      color: #94a3b8 !important;
      margin-top: 2px !important;
    }

    .audio-right-section {
      position: absolute !important;
      right: 0 !important;
      top: 0 !important;
      display: flex !important;
      gap: 8px !important;
      align-items: center !important;
      min-width: unset !important;
    }

    .sp-touch-top-action {
      width: 38px !important;
      height: 38px !important;
      border-radius: 10px !important;
      background: rgba(255, 255, 255, 0.08) !important;
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
      font-size: 16px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    .sp-touch-top-action:active {
      transform: scale(0.92) !important;
      background: rgba(255, 255, 255, 0.16) !important;
    }

    /* 2. 第二排：满宽进度条与时间显示 (上下扩大点击感应区) */
    .audio-center-section {
      width: 100% !important;
      max-width: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
      margin-top: 2px !important;
    }

    .audio-progress-container {
      width: 100% !important;
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
    }

    .time-stamp {
      font-size: 12px !important;
      color: #94a3b8 !important;
      font-weight: 500 !important;
    }

    .progress-bar-wrapper {
      height: 24px !important;
    }
    .progress-bar-bg {
      height: 6px !important;
      border-radius: 3px !important;
    }
    .progress-bar-fill {
      height: 6px !important;
      border-radius: 3px !important;
      top: 9px !important;
    }
    .progress-bar-handle {
      width: 16px !important;
      height: 16px !important;
      margin-left: -8px !important;
      top: 4px !important;
      opacity: 1 !important;
      background: #ffffff !important;
      box-shadow: 0 0 8px rgba(0, 0, 0, 0.7) !important;
    }

    /* 3. 第三排：超大按键控制条 (等距宽阔，绝不误触) */
    .audio-main-controls {
      width: 100% !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding: 0 4px !important;
    }

    .sp-touch-sub-btn {
      width: 44px !important;
      height: 44px !important;
      border-radius: 50% !important;
      background: rgba(255, 255, 255, 0.07) !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      font-size: 17px !important;
    }
    .sp-touch-sub-btn:active {
      transform: scale(0.9) !important;
      background: rgba(255, 255, 255, 0.18) !important;
    }

    .sp-touch-side-btn {
      width: 48px !important;
      height: 48px !important;
      border-radius: 50% !important;
      background: rgba(255, 255, 255, 0.08) !important;
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
      font-size: 19px !important;
      font-weight: 700 !important;
    }
    .sp-touch-side-btn:active {
      transform: scale(0.9) !important;
      background: rgba(255, 255, 255, 0.2) !important;
    }

    .sp-touch-play-btn {
      width: 58px !important;
      height: 58px !important;
      border-radius: 50% !important;
      background: linear-gradient(135deg, #ef4444, #dc2626) !important;
      box-shadow: 0 4px 18px rgba(239, 68, 68, 0.6) !important;
      font-size: 24px !important;
      border: none !important;
    }
    .sp-touch-play-btn:active {
      transform: scale(0.9) !important;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4) !important;
    }
  }

  /* ☀️ 白底/浅色主题适配 (Light Theme) */
  :global([data-theme="light"]) .floating-vinyl-bubble {
    background: rgba(255, 255, 255, 0.95) !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.08) !important;
  }
  :global([data-theme="light"]) .ring-bg {
    stroke: rgba(0, 0, 0, 0.08) !important;
  }
  :global([data-theme="light"]) .inner-ring-bg {
    stroke: rgba(0, 0, 0, 0.06) !important;
  }

  :global([data-theme="light"]) .bottom-audio-bar {
    background: rgba(255, 255, 255, 0.95) !important;
    border-top: 1px solid rgba(0, 0, 0, 0.08) !important;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.08) !important;
  }
  :global([data-theme="light"]) .audio-title {
    color: #0f172a !important;
  }
  :global([data-theme="light"]) .audio-artist {
    color: #64748b !important;
  }
  :global([data-theme="light"]) .time-stamp {
    color: #64748b !important;
  }
  :global([data-theme="light"]) .ctrl-btn.sub-btn {
    color: #334155 !important;
  }
  :global([data-theme="light"]) .ctrl-btn.sub-btn:hover {
    color: #0f172a !important;
    background: rgba(0, 0, 0, 0.06) !important;
  }
  :global([data-theme="light"]) .progress-bar-bg {
    background: rgba(0, 0, 0, 0.08) !important;
  }
  :global([data-theme="light"]) .vol-icon {
    color: #64748b !important;
  }
  :global([data-theme="light"]) .ctrl-btn.mini-close-btn {
    color: #94a3b8 !important;
  }
  :global([data-theme="light"]) .ctrl-btn.mini-close-btn:hover {
    color: #ef4444 !important;
    background: rgba(239, 68, 68, 0.1) !important;
  }

  /* 📱 移动端 (SP) 浅色/白底模式专属适配 */
  @media (max-width: 768px) {
    :global([data-theme="light"]) .bottom-audio-bar {
      background: rgba(255, 255, 255, 0.98) !important;
      border: 1px solid rgba(0, 0, 0, 0.1) !important;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12) !important;
    }
    :global([data-theme="light"]) .sp-touch-top-action {
      background: rgba(0, 0, 0, 0.05) !important;
      border: 1px solid rgba(0, 0, 0, 0.08) !important;
      color: #1e293b !important;
    }
    :global([data-theme="light"]) .sp-touch-top-action:active {
      background: rgba(0, 0, 0, 0.1) !important;
    }
    :global([data-theme="light"]) .sp-touch-sub-btn {
      background: rgba(0, 0, 0, 0.05) !important;
      border: 1px solid rgba(0, 0, 0, 0.08) !important;
      color: #1e293b !important;
    }
    :global([data-theme="light"]) .sp-touch-sub-btn:active {
      background: rgba(0, 0, 0, 0.1) !important;
    }
    :global([data-theme="light"]) .sp-touch-side-btn {
      background: rgba(0, 0, 0, 0.06) !important;
      border: 1px solid rgba(0, 0, 0, 0.1) !important;
      color: #0f172a !important;
    }
    :global([data-theme="light"]) .sp-touch-side-btn:active {
      background: rgba(0, 0, 0, 0.12) !important;
    }
  }
</style>
