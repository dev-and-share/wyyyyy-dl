<script lang="ts">
  import type { Snippet } from 'svelte';
  import DesktopHeaderActions from './DesktopHeaderActions.svelte';

  let {
    icon = '',
    title = '',
    subtitle = '',
    badge = '',
    badgeType = 'default',
    actions,
    children
  } = $props<{
    icon?: string;
    title?: string;
    subtitle?: string;
    badge?: string;
    badgeType?: 'default' | 'success' | 'purple' | 'amber';
    actions?: Snippet;
    children?: Snippet;
  }>();
</script>

<!-- 🖥️ PC 桌面端统一版块 Header (Desktop View Standard Header) -->
<header
  data-testid="desktop-view-header"
  class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3 lg:pb-4 shrink-0 select-none"
>
  <!-- 左侧：图标 + 板块大标题 + 状态/统计 Badge + 辅助说明 -->
  <div class="flex items-center gap-3 min-w-0">
    {#if icon}
      <span class="text-2xl leading-none select-none shrink-0" aria-hidden="true">{icon}</span>
    {/if}
    <div class="flex items-baseline gap-2.5 min-w-0 flex-wrap">
      <h1 class="text-xl lg:text-2xl font-bold text-[var(--text-main)] tracking-tight shrink-0 whitespace-nowrap">
        {title}
      </h1>
      {#if badge}
        <span
          class="text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 select-none {
            badgeType === 'purple'
              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
              : badgeType === 'success'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : badgeType === 'amber'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : 'bg-black/5 dark:bg-white/10 text-[var(--text-secondary)] border border-[var(--border-subtle)]'
          }"
        >
          {badge}
        </span>
      {/if}
      {#if subtitle}
        <span class="text-xs text-[var(--text-muted)] truncate hidden md:inline">
          {subtitle}
        </span>
      {/if}
    </div>
  </div>

  <!-- 右侧：统一规格的 Sub-Tabs 胶囊 / 音源切换 / 操作按钮区 + 桌面端全局快捷控制 -->
  <div class="flex items-center gap-2 sm:gap-2.5 shrink-0 self-start sm:self-auto overflow-x-auto max-w-full">
    {#if actions}
      {@render actions()}
    {:else if children}
      {@render children()}
    {/if}

    <div class="hidden lg:block w-px h-3.5 bg-[var(--border-subtle)] mx-0.5 shrink-0"></div>
    <DesktopHeaderActions />
  </div>
</header>
