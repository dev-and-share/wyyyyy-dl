<script lang="ts">
  import { formatArtist, DEFAULT_VINYL_COVER, isIOS } from '../lib/utils';
  import type { Track } from '../lib/types';
  import PlayerCoverRing from './PlayerCoverRing.svelte';
  import PlayerProgressBar from './PlayerProgressBar.svelte';
  import PlayerControls from './PlayerControls.svelte';

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
</script>

<div class="fixed bottom-0 left-0 right-0 h-[74px] bg-[var(--card-bg-solid,#0f172a)]/95 backdrop-blur-2xl border-t border-[var(--border-color,rgba(255,255,255,0.12))] shadow-[-12px_48px_rgba(0,0,0,0.45)] z-[9998] px-6 flex items-center transition-colors duration-300">
  <div class="w-full max-w-[1280px] mx-auto flex justify-between items-center gap-5">
    <!-- 1. 左侧：黑胶封面与歌曲元信息 -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="flex items-center gap-3 flex-1 min-w-[180px] max-w-[320px] cursor-pointer select-none" onclick={onLyric} title="点击展开全屏歌词与大黑胶">
      <PlayerCoverRing
        cover={curTrack?.cover || DEFAULT_VINYL_COVER}
        {playing}
        {ringDashOffset}
        size="md"
      />
      <div class="flex flex-col overflow-hidden min-w-0 flex-1">
        <div class="flex items-center gap-1.5 overflow-hidden">
          <span class="text-sm font-semibold text-[var(--text-main,#0f172a)] truncate leading-tight">
            {curTrack?.name || '未在播放'}
          </span>
          {#if curTrack?.isLocal}
            <span class="audio-source-badge icon-only badge-server ml-1" title="🖥️ 本地已下载">🖥️</span>
          {/if}
        </div>
        <div class="text-xs text-[var(--text-secondary,#64748b)] truncate mt-0.5">
          {formatArtist(curTrack?.artist) || '未知歌手'}
        </div>
      </div>
    </div>

    <!-- 2. 中间：核心控制按键 + 全宽进度条 -->
    <div class="flex flex-col items-center justify-center flex-2 max-w-[580px] gap-1.5 w-full">
      <PlayerControls
        {playing}
        {playMode}
        {onTogglePlay}
        {onPrev}
        {onNext}
        {onToggleMode}
        size="md"
      />
      <PlayerProgressBar
        {curTime}
        {duration}
        {progressRatio}
        {onSeek}
      />
    </div>

    <!-- 3. 右侧：功能控制与平滑音量条 -->
    <div class="flex items-center justify-end gap-3 flex-1 min-w-[220px] max-w-[320px]">
      <button
        type="button"
        class="w-8.5 h-8.5 rounded-lg flex items-center justify-center text-sm text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all"
        onclick={onLyric}
        title="全屏沉浸歌词"
      >
        🎤
      </button>
      <!-- iOS Web Audio API 会导致熄屏后台播放中断，故在 iOS 设备上隐藏 PEQ 均衡器 -->
      {#if !isIOS()}
        <button
          type="button"
          class="w-8.5 h-8.5 rounded-lg flex items-center justify-center text-sm text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all"
          onclick={onPeq}
          title="5段参量均衡器 (PEQ)"
        >
          🎛️
        </button>
      {/if}
      <button
        type="button"
        class="relative w-8.5 h-8.5 rounded-lg flex items-center justify-center text-sm text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all"
        onclick={onQueue}
        title="当前播放列表"
      >
        📜
        <span class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold px-1 py-px rounded-full border border-white/60 leading-none">
          {queue.length}
        </span>
      </button>
      <!-- iOS (Safari/PWA) HTML5 audio volume 为系统级只读，隐藏滑块避免误解 -->
      {#if !isIOS()}
        <div class="flex items-center gap-1.5">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            class="text-sm cursor-pointer select-none text-[var(--text-main)]"
            onclick={() => { vol = vol > 0 ? 0 : 0.8; }}
            title="静音切换"
          >
            {vol === 0 ? '🔇' : vol < 0.4 ? '🔉' : '🔊'}
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            bind:value={vol}
            class="w-20 h-1 accent-red-500 cursor-pointer bg-black/10 dark:bg-white/15 rounded-lg"
          />
        </div>
      {/if}
      <button
        type="button"
        class="w-7 h-7 rounded-full flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/15 active:scale-95 transition-all"
        onclick={onMinimize}
        title="收起为黑胶悬浮球"
      >
        ✕
      </button>
    </div>
  </div>
</div>
