<script lang="ts">
  import { musicFreeStore } from '../../lib/musicfree/musicFreeStore.svelte';
  import type { Track } from '../../lib/types';
  import MusicFreeTopListsTab from './musicfree/MusicFreeTopListsTab.svelte';
  import MusicFreeSheetsTab from './musicfree/MusicFreeSheetsTab.svelte';
  import MusicFreeManageTab from './musicfree/MusicFreeManageTab.svelte';

  let {
    curTrack = null,
    playing = false,
    onPlayQueue,
    showToast
  } = $props<{
    curTrack?: Track | null;
    playing?: boolean;
    onPlayQueue?: (tracks: any[], idx?: number) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let activeTab = $state<'toplists' | 'sheets' | 'manage'>('toplists');
  const activeCount = $derived(musicFreeStore.getActivePlugins().length);
</script>

<div class="w-full h-full flex flex-col p-4 lg:p-6 overflow-y-auto max-w-7xl mx-auto space-y-5 animate-fade-in">
  <!-- 发现中心顶栏 -->
  <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4 shrink-0">
    <div>
      <h1 class="text-xl lg:text-2xl font-bold flex items-center gap-2.5 text-[var(--text-main)]">
        <span class="text-2xl">🧩</span> 发现中心 (MusicFree 音源广场与插件)
      </h1>
      <p class="text-xs lg:text-sm text-[var(--text-secondary)] mt-1">
        无须客户端，直接探索各大音源官方排行榜、推荐歌单广场，并通过浏览器沙箱实现即点即播。
      </p>
    </div>

    <!-- 选项卡切换胶囊 -->
    <div class="flex items-center gap-1.5 p-1 rounded-xl bg-black/10 dark:bg-white/5 border border-[var(--border-subtle)] shrink-0 self-start sm:self-auto">
      <button
        type="button"
        class="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {activeTab === 'toplists' ? 'bg-purple-600 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => activeTab = 'toplists'}
      >
        <span>🏆</span> <span>官方排行榜</span>
      </button>

      <button
        type="button"
        class="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {activeTab === 'sheets' ? 'bg-purple-600 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => activeTab = 'sheets'}
      >
        <span>📻</span> <span>歌单广场</span>
      </button>

      <button
        type="button"
        class="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {activeTab === 'manage' ? 'bg-purple-600 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => activeTab = 'manage'}
      >
        <span>⚙️</span> <span>插件管理</span>
        <span class="text-[10px] px-1.5 py-0.2 rounded-full {activeCount > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-[var(--text-muted)]'}">
          {activeCount}
        </span>
      </button>
    </div>
  </header>

  <!-- 子功能区域 -->
  {#if activeTab === 'toplists'}
    <MusicFreeTopListsTab
      {curTrack}
      {playing}
      {onPlayQueue}
      {showToast}
    />
  {:else if activeTab === 'sheets'}
    <MusicFreeSheetsTab
      {curTrack}
      {playing}
      {onPlayQueue}
      {showToast}
    />
  {:else if activeTab === 'manage'}
    <MusicFreeManageTab
      {showToast}
    />
  {/if}
</div>
