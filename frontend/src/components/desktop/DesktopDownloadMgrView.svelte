<script lang="ts">
  import { onMount } from 'svelte';
  import FolderExplorer from '../FolderExplorer.svelte';
  import BrowserCacheSection from '../BrowserCacheSection.svelte';
  import SlotBtn from '../SlotBtn.svelte';
  import { api } from '../../lib/api';
  import { formatBytes, formatArtist, DEFAULT_VINYL_COVER, getApiCache, setApiCache } from '../../lib/utils';
  import type { Track } from '../../lib/types';

  let {
    curTrack = null,
    playing = false,
    onPlayQueue,
    onReveal,
    showToast
  } = $props<{
    curTrack?: Track | null;
    playing?: boolean;
    onPlayQueue: (tracks: any[], idx?: number) => void;
    onReveal: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let subTab = $state<'history' | 'browser-cache'>('history');
  let histKw = $state('');
  let histPage = $state(1);
  let histList = $state<any[]>([]);
  let histStats = $state<any>(null);
  let histTotal = $state(0);
  let loadingHistory = $state(false);
  let scanLoading = $state(false);

  let histTotalPages = $derived(Math.max(1, Math.ceil(histTotal / 10)));

  onMount(() => {
    loadHistory(1);
  });

  async function loadHistory(p = 1) {
    histPage = p;
    if (p === 1 && !histKw.trim()) {
      const cachedList = getApiCache('history_list_1');
      if (cachedList?.data && Array.isArray(cachedList.data)) {
        histList = cachedList.data;
        histTotal = cachedList.total || cachedList.data.length;
      }
      const cachedStats = getApiCache('history_stats');
      if (cachedStats?.data) {
        histStats = cachedStats.data;
      }
    }
    loadingHistory = true;
    try {
      const j = await api.historyList(histKw, p);
      const list = j?.data?.list || [];
      const total = j?.data?.total || 0;
      histList = list;
      histTotal = total;
      if (p === 1 && !histKw.trim()) {
        setApiCache('history_list_1', list);
      }
      const s = await api.historyStats();
      const stats = s?.data || null;
      histStats = stats;
      if (stats) setApiCache('history_stats', stats);
    } catch (e: any) {
      showToast('加载历史失败: ' + (e?.message || e), 'error');
    } finally {
      loadingHistory = false;
    }
  }

  async function handleDeleteHistory(item: any) {
    if (!item?.id) return;
    if (!confirm(`确定要从下载历史数据库中移除《${item.name || '此歌曲'}》吗？（不会删除磁盘文件）`)) {
      return;
    }
    try {
      const j = await api.historyDelete(item.id);
      if (j?.code === '000000') {
        showToast('已从历史记录中移除', 'success', 1500);
        loadHistory(histPage);
      } else {
        showToast(j?.msg || '删除失败', 'warning');
      }
    } catch (e: any) {
      showToast('删除失败: ' + (e?.message || e), 'error');
    }
  }

  async function handleScanExternal() {
    scanLoading = true;
    try {
      const j = await api.historyScanExternal();
      if (j?.code === '000000') {
        showToast('外部曲库扫描完成！', 'success');
        loadHistory(1);
      } else {
        showToast(j?.msg || '扫描失败', 'warning');
      }
    } catch (e: any) {
      showToast('扫描异常: ' + (e?.message || e), 'error');
    } finally {
      scanLoading = false;
    }
  }

  async function handleScanDisk() {
    scanLoading = true;
    try {
      const j = await api.historyScan();
      if (j?.code === '000000') {
        showToast('磁盘对齐校验完成！', 'success');
        loadHistory(histPage);
      } else {
        showToast(j?.msg || '扫描失败', 'warning');
      }
    } catch (e: any) {
      showToast('磁盘校验异常: ' + (e?.message || e), 'error');
    } finally {
      scanLoading = false;
    }
  }
</script>

<!-- 🖥️ PC 桌面端：本地管理双栏工作台 (去手风琴化) -->
<div class="flex flex-col lg:flex-row gap-5 items-start w-full select-none animate-fade-in" data-testid="desktop-download-mgr-view">
  <!-- 左栏：本地曲库文件夹树 (约 38% 宽度) -->
  <div class="w-full lg:w-[400px] xl:w-[460px] 2xl:w-[500px] shrink-0 flex flex-col gap-3 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] p-4 shadow-sm">
    <div class="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
      <div class="flex items-center gap-2">
        <span class="text-base">📁</span>
        <h2 class="font-bold text-sm text-[var(--text-main)]">本地曲库与目录树</h2>
      </div>
      <span class="text-[10px] text-[var(--text-muted)]">点击展开/单曲连播</span>
    </div>

    <!-- 目录树组件直铺容器 -->
    <div class="max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto custom-scroll pr-1">
      <FolderExplorer {onPlayQueue} {onReveal} {showToast} />
    </div>
  </div>

  <!-- 右栏：下载历史表格 & 离线缓存工作台 (约 62% 宽度) -->
  <div class="flex-1 min-w-0 w-full flex flex-col gap-4">
    <!-- 1. 顶部统计与曲库维护栏 -->
    <div class="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] shadow-sm text-xs">
      <div class="flex items-center gap-3 flex-wrap">
        <span class="text-[var(--text-secondary)]">
          已记录下载: <strong class="text-[var(--text-main)] font-semibold">{histStats?.totalCount ?? histTotal ?? 0}</strong> 首
        </span>
        <span class="text-[var(--text-secondary)]">
          占用空间: <strong class="text-red-400 font-semibold">{histStats?.totalSize ? formatBytes(histStats.totalSize) : '-'}</strong>
        </span>
        {#if (histStats?.missingCount ?? 0) > 0}
          <span class="text-amber-400 font-medium bg-amber-400/10 px-2 py-0.5 rounded-md">
            ⚠️ 缺失: {histStats.missingCount} 首
          </span>
        {/if}
      </div>

      <!-- 快捷维护工具组 -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn-secondary px-2.5 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer"
          disabled={scanLoading}
          onclick={handleScanExternal}
          title="扫描外部存储音频并增量录入数据库"
        >
          {scanLoading ? '⏳ 扫描中' : '🔄 增量扫描'}
        </button>
        <button
          type="button"
          class="btn-secondary px-2.5 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer"
          disabled={scanLoading}
          onclick={handleScanDisk}
          title="校验数据库记录与磁盘实际物理文件"
        >
          🔍 磁盘校验
        </button>
      </div>
    </div>

    <!-- 2. 子工作台标签切换 -->
    <div class="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
      <div class="flex items-center gap-2">
        <button
          type="button"
          data-testid="subtab-history"
          class="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border-none transition-all {subTab === 'history' ? 'bg-red-500 text-white shadow-md shadow-red-500/20' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => subTab = 'history'}
        >
          📥 下载历史与文件管理
        </button>
        <button
          type="button"
          data-testid="subtab-cache"
          class="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border-none transition-all {subTab === 'browser-cache' ? 'bg-red-500 text-white shadow-md shadow-red-500/20' : 'bg-[var(--btn-secondary-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => subTab = 'browser-cache'}
        >
          📲 离线浏览器缓存
        </button>
      </div>
    </div>

    <!-- 3. 内容区 -->
    {#if subTab === 'history'}
      <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] overflow-hidden shadow-sm flex flex-col">
        <!-- 搜索与刷新栏 -->
        <div class="p-3 border-b border-[var(--border-color)] flex items-center justify-between gap-2.5">
          <div class="flex items-center gap-2 flex-1 max-w-sm">
            <input
              type="search"
              placeholder="搜索本地下载记录..."
              class="w-full px-3 py-1.5 rounded-xl text-xs bg-[var(--input-bg)] text-[var(--text-main)] border border-[var(--input-border)] focus:outline-none focus:border-red-500"
              bind:value={histKw}
              onkeydown={(e) => e.key === 'Enter' && loadHistory(1)}
            />
            <button
              type="button"
              class="btn-primary px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
              onclick={() => loadHistory(1)}
            >
              检索
            </button>
          </div>
          <button
            type="button"
            class="p-2 rounded-xl text-xs bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--btn-secondary-border)] transition-colors cursor-pointer"
            onclick={() => loadHistory(histPage)}
            title="刷新历史列表"
          >
            🔄
          </button>
        </div>

        <!-- 历史表格 -->
        <div class="overflow-x-auto max-h-[560px] overflow-y-auto custom-scroll">
          <table class="w-full text-left border-collapse text-xs">
            <thead class="sticky top-0 z-10 bg-[var(--card-header-bg)] backdrop-blur-xl border-b border-[var(--border-color)] text-[var(--text-muted)]">
              <tr>
                <th class="w-12 py-3 pl-4 font-semibold">#</th>
                <th class="py-3 px-3 font-semibold">歌曲标题</th>
                <th class="py-3 px-3 font-semibold w-28">大小/格式</th>
                <th class="py-3 px-3 font-semibold hidden md:table-cell">路径</th>
                <th class="py-3 pr-4 text-right font-semibold w-40">快捷操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border-subtle)]">
              {#if loadingHistory && histList.length === 0}
                <tr>
                  <td colspan="5" class="py-12 text-center text-[var(--text-muted)]">
                    ⏳ 正在读取本地下载历史...
                  </td>
                </tr>
              {:else if histList.length === 0}
                <tr>
                  <td colspan="5" class="py-12 text-center text-[var(--text-muted)]">
                    暂无符合条件的本地下载记录
                  </td>
                </tr>
              {:else}
                {#each histList as item, i (item.id || i)}
                  {@const idx = (histPage - 1) * 10 + i + 1}
                  {@const artist = item.artist || item.artists || ''}
                  {@const isPlayingThis = !!(curTrack && (String(curTrack.id) === String(item.songId) || (curTrack.name && curTrack.name === item.name)))}
                  <tr class="hover:bg-[var(--card-header-hover)] transition-colors group {isPlayingThis ? 'bg-red-500/10' : ''}">
                    <td class="py-2.5 pl-4 text-[var(--text-muted)] font-mono text-[11px]">
                      {#if isPlayingThis && playing}
                        <span class="text-red-500 animate-pulse">▶</span>
                      {:else}
                        {idx}
                      {/if}
                    </td>
                    <td class="py-2.5 px-3 min-w-0">
                      <div class="flex flex-col gap-0.5">
                        <span class="font-semibold text-[var(--text-main)] truncate max-w-xs group-hover:text-red-400 transition-colors">
                          {item.name || item.title || '未知歌曲'}
                        </span>
                        {#if artist}
                          <span class="text-[11px] text-[var(--text-muted)] truncate">{artist}</span>
                        {/if}
                      </div>
                    </td>
                    <td class="py-2.5 px-3 text-[var(--text-secondary)] whitespace-nowrap">
                      <span>{item.fileSize ? formatBytes(item.fileSize) : '-'}</span>
                      {#if item.format}
                        <span class="ml-1 text-[10px] text-red-400/80 font-mono uppercase">.{item.format}</span>
                      {/if}
                    </td>
                    <td class="py-2.5 px-3 text-[var(--text-muted)] font-mono text-[11px] truncate max-w-[200px] hidden md:table-cell" title={item.path || ''}>
                      {item.path || '默认音乐目录'}
                    </td>
                    <td class="py-2.5 pr-4 text-right whitespace-nowrap">
                      <div class="inline-flex items-center justify-end gap-1.5">
                        <SlotBtn
                          playing={isPlayingThis && playing}
                          onclick={() => onPlayQueue([{ id: item.songId || item.id, name: item.name, artist, cover: item.cover || DEFAULT_VINYL_COVER, isLocal: true }])}
                        >
                          {isPlayingThis && playing ? '⏸ 暂停' : '▶ 本地'}
                        </SlotBtn>
                        <SlotBtn onclick={() => onReveal({ id: item.songId || item.id, name: item.name, artist, path: item.path })}>
                          📂 定位
                        </SlotBtn>
                        <button
                          type="button"
                          class="p-1 rounded-md text-[var(--text-muted)] hover:text-red-400 cursor-pointer border-none bg-transparent transition-colors"
                          onclick={() => handleDeleteHistory(item)}
                          title="从记录中移除"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>

        <!-- 翻页控制 -->
        <div class="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)] bg-[var(--card-bg)]">
          <button
            type="button"
            class="btn-secondary px-3 py-1 text-xs rounded-lg cursor-pointer"
            disabled={histPage <= 1}
            onclick={() => loadHistory(histPage - 1)}
          >
            上一页
          </button>
          <span class="text-xs text-[var(--text-secondary)]">
            第 <strong class="text-[var(--text-main)]">{histPage}</strong> / {histTotalPages} 页 (共 {histTotal} 首)
          </span>
          <button
            type="button"
            class="btn-secondary px-3 py-1 text-xs rounded-lg cursor-pointer"
            disabled={histPage >= histTotalPages}
            onclick={() => loadHistory(histPage + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    {:else}
      <!-- 离线浏览器缓存直接平铺 -->
      <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] p-4 shadow-sm">
        <BrowserCacheSection {onPlayQueue} {showToast} />
      </div>
    {/if}
  </div>
</div>

<style>
  .custom-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scroll::-webkit-scrollbar-thumb {
    background: var(--border-color, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
  }
</style>
