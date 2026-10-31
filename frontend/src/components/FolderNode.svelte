<script lang="ts">
  import { api } from '../lib/api';
  import { t } from '../lib/i18n';
  import SlotBtn from './SlotBtn.svelte';
  import FolderNode from './FolderNode.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { formatBytes } from '../lib/utils';

  let {
    item,
    level = 0,
    expandSignal = 0,
    onPlayFolder,
    onPlaySingle,
    onReveal
  } = $props<{
    item: any;
    level?: number;
    expandSignal?: number;
    onPlayFolder: (path: string, name: string) => void;
    onPlaySingle: (item: any) => void;
    onReveal?: (item: any) => void;
  }>();

  let expanded = $state(false);
  let children: any[] = $state([]);
  let loaded = $state(false);
  let loading = $state(false);

  // Listen to global expand/collapse signals
  $effect(() => {
    if (!expandSignal || !item.directory) return;
    if (expandSignal > 0) {
      if (!expanded) {
        if (!loaded) {
          loading = true;
          api.folderBrowse(item.path).then((j: any) => {
            children = j?.data || [];
            loaded = true;
            loading = false;
            expanded = true;
          }).catch(() => { loading = false; });
        } else {
          expanded = true;
        }
      }
    } else if (expandSignal < 0) {
      expanded = false;
    }
  });

  async function handleRowClick() {
    if (!item.directory) {
      onPlaySingle(item);
      return;
    }
    if (!expanded && !loaded) {
      loading = true;
      try {
        const j = await api.folderBrowse(item.path);
        children = j?.data || [];
        loaded = true;
      } catch {}
      loading = false;
    }
    expanded = !expanded;
  }

  async function toggle() {
    if (!item.directory) return;
    if (!expanded && !loaded) {
      loading = true;
      try {
        const j = await api.folderBrowse(item.path);
        children = j?.data || [];
        loaded = true;
      } catch {}
      loading = false;
    }
    expanded = !expanded;
  }

  function handlePlay(e?: MouseEvent) {
    if (e) e.stopPropagation();
    if (item.directory) {
      onPlayFolder(item.path, item.name);
    } else {
      onPlaySingle(item);
    }
  }

  function handleReveal(e?: MouseEvent) {
    if (e) e.stopPropagation();
    if (onReveal) {
      onReveal(item);
    } else if (item.hostPath) {
      alert(item.hostPath);
    }
  }

  function showOptions() {
    const actions: any[] = [];

    if (item.directory) {
      if (item.trackCount > 0) {
        actions.push({ label: t('folder.playFolderWithCount', { count: item.trackCount }), style: 'primary', onclick: () => handlePlay() });
      }
      if (item.hostPath || item.path) {
        actions.push({ label: t('common.reveal'), onclick: () => handleReveal() });
      }
      actions.push({ label: `🔄 ${t('common.refresh')}`, onclick: () => { loaded = false; toggle(); } });
      actions.push({ label: t('folder.ignoreFolder'), style: 'danger', onclick: () => { if (confirm('Ignore ' + item.name + '?')) alert('Ignored'); } });
      actions.push({ label: t('folder.physicalDelete'), style: 'danger', onclick: () => { if (confirm('Delete ' + item.name + '?')) alert('Deleted'); } });
    } else {
      actions.push({ label: `▶ ${t('player.play')}`, style: 'primary', onclick: () => handlePlay() });
      if (item.hostPath || item.path) {
        actions.push({ label: t('common.reveal'), onclick: () => handleReveal() });
      }
    }

    actions.push({ label: t('common.cancel'), style: 'cancel', onclick: () => {} });

    openSheet({
      title: (item.directory ? '📁 ' : '🎵 ') + (item.songName || item.name),
      subtitle: item.path,
      actions,
    });
  }
</script>

