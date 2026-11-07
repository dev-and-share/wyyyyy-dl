<script lang="ts">
  let {
    showIcon = true,
    title = 'WYY · Whatever You Yearn',
    class: className = '',
    onclick
  } = $props<{
    showIcon?: boolean;
    title?: string;
    class?: string;
    onclick?: () => void;
  }>();
</script>

{#snippet logoContent()}
  {#if showIcon}
    <span
      class="text-lg leading-none shrink-0 transition-transform duration-300 ease-out group-hover/wyy-logo:scale-110 group-hover/wyy-logo:rotate-[-6deg]"
      aria-hidden="true"
    >
      🎵
    </span>
  {/if}

  <!-- 走马灯视口容器：默认静止展示 WYY，mouse on (hover) 时平滑展开为微型走马灯滚动 -->
  <div
    data-testid="wyy-logo-marquee-viewport"
    class="wyy-marquee-viewport relative overflow-hidden flex items-center h-5 w-[38px] group-hover/wyy-logo:w-[158px] transition-[width] duration-300 ease-out"
    style="mask-image: linear-gradient(to right, black calc(100% - 14px), transparent 100%); -webkit-mask-image: linear-gradient(to right, black calc(100% - 14px), transparent 100%);"
  >
    <!-- 默认静态态：极简 WYY -->
    <span
      data-testid="wyy-logo-static-text"
      class="font-bold text-sm text-[var(--text-main)] tracking-tight whitespace-nowrap transition-opacity duration-200 group-hover/wyy-logo:opacity-0 group-hover/wyy-logo:pointer-events-none absolute left-0"
    >
      WYY
    </span>

    <!-- Hover 态：走马灯双轨跑道 (无缝衔接循环) -->
    <div
      data-testid="wyy-logo-marquee-track"
      class="wyy-marquee-track absolute left-0 flex items-center whitespace-nowrap opacity-0 group-hover/wyy-logo:opacity-100 transition-opacity duration-200 pointer-events-none"
    >
      <span class="font-bold text-xs tracking-wide text-[var(--text-main)] inline-flex items-center gap-1 pr-3">
        <span class="text-red-500 font-extrabold">WYY</span>
        <span class="font-serif italic text-[var(--text-secondary)]">· Whatever You Yearn</span>
        <span class="text-amber-400 text-[10px]">✦</span>
      </span>
      <span class="font-bold text-xs tracking-wide text-[var(--text-main)] inline-flex items-center gap-1 pr-3" aria-hidden="true">
        <span class="text-red-500 font-extrabold">WYY</span>
        <span class="font-serif italic text-[var(--text-secondary)]">· Whatever You Yearn</span>
        <span class="text-amber-400 text-[10px]">✦</span>
      </span>
    </div>
  </div>
{/snippet}

{#if onclick}
  <button
    type="button"
    data-testid="wyy-logo"
    class="wyy-logo-root group/wyy-logo inline-flex items-center gap-1.5 select-none cursor-pointer border-none bg-transparent p-0 text-left {className}"
    {onclick}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onclick?.();
      }
    }}
    {title}
  >
    {@render logoContent()}
  </button>
{:else}
  <div
    data-testid="wyy-logo"
    class="wyy-logo-root group/wyy-logo inline-flex items-center gap-1.5 select-none cursor-default {className}"
    {title}
  >
    {@render logoContent()}
  </div>
{/if}

<style>
  @keyframes wyy-logo-marquee-scroll {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }

  .wyy-logo-root:hover .wyy-marquee-track {
    animation: wyy-logo-marquee-scroll 5.5s linear infinite;
  }
</style>
