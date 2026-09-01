<script lang="ts">
  import { api } from '../lib/api';
  import { formatBytes } from '../lib/utils';
  import AccordionCard from './AccordionCard.svelte';
  import SlotBtn from './SlotBtn.svelte';

  let histKw = $state('');
  let histPage = $state(1);
  let histList: any[] = $state([]);
  let histStats: any = $state(null);
  let histTotal = $state(0);

  let histTotalPages = $derived(Math.max(1, Math.ceil(histTotal / 10)));

  async function loadHistory(p = 1) {
    histPage = p;
    const j = await api.historyList(histKw, p);
    histList = j?.data?.list || [];
    histTotal = j?.data?.total || 0;
    const s = await api.historyStats();
    histStats = s?.data || null;
  }

  $effect(() => {
    loadHistory(1);
  });

  function copy(t: string) {
    navigator.clipboard?.writeText(t);
  }
</script>

<AccordionCard title="📥 2. 本地下载历史与文件管理" open={true}>
  <!-- 统计信息工具栏 -->
  <div class="flex flex-wrap gap-2.5 bg-[var(--stat-bar-bg,#1e293b)]/30 border border-[var(--border-subtle)] p-2.5 px-3.5 rounded-xl mb-2.5 items-center text-xs">
    <span class="text-[var(--text-secondary)]">已记录下载：<strong class="text-[var(--text-main)] font-semibold">{histStats?.totalCount ?? histTotal ?? 0}</strong> 首</span>
    <span class="text-[var(--text-secondary)]">占用空间：<strong class="text-[var(--text-main)] font-semibold">{histStats?.totalSize ? formatBytes(histStats.totalSize) : '-'}</strong></span>
    {#if (histStats?.missingCount ?? 0) > 0}
      <span class="text-red-500 font-medium">⚠️ 文件缺失：{histStats.missingCount} 首</span>
    {/if}
    {#if (histStats?.nonMp3Count ?? 0) > 0}
      <span class="text-amber-500 font-medium">📁 非 MP3：{histStats.nonMp3Count} 首</span>
    {/if}
    <div class="ml-auto flex gap-1.5">
      <button
        type="button"
        class="btn-primary px-3 py-1 text-xs"
        onclick={() => loadHistory(1)}
      >
        🔄 刷新
      </button>
      <button
        type="button"
        class="btn-secondary px-3 py-1 text-xs"
        onclick={() => {
          const v = prompt('搜索历史记录');
          if (v !== null) {
            histKw = v;
            loadHistory(1);
          }
        }}
      >
        🔍 搜索
      </button>
    </div>
  </div>

  <!-- 搜索输入行 -->
  <div class="flex gap-2 mb-2.5">
    <input
      type="text"
      placeholder="🔍 搜索已下载歌曲 (按回车搜索)..."
      class="flex-1 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-blue-500 transition-all"
      bind:value={histKw}
      onkeydown={(e) => e.key === 'Enter' && loadHistory(1)}
    />
    <button
      type="button"
      class="btn-primary px-4 py-1.5 text-xs hidden md:inline-flex"
      onclick={() => loadHistory(1)}
    >
      搜索
    </button>
  </div>

  <!-- 历史记录列表 -->
  <div class="border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--card-bg)]">
    <ul class="divide-y divide-black/5 dark:divide-white/5 m-0 p-0 list-none">
      {#each histList as h}
        <li class="flex justify-between items-center py-2 px-3 hover:bg-black/5 dark:hover:bg-white/5 transition-all">
          <div class="flex-1 overflow-hidden min-w-0 pr-2">
            <div class="font-bold text-xs text-[var(--text-main)] truncate">{h.songName || h.title}</div>
            <div class="text-[11px] text-[var(--text-secondary)] truncate mt-0.5 flex items-center gap-1.5">
              <span>{h.artist || ''}</span>
              {#if h.fileSize}<span>| {formatBytes(h.fileSize)}</span>{/if}
              <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold {h.fileExists ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'}">
                {h.fileExists ? '正常' : '缺失'}
              </span>
            </div>
          </div>
          <div class="flex gap-1.5 shrink-0">
            <SlotBtn onclick={() => copy(h.hostFilePath || h.filePath)}>📂 定位</SlotBtn>
            <SlotBtn onclick={() => { if (confirm('确认删除此记录?')) alert('删除操作已触发'); }}>🗑️ 删除</SlotBtn>
          </div>
        </li>
      {:else}
        <li class="py-8 px-4 text-center text-[var(--text-muted)] text-xs list-none">暂无历史</li>
      {/each}
    </ul>
  </div>

  <!-- 分页器 -->
  <div class="flex justify-between items-center mt-3 text-xs text-[var(--text-secondary)] select-none">
    <button
      type="button"
      class="btn-secondary px-3 py-1 text-xs"
      disabled={histPage <= 1}
      onclick={() => loadHistory(histPage - 1)}
    >
      上一页
    </button>
    <span>第 {histPage} / 共 {histTotalPages} 页 (共 {histTotal} 条)</span>
    <button
      type="button"
      class="btn-secondary px-3 py-1 text-xs"
      disabled={histPage >= histTotalPages}
      onclick={() => loadHistory(histPage + 1)}
    >
      下一页
    </button>
  </div>
</AccordionCard>
