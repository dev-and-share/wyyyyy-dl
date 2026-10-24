<script lang="ts">
  import PlayerIcon, { type PlayerIconName } from './PlayerIcon.svelte';

  let {
    playing = false,
    playMode = 'list',
    onTogglePlay,
    onPrev,
    onNext,
    onToggleMode,
    size = 'md',
    skinId = 'vinyl'
  } = $props<{
    playing: boolean;
    playMode: 'list' | 'single' | 'shuffle';
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    onToggleMode: () => void;
    size?: 'md' | 'lg';
    skinId?: string;
  }>();

  let modeIconName = $derived<PlayerIconName>(
    playMode === 'single' ? 'repeat-1' : playMode === 'shuffle' ? 'shuffle' : 'repeat'
  );
  let modeTitle = $derived(
    playMode === 'single' ? '单曲循环' : playMode === 'shuffle' ? '随机播放' : '列表循环'
  );
</script>

<div class="flex items-center justify-center {size === 'lg' ? 'gap-3 w-full justify-between' : 'gap-3.5'}">
  <!-- 播放模式切换 -->
  <button
    data-testid="btn-toggle-mode"
    type="button"
    class="flex items-center justify-center transition-all cursor-pointer {skinId === 'winamp'
      ? 'w-7 h-6 rounded-xs bg-[#252a33] border-t border-l border-white/20 border-b-2 border-r-2 border-black/80 active:translate-y-px text-neutral-300'
      : skinId === 'cassette'
        ? 'w-7.5 h-7 rounded-md bg-[#22262d] border border-neutral-700 active:scale-95 text-neutral-400'
        : skinId === 'aurora'
          ? 'w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 active:scale-95'
          : skinId === 'spring'
            ? 'w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 active:scale-95'
            : size === 'lg'
              ? 'w-9 h-9 rounded-full bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
              : 'w-8 h-8 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95'}"
    onclick={onToggleMode}
    title={modeTitle}
  >
    <PlayerIcon name={modeIconName} size={size === 'lg' ? 20 : 16} />
  </button>

  <!-- 上一首 -->
  <button
    data-testid="btn-prev-track"
    type="button"
    class="flex items-center justify-center transition-all cursor-pointer {skinId === 'winamp'
      ? 'w-8 h-7 rounded-xs bg-gradient-to-b from-[#343a46] to-[#20242b] border-t border-l border-white/30 border-b-2 border-r-2 border-black/90 active:translate-y-px text-neutral-200'
      : skinId === 'cassette'
        ? 'w-8 h-7.5 rounded-md bg-[#252930] border border-neutral-600 active:scale-95 text-neutral-300'
        : skinId === 'aurora'
          ? 'w-8.5 h-8.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 active:scale-95'
          : skinId === 'spring'
            ? 'w-8.5 h-8.5 rounded-full bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 active:scale-95'
            : size === 'lg'
              ? 'w-10 h-10 rounded-full bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)] text-[var(--text-main)]'
              : 'w-8 h-8 rounded-full text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95'}"
    onclick={onPrev}
    title="上一首"
  >
    {#if skinId === 'winamp'}
      <span class="text-xs font-mono font-bold leading-none">|◀</span>
    {:else}
      <PlayerIcon name="prev" size={size === 'lg' ? 20 : 17} />
    {/if}
  </button>

  <!-- 播放 / 暂停 -->
  <button
    data-testid="btn-play-pause"
    type="button"
    class="flex items-center justify-center transition-all cursor-pointer {skinId === 'winamp'
      ? 'w-9 h-7.5 rounded-xs bg-gradient-to-b from-[#3d4553] to-[#1c2027] border-t-2 border-l-2 border-white/40 border-b-2 border-r-2 border-black text-amber-400 active:translate-y-px shadow-sm'
      : skinId === 'cassette'
        ? 'w-9 h-8.5 rounded-md bg-[#2d323b] border-2 border-neutral-500 text-emerald-400 active:scale-95 shadow-sm'
        : skinId === 'aurora'
          ? 'w-10 h-10 rounded-full bg-gradient-to-r from-[var(--skin-accent,#ef4444)] to-[var(--skin-dominant,#6366f1)] text-white shadow-[0_0_16px_var(--skin-glow,rgba(239,68,68,0.5))] hover:scale-105 active:scale-95'
          : skinId === 'spring'
            ? 'w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/40 hover:scale-105 active:scale-95'
            : 'rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/35 hover:scale-105 active:scale-95 ' +
              (size === 'lg' ? 'w-12 h-12' : 'w-9.5 h-9.5')}"
    onclick={onTogglePlay}
    title={playing ? '暂停' : '播放'}
  >
    {#if skinId === 'winamp'}
      <span class="text-xs font-mono font-bold leading-none">{playing ? '❚❚' : '▶'}</span>
    {:else}
      <PlayerIcon name={playing ? 'pause' : 'play'} size={size === 'lg' ? 24 : 19} />
    {/if}
  </button>

  <!-- 下一首 -->
  <button
    data-testid="btn-next-track"
    type="button"
    class="flex items-center justify-center transition-all cursor-pointer {skinId === 'winamp'
      ? 'w-8 h-7 rounded-xs bg-gradient-to-b from-[#343a46] to-[#20242b] border-t border-l border-white/30 border-b-2 border-r-2 border-black/90 active:translate-y-px text-neutral-200'
      : skinId === 'cassette'
        ? 'w-8 h-7.5 rounded-md bg-[#252930] border border-neutral-600 active:scale-95 text-neutral-300'
        : skinId === 'aurora'
          ? 'w-8.5 h-8.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 active:scale-95'
          : skinId === 'spring'
            ? 'w-8.5 h-8.5 rounded-full bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 active:scale-95'
            : size === 'lg'
              ? 'w-10 h-10 rounded-full bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)] text-[var(--text-main)]'
              : 'w-8 h-8 rounded-full text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95'}"
    onclick={onNext}
    title="下一首"
  >
    {#if skinId === 'winamp'}
      <span class="text-xs font-mono font-bold leading-none">▶|</span>
    {:else}
      <PlayerIcon name="next" size={size === 'lg' ? 20 : 17} />
    {/if}
  </button>
</div>
