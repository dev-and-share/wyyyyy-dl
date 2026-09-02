<script lang="ts">
  import { formatArtist, DEFAULT_VINYL_COVER, isIOS } from '../lib/utils';
  import type { Track } from '../lib/types';
  import PlayerCoverRing from './PlayerCoverRing.svelte';
  import PlayerProgressBar from './PlayerProgressBar.svelte';

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
</script>

<div class="fixed bottom-[calc(10px+env(safe-area-inset-bottom,0px))] left-2.5 right-2.5 rounded-[20px] bg-[var(--card-bg-solid,#121826)]/95 backdrop-blur-2xl shadow-[0_16px_44px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.2)] border border-[var(--border-color,rgba(255,255,255,0.15))] z-[9998] p-2.5 pb-[calc(10px+env(safe-area-inset-bottom,0px))] flex flex-col gap-2 transition-colors duration-300">
  <!-- 2.1 顶部区域：左侧黑胶封面；右侧上下两行（上行歌名满宽独占，下行歌手与4个按钮并排） -->
  <div class="flex items-center gap-2.5 w-full">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div onclick={onLyric} title="点击展开全屏播放器与歌词">
      <PlayerCoverRing
        cover={curTrack?.cover || DEFAULT_VINYL_COVER}
        {playing}
        {ringDashOffset}
        size="sm"
      />
    </div>

    <!-- 右侧两行信息栏 -->
    <div class="flex flex-col flex-1 min-w-0 justify-center">
      <!-- 上排：歌名满宽独占 -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="flex items-center gap-1.5 overflow-hidden cursor-pointer" onclick={onLyric} title="点击展开全屏播放器与歌词">
        <span class="text-sm font-semibold text-[var(--text-main,#0f172a)] truncate leading-tight">
          {curTrack?.name || '未在播放'}
        </span>
        {#if curTrack?.isLocal}
          <span class="audio-source-badge icon-only badge-server ml-1" title="🖥️ 本地已下载">🖥️</span>
        {/if}
      </div>

      <!-- 下排：歌手名 与 4个快捷工具按钮在同一排 -->
      <div class="flex items-center justify-between gap-1.5 mt-0.5">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="text-xs text-[var(--text-secondary,#64748b)] truncate flex-1 min-w-0 cursor-pointer" onclick={onLyric} title="点击展开全屏播放器与歌词">
          {formatArtist(curTrack?.artist) || '未知歌手'}
        </div>

        <!-- 4个快捷按键 -->
        <div class="flex items-center gap-1 shrink-0">
          <button
            type="button"
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all"
            onclick={onLyric}
            title="全屏沉浸歌词"
          >
            🎤
          </button>
          <!-- iOS Web Audio API 会导致熄屏后台播放中断，故在 iOS 设备上隐藏 PEQ 均衡器 -->
          {#if !isIOS()}
            <button
              type="button"
              class="w-7 h-7 rounded-full flex items-center justify-center text-xs text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all"
              onclick={onPeq}
              title="5段参量均衡器 (PEQ)"
            >
              🎛️
            </button>
          {/if}
          <button
            data-testid="btn-toggle-drawer"
            type="button"
            class="relative w-7 h-7 rounded-full flex items-center justify-center text-xs text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all"
            onclick={onQueue}
            title="当前播放列表"
          >
            📜
            <span class="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1 py-px rounded-full border border-white/60 leading-none">
              {queue.length}
            </span>
          </button>
          <!-- iOS (Safari/PWA) HTML5 audio volume 为系统级只读，隐藏滑块避免误解 -->
          {#if !isIOS()}
            <!-- 移动端音量竖立弹出滑块 -->
            <div class="relative">
              <button
                type="button"
                class="w-7 h-7 rounded-full flex items-center justify-center text-xs text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all"
                onclick={() => showVolPopup = !showVolPopup}
                title={vol === 0 ? '静音' : `音量 ${Math.round(vol * 100)}%`}
              >
                {vol === 0 ? '🔇' : vol < 0.4 ? '🔉' : '🔊'}
              </button>
              {#if showVolPopup}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="fixed inset-0 z-[10001]" onclick={() => showVolPopup = false}></div>
                <div class="absolute bottom-9 left-1/2 -translate-x-1/2 w-9 py-2.5 bg-[var(--card-bg-solid,#1e293b)] border border-[var(--border-color,rgba(255,255,255,0.15))] rounded-2xl shadow-xl z-[10002] flex flex-col items-center gap-1.5 backdrop-blur-xl">
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
                  <span class="text-xs">{vol === 0 ? '🔇' : '🔊'}</span>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- 2.2 第二排：全宽进度条 -->
  <PlayerProgressBar
    {curTime}
    {duration}
    {progressRatio}
    {onSeek}
  />

  <!-- 2.3 第三排：5个控制按键 -->
  <div class="flex items-center justify-between w-full px-2">
    <button
      data-testid="btn-toggle-mode"
      type="button"
      class="w-8.5 h-8.5 rounded-full flex items-center justify-center text-sm text-[var(--text-secondary)] bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)] active:scale-95 transition-all"
      onclick={onToggleMode}
      title={playMode === 'single' ? '单曲循环' : (playMode === 'shuffle' ? '随机播放' : '列表循环')}
    >
      {playMode === 'single' ? '🔂' : (playMode === 'shuffle' ? '🔀' : '🔁')}
    </button>
    <button
      data-testid="btn-prev-track"
      type="button"
      class="w-10 h-10 rounded-full flex items-center justify-center text-base text-[var(--text-main)] bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)] active:scale-95 transition-all"
      onclick={onPrev}
      title="上一首"
    >
      ⏮
    </button>
    <button
      data-testid="btn-play-pause"
      type="button"
      class="w-12 h-12 rounded-full flex items-center justify-center text-xl bg-gradient-to-br from-red-500 to-orange-500 text-white font-bold shadow-lg shadow-red-500/40 active:scale-95 transition-all"
      onclick={onTogglePlay}
      title={playing ? '暂停' : '播放'}
    >
      {playing ? '⏸' : '▶'}
    </button>
    <button
      data-testid="btn-next-track"
      type="button"
      class="w-10 h-10 rounded-full flex items-center justify-center text-base text-[var(--text-main)] bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)] active:scale-95 transition-all"
      onclick={onNext}
      title="下一首"
    >
      ⏭
    </button>
    <button
      type="button"
      class="w-8.5 h-8.5 rounded-full flex items-center justify-center text-sm text-[var(--text-muted)] bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)] hover:text-red-400 active:scale-95 transition-all"
      onclick={onMinimize}
      title="收起为黑胶悬浮球"
    >
      ✕
    </button>
  </div>
</div>
