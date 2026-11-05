<script lang="ts">
  import { onMount } from 'svelte';
  import { scrollToPageTop } from '../../lib/router.svelte';
  import { playerStore } from '../../lib/playerStore.svelte';

  let visible = $state(false);
  let idleTimer: any = null;
  let isIdle = $state(false);

  let hasPlayer = $derived(!!playerStore.activeTrack);

  function resetIdle() {
    isIdle = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      isIdle = true;
    }, 3200);
  }

  function handleScroll(e?: Event) {
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const target = e?.target as HTMLElement | null;
    const targetY = target && target.scrollTop ? target.scrollTop : 0;
    const container = document.querySelector('.app-main-container');
    const containerY = container ? container.scrollTop : 0;
    const maxScroll = Math.max(scrollY, targetY, containerY);

    if (maxScroll > 240) {
      visible = true;
      resetIdle();
    } else {
      visible = false;
    }
  }

  onMount(() => {
    // 使用捕获阶段监听，确保无论哪个子容器滚动都能感知
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  });
</script>

{#if visible}
  <!-- 📱 滚动回顶 FAB (悬浮于播放器与底栏上方，克制优雅，横线正好穿过 icon 中心) -->
  <button
    type="button"
    data-testid="btn-scroll-top-fab"
    class="fixed right-3.5 z-[9998] w-8.5 h-8.5 rounded-full flex items-center justify-center bg-black/65 dark:bg-neutral-800/90 backdrop-blur-xl border border-white/20 text-white/90 shadow-xl hover:text-white hover:scale-105 active:scale-90 transition-all duration-300 cursor-pointer {isIdle ? 'opacity-35 hover:opacity-100' : 'opacity-100'}"
    style="bottom: calc(var(--mobile-nav-height, 40px) + {hasPlayer ? '112px' : '20px'});"
    onclick={() => {
      scrollToPageTop();
      visible = false;
    }}
    aria-label="回到顶部"
    title="回到顶部"
  >
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
  </button>
{/if}
