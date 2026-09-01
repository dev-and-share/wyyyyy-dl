<script lang="ts">
  import { formatTime, formatArtist } from '../lib/utils';
  import { queue, playerState, getCurTrack } from '../lib/player.svelte';

  let {
    audioEl,
    playing,
    curTime,
    duration,
    onToggle,
    onPrev,
    onNext,
    onSeek,
    onLyric,
    onQueue
  } = $props<{
    audioEl?: HTMLAudioElement;
    playing: boolean;
    curTime: number;
    duration: number;
    onToggle: () => void;
    onPrev: () => void;
    onNext: () => void;
    onSeek: (e: MouseEvent) => void;
    onLyric: () => void;
    onQueue: () => void;
  }>();

  let vol = $state(playerState.volume);
  let curTrack = $derived(getCurTrack());

  $effect(() => {
    if (audioEl) audioEl.volume = vol;
    playerState.volume = vol;
  });

  // 顶部极细进度条点击/Seek
  function handleTopSeek(e: MouseEvent) {
    if (!duration || !audioEl) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioEl.currentTime = pos * duration;
  }
</script>

{#if queue.length}
<div class="bottom-audio-bar">
  <audio bind:this={audioEl} src={curTrack?.url || ''}></audio>

  <!-- 📱 移动端顶部微型发光进度条 (可直接点击快进) -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="mini-top-progress-bar sp-only-flex" onclick={handleTopSeek}>
    <div class="mini-top-progress-fill" style="width: {duration ? (curTime / duration) * 100 : 0}%;"></div>
  </div>

  <div class="audio-bar-inner">
    <!-- 1. 左侧：封面与歌曲信息 (移动端点击直接呼出沉浸式大黑胶歌词) -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="audio-left-section" onclick={onLyric} title="点击展开全屏播放器与歌词">
      <div class="vinyl-cover-wrapper">
        <img
          src={curTrack?.cover || '/favicon.png'}
          alt="封面"
          class="audio-cover"
          class:playing={playing}
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

    <!-- 2. 中间：PC 端核心控制与可拖拽全尺寸进度条 (移动端隐藏，留给右上角大按键与全屏播放器) -->
    <div class="audio-center-section pc-only">
      <div class="audio-main-controls">
        <button
          class="ctrl-btn sub-btn"
          onclick={() => { playerState.playMode = playerState.playMode === 'single' ? 'list' : (playerState.playMode === 'list' ? 'shuffle' : 'single'); }}
          title={playerState.playMode === 'single' ? '单曲循环' : (playerState.playMode === 'shuffle' ? '随机播放' : '列表循环')}
        >
          {playerState.playMode === 'single' ? '🔂' : (playerState.playMode === 'shuffle' ? '🔀' : '🔁')}
        </button>
        <button class="ctrl-btn sub-btn" onclick={onPrev} title="上一首">⏮</button>
        <button class="ctrl-btn play-main-btn" onclick={onToggle} title={playing ? '暂停' : '播放'}>
          {playing ? '⏸' : '▶'}
        </button>
        <button class="ctrl-btn sub-btn" onclick={onNext} title="下一首">⏭</button>
      </div>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="audio-progress-container">
        <span class="time-stamp">{formatTime(curTime)}</span>
        <div class="progress-bar-wrapper" onclick={onSeek}>
          <div class="progress-bar-bg"></div>
          <div class="progress-bar-fill" style="width: {duration ? (curTime / duration) * 100 : 0}%;"></div>
          <div class="progress-bar-handle" style="left: {duration ? (curTime / duration) * 100 : 0}%;"></div>
        </div>
        <span class="time-stamp">{formatTime(duration)}</span>
      </div>
    </div>

    <!-- 3. 右侧：功能控制区 -->
    <div class="audio-right-section">
      <!-- 移动端专享：大触控核心播放/暂停键 + 下一曲 -->
      <button class="ctrl-btn mini-capsule-play-btn sp-only-flex" onclick={onToggle} title={playing ? '暂停' : '播放'}>
        {playing ? '⏸' : '▶'}
      </button>
      <button class="ctrl-btn mini-capsule-btn sp-only-flex" onclick={onNext} title="下一曲">
        ⏭
      </button>

      <!-- 全局通用：歌词 & 播放列表抽屉 -->
      <button class="ctrl-btn sub-btn pc-only" onclick={onLyric} title="全屏沉浸歌词">🎤</button>
      <button class="ctrl-btn mini-capsule-btn playlist-btn-wrap" onclick={onQueue} title="当前播放列表">
        📜
        <span class="badge-count-pill">{queue.length}</span>
      </button>

      <!-- PC 端专享：音量滑块 -->
      <div class="volume-container pc-only">
        <span class="vol-icon" onclick={() => { vol = vol > 0 ? 0 : 0.8; }} title="静音切换">
          {vol === 0 ? '🔇' : '🔊'}
        </span>
        <input type="range" min="0" max="1" step="0.05" bind:value={vol} class="volume-slider" style="width: 70px;" />
      </div>

      <!-- 关闭播放器 -->
      <button class="ctrl-btn mini-close-btn" onclick={() => { queue.length = 0; }} title="关闭播放器">✕</button>
    </div>
  </div>
</div>
{/if}

<style>
  /* --------------------------------------------------------------------------
     🎵 现代极简悬浮 Mini Player Bar (Spotify / Apple Music 风格)
     -------------------------------------------------------------------------- */
  .bottom-audio-bar {
    position: fixed;
    bottom: 12px;
    left: 16px;
    right: 16px;
    max-width: 1200px;
    margin: 0 auto;
    height: 64px;
    background: rgba(15, 23, 42, 0.94);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05);
    z-index: 9998;
    padding: 0 16px;
    display: flex;
    align-items: center;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .audio-bar-inner {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    position: relative;
    z-index: 2;
  }

  /* 顶部发光微进度条 (移动端展示) */
  .mini-top-progress-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    z-index: 3;
  }
  .mini-top-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #ef4444, #f97316);
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.8);
    transition: width 0.15s linear;
  }

  /* 1. 左侧歌曲元信息 */
  .audio-left-section {
    display: flex;
    align-items: center;
    gap: 12px;
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
    max-width: 540px;
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
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: #cbd5e1;
  }
  .ctrl-btn.sub-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  .ctrl-btn.play-main-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #ffffff;
    font-size: 16px;
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
    height: 16px;
    display: flex;
    align-items: center;
    position: relative;
    cursor: pointer;
  }
  .progress-bar-bg {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 2px;
  }
  .progress-bar-fill {
    height: 4px;
    background: linear-gradient(90deg, #ef4444, #f97316);
    border-radius: 2px;
    position: absolute;
    left: 0;
    top: 6px;
    pointer-events: none;
  }
  .progress-bar-handle {
    width: 10px;
    height: 10px;
    background: #ffffff;
    border-radius: 50%;
    position: absolute;
    top: 3px;
    margin-left: -5px;
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

  /* --------------------------------------------------------------------------
     📱 移动端 (SP) 专属悬浮胶囊样式 (Spotify / Apple Music 现代 Mini Bar)
     -------------------------------------------------------------------------- */
  .sp-only-flex {
    display: none;
  }

  @media (max-width: 768px) {
    .pc-only {
      display: none !important;
    }
    .sp-only-flex {
      display: inline-flex !important;
    }

    .bottom-audio-bar {
      left: 10px !important;
      right: 10px !important;
      bottom: calc(10px + env(safe-area-inset-bottom, 0px)) !important;
      height: 58px !important;
      padding: 0 12px !important;
      border-radius: 14px !important;
      background: rgba(18, 24, 38, 0.96) !important;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.6) !important;
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
    }

    .audio-bar-inner {
      gap: 8px !important;
    }

    .audio-left-section {
      max-width: calc(100% - 135px) !important;
      gap: 10px !important;
    }

    .vinyl-cover-wrapper, .audio-cover {
      width: 40px !important;
      height: 40px !important;
    }

    .audio-title {
      font-size: 13.5px !important;
      font-weight: 700 !important;
      line-height: 1.2 !important;
    }

    .audio-artist {
      font-size: 11px !important;
      color: #94a3b8 !important;
      margin-top: 1px !important;
    }

    .audio-right-section {
      min-width: unset !important;
      flex: initial !important;
      gap: 6px !important;
    }

    /* 移动端核心播放大键 (40px 优雅触控圆形) */
    .mini-capsule-play-btn {
      width: 38px !important;
      height: 38px !important;
      border-radius: 50% !important;
      background: linear-gradient(135deg, #ef4444, #dc2626) !important;
      color: #ffffff !important;
      font-size: 16px !important;
      box-shadow: 0 2px 10px rgba(239, 68, 68, 0.5) !important;
    }
    .mini-capsule-play-btn:active {
      transform: scale(0.9) !important;
    }

    /* 移动端下一曲与播放列表 (34px 独立触控胶囊) */
    .mini-capsule-btn {
      width: 34px !important;
      height: 34px !important;
      border-radius: 50% !important;
      background: rgba(255, 255, 255, 0.08) !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      color: #f8fafc !important;
      font-size: 14px !important;
    }
    .mini-capsule-btn:active {
      transform: scale(0.9) !important;
      background: rgba(255, 255, 255, 0.18) !important;
    }

    .ctrl-btn.mini-close-btn {
      width: 24px !important;
      height: 24px !important;
      font-size: 11px !important;
      color: #64748b !important;
      margin-left: 2px !important;
    }
  }
</style>
