<script lang="ts">
  export interface SegmentItem {
    id: string;
    label: string;
    icon?: string;
    badge?: string | number;
    accent?: 'red' | 'blue' | 'purple' | 'amber' | 'emerald' | 'cyan' | 'default';
  }

  let {
    items = [],
    activeId,
    onChange
  } = $props<{
    items: SegmentItem[];
    activeId: string;
    onChange: (id: string) => void;
  }>();

  const ACCENT_ACTIVE_CLASSES: Record<string, string> = {
    red: 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-[0_2px_10px_rgba(239,68,68,0.35)]',
    blue: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_2px_10px_rgba(14,165,233,0.35)]',
    purple: 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-[0_2px_10px_rgba(168,85,247,0.35)]',
    amber: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-[0_2px_10px_rgba(245,158,11,0.35)]',
    emerald: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_2px_10px_rgba(16,185,129,0.35)]',
    cyan: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_2px_10px_rgba(6,182,212,0.35)]',
    default: 'bg-[var(--card-header-bg)] text-[var(--text-main)] shadow-sm'
  };
</script>

<div class="px-2 md:px-0 mb-2.5 w-full">
  <div
    class="flex items-center p-1 bg-[var(--card-header-bg)]/90 backdrop-blur-xl border border-[var(--border-color)] rounded-xl gap-1 shadow-xs"
    role="tablist"
  >
    {#each items as item (item.id)}
      {@const isActive = item.id === activeId}
      {@const activeStyle = ACCENT_ACTIVE_CLASSES[item.accent || 'default'] || ACCENT_ACTIVE_CLASSES.default}
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        class="flex-1 py-1.5 px-1.5 md:px-3 rounded-lg text-xs md:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer border-none select-none {isActive ? activeStyle : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-white/5 opacity-80 hover:opacity-100'}"
        onclick={() => onChange(item.id)}
      >
        {#if item.icon}
          <span class="text-sm md:text-base leading-none shrink-0">{item.icon}</span>
        {/if}
        <span class="truncate">{item.label}</span>
        {#if item.badge}
          <span class="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono {isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-[var(--text-muted)]'}">
            {item.badge}
          </span>
        {/if}
      </button>
    {/each}
  </div>
</div>
