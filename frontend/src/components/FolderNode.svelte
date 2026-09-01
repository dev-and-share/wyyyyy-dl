<script lang="ts">
  import { api } from '../lib/api';
  import SlotBtn from './SlotBtn.svelte';
  import FolderNode from './FolderNode.svelte';

  let { item, level = 0, onPlay } = $props<{ item: any; level?: number; onPlay: (path: string, name: string) => void }>();
  let expanded = $state(false);
  let children: any[] = $state([]);
  let loaded = $state(false);
  let loading = $state(false);
  let showSheet = $state(false);

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
          <SlotBtn onclick={(e) => { e.stopPropagation(); showSheet = true; }}>···</SlotBtn>
        </span>
      {:else}
        <SlotBtn onclick={(e) => { e.stopPropagation(); handlePlay(); }}>▶ 播放</SlotBtn>
        <span class="inline-flex md:hidden">
          <SlotBtn onclick={(e) => { e.stopPropagation(); showSheet = true; }}>···</SlotBtn>
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

<!-- 移动端操作抽屉 Bottom Sheet -->
{#if showSheet}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10003] flex items-end justify-center p-0" onclick={() => showSheet = false}>
    <div
      class="bg-[var(--card-bg-solid,#0f172a)] rounded-t-2xl w-full max-w-[500px] p-4 max-h-[70vh] overflow-y-auto border-t border-[var(--border-color,rgba(255,255,255,0.12))] shadow-2xl flex flex-col gap-2 pb-[calc(16px+env(safe-area-inset-bottom,0px))] animate-[scaleUp_0.22s_cubic-bezier(0.16,1,0.3,1)]"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex justify-between items-center pb-2 border-b border-[var(--border-subtle)]">
        <div class="overflow-hidden pr-2">
          <div class="font-bold text-sm text-[var(--text-main)] truncate">{item.directory ? '📁 ' : '🎵 '}{item.name}</div>
          <div class="text-[11px] text-[var(--text-muted)] font-mono truncate mt-0.5">{item.path}</div>
        </div>
        <button
          type="button"
          onclick={() => showSheet = false}
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
        >
          ✕
        </button>
      </div>

      {#if item.directory}
        {#if item.trackCount > 0}
          <button
            type="button"
            class="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs transition-all cursor-pointer text-center"
            onclick={() => { showSheet = false; handlePlay(); }}
          >
            ▶ 连播此文件夹 ({item.trackCount}首)
          </button>
        {/if}
        <button
          type="button"
          class="w-full py-2.5 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.04] text-left text-xs font-medium text-[var(--text-main)] transition-all cursor-pointer"
          onclick={() => { showSheet = false; handlePlay(); }}
        >
          ➕ 追加到队列
        </button>
        {#if item.hostPath}
          <button
            type="button"
            class="w-full py-2.5 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.04] text-left text-xs font-medium text-[var(--text-main)] transition-all cursor-pointer"
            onclick={() => { showSheet = false; alert(item.hostPath); }}
          >
            📂 定位
          </button>
        {/if}
        <button
          type="button"
          class="w-full py-2.5 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.04] text-left text-xs font-medium text-[var(--text-main)] transition-all cursor-pointer"
          onclick={() => { showSheet = false; toggle(); }}
        >
          🔄 刷新
        </button>
      {/if}

      <button
        type="button"
        class="w-full py-2.5 px-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 text-left text-xs font-medium transition-all cursor-pointer"
        onclick={() => { showSheet = false; if (confirm('忽略 ' + item.name + '?')) alert('忽略'); }}
      >
        🚫 忽略此文件夹 (.musicignore)
      </button>
      <button
        type="button"
        class="w-full py-2.5 px-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-left text-xs font-medium transition-all cursor-pointer"
        onclick={() => { showSheet = false; if (confirm('彻底删除 ' + item.name + '?')) alert('删除'); }}
      >
        🗑️ 彻底删除 (物理删除)
      </button>
      <button
        type="button"
        class="w-full py-2.5 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.04] text-center text-xs text-[var(--text-secondary)] mt-1 transition-all cursor-pointer"
        onclick={() => showSheet = false}
      >
        取消
      </button>
    </div>
  </div>
{/if}
