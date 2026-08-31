<script lang="ts">
  import { onMount } from 'svelte';
  import { formatTime } from '../lib/utils';
  import { api } from '../lib/api';

  type Lrc = { time: number; text: string };

  let {
    track,
    currentTime,
    duration,
    playing,
    playMode,
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
      const el = document.getElementById(`lrc-${activeIdx}`);
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
    if (track?.id) {
      fetchedLyric = '';
      loadTrackLyric(track);
    }
  });
</script>

<!-- 🎤 全屏沉浸式现代大黑胶音乐播放器 Modal -->
<div class="lyric-modal-overlay" onclick={onClose}>
  <div class="lyric-modal-card" onclick={(e) => e.stopPropagation()}>
    <!-- 头部栏 -->
    <div class="lyric-modal-header">
      <button class="lyric-close-btn" onclick={onClose} title="收起全屏播放器">🔽</button>
      <h3 class="lyric-modal-title">🎵 全屏沉浸播放</h3>
      <button class="lyric-close-btn" onclick={onClose} title="关闭全屏">✕</button>
    </div>

    <!-- 中间主体：左侧大黑胶唱片 + 右侧滚动歌词 -->
    <div class="fullscreen-player-body">
      <!-- 左侧：大黑胶唱片与歌曲元信息 -->
      <div class="fullscreen-cover-column">
        <div class="fullscreen-vinyl-container">
          <div class="fullscreen-vinyl-disk-wrapper">
            <img
              src={track?.cover || '/favicon.png'}
              class="fullscreen-cover-img vinyl-disk"
              class:playing={playing}
              alt="大图封面"
            />
          </div>
        </div>
        <div class="fullscreen-meta-info">
          <div class="fullscreen-title-wrap">
            <div class="fullscreen-title">{track?.name || '未在播放'}</div>
            {#if track?.isLocal}
              <span class="audio-source-badge icon-only badge-server" title="🖥️ 已存在服务器磁盘">🖥️</span>
            {/if}
            <button class="ctrl-btn full-like-btn" onclick={onToggleLike} title="喜欢 (点击添加红心)">
              <svg class="heart-icon outline" viewBox="0 0 24 24" width="22" height="22" fill={isLiked ? '#ef4444' : 'none'} stroke={isLiked ? '#ef4444' : 'currentColor'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>
          <div class="fullscreen-artist">{track?.artist || '未知歌手'}</div>
        </div>
      </div>

      <!-- 右侧：滚动歌词展示面板 -->
      <div class="fullscreen-lyrics-column">
        <div class="lyric-modal-body" id="lyricModalContent">
          {#if lrcs.length > 0}
            {#each lrcs as l, i}
              <div
                id="lrc-{i}"
                class="lrc-line"
                class:active={i === activeIdx}
                onclick={() => onSeekTime(l.time)}
              >
                {l.text}
              </div>
            {/each}
          {:else if rawLyricText}
            {#each rawLyricText.split(/\r?\n/) as lineStr}
              {#if lineStr.trim()}
                <p class="lrc-fallback">{lineStr}</p>
              {/if}
            {/each}
          {:else}
            <div class="lrc-fallback" style="text-align:center; padding-top:40px;">暂无歌词</div>
          {/if}
        </div>
      </div>
    </div>

    <!-- 底部：全屏沉浸播放控制条 -->
    <div class="fullscreen-controls-bar">
      <div class="audio-progress-container" style="width: 100%; max-width: 650px; margin: 0 auto 10px auto;">
        <span class="time-stamp">{formatTime(currentTime)}</span>
        <div class="progress-bar-wrapper" onclick={onSeek}>
          <div class="progress-bar-bg"></div>
          <div class="progress-bar-fill" style="width: {duration ? (currentTime / duration * 100) : 0}%"></div>
          <div class="progress-bar-handle" style="left: {duration ? (currentTime / duration * 100) : 0}%"></div>
        </div>
        <span class="time-stamp">{formatTime(duration)}</span>
      </div>
      <div class="fullscreen-main-controls">
        <button class="ctrl-btn sub-btn" onclick={onToggleMode} title="切换播放模式">
          {playMode === 'single' ? '🔂' : playMode === 'shuffle' ? '🔀' : '🔁'}
        </button>
        <button class="ctrl-btn sub-btn" onclick={onPrev} title="上一首">⏮</button>
        <button class="ctrl-btn play-main-btn" onclick={onTogglePlay} title="播放 / 暂停">
          {playing ? '⏸' : '▶'}
        </button>
        <button class="ctrl-btn sub-btn" onclick={onNext} title="下一首">⏭</button>
        <button class="ctrl-btn sub-btn peq-btn-badge" onclick={onTogglePeq} title="5段参量均衡器 (PEQ)">🎛️</button>
        <button class="ctrl-btn sub-btn" onclick={onToggleDrawer} title="播放列表">📜</button>
      </div>
    </div>
  </div>
</div>
