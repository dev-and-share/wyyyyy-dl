<script lang="ts">
  import { formatArtist, DEFAULT_VINYL_COVER, platform, formatCoverUrl } from '../../lib/utils';
  import type { Track } from '../../lib/types';
  import PlayerCoverRing from '../PlayerCoverRing.svelte';
  import PlayerProgressBar from '../PlayerProgressBar.svelte';
  import PlayerControls from '../PlayerControls.svelte';
  import PlayerIcon from '../PlayerIcon.svelte';
  import TrackSourceBadge from '../TrackSourceBadge.svelte';
  import TrackLikeBtn from '../TrackLikeBtn.svelte';
  import { skin } from '../../lib/skinStore.svelte';
  import WinampMiniVisualizer from '../skins/WinampMiniVisualizer.svelte';
  import CassetteMiniSpools from '../skins/CassetteMiniSpools.svelte';

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
    likedSet = new Set<number>(),
    onTogglePlay,
    onPrev,
    onNext,
    onToggleMode,
    onSeek,
    onLyric,
    onPeq,
    onQueue,
    onToggleLike = () => {},
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
    likedSet?: Set<number>;
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    onToggleMode: () => void;
    onSeek: (e: MouseEvent) => void;
    onLyric: () => void;
    onPeq: () => void;
    onQueue: () => void;
    onToggleLike?: () => void;
    onMinimize: () => void;
  }>();

  let isLiked = $derived(curTrack ? likedSet.has(Number(curTrack.id)) : false);
</script>

<div
  data-testid="player-bar-desktop"
  class="fixed bottom-0 left-0 right-0 h-[76px] z-[9998] px-6 flex items-center transition-all duration-300 select-none {skin.current === 'winamp'
    ? 'bg-gradient-to-b from-[#303642] via-[#21252d] to-[#171920] border-t-2 border-l-2 border-white/20 border-b-2 border-r-2 border-black/90 shadow-2xl'
    : skin.current === 'cassette'
      ? 'bg-[#181a1f] border-t-2 border-[#2c3038] shadow-2xl'
      : skin.current === 'aurora'
        ? 'bg-slate-950/70 backdrop-blur-2xl border-t border-white/20 shadow-[0_-8px_32px_var(--skin-glow,rgba(239,68,68,0.25))]'
        : skin.current === 'spring'
          ? 'bg-[#071711]/95 backdrop-blur-2xl border-t border-emerald-500/25 shadow-[0_-8px_32px_rgba(16,185,129,0.25)]'
          : 'bg-[var(--card-bg-solid,#0f172a)]/95 backdrop-blur-2xl border-t border-[var(--border-color,rgba(255,255,255,0.12))] shadow-[-12px_48px_rgba(0,0,0,0.45)]'}"
  style="{skin.cssVars}"
