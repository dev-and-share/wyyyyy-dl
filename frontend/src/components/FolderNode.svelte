<script lang="ts">
  import { api } from '../lib/api';
  import SlotBtn from './SlotBtn.svelte';
  import FolderNode from './FolderNode.svelte';
  import { openSheet } from '../lib/ui.svelte';

  let { item, level = 0, onPlay } = $props<{ item: any; level?: number; onPlay: (path: string, name: string) => void }>();
  let expanded = $state(false);
  let children: any[] = $state([]);
  let loaded = $state(false);
  let loading = $state(false);

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

  function handlePlay() {
    onPlay(item.path, item.name);
  }

  function showOptions() {
    const actions = [];

    if (item.directory) {
      if (item.trackCount > 0) {
        actions.push({ label: `▶ 连播此文件夹 (${item.trackCount}首)`, style: 'primary' as const, onclick: handlePlay });
        actions.push({ label: '➕ 追加到队列', onclick: handlePlay });
      }
      if (item.hostPath) {
        actions.push({ label: '📂 定位', onclick: () => alert(item.hostPath) });
      }
      actions.push({ label: '🔄 刷新', onclick: () => { loaded = false; toggle(); } });
      actions.push({ label: '🚫 忽略此文件夹 (.musicignore)', style: 'danger' as const, onclick: () => { if (confirm('忽略 ' + item.name + '?')) alert('忽略'); } });
      actions.push({ label: '🗑️ 彻底删除 (物理删除)', style: 'danger' as const, onclick: () => { if (confirm('彻底删除 ' + item.name + '?')) alert('删除'); } });
    } else {
      actions.push({ label: '▶ 播放', style: 'primary' as const, onclick: handlePlay });
    }

    actions.push({ label: '取消', style: 'cancel' as const, onclick: () => {} });

    openSheet({
      title: (item.directory ? '📁 ' : '🎵 ') + item.name,
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
      class="flex-1 flex items-center gap-1.5 overflow-hidden {item.directory ? 'cursor-pointer select-none' : 'cursor-default'}"
      onclick={toggle}
    >
      {#if item.directory}
        <span class="text-[10px] w-3 text-center text-[var(--text-muted)]">{expanded ? '▼' : '▶'}</span>
        <span class="text-sm">{expanded ? '📂' : '📁'}</span>
      {:else}
        <span class="w-3"></span>
        <span class="text-xs">🎵</span>
      {/if}
      <span class="truncate text-xs {item.directory ? 'font-semibold' : 'font-normal'} text-[var(--text-main)]">
        {item.name}
      </span>
      {#if item.directory && item.trackCount}
        <span class="bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 px-1.5 py-0.5 rounded-full text-[10px] text-[var(--text-muted)] shrink-0">
          {item.trackCount}首
        </span>
      {/if}
      {#if !item.directory && item.size}
        <span class="text-[10px] text-[var(--text-muted)] font-mono shrink-0">{item.size}</span>
      {/if}
    </div>
    <div class="flex gap-1.5 shrink-0">
      {#if item.directory}
        {#if item.trackCount > 0}
          <SlotBtn onclick={(e) => { e.stopPropagation(); handlePlay(); }}>▶ 连播</SlotBtn>
          <span class="hidden md:inline-flex">
            <SlotBtn onclick={(e) => { e.stopPropagation(); handlePlay(); }}>➕ 追加</SlotBtn>
          </span>
        {/if}
        {#if item.hostPath}
          <span class="hidden md:inline-flex">
            <SlotBtn onclick={(e) => { e.stopPropagation(); alert(item.hostPath); }}>📂 定位</SlotBtn>
          </span>
        {/if}
        <span class="hidden md:inline-flex">
          <SlotBtn onclick={(e) => { e.stopPropagation(); toggle(); }}>🔄</SlotBtn>
        </span>
        <span class="inline-flex md:hidden">
          <SlotBtn onclick={(e) => { e.stopPropagation(); showOptions(); }}>···</SlotBtn>
        </span>
      {:else}
        <SlotBtn onclick={(e) => { e.stopPropagation(); handlePlay(); }}>▶ 播放</SlotBtn>
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
          <FolderNode item={child} level={level + 1} onPlay={onPlay} />
        {/each}
      {/if}
    </div>
  {/if}
</div>
