<script lang="ts">
  import PlayerIcon, { type PlayerIconName } from './PlayerIcon.svelte';

  let {
    playing = false,
    playMode = 'list',
    onTogglePlay,
    onPrev,
    onNext,
    onToggleMode,
    size = 'md'
  } = $props<{
    playing: boolean;
    playMode: 'list' | 'single' | 'shuffle';
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    onToggleMode: () => void;
    size?: 'md' | 'lg';
  }>();

  let modeIconName = $derived<PlayerIconName>(playMode === 'single' ? 'repeat-1' : (playMode === 'shuffle' ? 'shuffle' : 'repeat'));
  let modeTitle = $derived(playMode === 'single' ? '单曲循环' : (playMode === 'shuffle' ? '随机播放' : '列表循环'));
</script>

<div class="flex items-center justify-center {size === 'lg' ? 'gap-3 w-full justify-between' : 'gap-4'}">
  <button
    data-testid="btn-toggle-mode"
    type="button"
    class="rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer {size === 'lg' ? 'w-9 h-9 bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)]' : 'w-8 h-8'}"
    onclick={onToggleMode}
    title={modeTitle}
  >
    <PlayerIcon name={modeIconName} size={size === 'lg' ? 20 : 17} />
  </button>
  <button
    data-testid="btn-prev-track"
    type="button"
    class="rounded-full flex items-center justify-center text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer {size === 'lg' ? 'w-10 h-10 bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)]' : 'w-8 h-8'}"
    onclick={onPrev}
    title="上一首"
  >
    <PlayerIcon name="prev" size={size === 'lg' ? 20 : 18} />
  </button>
  <button
    data-testid="btn-play-pause"
    type="button"
    class="rounded-full flex items-center justify-center bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/35 hover:scale-105 active:scale-95 transition-all cursor-pointer {size === 'lg' ? 'w-12 h-12' : 'w-9.5 h-9.5'}"
    onclick={onTogglePlay}
    title={playing ? '暂停' : '播放'}
  >
    <PlayerIcon name={playing ? 'pause' : 'play'} size={size === 'lg' ? 24 : 19} />
  </button>
  <button
    data-testid="btn-next-track"
    type="button"
    class="rounded-full flex items-center justify-center text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer {size === 'lg' ? 'w-10 h-10 bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)]' : 'w-8 h-8'}"
    onclick={onNext}
    title="下一首"
  >
    <PlayerIcon name="next" size={size === 'lg' ? 20 : 18} />
  </button>
</div>