>
  <div class="w-full max-w-[1280px] mx-auto flex justify-between items-center gap-5">
    <!-- 1. 左侧：根据皮肤渲染专属封面/状态槽 -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="flex items-center gap-3 flex-1 min-w-[200px] max-w-[360px]">
      <div class="cursor-pointer select-none flex items-center gap-3 flex-1 min-w-0" onclick={onLyric} title="点击展开全屏播放器">
        {#if skin.current === 'winamp'}
          <!-- Winamp 风格封面 + 经典示波频谱 -->
          <div class="flex items-center gap-2 shrink-0">
            <div class="w-11 h-11 rounded-xs overflow-hidden border border-white/30 shadow-sm shrink-0">
              <img
                src={formatCoverUrl(curTrack?.cover, 100)}
                alt="封面"
                class="w-full h-full object-cover"
                referrerpolicy="no-referrer"
                onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
              />
            </div>
            <WinampMiniVisualizer {playing} barCount={8} />
          </div>
        {:else if skin.current === 'cassette'}
          <!-- 磁带风格微型双轴旋转窗 -->
          <CassetteMiniSpools
            cover={curTrack?.cover || DEFAULT_VINYL_COVER}
            {playing}
            {progressRatio}
            size="md"
          />
        {:else if skin.current === 'aurora'}
          <!-- 极光风格圆角方形悬浮发光封面 -->
          <div
            class="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-lg border border-white/30 transition-transform hover:scale-105"
            style="box-shadow: 0 0 16px var(--skin-glow, rgba(239, 68, 68, 0.45));"
          >
            <img
              src={formatCoverUrl(curTrack?.cover, 100)}
              alt="封面"
              class="w-full h-full object-cover {playing ? 'scale-105' : 'scale-100'} transition-transform duration-500"
              referrerpolicy="no-referrer"
              onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
            />
          </div>
        {:else if skin.current === 'spring'}
          <!-- 春日青绿翡翠唱片 -->
          <div class="relative w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-emerald-600 to-teal-400 shrink-0 shadow-md shadow-emerald-500/20">
            <img
              src={formatCoverUrl(curTrack?.cover, 100)}
              alt="封面"
              class="w-full h-full rounded-full object-cover {playing ? 'animate-[spin_20s_linear_infinite]' : ''}"
              referrerpolicy="no-referrer"
              onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
            />
          </div>
        {:else}
          <!-- 经典黑胶唱片环 -->
          <PlayerCoverRing
            cover={curTrack?.cover || DEFAULT_VINYL_COVER}
            {playing}
            {ringDashOffset}
            size="md"
          />
        {/if}

        <div class="flex flex-col overflow-hidden min-w-0 flex-1">
          <div class="flex items-center gap-1.5 overflow-hidden">
            {#if skin.current === 'winamp'}
              <span class="text-xs text-amber-400 font-mono">⚡</span>
            {:else if skin.current === 'spring'}
              <span class="text-xs text-emerald-400">🌱</span>
            {/if}
            <span
              class="text-sm font-semibold truncate leading-tight {skin.current === 'winamp'
                ? 'font-mono text-[#10b981] drop-shadow-[0_0_4px_rgba(16,185,129,0.5)]'
                : skin.current === 'cassette'
                  ? 'font-mono text-neutral-200'
                  : skin.current === 'spring'
                    ? 'text-emerald-400 font-semibold'
                    : 'text-[var(--text-main,#0f172a)]'}"
            >
              {curTrack?.name || '未在播放'}
            </span>
            {#if curTrack}
              <TrackSourceBadge id={curTrack.id} isLocal={curTrack.isLocal} {curTrack} class="ml-1" />
            {/if}
          </div>
          <div
            class="text-xs truncate mt-0.5 {skin.current === 'winamp'
              ? 'font-mono text-emerald-400/70'
              : skin.current === 'cassette'
                ? 'font-mono text-neutral-400'
                : skin.current === 'spring'
                  ? 'text-emerald-300/70'
                  : 'text-[var(--text-secondary,#64748b)]'}"
          >
            {formatArtist(curTrack?.artist) || '未知歌手'}
          </div>
        </div>
      </div>

      <!-- ❤️ 红心按钮 -->
      {#if curTrack}
        <TrackLikeBtn liked={isLiked} onclick={onToggleLike} />
      {/if}
    </div>

    <!-- 2. 中间：按皮肤定制的核心控制按键 + 全宽进度条 -->
    <div class="flex flex-col items-center justify-center flex-2 max-w-[580px] gap-1.5 w-full">
      <PlayerControls
        {playing}
        {playMode}
        {onTogglePlay}
        {onPrev}
        {onNext}
        {onToggleMode}
        size="md"
        skinId={skin.current}
      />
      <PlayerProgressBar
        {curTime}
        {duration}
        {progressRatio}
        {onSeek}
        skinId={skin.current}
      />
    </div>

    <!-- 3. 右侧：功能控制与平滑音量条 -->
    <div class="flex items-center justify-end gap-3 flex-1 min-w-[220px] max-w-[320px]">
      <button
        type="button"
        class="w-8.5 h-8.5 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onLyric}
        title="全屏歌词与皮肤舞台"
      >
        <PlayerIcon name="mic" size={17} />
      </button>
      {#if platform.canUseAudioProcessing}
        <button
          type="button"
          class="w-8.5 h-8.5 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          onclick={onPeq}
          title="5段参量均衡器 (PEQ)"
        >
          <PlayerIcon name="equalizer" size={17} />
        </button>
      {/if}
      <button
        data-testid="btn-toggle-drawer"
        type="button"
        class="relative w-8.5 h-8.5 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onQueue}
        title="当前播放列表"
      >
        <PlayerIcon name="list" size={17} />
        <span class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold px-1 py-px rounded-full border border-white/60 leading-none">
          {queue.length}
        </span>
      </button>

      {#if platform.canAdjustVolume}
        <div class="flex items-center gap-1.5">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            class="cursor-pointer select-none text-[var(--text-main)] flex items-center"
            onclick={() => { vol = vol > 0 ? 0 : 0.8; }}
            title="静音切换"
          >
            <PlayerIcon name={vol === 0 ? 'volume-mute' : vol < 0.4 ? 'volume-low' : 'volume'} size={18} />
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            bind:value={vol}
            class="w-20 h-1 cursor-pointer bg-black/10 dark:bg-white/15 rounded-lg {skin.current === 'winamp' || skin.current === 'spring'
              ? 'accent-emerald-500'
              : skin.current === 'aurora'
                ? 'accent-[var(--skin-accent,#ef4444)]'
                : 'accent-red-500'}"
          />
        </div>
      {/if}

      <button
        type="button"
        class="w-7 h-7 rounded-full flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/15 active:scale-95 transition-all cursor-pointer"
        onclick={onMinimize}
        title="收起为浮球"
      >
        <PlayerIcon name="close" size={13} />
      </button>
    </div>
  </div>
</div>
