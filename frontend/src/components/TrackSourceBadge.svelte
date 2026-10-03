<script lang="ts">
  import { getTrackSourceStatus } from '../lib/trackStatus.svelte';
  import { showToast } from '../lib/toast.svelte';
  import type { Track } from '../lib/types';

  let {
    id,
    name = '',
    artist = '',
    path = '',
    item = null,
    isLocal = false,
    curTrack = null,
    onReveal,
    class: customClass = ''
  } = $props<{
    id: number | string | undefined | null;
    name?: string;
    artist?: string;
    path?: string;
    item?: any;
    isLocal?: boolean;
    curTrack?: Track | null;
    onReveal?: (item: any) => void;
    class?: string;
  }>();

  let status = $derived(getTrackSourceStatus(id, isLocal, curTrack));

  // 长按手势状态
  let pressTimer: any = null;
  let startX = 0;
  let startY = 0;
  let isLongPress = false;

  function doReveal(e?: Event) {
    if (!status.isServer) return;
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const targetItem = item || {
      id,
      name,
      artist,
      path
    };
    showToast('🚀 正在定位本地物理文件...', 'info', 1200);
    if (onReveal) {
      onReveal(targetItem);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wyyyy:reveal', { detail: targetItem }));
    }
  }

  function handleTouchStart(e: TouchEvent) {
    if (!status.isServer) return;
    if (e.touches.length !== 1) return;
    isLongPress = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      isLongPress = true;
      try {
        navigator.vibrate?.(40);
      } catch {}
      doReveal(e);
    }, 500);
  }

  function handleTouchMove(e: TouchEvent) {
    if (!pressTimer || isLongPress) return;
    const touch = e.touches[0];
    if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (isLongPress) {
      e.preventDefault();
      e.stopPropagation();
      isLongPress = false;
    }
  }

  function handleDblClick(e: MouseEvent) {
    if (!status.isServer) return;
    doReveal(e);
  }

  function handleContextMenu(e: MouseEvent) {
    if (status.isServer) {
      // 避免长按时弹出移动端浏览器默认的菜单
      e.preventDefault();
      e.stopPropagation();
    }
  }
</script>

{#if status.isServer && status.isPhone}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <span
    role="button"
    tabindex="0"
    class="audio-source-badge icon-only badge-both cursor-pointer select-none active:scale-90 transition-transform {customClass}"
    title="✨ 本机手机与服务器均已下载/缓存 (电脑双击 / 手机长按可定位本地文件)"
    ondblclick={handleDblClick}
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
    ontouchcancel={handleTouchEnd}
    oncontextmenu={handleContextMenu}
  >
    ✨
  </span>
{:else if status.isServer}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <span
    role="button"
    tabindex="0"
    class="audio-source-badge icon-only badge-server cursor-pointer select-none active:scale-90 transition-transform {customClass}"
    title="🖥️ 已下载到本地服务器磁盘 (电脑双击 / 手机长按可定位本地文件)"
    ondblclick={handleDblClick}
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
    ontouchcancel={handleTouchEnd}
    oncontextmenu={handleContextMenu}
  >
    🖥️
  </span>
{:else if status.isPhone}
  <span
    class="audio-source-badge icon-only badge-browser {customClass}"
    title="📲 已离线缓存到当前手机/浏览器"
  >
    📲
  </span>
{/if}

