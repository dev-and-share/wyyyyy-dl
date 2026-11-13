<script lang="ts">
  import { layoutState } from '../lib/layout.svelte';
  import { buildCinemaCornerGradient } from '../lib/cinemaCorner';
  import { isModalBackdropActive } from '../lib/skinStore.svelte';

  let {
    alwaysVisible = false,
    color,
    radiusX,
    radiusY,
    opacity,
    zIndex = 100060,
    height = '320px',
    class: customClass = ''
  } = $props<{
    alwaysVisible?: boolean;
    color?: string;
    radiusX?: number;
    radiusY?: number;
    opacity?: number;
    zIndex?: number;
    height?: string;
    class?: string;
  }>();

  const isVisible = $derived(alwaysVisible || layoutState.wco.visible);

  // 🌟 核心：默认仅在全屏浮层遮罩激活时展开电影级柔焦暗化漫反射；
  // 在日常无弹窗状态下保持 0 不透明度，杜绝在顶层覆盖遮蔽 Logo 与右上角控制按钮！
  const computedOpacity = $derived.by(() => {
    if (opacity !== undefined) return opacity;
    if (alwaysVisible) return 1;
    return isModalBackdropActive() ? 1 : 0;
  });

  const customGradient = $derived.by(() => {
    if (color || radiusX !== undefined || radiusY !== undefined) {
      return buildCinemaCornerGradient({ color, radiusX, radiusY });
    }
    return '';
  });
</script>

{#if isVisible}
  <!-- 🎬 2D Cinema Corner 双顶角电影级柔焦晕染层
       消灭系统非客户区（交通灯与插件栏）与 Web 页面/弹窗之间的断层与硬切边 -->
  <div
    data-testid="cinema-corner-stage"
    class="cinema-corner-stage pointer-events-none select-none fixed top-0 inset-x-0 transition-opacity duration-300 {customClass}"
    style="
      height: {height};
      z-index: {zIndex};
      opacity: {computedOpacity};
      background: {customGradient ? customGradient : 'var(--cinema-corner-bg)'};
    "
    aria-hidden="true"
  ></div>
{/if}
