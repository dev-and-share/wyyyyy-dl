<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title = '',
    icon = '',
    maxWidth = 'max-w-[520px]',
    onClose,
    children,
    footer
  } = $props<{
    title?: string;
    icon?: string;
    maxWidth?: string;
    onClose: () => void;
    children: Snippet;
    footer?: Snippet;
  }>();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 w-screen h-screen bg-black/65 backdrop-blur-md z-[100000] flex items-center justify-center p-4 box-border animate-[modalFadeIn_0.2s_ease-out]"
  onclick={(e) => e.target === e.currentTarget && onClose()}
>
  <div
    class="bg-[var(--card-bg-solid,#0f172a)] border border-[var(--border-color,rgba(255,255,255,0.18))] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] w-full {maxWidth} overflow-hidden flex flex-col box-border animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- Modal Header -->
    <div class="px-5 py-3.5 border-b border-[var(--border-subtle,rgba(255,255,255,0.08))] flex justify-between items-center bg-black/5 dark:bg-white/[0.02]">
      <div class="flex items-center gap-2 font-bold text-[var(--text-main,#f8fafc)] text-[15px] select-none">
        {#if icon}<span>{icon}</span>{/if}
        <span>{title}</span>
      </div>
      <button
        type="button"
        class="w-7 h-7 rounded-full flex items-center justify-center text-sm text-[var(--text-muted,#94a3b8)] hover:text-[var(--text-main,#ffffff)] hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onClose}
        title="关闭"
      >
        ✕
      </button>
    </div>

    <!-- Modal Body -->
    <div class="p-5 overflow-y-auto text-[var(--text-main,#cbd5e1)] text-[13.5px] leading-relaxed max-h-[75vh]">
      {@render children()}
    </div>

    <!-- Modal Footer -->
    {#if footer}
      <div class="px-5 py-3 border-t border-[var(--border-subtle,rgba(255,255,255,0.08))] flex justify-end items-center gap-2.5 bg-black/5 dark:bg-white/[0.02]">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>
