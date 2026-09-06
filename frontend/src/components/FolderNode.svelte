<script lang="ts">
  import { api } from '../lib/api';
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

  // 监听全局展开/折叠信号
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
    <!-- 左侧主信息区域：图标 + 标题 + 补充信息 -->
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

      <!-- 文件夹/歌曲名：独占剩余宽度，支持完整 tooltip -->
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
          {item.trackCount}首
        </span>
      {/if}

      {#if !item.directory && item.size}
        <span class="text-[10px] text-[var(--text-muted)] font-mono shrink-0 tabular-nums">
          {typeof item.size === 'number' ? formatBytes(item.size) : item.size}
        </span>
      {/if}
    </div>

    <!-- 移动端常驻操作按钮 (触屏设备) -->
    <div class="inline-flex md:hidden shrink-0">
      <button
        type="button"
        class="w-6 h-6 rounded-md flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/10 dark:hover:bg-white/10"
        onclick={(e) => { e.stopPropagation(); showOptions(); }}
        title="更多操作"
      >
        ···
      </button>
    </div>

    <!-- 桌面端悬浮微型工具栏：默认绝对定位右浮动且透明，不提前霸占文字宽度；hover 时平滑显现 -->
    <div class="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 items-center gap-1 pl-6 py-0.5 pr-1 bg-gradient-to-l from-[var(--card-bg)] via-[var(--card-bg)]/95 to-transparent transition-opacity duration-150 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
      {#if item.directory}
        {#if item.trackCount > 0}
          <button
            type="button"
            class="w-6 h-6 rounded-md flex items-center justify-center text-[10px] bg-sky-500/15 hover:bg-sky-500 text-sky-400 hover:text-white border border-sky-500/30 transition-all active:scale-95 cursor-pointer shadow-sm"
            title="连播整目录 ({item.trackCount}首)"
            onclick={(e) => handlePlay(e)}
          >
            ▶
          </button>
        {/if}
        {#if item.hostPath || item.path}
          <button
            type="button"
            class="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-black/5 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer shadow-sm"
            title="定位文件夹"
            onclick={(e) => handleReveal(e)}
          >
            📁
          </button>
        {/if}
        <button
          type="button"
          class="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-black/5 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer shadow-sm"
          title="刷新目录"
          onclick={(e) => { e.stopPropagation(); loaded = false; toggle(); }}
        >
          🔄
        </button>
        <button
          type="button"
          class="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-black/5 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer shadow-sm"
          title="更多选项"
          onclick={(e) => { e.stopPropagation(); showOptions(); }}
        >
          ···
        </button>
      {:else}
        <button
          type="button"
          class="w-6 h-6 rounded-md flex items-center justify-center text-[10px] bg-sky-500/15 hover:bg-sky-500 text-sky-400 hover:text-white border border-sky-500/30 transition-all active:scale-95 cursor-pointer shadow-sm"
          title="播放歌曲"
          onclick={(e) => handlePlay(e)}
        >
          ▶
        </button>
        {#if item.hostPath || item.path}
          <button
            type="button"
            class="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-black/5 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer shadow-sm"
            title="定位文件"
            onclick={(e) => handleReveal(e)}
          >
            📁
          </button>
        {/if}
        <button
          type="button"
          class="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-black/5 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer shadow-sm"
          title="更多选项"
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
          <span class="animate-spin text-[10px]">⏳</span> 加载中...
        </div>
      {:else if children.length === 0}
        <div class="py-1 px-3 text-[var(--text-muted)] text-[11px]">(空)</div>
      {:else}
        {#each children as child}
          <FolderNode item={child} level={level + 1} {expandSignal} {onPlayFolder} {onPlaySingle} {onReveal} />
        {/each}
      {/if}
    </div>
  {/if}
</div>
