<script lang="ts">
  import { formatTime, formatArtist } from '../lib/utils';
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
</script>

{#if queue.length > 0 && curTrack}
<div class="bottom-audio-bar">
  <div class="audio-bar-inner">
    <!-- 1. 顶部：歌曲信息与顶部功能键 (SP 端第一排，PC 端左侧) -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="audio-left-section" onclick={onLyric} title="点击展开全屏播放器与歌词">
      <div class="vinyl-cover-wrapper">
        <img
          src={curTrack?.cover || '/favicon.png'}
          alt="封面"
          class="audio-cover"
          class:playing={playing}
          referrerpolicy="no-referrer"
          onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (!img.src.includes('favicon.png')) img.src = '/favicon.png'; }}
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

    <!-- 2. 中间：进度条与主控键 (SP 端多排大触控，PC 端居中) -->
    <div class="audio-center-section">
      <!-- 进度条区 (SP 端满宽第二排) -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="audio-progress-container">
        <span class="time-stamp">{formatTime(curTime)}</span>
        <div class="progress-bar-wrapper" onclick={onSeek}>
          <div class="progress-bar-bg"></div>
          <div class="progress-bar-fill" style="width: {duration ? (curTime / duration * 100) : 0}%;"></div>
          <div class="progress-bar-handle" style="left: {duration ? (curTime / duration * 100) : 0}%;"></div>
        </div>
        <span class="time-stamp">{formatTime(duration)}</span>
      </div>

      <!-- 核心控制按键 (SP 端超大触控第三排) -->
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
        <button class="ctrl-btn sub-btn sp-touch-sub-btn sp-only-flex" onclick={onClearQueue} title="清空/关闭">✕</button>
      </div>
    </div>

    <!-- 3. 右侧：功能控制区 (PC 端右侧，SP 端融入右上角) -->
    <div class="audio-right-section">
      <button class="ctrl-btn sub-btn sp-touch-top-action" onclick={onLyric} title="全屏沉浸歌词">🎤</button>
      <button class="ctrl-btn sub-btn sp-touch-top-action" onclick={onPeq} title="5段参量均衡器 (PEQ)">🎛️</button>
      <button class="ctrl-btn sub-btn playlist-btn-wrap sp-touch-top-action" onclick={onQueue} title="当前播放列表">
        📜
        <span class="badge-count-pill">{queue.length}</span>
      </button>

      <!-- PC 端专享：音量滑块与关闭 -->
      <div class="volume-container pc-only">
        <span class="vol-icon" onclick={() => { vol = vol > 0 ? 0 : 0.8; }} title="静音切换">
          {vol === 0 ? '🔇' : '🔊'}
        </span>
        <input type="range" min="0" max="1" step="0.05" bind:value={vol} class="volume-slider" style="width: 70px;" />
      </div>
      <button class="ctrl-btn mini-close-btn pc-only" onclick={onClearQueue} title="关闭播放器">✕</button>
    </div>
  </div>
</div>
{/if}

<style>
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

  /* 1. 左侧歌曲元信息 */
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
    width: 44px;
    height: 44px;
    flex-shrink: 0;
  }

  .audio-cover {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    background: #1e293b;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    border: 2px solid rgba(255, 255, 255, 0.15);
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
  }

  .audio-title {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .audio-artist {
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  /* 2. 中间 PC 控制器与进度条 */
  .audio-center-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1.6;
    max-width: 560px;
  }

  .audio-main-controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .ctrl-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #f8fafc;
    transition: all 0.2s ease;
    user-select: none;
  }

  .ctrl-btn.sub-btn {
    font-size: 16px;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    color: #cbd5e1;
  }
  .ctrl-btn.sub-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  .ctrl-btn.play-main-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #ffffff;
    font-size: 17px;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  }
  .ctrl-btn.play-main-btn:hover {
    transform: scale(1.06);
    box-shadow: 0 6px 16px rgba(239, 68, 68, 0.6);
  }
  .ctrl-btn.play-main-btn:active {
    transform: scale(0.94);
  }

  .audio-progress-container {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .time-stamp {
    font-size: 11px;
    color: #64748b;
    font-variant-numeric: tabular-nums;
    min-width: 32px;
  }

  .progress-bar-wrapper {
    flex: 1;
    height: 18px;
    display: flex;
    align-items: center;
    position: relative;
    cursor: pointer;
  }
  .progress-bar-bg {
    width: 100%;
    height: 5px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 3px;
  }
  .progress-bar-fill {
    height: 5px;
    background: linear-gradient(90deg, #ef4444, #f97316);
    border-radius: 3px;
    position: absolute;
    left: 0;
    top: 6.5px;
    pointer-events: none;
  }
  .progress-bar-handle {
    width: 12px;
    height: 12px;
    background: #ffffff;
    border-radius: 50%;
    position: absolute;
    top: 3px;
    margin-left: -6px;
    box-shadow: 0 0 6px rgba(0,0,0,0.6);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s, transform 0.2s;
  }
  .progress-bar-wrapper:hover .progress-bar-handle {
    opacity: 1;
    transform: scale(1.2);
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

    /* 1. 第一排：左侧大封面+歌名，右上角 🎤 🎛️ 📜 大按钮 */
    .audio-left-section {
      display: flex !important;
      align-items: center !important;
      max-width: calc(100% - 135px) !important;
      width: 100% !important;
      gap: 12px !important;
    }

    .vinyl-cover-wrapper, .audio-cover {
      width: 44px !important;
      height: 44px !important;
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