<div
  class="min-w-0"
  style="margin-left: {level > 0 ? '10px' : '0'}; border-left: {level > 0 ? '1px solid var(--border-subtle)' : 'none'}; padding-left: {level > 0 ? '6px' : '0'};"
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="group relative flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/[0.06] transition-colors cursor-pointer select-none min-w-0 {expanded ? 'bg-black/[0.03] dark:bg-white/[0.03]' : ''}"
    onclick={handleRowClick}
  >
    <!-- Left Info Area -->
    <div class="flex-1 flex items-center gap-1.5 min-w-0 overflow-hidden pr-1">
      {#if item.directory}
        <span
          class="text-[10px] w-3.5 h-3.5 flex items-center justify-center text-[var(--text-muted)] shrink-0 hover:text-[var(--text-main)] transition-colors"
          onclick={(e) => { e.stopPropagation(); toggle(); }}
        >
          {expanded ? '▼' : '▶'}
        </span>
        <span class="text-sm shrink-0 leading-none">{expanded ? '📂' : '📁'}</span>
      {:else}
        <span class="w-3.5 shrink-0"></span>
        <span class="text-xs shrink-0 text-sky-400 leading-none">🎵</span>
      {/if}

      <!-- Folder / Track Name -->
      <span
        class="flex-1 min-w-0 text-xs truncate {item.directory ? 'font-semibold text-[var(--text-main)]' : 'font-normal text-[var(--text-main)]'}"
        title={item.songName || item.name}
      >
        {item.songName || item.name}
      </span>

      {#if !item.directory && item.artist}
        <span
          class="text-[11px] text-[var(--text-secondary)] truncate max-w-[90px] shrink-0 font-normal opacity-85"
          title={item.artist}
        >
          {item.artist}
        </span>
      {/if}

      {#if item.directory && item.trackCount !== undefined && item.trackCount !== null}
        <span class="bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 px-1.5 py-0.5 rounded-full text-[10px] text-[var(--text-muted)] shrink-0 tabular-nums">
          {t('playlist.trackCount', { count: item.trackCount })}
        </span>
      {/if}

      {#if !item.directory && item.size}
        <span class="text-[10px] text-[var(--text-muted)] font-mono shrink-0 tabular-nums">
          {typeof item.size === 'number' ? formatBytes(item.size) : item.size}
        </span>
      {/if}
    </div>

    <!-- Mobile Action Button -->
    <div class="inline-flex md:hidden shrink-0">
      <button
        type="button"
        class="w-6 h-6 rounded-md flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/10 dark:hover:bg-white/10"
        onclick={(e) => { e.stopPropagation(); showOptions(); }}
        title={t('common.moreActions')}
      >
        ···
      </button>
    </div>

    <!-- Desktop Toolbar -->
    <div class="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 items-center gap-1 pl-6 py-0.5 pr-1 bg-gradient-to-l from-[var(--card-bg)] via-[var(--card-bg)]/95 to-transparent transition-opacity duration-150 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
      {#if item.directory}
        {#if item.trackCount > 0}
          <button
            type="button"
            class="w-6 h-6 rounded-md flex items-center justify-center text-[10px] bg-sky-500/15 hover:bg-sky-500 text-sky-400 hover:text-white border border-sky-500/30 transition-all active:scale-95 cursor-pointer shadow-sm"
            title={t('folder.playFolderTooltip', { count: item.trackCount })}
            onclick={(e) => handlePlay(e)}
          >
            ▶
          </button>
        {/if}
        {#if item.hostPath || item.path}
          <button
            type="button"
            class="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-black/5 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer shadow-sm"
            title={t('folder.revealFolderTooltip')}
            onclick={(e) => handleReveal(e)}
          >
            📁
          </button>
        {/if}
        <button
          type="button"
          class="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-black/5 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer shadow-sm"
          title={t('folder.refreshFolderTooltip')}
          onclick={(e) => { e.stopPropagation(); loaded = false; toggle(); }}
        >
          🔄
        </button>
        <button
          type="button"
          class="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-black/5 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer shadow-sm"
          title={t('common.moreActions')}
          onclick={(e) => { e.stopPropagation(); showOptions(); }}
        >
          ···
        </button>
      {:else}
        <button
          type="button"
          class="w-6 h-6 rounded-md flex items-center justify-center text-[10px] bg-sky-500/15 hover:bg-sky-500 text-sky-400 hover:text-white border border-sky-500/30 transition-all active:scale-95 cursor-pointer shadow-sm"
          title={t('folder.playTrackTooltip')}
          onclick={(e) => handlePlay(e)}
        >
          ▶
        </button>
        {#if item.hostPath || item.path}
          <button
            type="button"
            class="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-black/5 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer shadow-sm"
            title={t('folder.revealFileTooltip')}
            onclick={(e) => handleReveal(e)}
          >
            📁
          </button>
        {/if}
        <button
          type="button"
          class="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-black/5 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer shadow-sm"
          title={t('common.moreActions')}
          onclick={(e) => { e.stopPropagation(); showOptions(); }}
        >
          ···
        </button>
      {/if}
    </div>
  </div>

  {#if item.directory && expanded}
    <div>
      {#if loading}
        <div class="py-1.5 px-3 text-[var(--text-muted)] text-xs flex items-center gap-1.5">
          <span class="animate-spin text-[10px]">⏳</span> {t('common.loading')}
        </div>
      {:else if children.length === 0}
        <div class="py-1 px-3 text-[var(--text-muted)] text-[11px]">{t('folder.empty')}</div>
      {:else}
        {#each children as child}
          <FolderNode item={child} level={level + 1} {expandSignal} {onPlayFolder} {onPlaySingle} {onReveal} />
        {/each}
      {/if}
    </div>
  {/if}
</div>
