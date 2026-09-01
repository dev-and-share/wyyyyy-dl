<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import FolderNode from './FolderNode.svelte';

  let roots: any[] = $state([]);
  let curRoot: any = $state(null);
  let tree: any[] = $state([]);
  let filterKw = $state('');
  let expanded = new Set<string>();

  async function loadRoots() {
    try {
      const j = await api.folderRoots();
      roots = j?.data || [];
      if (roots.length) {
        const def = roots.find((r: any) => r.name.includes('外部')) || roots[0];
        selectRoot(def);
      }
    } catch {}
  }

  async function selectRoot(r: any) {
    curRoot = r;
    tree = [];
    expanded.clear();
    await loadBrowse(r.path, true);
  }

  async function loadBrowse(path: string, isRoot = false) {
    try {
      const j = await api.folderBrowse(path);
      const items = j?.data || [];
      if (isRoot) tree = items;
    } catch {}
  }

  function playFolder(path: string, name: string) {
    api.folderTracks(path, true).then((j: any) => {
      const tracks = j?.data || [];
      window.dispatchEvent(new CustomEvent('svelte:playFolder', { detail: { tracks, name } }));
    });
  }

  onMount(loadRoots);
</script>

<div>
  <!-- 根选择 -->
  <div class="flex gap-1.5 flex-wrap mb-2.5">
    {#each roots as r}
      <button
        type="button"
        class="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all {curRoot?.path === r.path ? 'btn-primary' : 'btn-secondary'}"
        onclick={() => selectRoot(r)}
      >
        {r.name.includes('外部') ? '📦 ' + r.name : '📁 ' + r.name}
      </button>
    {/each}
  </div>

  <!-- 树形全局控制与搜索 Bar -->
  <div class="mb-2.5 flex flex-col gap-2">
    <div class="w-full">
      <input
        type="text"
        class="w-full px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-blue-500 transition-all box-border"
        placeholder="🔍 搜索过滤曲目 / 歌手 / 文件夹..."
        bind:value={filterKw}
      />
    </div>
    <div class="flex gap-1.5 flex-wrap">
      <button
        type="button"
        class="btn-secondary px-2.5 py-1 text-xs"
        onclick={() => expanded = new Set(tree.filter((t: any) => t.directory).map((t: any) => t.path))}
        title="展开所有子文件夹"
      >
        📂 全部展开
      </button>
      <button
        type="button"
        class="btn-secondary px-2.5 py-1 text-xs"
        onclick={() => expanded.clear()}
        title="折叠所有子文件夹"
      >
        📁 全部折叠
      </button>
      <button
        type="button"
        class="btn-secondary px-2.5 py-1 text-xs"
        onclick={() => curRoot && loadBrowse(curRoot.path, true)}
        title="刷新整库"
      >
        🔄 刷新
      </button>
    </div>
  </div>

  <!-- 根统计 -->
  {#if curRoot}
    <div class="bg-[var(--stat-bar-bg,#1e293b)]/30 border border-[var(--border-subtle)] rounded-xl p-2.5 px-3.5 mb-2 flex justify-between items-center flex-wrap gap-2">
      <div class="flex items-center gap-2">
        <span class="font-bold text-xs text-[var(--text-main)]">📁 {curRoot.name}</span>
        <span class="bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 px-2 py-0.5 rounded-full text-[11px] text-[var(--text-muted)]">
          {tree.filter((t: any) => t.directory).length}目录 · {tree.filter((t: any) => !t.directory).length}首
        </span>
      </div>
      <div class="flex gap-1.5">
        <button
          type="button"
          class="btn-primary px-3 py-1 text-xs"
          onclick={() => playFolder(curRoot.path, curRoot.name)}
        >
          ▶ 连播整库
        </button>
        <button
          type="button"
          class="btn-secondary hidden md:inline-flex px-3 py-1 text-xs"
          onclick={() => playFolder(curRoot.path, curRoot.name)}
        >
          ➕ 追加
        </button>
      </div>
    </div>
  {/if}

  <!-- 列表：递归子树，支持折叠与 … 抽屉 -->
  <div class="border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--card-bg)]">
    {#each tree.filter((t: any) => !filterKw || (t.name + t.path).toLowerCase().includes(filterKw.toLowerCase())) as item}
      <FolderNode {item} level={0} onPlay={playFolder} />
    {:else}
      <div class="py-6 px-4 text-center text-[var(--text-muted)] text-xs">暂无目录 · 试试切换根或刷新</div>
    {/each}
  </div>
</div>
