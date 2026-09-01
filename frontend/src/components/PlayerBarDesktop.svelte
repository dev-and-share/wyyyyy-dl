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
    vol = $bindable(0.8),
    progressRatio = 0,
    ringDashOffset = 0,
    onTogglePlay,
    onPrev,
    onNext,
    onToggleMode,
    onSeek,
    onLyric,
    onPeq,
    onQueue,
    onMinimize
  } = $props<{
    curTrack: Track | null;
    queue: Track[];
    playing: boolean;
    curTime: number;
    duration: number;
    playMode: 'list' | 'single' | 'shuffle';
    vol: number;
    progressRatio: number;
    ringDashOffset: number;
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    onToggleMode: () => void;
    onSeek: (e: MouseEvent) => void;
    onLyric: () => void;
    onPeq: () => void;
    onQueue: () => void;
    onMinimize: () => void;
  }>();

  const RING_CIRCUMFERENCE = 144.513;
</script>

<div class="pc-player-bar">
  <div class="pc-bar-inner">
    <!-- 1. 左侧：黑胶封面与歌曲元信息 -->
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

    <!-- 2. 中间：核心控制按键 + 全宽进度条 -->
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
          <div class="pc-progress-bg"></div>
          <div class="pc-progress-fill" style="width: {progressRatio * 100}%;"></div>
          <div class="pc-progress-handle" style="left: {progressRatio * 100}%;"></div>
        </div>
        <span class="pc-time-stamp">{formatTime(duration)}</span>
      </div>
    </div>

    <!-- 3. 右侧：功能控制与平滑音量条 -->
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
      <button class="pc-action-btn pc-close-btn" onclick={onMinimize} title="收起为黑胶悬浮球">✕</button>
    </div>
  </div>
</div>

<style>
  .pc-player-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 74px;
    background: var(--card-bg-solid, rgba(15, 23, 42, 0.96));
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
    box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    z-index: 9998;
    padding: 0 24px;
    display: flex;
    align-items: center;
    transition: background 0.3s ease, border-color 0.3s ease;
  }

  /* 白天模式精修 */
  :global([data-theme="light"]) .pc-player-bar {
    background: rgba(255, 255, 255, 0.96) !important;
    border-top: 1px solid rgba(0, 0, 0, 0.08) !important;
    box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
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

  @keyframes spinVinyl {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
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
    color: var(--text-main, #0f172a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4;
  }

  .pc-song-artist {
    font-size: 12px;
    color: var(--text-secondary, #64748b);
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
    display: inline-flex;
    align-items: center;
  }
  .badge-server {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
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
    color: var(--text-main, #0f172a);
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
    background: var(--btn-slot-bg, rgba(0, 0, 0, 0.06));
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
    color: var(--text-muted, #94a3b8);
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

  .pc-progress-bg {
    position: absolute;
    width: 100%;
    height: 4px;
    background: var(--btn-slot-bg, rgba(0, 0, 0, 0.1));
    border-radius: 2px;
    transition: height 0.15s ease;
  }

  :global([data-theme="dark"]) .pc-progress-bg {
    background: rgba(255, 255, 255, 0.15);
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
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.35);
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
    color: var(--text-main, #0f172a);
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
    background: var(--btn-slot-bg, rgba(0, 0, 0, 0.06));
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
    border: 1px solid rgba(255, 255, 255, 0.6);
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
    color: var(--text-main, #0f172a);
  }

  .pc-volume-slider {
    width: 78px;
    height: 4px;
    accent-color: #ef4444;
    cursor: pointer;
  }

  .pc-close-btn {
    font-size: 13px;
    color: var(--text-muted, #64748b);
    border-radius: 50%;
    width: 28px;
    height: 28px;
  }
  .pc-close-btn:hover {
    color: #f87171;
    background: rgba(239, 68, 68, 0.15);
  }
</style>
