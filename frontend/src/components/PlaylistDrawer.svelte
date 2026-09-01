<script lang="ts">
  import type { Track } from '../lib/types';
  import { formatArtist } from '../lib/utils';
  import TaskStatusBadge from './TaskStatusBadge.svelte';

  let {
    queue = [],
    qIndex = 0,
    tasks = [],
    likedSet = new Set<number>(),
    autoSkipTrial = true,
    offlineOnly = false,
    downloadedSet = new Set<number>(),
    onPlayIndex,
    onClearQueue,
    onRemoveItem,
    onToggleLike,
    onToggleAutoSkip,
    onToggleOfflineOnly,
    onClearTasks,
    onReveal,
    onClose
  } = $props<{
    queue: Track[];
    qIndex: number;
    tasks: any[];
    likedSet: Set<number>;
    autoSkipTrial: boolean;
    offlineOnly: boolean;
    downloadedSet: Set<number>;
    onPlayIndex: (index: number) => void;
    onClearQueue: () => void;
    onRemoveItem: (index: number) => void;
    onToggleLike: (id: number, name: string) => void;
    onToggleAutoSkip: (val: boolean) => void;
    onToggleOfflineOnly: (val: boolean) => void;
    onClearTasks: () => void;
    onReveal: (item: any) => void;
    onClose: () => void;
  }>();

  let activeTab: 'queue' | 'tasks' = $state('queue');
  let filterText = $state('');
  let filterType: 'all' | 'ready' | 'server' = $state('all');

  // 计算过滤后的队列
  let filteredQueueWithIndex = $derived.by(() => {
    return queue.map((t: Track, realIdx: number) => ({ t, realIdx })).filter(({ t }: { t: Track }) => {
      const isServer = (downloadedSet && downloadedSet.has(Number(t.id))) || t.isLocal === true;
      if (filterType === 'server' && !isServer) return false;
      if (filterType === 'ready' && !isServer) return false;
      if (filterText.trim()) {
        const kw = filterText.toLowerCase();
        const nameMatch = (t.name || '').toLowerCase().includes(kw);
        const artistMatch = (t.artist || '').toLowerCase().includes(kw);
        if (!nameMatch && !artistMatch) return false;
      }
      return true;
    });
  });

  // 统计数
  let countAll = $derived(queue.length);
  let countServer = $derived(queue.filter((t: Track) => (downloadedSet && downloadedSet.has(Number(t.id))) || t.isLocal === true).length);
  let activeTasksCount = $derived(tasks.filter((t: any) => t.status !== 'SUCCESS' && t.status !== 'FAILED').length);
</script>

