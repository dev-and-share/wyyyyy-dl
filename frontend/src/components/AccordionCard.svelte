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
  <!-- 采用现代 CSS Grid 0fr ➔ 1fr 动画，消除 max-height 估算带来的折叠延迟与抽搐卡顿 -->
  <div class="grid transition-[grid-template-rows,opacity] duration-250 ease-out {open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}">
    <div class="overflow-hidden">
      <div class="p-3 md:p-5 pt-2.5 md:pt-3.5">
        {#if children}
          {@render children()}
        {/if}
      </div>
    </div>
  </div>
</div>
