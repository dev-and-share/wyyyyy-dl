<script lang="ts">
  import { onMount } from 'svelte';

  let {
    disabled = false,
    onRefresh
  } = $props<{
    disabled?: boolean;
    onRefresh?: () => Promise<void> | void;
  }>();

  let startY = 0;
  let isDragging = $state(false);
  let pullDistance = $state(0);
  let isRefreshing = $state(false);

  const THRESHOLD = 65;

  function handleTouchStart(e: TouchEvent) {
    if (disabled || window.scrollY > 5 || isRefreshing) return;
    const target = e.target as HTMLElement | null;
    // 如果触摸在弹窗、抽屉、固定层、输入框、按钮或滚动列表中，忽略全屏下拉刷新
    if (
      !target ||
      target.closest(
        '[class*="z-[100"], [class*="z-[999"], [role="dialog"], .fixed, input, textarea, button, select, .scrollable-list, .data-list'
      )
    ) {
      return;
    }
    if (e.touches.length === 1) {
      startY = e.touches[0].clientY;
      isDragging = true;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging || isRefreshing || disabled) return;
    if (window.scrollY > 0) {
      isDragging = false;
      pullDistance = 0;
      return;
    }
    const touchY = e.touches[0].clientY;
    const diff = touchY - startY;
    if (diff > 0) {
      // 阻尼弹性拉动公式
      pullDistance = Math.min(100, Math.pow(diff, 0.85));
    } else {
      pullDistance = 0;
    }
  }

  async function handleTouchEnd() {
    if (!isDragging || isRefreshing || disabled) return;
    isDragging = false;
    if (pullDistance >= THRESHOLD) {
      isRefreshing = true;
      pullDistance = 54;
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15);
        }
      } catch {}
      try {
        if (onRefresh) {
          await onRefresh();
        } else {
          window.location.reload();
        }
      } catch {}
      setTimeout(() => {
        isRefreshing = false;
        pullDistance = 0;
      }, 600);
    } else {
      pullDistance = 0;
    }
  }

  onMount(() => {
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  });
</script>

{#if (pullDistance > 0 || isRefreshing) && !disabled}
  <div
    class="fixed top-0 left-0 right-0 z-[100000] flex justify-center pointer-events-none transition-transform duration-150 ease-out"
    style="transform: translateY(calc(env(safe-area-inset-top, 0px) + {pullDistance - 45}px)); opacity: {Math.min(1, pullDistance / 28)};"
  >
    <div
      class="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 shadow-2xl backdrop-blur-xl transition-all border duration-200 {pullDistance >= THRESHOLD || isRefreshing ? 'bg-purple-600/95 text-white border-purple-400/40 shadow-purple-500/30 scale-105' : 'bg-[var(--card-bg-solid,#0f172a)]/95 text-[var(--text-main)] border-[var(--border-color,rgba(255,255,255,0.15))]'}"
    >
      <span
        class="inline-block text-sm transition-transform duration-75 {isRefreshing ? 'animate-[spin_0.8s_linear_infinite]' : ''}"
        style={!isRefreshing ? `transform: rotate(${pullDistance * 4.5}deg);` : ''}
      >
        🔄
      </span>
      <span>
        {isRefreshing ? '正在同步应用与数据...' : pullDistance >= THRESHOLD ? '释放立即刷新' : '下拉刷新 PWA'}
      </span>
    </div>
  </div>
{/if}
