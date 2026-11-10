<script lang="ts">
  import PlayerIcon, { type PlayerIconName } from './PlayerIcon.svelte';
  import { formatTime } from '../lib/utils';
  import { t } from '../lib/i18n/index.svelte';

  let {
    playing = false,
    curTime = 0,
    duration = 0,
    playMode = 'list',
    skinId = 'vinyl',
    onTogglePlay,
    onPrev,
    onNext,
    onToggleMode,
    onSeek,
    onSeekTime,
    onToggleDrawer
  } = $props<{
    playing: boolean;
    curTime: number;
    duration: number;
    playMode: 'list' | 'single' | 'shuffle';
    skinId?: string;
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    onToggleMode: () => void;
    onSeek?: (e: MouseEvent) => void;
    onSeekTime?: (time: number) => void;
    onToggleDrawer?: () => void;
  }>();

  let modeIconName = $derived<PlayerIconName>(
    playMode === 'single' ? 'repeat-1' : playMode === 'shuffle' ? 'shuffle' : 'repeat'
  );
  let modeTitle = $derived(
    playMode === 'single' ? t('player.repeatOne') : playMode === 'shuffle' ? t('player.shuffle') : t('player.repeatAll')
  );

  let progressRatio = $derived(duration > 0 ? Math.max(0, Math.min(1, curTime / duration)) : 0);

  // 微型进度条交互
  let progressBarEl = $state<HTMLDivElement | null>(null);
  let isDragging = $state(false);
  let dragRatio = $state<number | null>(null);

  let displayRatio = $derived(dragRatio !== null ? dragRatio : progressRatio);
  let displayCurTime = $derived(dragRatio !== null && duration > 0 ? dragRatio * duration : curTime);

  function calculateRatio(e: MouseEvent): number {
    if (!progressBarEl) return 0;
    const rect = progressBarEl.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }

  function handleProgressClick(e: MouseEvent) {
    e.stopPropagation();
    const ratio = calculateRatio(e);
    if (onSeekTime && duration > 0) {
      onSeekTime(ratio * duration);
    } else if (onSeek) {
      onSeek(e);
    }
  }

  function handleMouseDown(e: MouseEvent) {
    e.stopPropagation();
    isDragging = true;
    dragRatio = calculateRatio(e);

    const onWindowMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging) return;
      dragRatio = calculateRatio(moveEvent);
    };

    const onWindowMouseUp = (upEvent: MouseEvent) => {
      if (isDragging) {
        isDragging = false;
        const finalRatio = calculateRatio(upEvent);
        dragRatio = null;
        if (onSeekTime && duration > 0) {
          onSeekTime(finalRatio * duration);
        } else if (onSeek) {
          onSeek(upEvent);
        }
      }
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- 沉浸式微雕控制组：彻底无突兀卡片外框与实心底块，如激光蚀刻般自然融入深色背景 -->
<div
  data-testid="immersive-mini-player"
  class="interactive-el w-full max-w-[260px] px-1 py-1 flex flex-col gap-1.5 select-none transition-all duration-300"
  onclick={(e) => e.stopPropagation()}
>
  <!-- 顶部：微雕刻度进度条与极淡时间戳 -->
  <div class="flex items-center gap-2 w-full text-[10px] font-mono tabular-nums text-white/30 tracking-tight">
    <!-- 当前播放时间 -->
    <span class="w-7 text-right shrink-0">{formatTime(displayCurTime)}</span>

    <!-- 蚀刻微凹进度槽 -->
    <div
      bind:this={progressBarEl}
      data-testid="mini-player-progressbar"
      class="group relative flex-1 h-3 flex items-center cursor-pointer"
      onclick={handleProgressClick}
      onmousedown={handleMouseDown}
    >
      <!-- 凹槽背景轨 (深凹微弱暗线) -->
      <div class="w-full h-[2px] group-hover:h-[3px] rounded-full bg-white/[0.08] transition-all duration-200"></div>

      <!-- 微光纯净填充轨 (如银丝般低调，悬停微亮) -->
      <div
        class="absolute left-0 h-[2px] group-hover:h-[3px] rounded-full bg-white/45 group-hover:bg-white/75 pointer-events-none transition-all duration-75"
        style="width: {displayRatio * 100}%;"
      ></div>

      <!-- 仅在悬停或拖拽时显现的微型银点 -->
      <div
        class="absolute w-2 h-2 -ml-1 rounded-full bg-white shadow-sm pointer-events-none transition-opacity duration-150 {isDragging ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'}"
        style="left: {displayRatio * 100}%;"
      ></div>
    </div>

    <!-- 歌曲总时长 -->
    <span class="w-7 text-left shrink-0">{formatTime(duration)}</span>
  </div>

  <!-- 底部：纯线条雕刻感播控按键 (无任何多余色块底盘) -->
  <div class="flex items-center justify-between px-2 pt-0.5">
    <!-- 播放模式 -->
    <button
      type="button"
      data-testid="mini-btn-mode"
      class="flex items-center justify-center text-white/30 hover:text-white/70 active:scale-90 transition-all cursor-pointer p-1"
      onclick={(e) => { e.stopPropagation(); onToggleMode(); }}
      title={modeTitle}
    >
      <PlayerIcon name={modeIconName} size={13} />
    </button>

    <div class="flex items-center gap-4">
      <!-- 上一首 -->
      <button
        type="button"
        data-testid="mini-btn-prev"
        class="flex items-center justify-center text-white/45 hover:text-white/85 active:scale-90 transition-all cursor-pointer p-1"
        onclick={(e) => { e.stopPropagation(); onPrev(); }}
        title={t('player.previous')}
      >
        <PlayerIcon name="prev" size={15} />
      </button>

      <!-- 播放 / 暂停 (纯线条居中核心键，无实心圆坨背景) -->
      <button
        type="button"
        data-testid="mini-btn-play"
        class="flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition-all cursor-pointer p-1"
        onclick={(e) => { e.stopPropagation(); onTogglePlay(); }}
        title={playing ? t('player.pause') : t('player.play')}
      >
        <PlayerIcon name={playing ? 'pause' : 'play'} size={18} />
      </button>

      <!-- 下一首 -->
      <button
        type="button"
        data-testid="mini-btn-next"
        class="flex items-center justify-center text-white/45 hover:text-white/85 active:scale-90 transition-all cursor-pointer p-1"
        onclick={(e) => { e.stopPropagation(); onNext(); }}
        title={t('player.next')}
      >
        <PlayerIcon name="next" size={15} />
      </button>
    </div>

    <!-- 播放队列列表抽屉 -->
    <button
      type="button"
      data-testid="mini-btn-drawer"
      class="flex items-center justify-center text-white/30 hover:text-white/70 active:scale-90 transition-all cursor-pointer p-1"
      onclick={(e) => { e.stopPropagation(); onToggleDrawer?.(); }}
      title={t('player.playlist')}
    >
      <PlayerIcon name="list" size={13} />
    </button>
  </div>
</div>
