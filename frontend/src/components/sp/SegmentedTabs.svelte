<script lang="ts">
  import type { Component } from 'svelte';
  import { Search, Disc, Mic, ListMusic, Music2, Calendar, Folder, FolderOpen, HardDriveDownload, Smartphone } from '@lucide/svelte';

  const TAB_ICON_MAP: Record<string, Component<{ size?: number | string; strokeWidth?: number | string; class?: string }>> = {
    '🔍': Search,
    '💽': Disc,
    '🎤': Mic,
    '📋': ListMusic,
    '🎼': Music2,
    '📅': Calendar,
    '📁': Folder,
    '📂': FolderOpen,
    '📥': HardDriveDownload,
    '📲': Smartphone
  };

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
    progress = null,
    onChange
  } = $props<{
    items: SegmentItem[];
    activeId: string;
    progress?: number | null;
    onChange: (id: string) => void;
  }>();

  const ACCENT_ACTIVE_CLASSES: Record<string, string> = {
    red: 'bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_2px_10px_rgba(239,68,68,0.35)]',
    blue: 'bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_2px_10px_rgba(14,165,233,0.35)]',
    purple: 'bg-gradient-to-r from-purple-500 to-violet-600 shadow-[0_2px_10px_rgba(168,85,247,0.35)]',
    amber: 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_2px_10px_rgba(245,158,11,0.35)]',
    emerald: 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-[0_2px_10px_rgba(16,185,129,0.35)]',
    cyan: 'bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_2px_10px_rgba(6,182,212,0.35)]',
    default: 'bg-[var(--card-header-bg)] shadow-sm'
  };

  const activeIndex = $derived(Math.max(0, items.findIndex((item: SegmentItem) => item.id === activeId)));
  const maxIndex = $derived(Math.max(0, items.length - 1));
  const isSwiping = $derived(progress !== null && progress !== undefined && Number.isFinite(progress));
  const clampedProgress = $derived(
    isSwiping ? Math.max(0, Math.min(maxIndex, progress as number)) : activeIndex
  );
  const progressPct = $derived(Number((clampedProgress * 100).toFixed(2)));
  const progressGapPx = $derived(Number((clampedProgress * 4).toFixed(2)));
  const visualIndex = $derived(Math.max(0, Math.min(maxIndex, Math.round(clampedProgress))));
  const visualAccent = $derived(items[visualIndex]?.accent || 'default');
  const activeIndicatorStyle = $derived(
    ACCENT_ACTIVE_CLASSES[visualAccent] || ACCENT_ACTIVE_CLASSES.default
  );
</script>

<div class="mb-2.5 w-full select-none">
  <div
    class="p-1 bg-[var(--card-header-bg)]/90 backdrop-blur-xl border border-[var(--border-color)] rounded-xl shadow-xs"
    role="tablist"
  >
    <div class="relative flex items-center gap-1 w-full">
      {#if items.length > 0}
        <div
          aria-hidden="true"
          data-testid="segmented-tabs-indicator"
          class="pointer-events-none absolute top-0 bottom-0 left-0 rounded-lg z-0 will-change-transform {isSwiping ? 'transition-[box-shadow] duration-150 ease-out' : 'transition-[transform,box-shadow] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]'} {activeIndicatorStyle}"
          style="width: calc((100% - {(items.length - 1) * 4}px) / {items.length}); transform: translate3d(calc({progressPct}% + {progressGapPx}px), 0, 0);"
        ></div>
      {/if}

      {#each items as item, idx (item.id)}
        {@const isActive = item.id === activeId}
        {@const isVisuallyActive = idx === visualIndex}
        {@const activeTextClass = item.accent && item.accent !== 'default' ? 'text-white' : 'text-[var(--text-main)]'}
        <button
          type="button"
          role="tab"
          aria-selected={isActive}
          class="relative z-10 flex-1 min-w-0 py-1.5 px-0.5 sm:px-2 md:px-3 rounded-lg text-[11px] sm:text-xs md:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors duration-150 cursor-pointer border-none select-none bg-transparent {isVisuallyActive ? activeTextClass : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-white/5 opacity-80 hover:opacity-100'}"
          onclick={() => onChange(item.id)}
        >
          {#if item.icon}
            {@const IconComp = TAB_ICON_MAP[item.icon]}
            {#if IconComp}
              <span class="shrink-0 flex items-center justify-center">
                <IconComp size={14} />
              </span>
            {:else}
              <span class="text-xs sm:text-sm md:text-base leading-none shrink-0">{item.icon}</span>
            {/if}
          {/if}
          <span class="truncate text-[11px] sm:text-xs">{item.label}</span>
          {#if item.badge}
            <span class="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono {isVisuallyActive ? 'bg-white/20 text-white' : 'bg-white/10 text-[var(--text-muted)]'}">
              {item.badge}
            </span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</div>
