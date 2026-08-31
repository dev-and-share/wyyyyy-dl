<script lang="ts">
  import type { Track } from '../lib/types';

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
    return queue.map((t, realIdx) => ({ t, realIdx })).filter(({ t }) => {
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
  let countServer = $derived(queue.filter(t => (downloadedSet && downloadedSet.has(Number(t.id))) || t.isLocal === true).length);
  let activeTasksCount = $derived(tasks.filter(t => t.status !== 'SUCCESS' && t.status !== 'FAILED').length);
</script>

<!-- 📜 播放列表 & 下载任务 Drawer 统一抽屉 (对齐旧版) -->
<div class="playlist-drawer" style="display:flex;">
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
              style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; cursor:pointer; background:{realIdx === qIndex ? 'rgba(56,189,248,0.1)' : 'transparent'};"
              onclick={() => onPlayIndex(realIdx)}
            >
              <div style="flex:1; overflow:hidden; display:flex; align-items:center; gap:6px;">
                <span style="font-weight:{realIdx === qIndex ? 700 : 500}; color:{realIdx === qIndex ? '#38bdf8' : 'inherit'}; font-size:13px;">
                  {realIdx + 1}. {t.name}
                </span>
                <span style="color:var(--text-muted); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  - {t.artist}
                </span>
                {#if isServer}
                  <span class="audio-source-badge icon-only badge-server" title="🖥️ 本地已下载">🖥️</span>
                {/if}
                {#if realIdx === qIndex}
                  <span style="color:#38bdf8; font-size:11px; margin-left:4px;">▶ 播放中</span>
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
            <li style="padding:32px 16px; text-align:center; color:var(--text-muted); font-size:13px;">
              {queue.length === 0 ? '暂无播放曲目' : '无匹配筛选结果'}
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {:else}
    <!-- 2. 下载任务视图 -->
    <div class="drawer-view-panel" style="display:flex; flex-direction:column; flex:1; min-height:0; overflow:hidden;">
      <div class="playlist-drawer-body" style="flex:1; overflow-y:auto; padding:10px;">
        <div class="monitor-task-list">
          {#each tasks as t}
            <div class="monitor-task-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.06); gap:8px;">
              <div class="task-info" style="flex:1; min-width:0;">
                <span class="task-name" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; font-size:13px;">
                  {t.name || t.id}
                </span>
              </div>
              <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                {#if t.status === 'SUCCESS'}
                  <button
                    class="btn-primary"
                    style="padding:2px 8px; font-size:11px; background:linear-gradient(135deg,#06b6d4,#0891b2); border-radius:4px;"
                    onclick={() => onReveal(t)}
                    title="在系统文件管理器中定位真实物理路径"
                  >
                    📂 定位
                  </button>
                {/if}
                <span class="badge badge-{String(t.status).toLowerCase()}">{t.status}</span>
              </div>
            </div>
          {:else}
            <div style="padding:32px 16px; text-align:center; color:var(--text-muted); font-size:13px;">暂无下载任务</div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