<!-- 📜 播放列表 & 下载任务 Drawer 统一抽屉 (SP 底部滑出 Bottom Sheet / PC 右下弹窗) -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="playlist-drawer-overlay" onclick={onClose}>
  <div class="playlist-drawer" onclick={(e) => e.stopPropagation()}>
    <!-- 抽屉头部 -->
    <div class="playlist-drawer-header">
      <div class="drawer-header-tabs">
        <button
          class="drawer-main-tab"
          class:active={activeTab === 'queue'}
          onclick={() => activeTab = 'queue'}
        >
          📜 播放队列 ({countAll})
        </button>
        <button
          class="drawer-main-tab"
          class:active={activeTab === 'tasks'}
          onclick={() => activeTab = 'tasks'}
        >
          📥 下载任务
          {#if tasks.length > 0}
            <span class="drawer-badge-pill">{tasks.length}</span>
          {/if}
        </button>
      </div>
      <div style="display:flex; gap:6px; align-items:center;">
        <button
          class="drawer-header-btn"
          onclick={() => {
            if (activeTab === 'queue') onClearQueue();
            else onClearTasks();
          }}
          title="清空列表"
        >
          🗑️ 清空
        </button>
        <button class="drawer-header-btn" onclick={onClose} title="关闭抽屉">✕</button>
      </div>
    </div>

    <!-- 1. 播放队列视图 -->
    {#if activeTab === 'queue'}
      <div class="drawer-view-panel" style="display:flex; flex-direction:column; flex:1; min-height:0; overflow:hidden;">
        <!-- 🔍 队列内搜索与快速过滤栏 -->
        <div class="playlist-drawer-filter-bar">
          <div class="drawer-search-wrap">
            <input
              type="text"
              class="drawer-search-input"
              placeholder="🔍 筛选当前列表 (歌名 / 歌手)..."
              bind:value={filterText}
            />
            {#if filterText}
              <button class="drawer-search-clear-btn" onclick={() => filterText = ''}>✕</button>
            {/if}
          </div>

          <!-- 🏷️ 筛选 Tab 按钮组 -->
          <div class="drawer-filter-tabs" style="display:flex; gap:4px;">
            <button
              class="drawer-tab-btn"
              class:active={filterType === 'all'}
              onclick={() => filterType = 'all'}
            >
              全部 {countAll}
            </button>
            <button
              class="drawer-tab-btn"
              class:active={filterType === 'ready'}
              onclick={() => filterType = 'ready'}
              title="本地就绪曲目"
            >
              ✨ 离线就绪 {countServer}
            </button>
            <button
              class="drawer-tab-btn"
              class:active={filterType === 'server'}
              onclick={() => filterType = 'server'}
              title="已存在服务器磁盘"
            >
              🖥️ 本地 {countServer}
            </button>
          </div>

          <!-- ⚙️ 智能跳过与播放策略开关 -->
          <div class="drawer-switches-row" style="display:flex; gap:12px; font-size:11px; color:var(--text-secondary);">
            <label class="drawer-switch-label" style="display:flex; align-items:center; gap:4px; cursor:pointer;" title="播放遇到 30 秒试听曲目时，自动跳过并播放下一首完整歌曲">
              <input
                type="checkbox"
                checked={autoSkipTrial}
                onchange={(e) => onToggleAutoSkip((e.currentTarget as HTMLInputElement).checked)}
              />
              <span>🛡️ 自动跳过试听</span>
            </label>
            <label class="drawer-switch-label" style="display:flex; align-items:center; gap:4px; cursor:pointer;" title="仅播放服务器已下载的歌曲">
              <input
                type="checkbox"
                checked={offlineOnly}
                onchange={(e) => onToggleOfflineOnly((e.currentTarget as HTMLInputElement).checked)}
              />
              <span>📴 纯离线模式</span>
            </label>
          </div>
        </div>

        <!-- 队列曲目列表 -->
        <div class="playlist-drawer-body" style="flex:1; overflow-y:auto; padding:4px 8px;">
          <ul class="data-list scrollable-list" style="margin:0; padding:0;">
            {#each filteredQueueWithIndex as { t, realIdx }}
              {@const isServer = (downloadedSet && downloadedSet.has(Number(t.id))) || t.isLocal === true}
              <li
                class="track-item-card"
                class:is-active-playing={realIdx === qIndex}
                style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; cursor:pointer;"
                onclick={() => onPlayIndex(realIdx)}
              >
                <div style="flex:1; overflow:hidden; display:flex; align-items:center; gap:6px;">
                  <span class="clickable-track-title" style="font-size:13px;">
                    {realIdx + 1}. {t.name}
                  </span>
                  {#if formatArtist(t.artist)}
                    <span style="color:var(--text-muted); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      - {formatArtist(t.artist)}
                    </span>
                  {/if}
                  {#if isServer}
                    <span class="audio-source-badge icon-only badge-server" title="🖥️ 本地已下载">🖥️</span>
                  {/if}
                  {#if realIdx === qIndex}
                    <span style="color:var(--playing-color, #059669); font-size:11px; font-weight:600; margin-left:4px;">▶ 播放中</span>
                  {/if}
                </div>
                <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                  <button
                    class="drawer-like-btn"
                    style="background:none; border:none; cursor:pointer; font-size:13px;"
                    onclick={(e) => { e.stopPropagation(); onToggleLike(Number(t.id), t.name); }}
                  >
                    {likedSet.has(Number(t.id)) ? '❤️' : '🤍'}
                  </button>
                  <button
                    class="drawer-item-del-btn"
                    style="background:none; border:none; cursor:pointer; font-size:12px; color:var(--text-muted);"
                    onclick={(e) => { e.stopPropagation(); onRemoveItem(realIdx); }}
                  >
                    ✕
                  </button>
                </div>
              </li>
            {:else}
              <li style="padding:28px 16px; text-align:center; color:var(--text-muted); font-size:13px; list-style:none;">
                {filterText ? '未找到匹配曲目' : '播放队列为空，请先在歌单或搜索中点播歌曲'}
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {:else}
      <!-- 2. 后台下载任务视图 -->
      <div class="drawer-view-panel" style="display:flex; flex-direction:column; flex:1; min-height:0; overflow:hidden;">
        <div class="playlist-drawer-body" style="flex:1; overflow-y:auto; padding:10px;">
          <div class="flex flex-col gap-1.5">
            {#each tasks as t}
              <div class="flex justify-between items-center px-2.5 py-2 border-b border-[var(--border-subtle)] gap-2">
                <div class="flex-1 min-w-0">
                  <span class="truncate block text-[13px] text-[var(--text-main)]">
                    {t.name || t.id}
                  </span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  {#if t.status === 'SUCCESS'}
                    <button
                      type="button"
                      class="btn-primary px-2 py-0.5 text-[11px] rounded"
                      onclick={() => onReveal(t)}
                      title="在系统文件管理器中定位真实物理路径"
                    >
                      📂 定位
                    </button>
                  {/if}
                  <TaskStatusBadge status={t.status} />
                </div>
              </div>
            {:else}
              <div class="py-8 px-4 text-center text-[var(--text-muted)] text-[13px]">暂无下载任务</div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
