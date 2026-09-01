<script lang="ts">
  import { onMount } from 'svelte';

  let { onRefresh } = $props<{
    onRefresh?: () => Promise<void> | void;
  }>();

  let startY = 0;
  let currentY = 0;
  let isDragging = $state(false);
  let pullDistance = $state(0);
  let isRefreshing = $state(false);

  const THRESHOLD = 65;

  function handleTouchStart(e: TouchEvent) {
    if (window.scrollY > 5 || isRefreshing) return;
    if (e.touches.length === 1) {
      startY = e.touches[0].clientY;
      isDragging = true;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging || isRefreshing) return;
    if (window.scrollY > 0) {
      isDragging = false;
      pullDistance = 0;
      return;
    }
    const touchY = e.touches[0].clientY;
    const diff = touchY - startY;
    if (diff > 0) {
      // 阻尼弹性拉动公式
      pullDistance = Math.min(90, Math.pow(diff, 0.84));
    } else {
      pullDistance = 0;
    }
  }

  async function handleTouchEnd() {
    if (!isDragging || isRefreshing) return;
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
      }, 500);
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

{#if pullDistance > 0 || isRefreshing}
  <div
    class="pull-refresh-container"
    style="transform: translateY({pullDistance}px); opacity: {Math.min(1, pullDistance / 25)};"
  >
    <div class="pull-refresh-pill" class:triggered={pullDistance >= THRESHOLD || isRefreshing}>
      <span class="pull-refresh-icon" class:spin={isRefreshing} style="transform: rotate({pullDistance * 4}deg);">
        🔄
      </span>
      <span class="pull-refresh-text">
        {isRefreshing ? '正在刷新...' : pullDistance >= THRESHOLD ? '释放立即刷新' : '下拉刷新'}
      </span>
    </div>
  </div>
{/if}

<style>
  .pull-refresh-container {
    position: fixed;
    top: -50px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 99999;
    pointer-events: none;
    transition: transform 0.15s ease-out, opacity 0.15s ease-out;
  }
  .pull-refresh-pill {
    background: var(--card-bg-solid, rgba(15, 23, 42, 0.9));
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: var(--text-main, #ffffff);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  }
  :global([data-theme="light"]) .pull-refresh-pill {
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }
  .pull-refresh-icon {
    display: inline-block;
    font-size: 13px;
    transition: transform 0.05s linear;
  }
  .pull-refresh-icon.spin {
    animation: refreshSpin 0.7s linear infinite;
  }
  @keyframes refreshSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
</style>
