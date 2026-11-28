<script lang="ts">
  import { onMount, tick } from 'svelte';

  interface Props {
    activeIndex: number;
    count: number;
    disabled?: boolean;
    minHeight?: string | number;
    onChange: (index: number) => void;
    onProgress?: (progress: number | null) => void;
    children?: import('svelte').Snippet;
  }

  let {
    activeIndex = 0,
    count = 3,
    disabled = false,
    minHeight = 'calc(100dvh - 250px)',
    onChange,
    onProgress,
    children
  }: Props = $props();

  const formattedMinHeight = $derived(
    typeof minHeight === 'number' ? `${minHeight}px` : (minHeight || 'calc(100dvh - 250px)')
  );

  let viewportEl = $state<HTMLDivElement | null>(null);
  let trackEl = $state<HTMLDivElement | null>(null);
  let isProgrammatic = false;
  let isPointerDown = false;
  let programmaticTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollSettleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSettledIndex = -1;
  let lastKnownWidth = 0;
  let lastEmittedProgress: number | null = null;
  let viewportHeight = $state<number | null>(null);

  function emitProgress(next: number | null) {
    if (next === null && lastEmittedProgress === null) return;
    if (next !== null && lastEmittedProgress !== null && Math.abs(next - lastEmittedProgress) < 0.0005) {
      return;
    }
    lastEmittedProgress = next;
    onProgress?.(next);
  }

  function clearProgrammaticTimer() {
    if (programmaticTimer !== null) {
      clearTimeout(programmaticTimer);
      programmaticTimer = null;
    }
  }

  function clearSettleTimer() {
    if (scrollSettleTimer !== null) {
      clearTimeout(scrollSettleTimer);
      scrollSettleTimer = null;
    }
  }

  function updateHeight() {
    if (!trackEl) return;
    const activeSlide = trackEl.children[activeIndex] as HTMLElement | undefined;
    if (activeSlide) {
      const h = Math.max(activeSlide.scrollHeight || 0, activeSlide.offsetHeight || 0);
      if (h > 0) {
        viewportHeight = h;
      }
    }
  }

  function snapToIndex(targetIndex: number, behavior: ScrollBehavior = 'smooth') {
    if (!viewportEl) return;
    const width = viewportEl.clientWidth;
    if (width <= 0) return;
    const targetLeft = targetIndex * width;
    if (Math.abs(viewportEl.scrollLeft - targetLeft) <= 2) return;

    if (behavior === 'auto') {
      viewportEl.scrollLeft = targetLeft;
      return;
    }

    isProgrammatic = true;
    viewportEl.scrollTo({ left: targetLeft, behavior: 'smooth' });
    clearProgrammaticTimer();
    programmaticTimer = setTimeout(() => {
      isProgrammatic = false;
      programmaticTimer = null;
      if (viewportEl && !isPointerDown && viewportEl.clientWidth > 0) {
        const expected = targetIndex * viewportEl.clientWidth;
        if (Math.abs(viewportEl.scrollLeft - expected) > 2) {
          viewportEl.scrollLeft = expected;
        }
      }
      emitProgress(null);
    }, 360);
  }

  function settleScroll() {
    clearSettleTimer();
    if (!viewportEl || isPointerDown) return;
    const width = viewportEl.clientWidth;
    if (width <= 0) {
      emitProgress(null);
      return;
    }

    if (isProgrammatic) {
      const targetLeft = activeIndex * width;
      if (Math.abs(viewportEl.scrollLeft - targetLeft) <= 2) {
        isProgrammatic = false;
        clearProgrammaticTimer();
        emitProgress(null);
      }
      return;
    }

    const index = Math.max(0, Math.min(count - 1, Math.round(viewportEl.scrollLeft / width)));
    emitProgress(null);

    if (index !== activeIndex && index !== lastSettledIndex) {
      lastSettledIndex = index;
      onChange(index);
    }

    // Snap guard: recover cleanly if browser scroll-snap aborted or stopped halfway
    if (Math.abs(viewportEl.scrollLeft - index * width) > 2) {
      snapToIndex(index, 'smooth');
    }
  }

  function scheduleSettle(delayMs = 90) {
    clearSettleTimer();
    scrollSettleTimer = setTimeout(() => {
      settleScroll();
    }, delayMs);
  }

  function handleTouchStart() {
    isPointerDown = true;
    if (isProgrammatic) {
      isProgrammatic = false;
      clearProgrammaticTimer();
    }
    clearSettleTimer();
  }

  function handleTouchEndOrCancel() {
    isPointerDown = false;
    scheduleSettle(90);
  }

  function handleScrollEnd() {
    if (!isPointerDown) {
      settleScroll();
    }
  }

  function handleScroll() {
    if (!viewportEl) return;
    if (disabled) {
      emitProgress(null);
      return;
    }
    if (isProgrammatic) return;

    const width = viewportEl.clientWidth;
    if (width <= 0) return;

    const rawProgress = Math.max(0, Math.min(Math.max(0, count - 1), viewportEl.scrollLeft / width));
    emitProgress(rawProgress);
    scheduleSettle(90);
  }

  $effect(() => {
    const target = activeIndex;
    if (!viewportEl) return;
    const width = viewportEl.clientWidth;
    if (width > 0) {
      lastKnownWidth = width;
      const targetLeft = target * width;
      if (Math.abs(viewportEl.scrollLeft - targetLeft) > 5) {
        isProgrammatic = true;
        emitProgress(null);
        clearSettleTimer();
        viewportEl.scrollTo({ left: targetLeft, behavior: 'smooth' });
        clearProgrammaticTimer();
        programmaticTimer = setTimeout(() => {
          isProgrammatic = false;
          programmaticTimer = null;
          lastSettledIndex = target;
          if (viewportEl && !isPointerDown && viewportEl.clientWidth > 0) {
            const expected = target * viewportEl.clientWidth;
            if (Math.abs(viewportEl.scrollLeft - expected) > 2) {
              viewportEl.scrollLeft = expected;
            }
          }
        }, 400);
      } else {
        lastSettledIndex = target;
      }
    }
    // Update container height to match active slide and prevent giant empty space
    tick().then(() => {
      updateHeight();
      if (typeof window !== 'undefined' && viewportEl) {
        const rect = viewportEl.getBoundingClientRect();
        if (rect.top < -30) {
          const scrollTarget = window.scrollY + rect.top - 60;
          window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
        }
      }
    });
  });

  onMount(() => {
    tick().then(() => {
      if (viewportEl) {
        lastKnownWidth = viewportEl.clientWidth;
        if (viewportEl.clientWidth > 0 && activeIndex > 0) {
          viewportEl.scrollLeft = activeIndex * viewportEl.clientWidth;
          lastSettledIndex = activeIndex;
        }
      }
      updateHeight();
    });

    const el = viewportEl;
    el?.addEventListener('scrollend', handleScrollEnd, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && trackEl) {
      resizeObserver = new ResizeObserver(() => {
        updateHeight();
        if (!viewportEl) return;
        const width = viewportEl.clientWidth;
        if (width <= 0) {
          lastKnownWidth = 0;
          isPointerDown = false;
          isProgrammatic = false;
          clearProgrammaticTimer();
          clearSettleTimer();
          emitProgress(null);
          return;
        }
        const widthChanged = width !== lastKnownWidth;
        lastKnownWidth = width;
        if (!isPointerDown && !isProgrammatic && (widthChanged || scrollSettleTimer === null)) {
          const expectedLeft = activeIndex * width;
          if (Math.abs(viewportEl.scrollLeft - expectedLeft) > 2) {
            viewportEl.scrollLeft = expectedLeft;
          }
          emitProgress(null);
        }
      });
      if (viewportEl) resizeObserver.observe(viewportEl);
      Array.from(trackEl.children).forEach((child) => {
        resizeObserver?.observe(child);
      });
    }

    const onResize = () => {
      if (viewportEl && viewportEl.clientWidth > 0) {
        lastKnownWidth = viewportEl.clientWidth;
        if (!isPointerDown) {
          viewportEl.scrollLeft = activeIndex * viewportEl.clientWidth;
          emitProgress(null);
        }
      }
      updateHeight();
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      clearProgrammaticTimer();
      clearSettleTimer();
      el?.removeEventListener('scrollend', handleScrollEnd);
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
    };
  });
