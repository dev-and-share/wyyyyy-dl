<script lang="ts">
  import { onMount, tick } from 'svelte';

  interface Props {
    activeIndex: number;
    count: number;
    disabled?: boolean;
    onChange: (index: number) => void;
    children?: import('svelte').Snippet;
  }

  let {
    activeIndex = 0,
    count = 3,
    disabled = false,
    onChange,
    children
  }: Props = $props();

  let viewportEl = $state<HTMLDivElement | null>(null);
  let trackEl = $state<HTMLDivElement | null>(null);
  let isProgrammatic = false;
  let scrollTimeout: any = null;
  let lastSettledIndex = -1;
  let viewportHeight = $state<number | null>(null);

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

  function handleScroll() {
    if (isProgrammatic || !viewportEl) return;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (!viewportEl) return;
      const width = viewportEl.clientWidth;
      if (width <= 0) return;
      const index = Math.round(viewportEl.scrollLeft / width);
      if (index >= 0 && index < count && index !== activeIndex && index !== lastSettledIndex) {
        lastSettledIndex = index;
        onChange(index);
      }
    }, 50);
  }

  $effect(() => {
    const target = activeIndex;
    if (!viewportEl) return;
    const width = viewportEl.clientWidth;
    if (width <= 0) return;
    const targetLeft = target * width;
    if (Math.abs(viewportEl.scrollLeft - targetLeft) > 5) {
      isProgrammatic = true;
      viewportEl.scrollTo({ left: targetLeft, behavior: 'smooth' });
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isProgrammatic = false;
        lastSettledIndex = target;
      }, 350);
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
      if (viewportEl && activeIndex > 0) {
        viewportEl.scrollLeft = activeIndex * viewportEl.clientWidth;
        lastSettledIndex = activeIndex;
      }
      updateHeight();
    });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && trackEl) {
      resizeObserver = new ResizeObserver(() => {
        updateHeight();
      });
      Array.from(trackEl.children).forEach((child) => {
        resizeObserver?.observe(child);
      });
    }

    const onResize = () => {
      if (viewportEl && viewportEl.clientWidth > 0) {
        viewportEl.scrollTo({ left: activeIndex * viewportEl.clientWidth, behavior: 'auto' });
      }
      updateHeight();
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      clearTimeout(scrollTimeout);
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
  style={viewportHeight ? `height: ${viewportHeight}px;` : ''}
  onscroll={handleScroll}
>
  <div bind:this={trackEl} class="swipeable-tabs-track">
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
  }
  .swipeable-tabs-viewport::-webkit-scrollbar {
    display: none;
  }

  .swipeable-tabs-track {
    display: flex;
    width: 100%;
    align-items: flex-start;
  }

  :global(.swipeable-tabs-track > *) {
    flex: 0 0 100% !important;
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }
</style>
