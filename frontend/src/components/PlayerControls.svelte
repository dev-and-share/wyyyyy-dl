<script lang="ts">
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

  let modeIcon = $derived(playMode === 'single' ? '🔂' : (playMode === 'shuffle' ? '🔀' : '🔁'));
  let modeTitle = $derived(playMode === 'single' ? '单曲循环' : (playMode === 'shuffle' ? '随机播放' : '列表循环'));
</script>

<div class="flex items-center justify-center {size === 'lg' ? 'gap-3 w-full justify-between' : 'gap-4'}">
  <button
    type="button"
    class="rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all {size === 'lg' ? 'w-9 h-9 text-base bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)]' : 'w-8 h-8 text-sm'}"
    onclick={onToggleMode}
    title={modeTitle}
  >
    {modeIcon}
  </button>
  <button
    type="button"
    class="rounded-full flex items-center justify-center text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all {size === 'lg' ? 'w-10 h-10 text-lg bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)]' : 'w-8 h-8 text-sm'}"
    onclick={onPrev}
    title="上一首"
  >
    ⏮
  </button>
  <button
    type="button"
    class="rounded-full flex items-center justify-center bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95 transition-all font-bold {size === 'lg' ? 'w-12 h-12 text-xl' : 'w-9.5 h-9.5 text-base'}"
    onclick={onTogglePlay}
    title={playing ? '暂停' : '播放'}
  >
    {playing ? '⏸' : '▶'}
  </button>
  <button
    type="button"
    class="rounded-full flex items-center justify-center text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all {size === 'lg' ? 'w-10 h-10 text-lg bg-[var(--btn-slot-bg)] border border-[var(--border-subtle)]' : 'w-8 h-8 text-sm'}"
    onclick={onNext}
    title="下一首"
  >
    ⏭
  </button>
</div>
