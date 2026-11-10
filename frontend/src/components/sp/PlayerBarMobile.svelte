<script lang="ts">
  import { formatArtist, DEFAULT_VINYL_COVER, platform, formatCoverUrl } from '../../lib/utils';
  import type { Track } from '../../lib/types';
  import PlayerCoverRing from '../PlayerCoverRing.svelte';
  import PlayerProgressBar from '../PlayerProgressBar.svelte';
  import PlayerIcon from '../PlayerIcon.svelte';
  import TrackSourceBadge from '../TrackSourceBadge.svelte';
  import { isTrackLiked } from '../../lib/likeStore.svelte';
  import { skin } from '../../lib/skinStore.svelte';
  import WinampMiniVisualizer from '../skins/WinampMiniVisualizer.svelte';
  import CassetteMiniSpools from '../skins/CassetteMiniSpools.svelte';
  import { t } from '../../lib/i18n/index.svelte';

  let {
    curTrack,
    queue = [],
    playing = false,
    loading = false,
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
    loading?: boolean;
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

  let isLiked = $derived(curTrack ? isTrackLiked(curTrack.id, curTrack.name, curTrack.artist) : false);
</script>

<div
  data-testid="player-bar-mobile"
  class="mobile-player-docked-bar fixed left-0 right-0 z-[9995] px-3 pt-1.5 pb-1.5 flex flex-col gap-1 transition-all duration-300 select-none {skin.current === 'winamp'
    ? 'bg-gradient-to-b from-[#2e3441] via-[#21252d] to-[#171920] border-t-2 border-white/25 shadow-2xl'
    : skin.current === 'cassette'
      ? 'bg-[#181a1f] border-t-2 border-[#2b2f38] shadow-2xl'
      : skin.current === 'aurora'
        ? 'bg-slate-950/75 backdrop-blur-2xl border-t border-white/20 shadow-[0_-8px_24px_var(--skin-glow,rgba(239,68,68,0.3))]'
        : skin.current === 'spring'
          ? 'bg-[#061710]/95 backdrop-blur-2xl border-t border-emerald-500/25 shadow-[0_-8px_24px_rgba(16,185,129,0.25)]'
          : 'bg-[var(--card-bg-solid)] backdrop-blur-2xl border-t border-[var(--border-color)]'}"
  style="{skin.cssVars}"
