<script lang="ts">
  import { untrack } from 'svelte';
  import { sheetState, closeSheet, type SheetActionStyle } from '../lib/ui.svelte';
  import { pushModalBackdrop } from '../lib/skinStore.svelte';
  import { X, Copy } from '@lucide/svelte';
  import { t } from '../lib/i18n';

  $effect(() => {
    if (sheetState.data) {
      const release = untrack(() => pushModalBackdrop());
      return () => untrack(() => release());
    }
  });

  // Style map for action buttons
  const styleClass: Record<SheetActionStyle, string> = {
    primary:
      'w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-sm transition-all cursor-pointer text-center',
    danger:
      'w-full py-3 px-4 rounded-xl border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/25 text-red-500 dark:text-red-400 font-medium text-sm transition-all cursor-pointer text-left',
    cancel:
      'w-full py-3 px-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.04] text-center text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all cursor-pointer mt-1 active:scale-98',
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
      dragOffset = 0;
      isDragging = false;
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

  // 检查 actions 列表中是否已经显式提供了 cancel 类型的按钮
  let hasCancelAction = $derived(
    sheetState.data?.actions.some((a) => a.style === 'cancel') ?? false
  );
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && handleClose()} />

{#if sheetState.data}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- 遮罩层：增加 cursor-pointer、role="button"、tabindex="-1"，支持移动端 ontouchend 兜底触发关闭 -->
  <div
    role="button"
    tabindex="-1"
    aria-label={t('common.close')}
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10050] flex items-end justify-center cursor-pointer {closing ? 'animate-[actionSheetFadeOut_0.2s_ease-in]' : 'animate-[actionSheetFadeIn_0.2s_ease-out]'}"
    onclick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    ontouchend={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); handleClose(); } }}
  >
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="bg-[var(--card-bg-solid,#0f172a)] rounded-t-2xl w-full max-w-[500px] p-4 max-h-[80vh] overflow-y-auto border-t border-[var(--border-color,rgba(255,255,255,0.12))] shadow-2xl flex flex-col gap-2 pb-[calc(16px+env(safe-area-inset-bottom,0px))] cursor-default select-text {closing && dragOffset === 0 ? 'animate-[actionSheetSlideDown_0.2s_ease-in]' : 'animate-[actionSheetSlideUp_0.25s_cubic-bezier(0.16,1,0.3,1)]'}"
      style={dragOffset > 0 ? `transform: translateY(${dragOffset}px); transition: ${isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)'};` : ''}
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Drag handle (仅在把手区和标题区响应手势拖拽，绝不劫持右侧关闭按钮) -->
      <div
        class="w-full py-1.5 flex justify-center cursor-grab active:cursor-grabbing select-none touch-none -mt-1"
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
      >
        <div class="w-10 h-1 rounded-full bg-white/25"></div>
      </div>

      <!-- Header -->
      <div
        class="flex justify-between items-start pb-2.5 border-b border-[var(--border-subtle)] select-none"
      >
        <div
          class="overflow-hidden pr-2 flex-1 cursor-grab active:cursor-grabbing touch-none"
          ontouchstart={handleTouchStart}
          ontouchmove={handleTouchMove}
          ontouchend={handleTouchEnd}
        >
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
          data-testid="bottom-sheet-close-btn"
          aria-label={t('common.close')}
          onclick={(e) => { e.stopPropagation(); handleClose(); }}
          ontouchstart={(e) => e.stopPropagation()}
          ontouchend={(e) => { e.stopPropagation(); e.preventDefault(); handleClose(); }}
          class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        >
          <X size={17} strokeWidth={2.2} />
        </button>
      </div>

      <!-- Action buttons -->
      {#each sheetState.data.actions as action}
        {#if action.trailingAction}
          {@const trailing = action.trailingAction}
          <div class="flex items-stretch gap-1.5 w-full">
            <button
              type="button"
              class="{styleClass[action.style ?? 'default']} flex-1 min-w-0 truncate"
              onclick={() => handleAction(action.onclick)}
            >
              {action.label}
            </button>
            <button
              type="button"
              class="shrink-0 px-3.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.04] hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-main)] flex items-center justify-center gap-1 text-xs font-medium transition-all cursor-pointer active:scale-95"
              title={trailing.title || trailing.label || t('common.copy')}
              aria-label={trailing.title || trailing.label || t('common.copy')}
              onclick={(e) => {
                e.stopPropagation();
                handleAction(trailing.onclick);
              }}
            >
              {#if trailing.icon === 'copy'}
                <Copy size={15} />
              {/if}
              {#if trailing.label}
                <span>{trailing.label}</span>
              {/if}
            </button>
          </div>
        {:else}
          <button
            type="button"
            class={styleClass[action.style ?? 'default']}
            onclick={() => handleAction(action.onclick)}
          >
            {action.label}
          </button>
        {/if}
      {/each}

      <!-- 📱 移动端标准取消按钮兜底：单手大拇指黄金触控区，一触即关 -->
      {#if !hasCancelAction}
        <button
          type="button"
          class={styleClass.cancel}
          onclick={handleClose}
          ontouchend={(e) => { e.stopPropagation(); e.preventDefault(); handleClose(); }}
        >
          {t('common.cancel')}
        </button>
      {/if}
    </div>
  </div>
{/if}
