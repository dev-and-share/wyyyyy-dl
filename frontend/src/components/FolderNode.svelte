<script lang="ts">
  import { api } from '../lib/api';
  import SlotBtn from './SlotBtn.svelte';
  import FolderNode from './FolderNode.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { formatBytes } from '../lib/utils';

  let {
    item,
    level = 0,
    onPlayFolder,
    onPlaySingle,
    onReveal
  } = $props<{
    item: any;
    level?: number;
    onPlayFolder: (path: string, name: string) => void;
    onPlaySingle: (item: any) => void;
    onReveal?: (item: any) => void;
  }>();

  let expanded = $state(false);
  let children: any[] = $state([]);
  let loaded = $state(false);
  let loading = $state(false);

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
        actions.push({ label: `▶ 连播此文件夹 (${item.trackCount}首)`, style: 'primary', onclick: () => handlePlay() });
      }
      if (item.hostPath || item.path) {
        actions.push({ label: '📂 定位', onclick: () => handleReveal() });
      }
      actions.push({ label: '🔄 刷新', onclick: () => { loaded = false; toggle(); } });
      actions.push({ label: '🚫 忽略此文件夹 (.musicignore)', style: 'danger', onclick: () => { if (confirm('忽略 ' + item.name + '?')) alert('忽略'); } });
      actions.push({ label: '🗑️ 彻底删除 (物理删除)', style: 'danger', onclick: () => { if (confirm('彻底删除 ' + item.name + '?')) alert('删除'); } });
    } else {
      actions.push({ label: '▶ 播放', style: 'primary', onclick: () => handlePlay() });
      if (item.hostPath || item.path) {
        actions.push({ label: '📂 定位', onclick: () => handleReveal() });
      }
    }

    actions.push({ label: '取消', style: 'cancel', onclick: () => {} });

    openSheet({
      title: (item.directory ? '📁 ' : '🎵 ') + (item.songName || item.name),
      subtitle: item.path,
      actions,
    });
  }
</script>

<div style="margin-left: {level * 14}px; border-left: {level > 0 ? '1px dashed var(--border-subtle)' : 'none'}; padding-left: {level > 0 ? '8px' : '0'};">
  <div class="flex justify-between items-center py-2 px-2.5 border-b border-[var(--border-subtle)] gap-2 {expanded ? 'bg-black/5 dark:bg-white/[0.04]' : ''}">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="flex-1 flex items-center gap-1.5 overflow-hidden cursor-pointer select-none"
      onclick={handleRowClick}
    >
      {#if item.directory}
        <span class="text-[10px] w-3 text-center text-[var(--text-muted)]">{expanded ? '▼' : '▶'}</span>
        <span class="text-sm">{expanded ? '📂' : '📁'}</span>
      {:else}
        <span class="w-3"></span>
        <span class="text-xs">🎵</span>
      {/if}
      <span class="truncate text-xs {item.directory ? 'font-semibold text-[var(--text-main)]' : 'font-normal text-[var(--text-main)]'}">
        {item.songName || item.name}
      </span>
      {#if !item.directory && item.artist}
        <span class="text-[11px] text-[var(--text-secondary)] truncate shrink-0 max-w-[150px]">
          - {item.artist}
        </span>
      {/if}
      {#if item.directory && item.trackCount}
        <span class="bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 px-1.5 py-0.5 rounded-full text-[10px] text-[var(--text-muted)] shrink-0">
          {item.trackCount}首
        </span>
      {/if}
      {#if !item.directory && item.size}
        <span class="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
          {typeof item.size === 'number' ? formatBytes(item.size) : item.size}
        </span>
      {/if}
    </div>
    <div class="flex gap-1.5 shrink-0">
      {#if item.directory}
        {#if item.trackCount > 0}
          <SlotBtn onclick={(e) => handlePlay(e)}>▶ 连播</SlotBtn>
        {/if}
        {#if item.hostPath || item.path}
          <span class="hidden md:inline-flex">
            <SlotBtn onclick={(e) => handleReveal(e)}>📂 定位</SlotBtn>
          </span>
        {/if}
        <span class="hidden md:inline-flex">
          <SlotBtn onclick={(e) => { e.stopPropagation(); toggle(); }}>🔄</SlotBtn>
        </span>
        <span class="inline-flex md:hidden">
          <SlotBtn onclick={(e) => { e.stopPropagation(); showOptions(); }}>···</SlotBtn>
        </span>
      {:else}
        <SlotBtn onclick={(e) => handlePlay(e)}>▶ 播放</SlotBtn>
        {#if item.hostPath || item.path}
          <span class="hidden md:inline-flex">
            <SlotBtn onclick={(e) => handleReveal(e)}>📂 定位</SlotBtn>
          </span>
        {/if}
        <span class="inline-flex md:hidden">
          <SlotBtn onclick={(e) => { e.stopPropagation(); showOptions(); }}>···</SlotBtn>
        </span>
      {/if}
    </div>
  </div>

  {#if item.directory && expanded}
    <div class="ml-1.5">
      {#if loading}
        <div class="py-2 px-3 text-[var(--text-muted)] text-xs">加载中...</div>
      {:else if children.length === 0}
        <div class="py-2 px-3 text-[var(--text-muted)] text-xs" style="padding-left: {(level + 1) * 14 + 20}px;">(空)</div>
      {:else}
        {#each children as child}
          <FolderNode item={child} level={level + 1} {onPlayFolder} {onPlaySingle} {onReveal} />
        {/each}
      {/if}
    </div>
  {/if}
</div>
