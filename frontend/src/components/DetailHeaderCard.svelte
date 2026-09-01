<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    cover,
    title,
    subtitle,
    subDetail,
    children
  } = $props<{
    cover: string;
    title: string;
    subtitle?: string;
    subDetail?: string;
    children?: Snippet;
  }>();
</script>

<div class="flex gap-3 md:gap-4 my-2.5 items-center bg-white/[0.02] dark:bg-white/[0.02] p-3 rounded-[10px] border border-[var(--border-subtle)]">
  <img
    src={cover}
    alt=""
    class="w-20 h-20 md:w-[110px] md:h-[110px] rounded-[10px] object-cover shadow-[0_4px_14px_rgba(0,0,0,0.3)] shrink-0 border border-[var(--border-color)]"
    referrerpolicy="no-referrer"
    onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (!img.src.includes('favicon.png')) img.src = '/favicon.png'; }}
  />
  <div class="flex-1 flex flex-col min-w-0">
    <h4 class="m-0 mb-1.5 text-[15px] md:text-[17px] font-bold text-[var(--text-main)] whitespace-nowrap overflow-hidden text-ellipsis">
      {title}
    </h4>
    {#if subtitle}
      <div class="text-[11px] md:text-[13px] text-[var(--text-secondary)] mb-1 md:mb-2 whitespace-nowrap overflow-hidden text-ellipsis">
        {subtitle}
      </div>
    {/if}
    {#if subDetail}
      <div class="text-[11px] md:text-xs text-[var(--text-muted)] mb-2 whitespace-nowrap overflow-hidden text-ellipsis">
        {subDetail}
      </div>
    {/if}
    {#if children}
      <div class="flex flex-wrap gap-1.5 md:gap-2.5 items-center mt-1">
        {@render children()}
      </div>
    {/if}
  </div>
</div>
