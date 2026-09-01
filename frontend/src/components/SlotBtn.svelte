<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    active = false,
    playing = false,
    title = '',
    onclick,
    children
  } = $props<{
    active?: boolean;
    playing?: boolean;
    title?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  }>();
</script>

<button
  type="button"
  class="min-w-[56px] md:min-w-[64px] h-7 px-2 md:px-2.5 rounded-[14px] text-xs font-medium inline-flex items-center justify-center whitespace-nowrap border cursor-pointer select-none transition-all hover:-translate-y-px active:translate-y-0 disabled:opacity-50 {
    playing
      ? 'bg-sky-500/15 border-sky-500/40 text-sky-500 font-bold dark:bg-sky-400/20 dark:border-sky-400/50 dark:text-sky-400'
      : active
      ? 'bg-[var(--btn-slot-active-bg)] border-[var(--primary-color)] text-[var(--primary-color)]'
      : 'bg-[var(--btn-slot-bg)] border-[var(--btn-slot-border)] text-[var(--btn-slot-color)] hover:bg-[var(--btn-slot-hover-bg)] hover:text-[var(--btn-slot-hover-color)]'
  }"
  {title}
  {onclick}
>
  {@render children?.()}
</button>
