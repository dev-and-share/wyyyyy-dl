<script lang="ts">
  import type { Snippet } from 'svelte';

  export type AccordionAccent = 'red' | 'blue' | 'purple' | 'amber' | 'emerald' | 'cyan' | 'default';

  let {
    title,
    open = $bindable(false),
    accent = 'default',
    flat = false,
    badge,
    icon,
    onToggle,
    children
  } = $props<{
    title: string;
    open?: boolean;
    accent?: AccordionAccent;
    flat?: boolean;
    badge?: string | number;
    icon?: string;
    onToggle?: (open: boolean) => void;
    children?: Snippet;
  }>();

  const parsed = $derived.by(() => {
    if (badge !== undefined || icon !== undefined) {
      return {
        icon: icon ?? '',
        badge: badge !== undefined ? String(badge) : '',
        cleanTitle: title
      };
    }
    const match = title.match(/^([^\s\d\w]+)\s*(\d+)\.\s*(.+)$/);
    if (match) {
      return {
        icon: match[1],
        badge: match[2],
        cleanTitle: match[3]
      };
    }
    return {
      icon: '',
      badge: '',
      cleanTitle: title
    };
  });

  const effectiveAccent = $derived.by<AccordionAccent>(() => {
    if (accent !== 'default') return accent;
    const b = parsed.badge;
    if (b === '1') return 'red';
    if (b === '2') return 'blue';
    if (b === '3') {
      if (parsed.cleanTitle.includes('推荐')) return 'amber';
      if (parsed.cleanTitle.includes('歌手')) return 'purple';
      if (parsed.cleanTitle.includes('缓存')) return 'emerald';
      return 'purple';
    }
    return 'default';
  });

  const ACCENT_STYLES: Record<Exclude<AccordionAccent, 'default'>, {
    bar: string;
    headerTint: string;
    badgeClosed: string;
    badgeOpen: string;
    textAccent: string;
  }> = {
    red: {
      bar: 'bg-gradient-to-b from-red-500 via-rose-500 to-red-600 shadow-[0_0_10px_rgba(239,68,68,0.45)]',
      headerTint: 'bg-gradient-to-r from-red-500/[0.08] via-red-500/[0.02] to-transparent',
      badgeClosed: 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20',
      badgeOpen: 'bg-gradient-to-br from-red-500 to-rose-600 text-white border-red-400/60 shadow-[0_2px_8px_rgba(239,68,68,0.35)]',
      textAccent: 'text-red-500 dark:text-red-400'
    },
    blue: {
      bar: 'bg-gradient-to-b from-sky-400 via-blue-500 to-indigo-600 shadow-[0_0_10px_rgba(14,165,233,0.45)]',
      headerTint: 'bg-gradient-to-r from-sky-500/[0.08] via-sky-500/[0.02] to-transparent',
      badgeClosed: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      badgeOpen: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white border-sky-400/60 shadow-[0_2px_8px_rgba(14,165,233,0.35)]',
      textAccent: 'text-sky-500 dark:text-sky-400'
    },
    purple: {
      bar: 'bg-gradient-to-b from-purple-400 via-violet-500 to-indigo-500 shadow-[0_0_10px_rgba(168,85,247,0.45)]',
      headerTint: 'bg-gradient-to-r from-purple-500/[0.08] via-purple-500/[0.02] to-transparent',
      badgeClosed: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      badgeOpen: 'bg-gradient-to-br from-purple-500 to-violet-600 text-white border-purple-400/60 shadow-[0_2px_8px_rgba(168,85,247,0.35)]',
      textAccent: 'text-purple-500 dark:text-purple-400'
    },
    amber: {
      bar: 'bg-gradient-to-b from-amber-400 via-amber-500 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.45)]',
      headerTint: 'bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.02] to-transparent',
      badgeClosed: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      badgeOpen: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white border-amber-400/60 shadow-[0_2px_8px_rgba(245,158,11,0.35)]',
      textAccent: 'text-amber-500 dark:text-amber-400'
    },
    emerald: {
      bar: 'bg-gradient-to-b from-emerald-400 via-teal-500 to-cyan-600 shadow-[0_0_10px_rgba(16,185,129,0.45)]',
      headerTint: 'bg-gradient-to-r from-emerald-500/[0.08] via-emerald-500/[0.02] to-transparent',
      badgeClosed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badgeOpen: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-400/60 shadow-[0_2px_8px_rgba(16,185,129,0.35)]',
      textAccent: 'text-emerald-500 dark:text-emerald-400'
    },
    cyan: {
      bar: 'bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-500 shadow-[0_0_10px_rgba(6,182,212,0.45)]',
      headerTint: 'bg-gradient-to-r from-cyan-500/[0.08] via-cyan-500/[0.02] to-transparent',
      badgeClosed: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
      badgeOpen: 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-cyan-400/60 shadow-[0_2px_8px_rgba(6,182,212,0.35)]',
      textAccent: 'text-cyan-500 dark:text-cyan-400'
    }
  };

  const DEFAULT_STYLE = {
    bar: 'bg-[var(--text-muted)]',
    headerTint: 'bg-transparent',
    badgeClosed: 'bg-white/10 text-[var(--text-secondary)] border-white/10',
    badgeOpen: 'bg-[var(--text-main)] text-[var(--card-bg-solid)] border-transparent',
    textAccent: 'text-[var(--text-main)]'
  };

  let styles = $derived(effectiveAccent !== 'default' ? ACCENT_STYLES[effectiveAccent] : DEFAULT_STYLE);

  function toggle() {
    open = !open;
    onToggle?.(open);
  }
