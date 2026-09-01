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

  let closing = $state(false);
  let dragOffset = $state(0);
  let isDragging = $state(false);
  let startY = 0;

  function handleClose() {
    if (closing) return;
    closing = true;
    setTimeout(() => {
      closing = false;
      closeSheet();
    }, 200);
  }

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      startY = e.touches[0].clientY;
      isDragging = true;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging || closing) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) {
      dragOffset = diff;
    } else {
      dragOffset = 0;
    }
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (dragOffset > 70) {
      dragOffset = 500;
      closing = true;
      setTimeout(() => {
        closing = false;
        dragOffset = 0;
        closeSheet();
      }, 200);
    } else {
      dragOffset = 0;
    }
  }

  function handleAction(fn: () => void) {
    handleClose();
    setTimeout(() => fn(), 100);
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && handleClose()} />

{#if sheetState.data}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10050] flex items-end justify-center {closing ? 'animate-[actionSheetFadeOut_0.2s_ease-in]' : 'animate-[actionSheetFadeIn_0.2s_ease-out]'}"
    onclick={handleClose}
  >
    <div
      class="bg-[var(--card-bg-solid,#0f172a)] rounded-t-2xl w-full max-w-[500px] p-4 max-h-[80vh] overflow-y-auto border-t border-[var(--border-color,rgba(255,255,255,0.12))] shadow-2xl flex flex-col gap-2 pb-[calc(16px+env(safe-area-inset-bottom,0px))] {closing && dragOffset === 0 ? 'animate-[actionSheetSlideDown_0.2s_ease-in]' : 'animate-[actionSheetSlideUp_0.25s_cubic-bezier(0.16,1,0.3,1)]'}"
      style={dragOffset > 0 ? `transform: translateY(${dragOffset}px); transition: ${isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)'};` : ''}
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Drag handle -->
      <div
        class="w-full py-1 flex justify-center cursor-grab active:cursor-grabbing select-none touch-none -mt-1"
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
      >
        <div class="w-9 h-1 rounded-full bg-white/25"></div>
      </div>

      <!-- Header -->
      <div
        class="flex justify-between items-start pb-2.5 border-b border-[var(--border-subtle)] select-none"
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
      >
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
          onclick={handleClose}
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
