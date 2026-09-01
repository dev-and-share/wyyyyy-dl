<script lang="ts">
  import { sheetState, closeSheet, type SheetActionStyle } from '../lib/ui.svelte';

  // Style map for action buttons
  const styleClass: Record<SheetActionStyle, string> = {
    primary:
      'w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-sm transition-all cursor-pointer text-center',
    danger:
      'w-full py-3 px-4 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-semibold text-sm transition-all cursor-pointer text-left',
    cancel:
      'w-full py-3 px-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.04] text-center text-sm text-[var(--text-secondary)] transition-all cursor-pointer mt-1',
    default:
      'w-full py-3 px-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.04] text-left text-sm font-medium text-[var(--text-main)] transition-all cursor-pointer',
  };

  function handleAction(fn: () => void) {
    closeSheet();
    fn();
  }
</script>

{#if sheetState.data}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10050] flex items-end justify-center"
    onclick={closeSheet}
  >
    <div
      class="bg-[var(--card-bg-solid,#0f172a)] rounded-t-2xl w-full max-w-[500px] p-4 max-h-[80vh] overflow-y-auto border-t border-[var(--border-color,rgba(255,255,255,0.12))] shadow-2xl flex flex-col gap-2 pb-[calc(16px+env(safe-area-inset-bottom,0px))] animate-[scaleUp_0.22s_cubic-bezier(0.16,1,0.3,1)]"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex justify-between items-start pb-3 border-b border-[var(--border-subtle)]">
        <div class="overflow-hidden pr-2 flex-1">
          <div class="font-bold text-sm text-[var(--text-main)] truncate">
            {sheetState.data.title}
          </div>
          {#if sheetState.data.subtitle}
            <div class="text-[11px] text-[var(--text-muted)] font-mono truncate mt-0.5">
              {sheetState.data.subtitle}
            </div>
          {/if}
        </div>
        <button
          type="button"
          onclick={closeSheet}
          class="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/10 dark:hover:bg-white/10 transition-all cursor-pointer"
        >
          ✕
        </button>
      </div>

      <!-- Action buttons -->
      {#each sheetState.data.actions as action}
        <button
          type="button"
          class={styleClass[action.style ?? 'default']}
          onclick={() => handleAction(action.onclick)}
        >
          {action.label}
        </button>
      {/each}
    </div>
  </div>
{/if}
