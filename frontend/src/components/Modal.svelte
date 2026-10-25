<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title = '',
    icon = '',
    maxWidth = 'max-w-[520px]',
    height = '',
    zIndex = 'z-[100020]',
    onClose,
    children,
    footer
  } = $props<{
    title?: string;
    icon?: string;
    maxWidth?: string;
    height?: string;
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

  // 💻 计算 PC 端最大宽度（精准提取 px/rem，彻底解决 Tailwind 动态拼接 sm:{maxWidth} 失效问题）
  let computedMaxWidth = $derived.by(() => {
    if (!maxWidth) return '480px';
    const m = maxWidth.match(/\[(.*?)\]/);
    if (m && m[1]) return m[1];
    if (maxWidth.endsWith('px') || maxWidth.endsWith('rem') || maxWidth.endsWith('%')) return maxWidth;
    return '480px';
  });

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
  class="fixed inset-0 w-screen h-screen bg-black/60 backdrop-blur-sm {zIndex} flex items-end sm:items-center justify-center p-0 sm:p-4 box-border {closing ? 'animate-[modalFadeIn_0.2s_ease-out_reverse]' : 'animate-[modalFadeIn_0.2s_ease-out]'}"
  onclick={(e) => e.target === e.currentTarget && handleClose()}
>
  <div
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label={title || '弹出窗口'}
    class="modal-dialog-box bg-[var(--card-bg)] text-[var(--text-main)] border-[var(--border-color)]
      w-full max-sm:rounded-t-[28px] max-sm:rounded-b-none max-sm:border-t max-sm:border-b-0 max-sm:max-h-[88vh]
      sm:rounded-2xl sm:max-h-[85vh] sm:border sm:mx-auto
      {height}
      shadow-2xl overflow-hidden flex flex-col box-border
      {closing && dragOffset === 0
        ? 'max-sm:animate-[drawerSlideDownSP_0.2s_ease-in] sm:animate-[modalFadeIn_0.2s_ease-out_reverse]'
        : 'max-sm:animate-[drawerSlideUpSP_0.25s_cubic-bezier(0.16,1,0.3,1)] sm:animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]'}"
    style="--modal-max-width: {computedMaxWidth}; {dragOffset > 0 ? `transform: translateY(${dragOffset}px); transition: ${isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)'};` : ''}"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- 📱 移动端手势拖拽把手 (Drag handle: 自适应明暗模式，与系统设置抽屉完全统一) -->
    <div
      class="w-full pt-2.5 pb-1 flex sm:hidden justify-center cursor-grab active:cursor-grabbing select-none touch-none"
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
    >
      <div class="w-10 h-1 bg-[var(--text-muted)] opacity-30 rounded-full"></div>
    </div>

    <!-- Modal Header 标题栏 -->
    <div
      class="px-5 py-3.5 border-b border-[var(--border-color)] flex justify-between items-center shrink-0 select-none"
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
    >
      <div class="flex items-center gap-2 font-bold text-[var(--text-main)] text-base select-none">
        {#if icon}<span class="text-xl leading-none">{icon}</span>{/if}
        <h2 class="text-base font-bold text-[var(--text-main)] m-0">{title}</h2>
      </div>
      <button
        type="button"
        class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent text-sm"
        onclick={handleClose}
        title="关闭"
        aria-label="关闭"
      >
        ✕
      </button>
    </div>

    <!-- Modal Body 内容区 -->
    <div class="p-4 sm:p-5 overflow-y-auto text-[var(--text-main)] text-[13.5px] leading-relaxed max-h-[75vh] overscroll-contain flex-1 custom-scrollbar">
      {@render children()}
    </div>

    <!-- Modal Footer 底部栏 -->
    {#if footer}
      <div class="px-5 py-3 border-t border-[var(--border-color)] flex justify-end items-center gap-2.5 bg-black/5 dark:bg-white/[0.02] pb-[max(12px,env(safe-area-inset-bottom,0px))] sm:pb-3 shrink-0 select-none">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>

<style>
  @media (min-width: 640px) {
    .modal-dialog-box {
      max-width: var(--modal-max-width, 480px) !important;
      width: 100% !important;
      margin-left: auto !important;
      margin-right: auto !important;
    }
  }
</style>
