<script lang="ts">
  import { onMount } from 'svelte';
  import { formatTime, formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';
  import { api } from '../lib/api';

  type Lrc = { time: number; text: string };

  let {
    track,
    currentTime,
    duration,
    playing,
    playMode,
    vol = $bindable(0.8),
    isLiked,
    onTogglePlay,
    onPrev,
    onNext,
    onToggleMode,
    onSeek,
    onSeekTime,
    onToggleLike,
    onTogglePeq,
    onToggleDrawer,
    onClose
  } = $props<{
    track: any;
    currentTime: number;
    duration: number;
    playing: boolean;
    playMode: 'list' | 'single' | 'shuffle';
    vol?: number;
    isLiked: boolean;
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    onToggleMode: () => void;
    onSeek: (e: MouseEvent) => void;
    onSeekTime: (time: number) => void;
    onToggleLike: () => void;
    onTogglePeq: () => void;
    onToggleDrawer: () => void;
    onClose: () => void;
  }>();

  let fetchedLyric = $state('');
  let showVolPopup = $state(false);
  let rawLyricText = $derived(track?.lyric || fetchedLyric || '');

  // 歌词解析
  function parseLrc(t: string): Lrc[] {
    if (!t) return [];
    const lines = t.split(/\r?\n/);
    const out: Lrc[] = [];
    const re = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    for (const line of lines) {
      const m = re.exec(line);
      if (m) {
        const min = parseInt(m[1], 10);
        const sec = parseInt(m[2], 10);
        const ms = parseInt(m[3], 10);
        const time = min * 60 + sec + (ms > 99 ? ms / 1000 : ms / 100);
        const text = line.replace(re, '').trim();
        if (text) out.push({ time, text });
      }
    }
    return out;
  }

  let lrcs = $derived(parseLrc(rawLyricText));

  // 计算当前高亮行
  let activeIdx = $derived.by(() => {
    let idx = -1;
    for (let i = 0; i < lrcs.length; i++) {
      if (currentTime >= lrcs[i].time) idx = i;
      else break;
    }
    return idx;
  });

  // 歌词自动居中平滑滚动
  $effect(() => {
    if (activeIdx >= 0) {
      const el = document.getElementById(`sv-lrc-${activeIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  // 若 track 缺少歌词，自动异步拉取
  async function loadTrackLyric(t: any) {
    if (!t || t.lyric) return;
    try {
      const j = await api.songV1(String(t.id), 'lossless');
      if (j?.data?.lyric) {
        fetchedLyric = j.data.lyric;
        t.lyric = j.data.lyric;
      }
    } catch {}
  }

  $effect(() => {
    if (typeof document !== 'undefined') {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  });

  $effect(() => {
    if (track?.id) {
      fetchedLyric = '';
      loadTrackLyric(track);
    }
  });
</script>

<!-- 🎤 全屏沉浸式独立无冲突 Modal (物理隔离 style.css 污染) -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="sv-lyric-overlay" onclick={onClose}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="sv-lyric-card" onclick={(e) => e.stopPropagation()}>
    <!-- 头部栏 (安全区避让灵动岛，标题正中居中，右侧关闭按钮) -->
    <div class="sv-lyric-header">
      <div class="sv-lyric-header-placeholder" aria-hidden="true"></div>
      <h3 class="sv-lyric-title">🎵 全屏沉浸播放</h3>
      <button class="sv-lyric-icon-btn" onclick={onClose} title="关闭全屏">✕</button>
    </div>

    <!-- 中间主体：左侧大黑胶唱片 + 右侧滚动歌词 -->
    <div class="sv-lyric-body">
      <!-- 左侧：大黑胶唱片与歌曲元信息 -->
      <div class="sv-lyric-cover-col">
        <div class="sv-lyric-vinyl-wrap">
          <div class="sv-lyric-disk">
            <img
              src={track?.cover || DEFAULT_VINYL_COVER}
              class="sv-lyric-disk-img"
              class:playing={playing}
              alt="大图封面"
              referrerpolicy="no-referrer"
              onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
            />
          </div>
        </div>
        <div class="sv-lyric-meta">
          <div class="sv-lyric-title-row">
            <span class="sv-lyric-song-name">{track?.name || '未在播放'}</span>
            {#if track?.isLocal}
              <span class="audio-source-badge badge-server" title="🖥️ 本地磁盘">🖥️</span>
            {/if}
            <button class="sv-lyric-like-btn" onclick={onToggleLike} title="喜欢">
              <svg viewBox="0 0 24 24" width="20" height="20" fill={isLiked ? '#ef4444' : 'none'} stroke={isLiked ? '#ef4444' : 'currentColor'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>
          <div class="sv-lyric-artist">{formatArtist(track?.artist) || '未知歌手'}</div>
        </div>
      </div>

      <!-- 右侧：滚动歌词展示面板 -->
      <div class="sv-lyric-content-col">
        <div class="sv-lyric-scroll-box" id="lyricModalContent">
          {#if lrcs.length > 0}
            {#each lrcs as l, i}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                id="sv-lrc-{i}"
                class="sv-lrc-row"
                class:active={i === activeIdx}
                onclick={() => onSeekTime(l.time)}
              >
                {l.text}
              </div>
            {/each}
          {:else if rawLyricText}
            {#each rawLyricText.split(/\r?\n/) as lineStr}
              {#if lineStr.trim()}
                <p class="sv-lrc-plain">{lineStr}</p>
              {/if}
            {/each}
          {:else}
            <div class="sv-lrc-empty">暂无歌词</div>
          {/if}
        </div>
      </div>
    </div>

    <!-- 底部：全屏沉浸播放控制条 -->
    <div class="sv-lyric-controls-bar">
      <!-- 进度条 -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sv-lyric-progress-row">
        <span class="sv-lyric-time">{formatTime(currentTime)}</span>
        <div class="sv-lyric-progress-bar" onclick={onSeek}>
          <div class="sv-lyric-progress-bg"></div>
          <div class="sv-lyric-progress-fill" style="width: {duration ? (currentTime / duration * 100) : 0}%"></div>
          <div class="sv-lyric-progress-thumb" style="left: {duration ? (currentTime / duration * 100) : 0}%"></div>
        </div>
        <span class="sv-lyric-time">{formatTime(duration)}</span>
      </div>

      <!-- 控制按键组 -->
      <div class="sv-lyric-btn-row">
        <button class="sv-ctrl-btn" onclick={onToggleMode} title="切换播放模式">
          {playMode === 'single' ? '🔂' : playMode === 'shuffle' ? '🔀' : '🔁'}
        </button>
        <button class="sv-ctrl-btn" onclick={onPrev} title="上一首">⏮</button>
        <button class="sv-ctrl-btn sv-play-main-btn" onclick={onTogglePlay} title="播放 / 暂停">
          {playing ? '⏸' : '▶'}
        </button>
        <button class="sv-ctrl-btn" onclick={onNext} title="下一首">⏭</button>
        <button class="sv-ctrl-btn" onclick={onTogglePeq} title="5段参量均衡器 (PEQ)">🎛️</button>
        <button class="sv-ctrl-btn" onclick={onToggleDrawer} title="播放列表">📜</button>
        
        <!-- 音量调节与弹出滑块 -->
        <div class="sv-vol-popup-wrap">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <button
            class="sv-ctrl-btn"
            onclick={() => showVolPopup = !showVolPopup}
            title={vol === 0 ? '静音' : `音量 ${Math.round(vol * 100)}%`}
          >
            {vol === 0 ? '🔇' : vol < 0.4 ? '🔉' : '🔊'}
          </button>
          {#if showVolPopup}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="sv-vol-overlay" onclick={() => showVolPopup = false}></div>
            <div class="sv-vol-panel">
              <span class="sv-vol-label">{Math.round(vol * 100)}%</span>
              <input type="range" min="0" max="1" step="0.02" bind:value={vol} class="sv-vol-slider" />
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span class="sv-vol-icon" onclick={() => { vol = vol > 0 ? 0 : 0.8; }} style="cursor:pointer;" title="点击切换静音">
                {vol === 0 ? '🔇' : '🔊'}
              </span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .sv-lyric-overlay {
    position: fixed !important;
    top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
    width: 100vw !important; height: 100vh !important;
    background: radial-gradient(circle at center, #1e293b 0%, #0f172a 70%, #090d16 100%);
    backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);
    z-index: 100000 !important; margin: 0 !important; padding: 0 !important;
    display: block !important; overflow: hidden !important;
  }
  :global([data-theme="light"]) .sv-lyric-overlay {
    background: radial-gradient(circle at center, #ffffff 0%, #f1f5f9 60%, #e2e8f0 100%) !important;
  }
  .sv-lyric-card {
    background: transparent !important; border: none !important;
    position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
    width: 100% !important; height: 100% !important;
    display: flex !important; flex-direction: column !important;
    color: var(--text-main, #ffffff); box-shadow: none !important; overflow: hidden !important;
    margin: 0 !important; padding: 0 !important; box-sizing: border-box !important;
  }
  .sv-lyric-header {
    min-height: calc(54px + env(safe-area-inset-top, 0px)) !important; height: auto !important;
    padding-top: max(10px, env(safe-area-inset-top, 0px)) !important; padding-bottom: 10px !important;
    padding-left: max(16px, env(safe-area-inset-left, 0px)) !important;
    padding-right: max(16px, env(safe-area-inset-right, 0px)) !important;
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    display: flex !important; justify-content: space-between !important; align-items: center !important;
    background: var(--card-bg-solid, rgba(15, 23, 42, 0.4)); width: 100% !important;
    box-sizing: border-box !important; flex-shrink: 0 !important; margin: 0 !important;
  }
  :global([data-theme="light"]) .sv-lyric-header {
    background: rgba(255, 255, 255, 0.85) !important; border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
  }
  .sv-lyric-title {
    font-size: 16.5px; font-weight: 700; margin: 0; color: var(--text-main, #f8fafc);
    flex: 1; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 8px;
  }
  .sv-lyric-header-placeholder {
    width: 38px; height: 38px; flex-shrink: 0; pointer-events: none;
  }
  .sv-lyric-icon-btn {
    background: var(--btn-slot-bg, rgba(255, 255, 255, 0.1)); border: none;
    color: var(--text-secondary, #94a3b8); width: 38px; height: 38px; border-radius: 50%;
    font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s ease; flex-shrink: 0; margin: 0 !important;
  }
  .sv-lyric-icon-btn:hover {
    background: var(--btn-hover-bg, rgba(255, 255, 255, 0.25)); color: var(--text-main, #ffffff);
  }
  .sv-lyric-icon-btn:active { transform: scale(0.92); }

  /* Body */
  .sv-lyric-body {
    flex: 1; display: flex; flex-direction: row; overflow: hidden;
    padding: 20px 40px; gap: 40px; max-width: 1200px; width: 100%; margin: 0 auto;
    align-items: center; box-sizing: border-box;
  }
  @media (max-width: 768px) {
    .sv-lyric-body { flex-direction: column !important; padding: 10px 16px !important; gap: 12px !important; }
  }
  .sv-lyric-cover-col {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; max-width: 440px;
  }
  .sv-lyric-vinyl-wrap {
    width: 220px; height: 220px; display: flex; align-items: center; justify-content: center;
  }
  @media (max-width: 768px) {
    .sv-lyric-vinyl-wrap { width: 150px !important; height: 150px !important; }
  }
  .sv-lyric-disk {
    width: 100%; height: 100%; border-radius: 50%; background: #0f172a;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5), 0 0 0 8px rgba(255, 255, 255, 0.05);
    padding: 6px; display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  }
  .sv-lyric-disk-img {
    width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.15);
  }
  .sv-lyric-disk-img.playing { animation: spinDisk 20s linear infinite; }
  @keyframes spinDisk { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .sv-lyric-meta { text-align: center; max-width: 100%; }
  .sv-lyric-title-row { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .sv-lyric-song-name { font-size: 19px; font-weight: 700; color: var(--text-main, #ffffff); }
  .sv-lyric-like-btn { background: transparent; border: none; cursor: pointer; display: inline-flex; align-items: center; }
  .sv-lyric-artist { font-size: 13px; color: var(--text-secondary, #94a3b8); margin-top: 4px; }

  /* Lyrics Scroll */
  .sv-lyric-content-col {
    flex: 1.4; height: 100%; display: flex; flex-direction: column; overflow: hidden; position: relative;
    mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
  }
  .sv-lyric-scroll-box { flex: 1; padding: 40px 10px; overflow-y: auto; scroll-behavior: smooth; }
  .sv-lrc-row {
    padding: 8px 0; font-size: 17px; line-height: 1.5; color: var(--text-secondary, #64748b);
    text-align: center; cursor: pointer; transition: all 0.25s ease;
  }
  .sv-lrc-row.active {
    font-size: 22px; font-weight: 700; color: #38bdf8; transform: scale(1.05);
    text-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
  }
  :global([data-theme="light"]) .sv-lrc-row.active { color: #2563eb !important; }
  .sv-lrc-plain { font-size: 15px; color: var(--text-secondary, #94a3b8); text-align: center; margin: 6px 0; }
  .sv-lrc-empty { text-align: center; color: var(--text-muted, #64748b); padding-top: 40px; }

  /* Controls */
  .sv-lyric-controls-bar {
    padding-top: 12px !important; padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px)) !important;
    padding-left: max(16px, env(safe-area-inset-left, 0px)) !important;
    padding-right: max(16px, env(safe-area-inset-right, 0px)) !important;
    background: var(--card-bg-solid, rgba(15, 23, 42, 0.4));
    border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    width: 100%; box-sizing: border-box; flex-shrink: 0; display: flex; flex-direction: column; align-items: center;
  }
  :global([data-theme="light"]) .sv-lyric-controls-bar {
    background: rgba(255, 255, 255, 0.85) !important; border-top: 1px solid rgba(0, 0, 0, 0.08) !important;
  }
  .sv-lyric-progress-row {
    width: 100%; max-width: 600px; display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
  }
  .sv-lyric-time { font-size: 11px; color: var(--text-muted, #94a3b8); min-width: 34px; text-align: center; }
  .sv-lyric-progress-bar { position: relative; flex: 1; height: 20px; display: flex; align-items: center; cursor: pointer; }
  .sv-lyric-progress-bg { position: absolute; width: 100%; height: 4px; background: rgba(255, 255, 255, 0.15); border-radius: 2px; }
  :global([data-theme="light"]) .sv-lyric-progress-bg { background: rgba(0, 0, 0, 0.08); }
  .sv-lyric-progress-fill { position: absolute; height: 4px; background: linear-gradient(90deg, #ef4444, #f97316); border-radius: 2px; }
  .sv-lyric-progress-thumb { position: absolute; width: 12px; height: 12px; border-radius: 50%; background: #ffffff; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35); transform: translate(-50%, 0); }

  .sv-lyric-btn-row { display: flex; align-items: center; gap: 14px; justify-content: center; }
  .sv-ctrl-btn {
    width: 38px; height: 38px; border-radius: 50%; background: var(--btn-slot-bg, rgba(255, 255, 255, 0.1));
    border: none; color: var(--text-main, #ffffff); font-size: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;
  }
  .sv-ctrl-btn:active { transform: scale(0.92); }
  .sv-play-main-btn {
    width: 48px; height: 48px; background: #ef4444 !important; color: #ffffff !important;
    font-size: 19px; box-shadow: 0 4px 16px rgba(239, 68, 68, 0.45);
  }

  /* Volume popup */
  .sv-vol-popup-wrap { position: relative; display: inline-flex; }
  .sv-vol-overlay { position: fixed; inset: 0; z-index: 100001; }
  .sv-vol-panel {
    position: absolute; bottom: calc(100% + 14px); right: 50%; transform: translateX(50%);
    background: var(--card-bg-solid, #ffffff); border: 1px solid var(--border-color, rgba(0, 0, 0, 0.12));
    border-radius: 14px; padding: 14px 10px; display: flex; flex-direction: column; align-items: center; gap: 8px;
    z-index: 100002; box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35); animation: volPopIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes volPopIn { from { opacity: 0; transform: translateX(50%) scale(0.85) translateY(8px); } to { opacity: 1; transform: translateX(50%) scale(1) translateY(0); } }
  .sv-vol-label { font-size: 11px; font-weight: 700; color: var(--text-secondary, #64748b); }
  .sv-vol-icon { font-size: 15px; }
  .sv-vol-slider {
    writing-mode: vertical-lr; direction: rtl; appearance: slider-vertical; -webkit-appearance: slider-vertical;
    width: 6px; height: 110px; accent-color: #ef4444; cursor: pointer;
  }
</style>
