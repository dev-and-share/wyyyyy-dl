<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    open = $bindable(false),
    onToggle,
    children
  } = $props<{
    title: string;
    open?: boolean;
    onToggle?: (open: boolean) => void;
    children?: Snippet;
  }>();

  function toggle() {
    open = !open;
    onToggle?.(open);
  }
</script>

<div class="bg-[var(--card-bg)] backdrop-blur-md rounded-[16px] shadow-md overflow-hidden border border-[var(--border-color)] transition-all duration-300">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="px-3.5 py-3 md:px-5 md:py-3.5 bg-[var(--card-header-bg)] hover:bg-[var(--card-header-hover)] cursor-pointer flex justify-between items-center select-none transition-colors duration-200"
    onclick={toggle}
  >
    <h3 class="m-0 text-sm md:text-[15px] font-semibold text-[var(--text-main)] flex items-center gap-2">
      {title}
    </h3>
    <span class="text-xs text-[var(--text-muted)] transition-transform duration-300 {open ? 'rotate-180' : ''}">
      ▼
    </span>
  </div>
  <div class="transition-all duration-300 ease-in-out {open ? 'max-h-[8000px] p-3 md:p-5 pt-2.5 md:pt-3.5' : 'max-h-0 overflow-hidden px-3 md:px-5'}">
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>
