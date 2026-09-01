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

  let showVolPopup = $state(false);
  const RING_CIRCUMFERENCE = 144.513;
</script>

<div class="sp-player-card">
  <!-- 2.1 顶部区域：左侧黑胶封面；右侧上下两行（上行歌名满宽独占，下行歌手与4个按钮并排） -->
  <div class="sp-top-section">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sp-cover-wrapper" onclick={onLyric} title="点击展开全屏播放器与歌词">
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

    <!-- 右侧两行信息栏 -->
    <div class="sp-info-col">
      <!-- 🌟 上排：歌名完全一整排独占，绝不被按钮挤压 -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sp-title-fullrow" onclick={onLyric} title="点击展开全屏播放器与歌词">
        <span class="sp-song-title">{curTrack?.name || '未在播放'}</span>
        {#if curTrack?.isLocal}
          <span class="audio-source-badge badge-server" title="🖥️ 本地已下载">🖥️</span>
        {/if}
      </div>

      <!-- 🌟 下排：歌手名 与 4个快捷工具按钮在同一排 -->
      <div class="sp-artist-tools-row">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="sp-song-artist" onclick={onLyric} title="点击展开全屏播放器与歌词">
          {formatArtist(curTrack?.artist) || '未知歌手'}
        </div>

        <!-- 4个快捷按键 (与歌手名同行对齐) -->
        <div class="sp-tools-group">
          <button class="sp-touch-btn" onclick={onLyric} title="全屏沉浸歌词">🎤</button>
          <button class="sp-touch-btn" onclick={onPeq} title="5段参量均衡器 (PEQ)">🎛️</button>
          <button class="sp-touch-btn sp-playlist-touch-btn" onclick={onQueue} title="当前播放列表">
            📜
            <span class="badge-count-pill">{queue.length}</span>
          </button>
          <!-- 移动端音量竖立弹出滑块 -->
          <div class="sp-vol-popup-wrap">
            <button
              class="sp-touch-btn"
              onclick={() => showVolPopup = !showVolPopup}
              title={vol === 0 ? '静音' : `音量 ${Math.round(vol * 100)}%`}
            >
              {vol === 0 ? '🔇' : vol < 0.4 ? '🔉' : '🔊'}
            </button>
            {#if showVolPopup}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="vol-popup-overlay" onclick={() => showVolPopup = false}></div>
              <div class="vol-popup-panel">
                <span class="vol-popup-label">{Math.round(vol * 100)}%</span>
                <input type="range" min="0" max="1" step="0.02" bind:value={vol} class="vol-popup-slider" />
                <span class="vol-popup-icon">{vol === 0 ? '🔇' : '🔊'}</span>
              </div>
            {/if}
          </div>
        </div>
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
      <div class="sp-progress-handle" style="left: {progressRatio * 100}%;"></div>
    </div>
    <span class="sp-time-stamp">{formatTime(duration)}</span>
  </div>

  <!-- 2.3 第三排：5个超大触控控制按键 (自适应黑夜/白天主题) -->
  <div class="sp-row-controls">
    <button class="sp-ctrl-btn sp-sub-btn" onclick={onToggleMode} title={playMode === 'single' ? '单曲循环' : (playMode === 'shuffle' ? '随机播放' : '列表循环')}>
      {playMode === 'single' ? '🔂' : (playMode === 'shuffle' ? '🔀' : '🔁')}
    </button>
    <button class="sp-ctrl-btn sp-side-btn" onclick={onPrev} title="上一首">⏮</button>
    <button class="sp-ctrl-btn sp-play-btn" onclick={onTogglePlay} title={playing ? '暂停' : '播放'}>
      {playing ? '⏸' : '▶'}
    </button>
    <button class="sp-ctrl-btn sp-side-btn" onclick={onNext} title="下一首">⏭</button>
    <button class="sp-ctrl-btn sp-sub-btn sp-close-btn" onclick={onMinimize} title="收起为黑胶悬浮球">✕</button>
  </div>
</div>

<style>
  .sp-player-card {
    position: fixed; bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    left: 10px; right: 10px; border-radius: 20px;
    background: var(--card-bg-solid, #121826); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    box-shadow: 0 16px 44px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.15);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15)); z-index: 9998;
    padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px)) 8px;
    display: flex; flex-direction: column; gap: 8px; transition: background 0.3s ease, border-color 0.3s ease;
  }
  :global([data-theme="light"]) .sp-player-card {
    background: rgba(255, 255, 255, 0.96) !important;
    border: 1px solid rgba(0, 0, 0, 0.1) !important;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06) !important;
  }

  /* 顶部两行混合布局 */
  .sp-top-section {
    display: flex; align-items: center; gap: 10px; width: 100%;
  }
  .sp-cover-wrapper {
    position: relative; width: 44px; height: 44px; border-radius: 50%;
    flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    margin: 0; padding: 0; cursor: pointer;
  }
  .sp-cover-ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); pointer-events: none; border-radius: 50%; }
  .sp-ring-bg { fill: none; stroke: transparent; stroke-width: 2.5; }
  .sp-ring-progress { fill: none; stroke-width: 2.5; stroke-linecap: round; transition: stroke-dashoffset 0.2s linear; }
  .sp-cover-img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; display: block; margin: 0; padding: 0; }
  .sp-cover-img.playing { animation: spinVinyl 16s linear infinite; }
  @keyframes spinVinyl { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .sp-info-col {
    display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 3px;
  }
  .sp-title-fullrow {
    display: flex; align-items: center; gap: 6px; width: 100%; overflow: hidden; cursor: pointer;
  }
  .sp-song-title {
    font-size: 14.5px; font-weight: 700; color: var(--text-main, #0f172a);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25;
  }
  .audio-source-badge { padding: 1px 5px; font-size: 10px; border-radius: 4px; flex-shrink: 0; display: inline-flex; align-items: center; }
  .badge-server { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }

  .sp-artist-tools-row {
    display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%;
  }
  .sp-song-artist {
    font-size: 12px; color: var(--text-secondary, #64748b);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    flex: 1; min-width: 0; cursor: pointer;
  }

  .sp-tools-group {
    display: flex; align-items: center; gap: 5px; flex-shrink: 0;
  }
  .sp-touch-btn {
    width: 28px; height: 28px; border-radius: 8px; background: var(--btn-slot-bg, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.08)); font-size: 13px; display: inline-flex;
    align-items: center; justify-content: center; color: var(--text-main, #0f172a); cursor: pointer; transition: all 0.15s ease;
  }
  .sp-touch-btn:active { transform: scale(0.92); background: var(--btn-hover-bg, rgba(0, 0, 0, 0.12)); }
  .sp-playlist-touch-btn { position: relative; }
  .badge-count-pill {
    position: absolute; top: -3px; right: -3px; background: #ef4444; color: #ffffff;
    font-size: 8px; font-weight: 700; padding: 0 3px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.6);
  }
  .sp-vol-popup-wrap { position: relative; display: inline-flex; }
  .vol-popup-overlay { position: fixed; inset: 0; z-index: 9999; }
  .vol-popup-panel {
    position: absolute; bottom: calc(100% + 10px); right: 50%; transform: translateX(50%);
    background: var(--card-bg-solid, #ffffff); border: 1px solid var(--border-color, rgba(0, 0, 0, 0.12));
    border-radius: 14px; padding: 12px 8px; display: flex; flex-direction: column; align-items: center;
    gap: 8px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2); z-index: 10000; width: 36px;
  }
  .vol-popup-label { font-size: 10px; font-weight: 700; color: var(--text-main, #0f172a); }
  .vol-popup-slider {
    writing-mode: vertical-lr; direction: rtl; -webkit-appearance: slider-vertical;
    width: 6px; height: 90px; cursor: pointer; accent-color: #ef4444; margin: 4px 0;
  }
  .vol-popup-icon { font-size: 14px; }

  /* 进度条与底栏控制 */
  .sp-row-progress { display: flex; align-items: center; gap: 8px; width: 100%; }
  .sp-time-stamp { font-size: 11px; color: var(--text-secondary, #64748b); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .sp-progress-bar-wrapper { position: relative; flex: 1; height: 20px; display: flex; align-items: center; cursor: pointer; }
  .sp-progress-bar-bg { width: 100%; height: 4px; background: var(--border-color, rgba(0, 0, 0, 0.08)); border-radius: 2px; }
  .sp-progress-bar-fill { position: absolute; left: 0; height: 4px; background: #ef4444; border-radius: 2px; }
  .sp-progress-handle {
    position: absolute; width: 12px; height: 12px; border-radius: 50%; background: #ffffff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4); transform: translate(-50%, 0);
  }

  .sp-row-controls { display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 6px; }
  .sp-ctrl-btn {
    border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s ease, background 0.15s ease;
  }
  .sp-ctrl-btn:active { transform: scale(0.9); }
  .sp-play-btn {
    width: 48px; height: 48px; background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff;
    font-size: 20px; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
  }
  .sp-side-btn {
    width: 40px; height: 40px; background: var(--btn-slot-bg, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.08)); color: var(--text-main, #0f172a); font-size: 16px;
  }
  .sp-sub-btn {
    width: 34px; height: 34px; background: var(--btn-slot-bg, rgba(0, 0, 0, 0.03));
    border: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.06)); color: var(--text-secondary, #64748b); font-size: 14px;
  }
</style>