</script>

{#if flat}
  <div class="bg-[var(--card-bg)] backdrop-blur-md rounded-none md:rounded-[16px] shadow-sm md:shadow-md overflow-hidden border-x-0 md:border border-y md:border-[var(--border-color)] border-[var(--border-color)] p-2.5 md:p-5">
    {#if children}
      {@render children()}
    {/if}
  </div>
{:else}
  <div class="bg-[var(--card-bg)] backdrop-blur-md rounded-none md:rounded-[16px] shadow-sm md:shadow-md overflow-hidden border-x-0 md:border border-y md:border-[var(--border-color)] border-[var(--border-color)] transition-all duration-300 relative">
    <div
      class="absolute left-0 top-0 bottom-0 w-[3.5px] transition-all duration-300 pointer-events-none z-10 {open ? styles.bar : 'opacity-0 scale-y-50'}"
    ></div>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      role="button"
      tabindex="0"
      aria-expanded={open}
      class="px-3 py-2.5 md:px-5 md:py-3.5 bg-[var(--card-header-bg)] hover:bg-[var(--card-header-hover)] cursor-pointer flex justify-between items-center select-none transition-colors duration-200 relative {open ? styles.headerTint : ''}"
      onclick={toggle}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
    >
      <h3 class="m-0 text-sm md:text-[15px] font-semibold text-[var(--text-main)] flex items-center gap-2 min-w-0">
        {#if parsed.badge}
          <span
            class="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-[6px] text-[11px] font-bold font-mono tracking-wider border shrink-0 transition-all duration-200 {open ? styles.badgeOpen : styles.badgeClosed}"
          >
            {parsed.badge}
          </span>
        {/if}
        <span class="flex items-center gap-1.5 truncate">
          {#if parsed.icon}
            <span class="text-sm md:text-base leading-none shrink-0 opacity-90">{parsed.icon}</span>
          {/if}
          <span class="truncate transition-colors duration-200 {open ? styles.textAccent : ''}">{parsed.cleanTitle}</span>
        </span>
      </h3>
      <div class="flex items-center gap-1.5 shrink-0 ml-2">
        <span class="text-xs text-[var(--text-muted)] transition-transform duration-300 {open ? 'rotate-180 ' + styles.textAccent : ''}">
          ▼
        </span>
      </div>
    </div>

    <!-- 采用现代 CSS Grid 0fr ➔ 1fr 动画 -->
    <div class="grid transition-[grid-template-rows,opacity] duration-250 ease-out {open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}">
      <div class="overflow-hidden">
        <div class="p-2.5 md:p-5 pt-2 md:pt-3.5">
          {#if children}
            {@render children()}
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
