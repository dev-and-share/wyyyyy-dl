<script lang="ts">
  import { getTrackSourceStatus } from '../lib/trackStatus.svelte';
  import { showToast } from '../lib/toast.svelte';
  import { t } from '../lib/i18n';
  import type { Track } from '../lib/types';

  let {
    id,
    name = '',
    artist = '',
    path = '',
    item = null,
    isServer = undefined,
    isPhone = undefined,
    isLocal = false,
    curTrack = null,
    onReveal,
    variant = 'badge',
    class: customClass = ''
  } = $props<{
    id: number | string | undefined | null;
    name?: string;
    artist?: string;
    path?: string;
    item?: any;
    isServer?: boolean;
    isPhone?: boolean;
    isLocal?: boolean;
    curTrack?: Track | null;
    onReveal?: (item: any) => void;
    variant?: 'badge' | 'tile';
    class?: string;
  }>();

  let computedStatus = $derived(
    getTrackSourceStatus(
      id,
      Boolean(isLocal && (path || item?.filePath)),
      curTrack,
      typeof id === 'string' && (id.startsWith('mf_') || id.startsWith('ext_')),
      name,
      artist
    )
  );

  let status = $derived({
    isServer: isServer !== undefined ? isServer : computedStatus.isServer,
    isPhone: isPhone !== undefined ? isPhone : computedStatus.isPhone,
    isLocal: (isServer !== undefined ? isServer : computedStatus.isServer) || (isPhone !== undefined ? isPhone : computedStatus.isPhone)
  });

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
    const cleanPath = (path && !path.startsWith('/v3/stream') && !path.startsWith('http')) ? path : '';
    const targetItem = item
      ? { ...item, path: (item.path && !item.path.startsWith('/v3/stream') && !item.path.startsWith('http')) ? item.path : cleanPath }
      : {
          id,
          name,
          artist,
          path: cleanPath
        };
    showToast(t('toast.locatingFile'), 'info', 1200);
    if (onReveal) {
      onReveal(targetItem);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wyyyy:reveal', { detail: targetItem }));
    }
  }

  function handleClick(e: MouseEvent) {
    if (variant === 'tile' && status.isServer) {
      doReveal(e);
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

{#if variant === 'tile'}
  <!-- 🎛️ 按钮/卡片形态：用于播放器快捷操作栏（42x42 标准舒适热区，与周围按钮视觉严格对齐） -->
  {#if status.isServer && status.isPhone}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      role="button"
      tabindex="0"
      class="w-[42px] h-[42px] rounded-2xl flex items-center justify-center bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 text-amber-400 shadow-sm cursor-pointer select-none active:scale-92 transition-all {customClass}"
      title={t('track.badgeBoth')}
      onclick={handleClick}
      ondblclick={handleDblClick}
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
      ontouchcancel={handleTouchEnd}
      oncontextmenu={handleContextMenu}
    >
      <span class="text-lg leading-none filter drop-shadow-sm">✨</span>
    </div>
  {:else if status.isServer}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      role="button"
      tabindex="0"
      class="w-[42px] h-[42px] rounded-2xl flex items-center justify-center bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shadow-sm cursor-pointer select-none active:scale-92 transition-all {customClass}"
      title={t('track.badgeServer')}
      onclick={handleClick}
      ondblclick={handleDblClick}
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
      ontouchcancel={handleTouchEnd}
      oncontextmenu={handleContextMenu}
    >
      <span class="text-lg leading-none filter drop-shadow-sm">🖥️</span>
    </div>
  {:else if status.isPhone}
    <div
      class="w-[42px] h-[42px] rounded-2xl flex items-center justify-center bg-purple-500/15 dark:bg-purple-500/20 border border-purple-500/30 text-purple-400 shadow-sm select-none {customClass}"
      title={t('track.badgePhone')}
    >
      <span class="text-lg leading-none filter drop-shadow-sm">📲</span>
    </div>
  {/if}
{:else}
  <!-- 🏷️ 默认行内徽章形态：用于单曲列表、详情表格等文本行内 -->
  {#if status.isServer && status.isPhone}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      role="button"
      tabindex="0"
      class="audio-source-badge icon-only badge-both cursor-pointer select-none active:scale-90 transition-transform {customClass}"
      title={t('track.badgeBoth')}
      onclick={doReveal}
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
      title={t('track.badgeServer')}
      onclick={doReveal}
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
      title={t('track.badgePhone')}
    >
      📲
    </span>
  {/if}
{/if}