>
  <!-- 2.1 顶部区域：左侧封面；右侧上下两行 -->
  <div class="flex items-center gap-2.5 w-full">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div onclick={onLyric} title={t('player.expandLyric')}>
      {#if skin.current === 'winamp'}
        <div class="flex items-center gap-1.5 shrink-0">
          <div class="w-10 h-10 rounded-xs overflow-hidden border border-white/30 shadow-xs">
            <img
              src={formatCoverUrl(curTrack?.cover, 80)}
              alt={t('player.cover')}
              class="w-full h-full object-cover"
              referrerpolicy="no-referrer"
              onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
            />
          </div>
          <WinampMiniVisualizer {playing} barCount={6} />
        </div>
      {:else if skin.current === 'cassette'}
        <CassetteMiniSpools
          cover={curTrack?.cover || DEFAULT_VINYL_COVER}
          {playing}
          {progressRatio}
          size="sm"
        />
      {:else if skin.current === 'aurora'}
        <div
          class="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-md border border-white/25"
          style="box-shadow: 0 0 12px var(--skin-glow, rgba(239, 68, 68, 0.45));"
        >
          <img
            src={formatCoverUrl(curTrack?.cover, 80)}
            alt={t('player.cover')}
            class="w-full h-full object-cover {playing ? 'scale-105' : 'scale-100'} transition-transform duration-500"
            referrerpolicy="no-referrer"
            onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
          />
        </div>
      {:else if skin.current === 'spring'}
        <div class="relative w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-emerald-600 to-teal-400 shrink-0 shadow-md shadow-emerald-500/20">
          <img
            src={formatCoverUrl(curTrack?.cover, 80)}
            alt={t('player.cover')}
            class="w-full h-full rounded-full object-cover {playing ? 'animate-[spin_20s_linear_infinite]' : ''}"
            referrerpolicy="no-referrer"
            onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
          />
        </div>
      {:else}
        <PlayerCoverRing
          cover={curTrack?.cover || DEFAULT_VINYL_COVER}
          {playing}
          {ringDashOffset}
          size="sm"
        />
      {/if}
    </div>

    <!-- 右侧两行信息栏 -->
    <div class="flex flex-col flex-1 min-w-0 justify-center">
      <!-- 上排：歌名满宽独占 -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="flex items-center gap-1.5 overflow-hidden cursor-pointer" onclick={onLyric} title={t('player.expandLyric')}>
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
          {curTrack?.name || t('player.noTrackPlaying')}
        </span>
        {#if loading}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            class="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0 animate-pulse font-normal flex items-center gap-1 cursor-pointer active:scale-95"
            onclick={(e) => { e.stopPropagation(); onTogglePlay(); }}
            title={t('player.cancelLoading')}
          >
            <span>{t('player.loadingTrack')}</span>
            <span class="text-[8px] opacity-70 font-bold">✕</span>
          </span>
        {/if}
        {#if curTrack}
          <TrackSourceBadge id={curTrack.id} isLocal={curTrack.isLocal} {curTrack} class="ml-1" />
        {/if}
      </div>

      <!-- 下排：歌手名 与 4个快捷工具按钮在同一排 -->
      <div class="flex items-center justify-between gap-1.5 mt-0.5">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="text-xs truncate flex-1 min-w-0 cursor-pointer {skin.current === 'winamp'
            ? 'font-mono text-emerald-400/70'
            : skin.current === 'cassette'
              ? 'font-mono text-neutral-400'
              : skin.current === 'spring'
                ? 'text-emerald-300/70'
                : 'text-[var(--text-secondary,#64748b)]'}"
          onclick={onLyric}
          title={t('player.expandLyric')}
        >
          {formatArtist(curTrack?.artist) || t('player.unknownArtist')}
        </div>

        <!-- 快捷按键 -->
        <div class="flex items-center gap-1 shrink-0">
          <button
            type="button"
            class="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            onclick={onLyric}
            title={t('player.lyricsStage')}
          >
            <PlayerIcon name="mic" size={15} />
          </button>
          {#if platform.canUseAudioProcessing}
            <button
              type="button"
              class="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              onclick={onPeq}
              title={t('peq.title')}
            >
              <PlayerIcon name="equalizer" size={15} />
            </button>
          {/if}
          <button
            data-testid="btn-toggle-drawer"
            type="button"
            class="relative w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            onclick={onQueue}
            title={t('player.playlist')}
          >
            <PlayerIcon name="list" size={15} />
            <span class="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1 py-px rounded-full border border-white/60 leading-none">
              {queue.length}
            </span>
          </button>

          <button
            type="button"
            class="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            onclick={onMinimize}
            title={t('player.minimize')}
          >
            <PlayerIcon name="close" size={13} />
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 2.2 第二排：全宽进度条 -->
  <PlayerProgressBar
    {curTime}
    {duration}
    progressRatio={progressRatio}
    {onSeek}
    skinId={skin.current}
  />

  <!-- 2.3 第三排：5个控制按键 (精致紧凑版) -->
  <div class="flex items-center justify-between w-full px-2 py-0.5">
    <button
      data-testid="btn-toggle-mode"
      type="button"
      class="w-8 h-8 flex items-center justify-center transition-all cursor-pointer {skin.current === 'winamp'
        ? 'rounded-xs bg-[#252a33] border-t border-l border-white/20 border-b-2 border-r-2 border-black/80 text-neutral-300'
        : skin.current === 'cassette'
          ? 'rounded-md bg-[#22262d] border border-neutral-700 text-neutral-400'
          : skin.current === 'aurora'
            ? 'rounded-full bg-white/10 text-white border border-white/15'
            : skin.current === 'spring'
              ? 'rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              : 'rounded-full text-[var(--text-secondary)] bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)]'}"
      onclick={onToggleMode}
      title={playMode === 'single' ? t('player.repeatOne') : (playMode === 'shuffle' ? t('player.shuffle') : t('player.repeatAll'))}
    >
      <PlayerIcon name={playMode === 'single' ? 'repeat-1' : (playMode === 'shuffle' ? 'shuffle' : 'repeat')} size={16} />
    </button>
    <button
      data-testid="btn-prev-track"
      type="button"
      class="w-8.5 h-8.5 flex items-center justify-center transition-all cursor-pointer {skin.current === 'winamp'
        ? 'rounded-xs bg-gradient-to-b from-[#343a46] to-[#20242b] border-t border-l border-white/30 border-b-2 border-r-2 border-black/90 text-neutral-200'
        : skin.current === 'cassette'
          ? 'rounded-md bg-[#252930] border border-neutral-600 text-neutral-300'
          : skin.current === 'aurora'
            ? 'rounded-full bg-white/10 text-white border border-white/15'
            : skin.current === 'spring'
              ? 'rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              : 'rounded-full text-[var(--text-main)] bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)]'}"
      onclick={onPrev}
      title={t('player.previous')}
    >
      {#if skin.current === 'winamp'}
        <span class="text-xs font-mono font-bold leading-none">|◀</span>
      {:else}
        <PlayerIcon name="prev" size={18} />
      {/if}
    </button>
    <button
      data-testid="btn-play-pause"
      type="button"
      class="flex items-center justify-center transition-all cursor-pointer {skin.current === 'winamp'
        ? 'w-10 h-8 rounded-xs bg-gradient-to-b from-[#3d4553] to-[#1c2027] border-t-2 border-l-2 border-white/40 border-b-2 border-r-2 border-black text-amber-400'
        : skin.current === 'cassette'
          ? 'w-10 h-8.5 rounded-md bg-[#2d323b] border-2 border-neutral-500 text-emerald-400'
          : skin.current === 'aurora'
            ? 'w-10 h-10 rounded-full bg-gradient-to-r from-[var(--skin-accent,#ef4444)] to-[var(--skin-dominant,#6366f1)] text-white shadow-[0_0_12px_var(--skin-glow,rgba(239,68,68,0.5))]'
            : skin.current === 'spring'
              ? 'w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/40'
              : 'w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-500/40'}"
      onclick={onTogglePlay}
      title={loading ? t('player.cancelLoading') : (playing ? t('player.pause') : t('player.play'))}
    >
      {#if loading}
        <svg class="animate-spin text-white w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
          <path class="opacity-85" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      {:else if skin.current === 'winamp'}
        <span class="text-xs font-mono font-bold leading-none">{playing ? '❚❚' : '▶'}</span>
      {:else}
        <PlayerIcon name={playing ? 'pause' : 'play'} size={20} />
      {/if}
    </button>
    <button
      data-testid="btn-next-track"
      type="button"
      class="w-8.5 h-8.5 flex items-center justify-center transition-all cursor-pointer {skin.current === 'winamp'
        ? 'rounded-xs bg-gradient-to-b from-[#343a46] to-[#20242b] border-t border-l border-white/30 border-b-2 border-r-2 border-black/90 text-neutral-200'
        : skin.current === 'cassette'
          ? 'rounded-md bg-[#252930] border border-neutral-600 text-neutral-300'
          : skin.current === 'aurora'
            ? 'rounded-full bg-white/10 text-white border border-white/15'
            : skin.current === 'spring'
              ? 'rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              : 'rounded-full text-[var(--text-main)] bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)]'}"
      onclick={onNext}
      title={t('player.next')}
    >
      {#if skin.current === 'winamp'}
        <span class="text-xs font-mono font-bold leading-none">▶|</span>
      {:else}
        <PlayerIcon name="next" size={18} />
      {/if}
    </button>
    <!-- ❤️ 红心按钮 -->
    <button
      type="button"
      class="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--btn-slot-bg)] border active:scale-95 transition-all cursor-pointer
        {isLiked
          ? 'border-red-500/40 text-red-500'
          : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-red-400 hover:border-red-400/30'}"
      onclick={onToggleLike}
      title={isLiked ? t('player.likeRemove') : t('player.likeAdd')}
    >
      <PlayerIcon name="heart" liked={isLiked} size={16} />
    </button>
  </div>
</div>
