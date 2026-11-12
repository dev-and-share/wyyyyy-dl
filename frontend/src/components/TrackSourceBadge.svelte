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

  let isMatchingCurTrack = $derived(
    Boolean(
      curTrack &&
      (id == null ||
        Number(curTrack.id) === Number(id) ||
        String(curTrack.id) === String(id) ||
        (name && curTrack.name === name))
    )
  );

  let effectiveName = $derived(
    name ||
    item?.name ||
    item?.songName ||
    (isMatchingCurTrack ? (curTrack?.name || '') : '') ||
    ''
  );

  let effectiveArtist = $derived(
    artist ||
    item?.artist ||
    item?.ar_name ||
    (isMatchingCurTrack ? (curTrack?.artist || '') : '') ||
    ''
  );

  let effectivePath = $derived(
    path ||
    item?.filePath ||
    item?.path ||
    (isMatchingCurTrack ? (curTrack?.filePath || '') : '') ||
    ''
  );

  let computedStatus = $derived(
    getTrackSourceStatus(
      id ?? curTrack?.id,
      Boolean((isLocal || (isMatchingCurTrack && curTrack?.isLocal)) && (effectivePath || item?.filePath)),
      curTrack,
      typeof (id ?? curTrack?.id) === 'string' && (String(id ?? curTrack?.id).startsWith('mf_') || String(id ?? curTrack?.id).startsWith('ext_')),
      effectiveName,
      effectiveArtist
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
    if (!status.isServer && !status.isPhone) return;
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const rawPath = effectivePath || '';
    const cleanPath = (rawPath && !rawPath.startsWith('/v3/stream') && !rawPath.startsWith('http')) ? rawPath : '';
    const targetItem = item
      ? {
          ...item,
          id: item.id ?? item.songId ?? id ?? curTrack?.id,
          name: item.name || item.songName || effectiveName,
          artist: item.artist || item.ar_name || effectiveArtist,
          path: (item.path && !item.path.startsWith('/v3/stream') && !item.path.startsWith('http')) ? item.path : cleanPath,
          isServer: Boolean(status.isServer),
          isPhone: Boolean(status.isPhone)
        }
      : {
          id: id ?? curTrack?.id,
          name: effectiveName,
          artist: effectiveArtist,
          path: cleanPath,
          isServer: Boolean(status.isServer),
          isPhone: Boolean(status.isPhone)
        };
    showToast(t('toast.locatingFile'), 'info', 1200);
    if (onReveal) {
      onReveal(targetItem);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wyy:reveal', { detail: targetItem }));
    }
  }

  function handleClick(e: MouseEvent) {
    if (variant === 'tile' && (status.isServer || status.isPhone)) {
      doReveal(e);
    }
  }

  function handleTouchStart(e: TouchEvent) {
    if (!status.isServer && !status.isPhone) return;
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
    if (!status.isServer && !status.isPhone) return;
    doReveal(e);
  }

  function handleContextMenu(e: MouseEvent) {
    if (status.isServer || status.isPhone) {
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
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      role="button"
      tabindex="0"
      class="w-[42px] h-[42px] rounded-2xl flex items-center justify-center bg-purple-500/15 dark:bg-purple-500/20 border border-purple-500/30 text-purple-400 shadow-sm cursor-pointer select-none active:scale-92 transition-all {customClass}"
      title={t('track.badgePhone')}
      onclick={handleClick}
      ondblclick={handleDblClick}
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
      ontouchcancel={handleTouchEnd}
      oncontextmenu={handleContextMenu}
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
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      role="button"
      tabindex="0"
      class="audio-source-badge icon-only badge-browser cursor-pointer select-none active:scale-90 transition-transform {customClass}"
      title={t('track.badgePhone')}
      onclick={doReveal}
      ondblclick={handleDblClick}
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
      ontouchcancel={handleTouchEnd}
      oncontextmenu={handleContextMenu}
    >
      📲
    </span>
  {/if}
{/if}