</script>

<div
  bind:this={viewportEl}
  role="region"
  aria-label="Swipeable tab view"
  class="swipeable-tabs-viewport {disabled ? 'overflow-x-hidden' : 'overflow-x-auto'}"
  style="--swipeable-min-height: {formattedMinHeight}; min-height: {formattedMinHeight}; {viewportHeight ? `height: ${viewportHeight}px;` : ''}"
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEndOrCancel}
  ontouchcancel={handleTouchEndOrCancel}
  onscroll={handleScroll}
>
  <div bind:this={trackEl} class="swipeable-tabs-track" style="min-height: {formattedMinHeight};">
    {@render children?.()}
  </div>
</div>

<style>
  .swipeable-tabs-viewport {
    width: 100%;
    display: block;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
    transition: height 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    min-height: calc(100dvh - 250px);
  }
  .swipeable-tabs-viewport::-webkit-scrollbar {
    display: none;
  }

  .swipeable-tabs-track {
    display: flex;
    width: 100%;
    align-items: flex-start;
    min-height: 100%;
  }

  :global(.swipeable-tabs-track > *) {
    flex: 0 0 100% !important;
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    scroll-snap-align: start;
    scroll-snap-stop: always;
    min-height: var(--swipeable-min-height, calc(100dvh - 250px));
    display: flex;
    flex-direction: column;
  }
</style>
