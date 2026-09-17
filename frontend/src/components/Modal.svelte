<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title = '',
    icon = '',
    maxWidth = 'max-w-[520px]',
    zIndex = 'z-[100020]',
    onClose,
    children,
    footer
  } = $props<{
    title?: string;
    icon?: string;
    maxWidth?: string;
    zIndex?: string;
    onClose: () => void;
    children: Snippet;
    footer?: Snippet;
  }>();

  // 📱 移动端底部抽屉滑动关闭手势状态
  let closing = $state(false);
  let dragOffset = $state(0);
  let isDragging = $state(false);
  let startY = 0;

  function handleClose() {
    if (closing) return;
    closing = true;
    setTimeout(() => {
      closing = false;
      onClose();
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
        onClose();
      }, 200);
    } else {
      dragOffset = 0;
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && handleClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 w-screen h-screen bg-black/65 backdrop-blur-md {zIndex} flex items-end sm:items-center justify-center p-0 sm:p-4 box-border {closing ? 'animate-[modalFadeIn_0.2s_ease-out_reverse]' : 'animate-[modalFadeIn_0.2s_ease-out]'}"
  onclick={(e) => e.target === e.currentTarget && handleClose()}
>
  <div
    class="bg-[var(--card-bg-solid,#0f172a)] border border-[var(--border-color,rgba(255,255,255,0.18))]
      w-full max-sm:rounded-t-[22px] max-sm:rounded-b-none max-sm:border-b-0 max-sm:max-h-[88vh]
      sm:rounded-2xl sm:{maxWidth} sm:max-h-[85vh]
      shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col box-border
      {closing && dragOffset === 0
        ? 'max-sm:animate-[drawerSlideDownSP_0.2s_ease-in] sm:animate-[modalFadeIn_0.2s_ease-out_reverse]'
        : 'max-sm:animate-[drawerSlideUpSP_0.25s_cubic-bezier(0.16,1,0.3,1)] sm:animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]'}"
    style={dragOffset > 0 ? `transform: translateY(${dragOffset}px); transition: ${isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)'};` : ''}
    onclick={(e) => e.stopPropagation()}
  >
    <!-- 📱 移动端下拉手柄 (Drag handle) -->
    <div
      class="w-full pt-2.5 pb-1 flex sm:hidden justify-center cursor-grab active:cursor-grabbing select-none touch-none"
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
    >
      <div class="w-10 h-1 rounded-full bg-white/30"></div>
    </div>

    <!-- Modal Header -->
    <div
      class="px-5 py-3 border-b border-[var(--border-subtle,rgba(255,255,255,0.08))] flex justify-between items-center bg-black/5 dark:bg-white/[0.02] select-none"
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
    >
      <div class="flex items-center gap-2 font-bold text-[var(--text-main,#f8fafc)] text-[15px] select-none">
        {#if icon}<span>{icon}</span>{/if}
        <span>{title}</span>
      </div>
      <button
        type="button"
        class="w-7 h-7 rounded-full flex items-center justify-center text-sm text-[var(--text-muted,#94a3b8)] hover:text-[var(--text-main,#ffffff)] hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={handleClose}
        title="关闭"
      >
        ✕
      </button>
    </div>

    <!-- Modal Body -->
    <div class="p-5 overflow-y-auto text-[var(--text-main,#cbd5e1)] text-[13.5px] leading-relaxed max-h-[75vh] overscroll-contain">
      {@render children()}
    </div>

    <!-- Modal Footer -->
    {#if footer}
      <div class="px-5 py-3 border-t border-[var(--border-subtle,rgba(255,255,255,0.08))] flex justify-end items-center gap-2.5 bg-black/5 dark:bg-white/[0.02] pb-[max(12px,env(safe-area-inset-bottom,0px))] sm:pb-3">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>
