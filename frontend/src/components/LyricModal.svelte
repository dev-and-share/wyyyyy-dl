<script lang="ts">
  import { onMount } from 'svelte';
  import { formatArtist, DEFAULT_VINYL_COVER, isIOS } from '../lib/utils';
  import { api } from '../lib/api';
  import PlayerProgressBar from './PlayerProgressBar.svelte';

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
  // 用户手动点击歌词跳转后，暂停自动滚动 3s
  let userSeekedAt = $state(0);
  const AUTO_SCROLL_PAUSE_MS = 3000;

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

  // 歌词自动居中平滑滚动（用户点击跳转后暂停 3s）
  $effect(() => {
    if (activeIdx >= 0) {
      const now = Date.now();
      if (now - userSeekedAt < AUTO_SCROLL_PAUSE_MS) return;
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
    if (track) loadTrackLyric(track);
  });

  onMount(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });
</script>

<div
  class="fixed inset-0 w-screen h-screen z-[100000] overflow-hidden flex flex-col transition-colors duration-300 select-none bg-[image:var(--immersive-bg)] bg-[var(--bg-color)]"
>
  <!-- 顶部标题栏 -->
  <div class="min-h-[calc(54px+env(safe-area-inset-top,0px))] pt-[max(10px,env(safe-area-inset-top,0px))] pb-2.5 px-4 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--immersive-header-bg)] backdrop-blur-md w-full shrink-0">
    <div class="w-9.5 h-9.5 shrink-0 pointer-events-none" aria-hidden="true"></div>
    <h3 class="text-base font-bold text-[var(--text-main)] flex-1 text-center truncate px-2">🎵 全屏沉浸播放</h3>
    <button
      type="button"
      class="w-9.5 h-9.5 rounded-full flex items-center justify-center text-base bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] active:scale-92 transition-all cursor-pointer"
      onclick={onClose}
      title="关闭全屏"
    >
      ✕
    </button>
  </div>

  <!-- 中间主体：左侧大黑胶唱片 + 右侧滚动歌词 -->
  <div class="flex-1 flex flex-col md:flex-row overflow-hidden p-3 md:p-10 gap-3 md:gap-10 max-w-[1200px] w-full mx-auto items-center">
    <!-- 左侧：大黑胶唱片与歌曲元信息 -->
    <div class="flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[440px] w-full md:w-auto shrink-0">
      <div class="w-[140px] h-[140px] md:w-[220px] md:h-[220px] flex items-center justify-center">
        <div class="w-full h-full rounded-full bg-[var(--immersive-ring-bg)] shadow-[var(--immersive-ring-shadow)] p-1.5 flex items-center justify-center transition-all duration-300">
          <img
            src={track?.cover || DEFAULT_VINYL_COVER}
            class="w-full h-full rounded-full object-cover shadow-inner {playing ? 'animate-[spin_20s_linear_infinite]' : ''}"
            alt="大图封面"
            referrerpolicy="no-referrer"
            onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
          />
        </div>
      </div>
      <div class="flex flex-col items-center text-center max-w-[280px]">
        <div class="flex items-center justify-center gap-2 max-w-full">
          <span class="text-sm md:text-base font-bold text-[var(--text-main)] truncate">{track?.name || '未在播放'}</span>
          {#if track?.isLocal}
            <span class="audio-source-badge icon-only badge-server" title="🖥️ 本地磁盘">🖥️</span>
          {/if}
          <button type="button" class="p-1 text-red-500 hover:scale-110 active:scale-90 transition-transform cursor-pointer" onclick={onToggleLike} title="喜欢">
            <svg viewBox="0 0 24 24" class="w-4.5 h-4.5" fill={isLiked ? '#ef4444' : 'none'} stroke={isLiked ? '#ef4444' : 'currentColor'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
        </div>
        <div class="text-xs text-[var(--text-secondary)] truncate mt-0.5">{formatArtist(track?.artist) || '未知歌手'}</div>
      </div>
    </div>

    <!-- 右侧：滚动歌词展示面板 -->
    <div class="flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col justify-center">
      <div
        class="w-full h-full max-h-[420px] overflow-y-auto px-4 py-8 flex flex-col gap-4 text-center scroll-smooth [mask-image:linear-gradient(to_bottom,transparent_0%,black_15%,black_85%,transparent_100%)]"
        id="lyricModalContent"
      >
        {#if lrcs.length > 0}
          {#each lrcs as l, i}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              id="sv-lrc-{i}"
              class="cursor-pointer transition-all duration-300 {i === activeIdx ? 'text-lg md:text-xl font-bold text-red-500 scale-105 drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]' : 'text-sm md:text-base text-[var(--text-muted)] hover:text-[var(--text-main)]'}"
              onclick={() => { userSeekedAt = Date.now(); onSeekTime(l.time); }}
            >
              {l.text}
            </div>
          {/each}
        {:else if rawLyricText}
          {#each rawLyricText.split(/\r?\n/) as lineStr}
            {#if lineStr.trim()}
              <p class="text-sm md:text-base text-[var(--text-muted)] my-1 leading-relaxed">{lineStr}</p>
            {/if}
          {/each}
        {:else}
          <div class="py-16 text-[var(--text-muted)] text-sm">暂无歌词</div>
        {/if}
      </div>
    </div>
  </div>

  <!-- 底部：全屏沉浸播放控制条 -->
  <div class="w-full px-4 md:px-12 py-3 border-t border-[var(--border-subtle)] bg-[var(--immersive-footer-bg)] backdrop-blur-xl flex flex-col items-center gap-2.5 shrink-0">
    <div class="w-full max-w-[680px]">
      <PlayerProgressBar
        curTime={currentTime}
        {duration}
        progressRatio={duration ? (currentTime / duration) : 0}
        {onSeek}
      />
    </div>

    <!-- 控制按键组 -->
    <div class="flex items-center justify-center gap-4 md:gap-6">
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-sm text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onToggleMode}
        title="切换播放模式"
      >
        {playMode === 'single' ? '🔂' : playMode === 'shuffle' ? '🔀' : '🔁'}
      </button>
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-sm text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onPrev}
        title="上一首"
      >
        ⏮
      </button>
      <button
        type="button"
        class="w-11 h-11 rounded-full flex items-center justify-center text-lg bg-gradient-to-br from-red-500 to-orange-500 text-white font-bold shadow-lg shadow-red-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        onclick={onTogglePlay}
        title="播放 / 暂停"
      >
        {playing ? '⏸' : '▶'}
      </button>
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-sm text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onNext}
        title="下一首"
      >
        ⏭
      </button>
      <!-- iOS Web Audio API 会导致熄屏后台播放中断，故在 iOS 设备上隐藏 PEQ 均衡器 -->
      {#if !isIOS()}
        <button
          type="button"
          class="w-9 h-9 rounded-full flex items-center justify-center text-sm text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          onclick={onTogglePeq}
          title="打开均衡器"
        >
          🎛️
        </button>
      {/if}
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-sm text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onToggleDrawer}
        title="播放列表"
      >
        📜
      </button>

      <!-- iOS (Safari/PWA) HTML5 audio volume 属性为只读，系统强制由实体键控制，隐藏滑块避免误解 -->
      {#if !isIOS()}
        <!-- 音量竖立弹出滑块 -->
        <div class="relative">
          <button
            type="button"
            class="w-9 h-9 rounded-full flex items-center justify-center text-sm text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            onclick={() => showVolPopup = !showVolPopup}
            title="调节音量"
          >
            {vol === 0 ? '🔇' : vol < 0.4 ? '🔉' : '🔊'}
          </button>
          {#if showVolPopup}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="fixed inset-0 z-[100001]" onclick={() => showVolPopup = false}></div>
            <div class="absolute bottom-11 left-1/2 -translate-x-1/2 w-9 py-2.5 bg-[var(--card-bg-solid)] border border-[var(--border-color)] rounded-2xl shadow-xl z-[100002] flex flex-col items-center gap-1.5 backdrop-blur-xl">
              <span class="text-[10px] font-mono text-[var(--text-muted)]">{Math.round(vol * 100)}%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                bind:value={vol}
                class="w-1.5 h-20 accent-red-500 cursor-pointer"
                style="writing-mode: vertical-lr; direction: rtl; -webkit-appearance: slider-vertical;"
              />
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span class="text-xs cursor-pointer select-none" onclick={() => { vol = vol > 0 ? 0 : 0.8; }} title="点击切换静音">
                {vol === 0 ? '🔇' : '🔊'}
              </span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
