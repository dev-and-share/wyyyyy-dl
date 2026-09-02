<script lang="ts">
  import type { Track } from '../lib/types';
  import { formatArtist } from '../lib/utils';
  import TaskStatusBadge from './TaskStatusBadge.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';

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

  // 退出动画与手势下拉状态
  let closing = $state(false);
  let dragOffset = $state(0);
  let isDragging = $state(false);
  let startY = 0;

  function handleClose() {
    if (closing) return;
    closing = true;
    setTimeout(() => { closing = false; onClose(); }, 200);
  }

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      startY = e.touches[0].clientY;
      isDragging = true;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging || closing) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) {
      dragOffset = diff;
    } else {
      dragOffset = 0;
    }
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (dragOffset > 75) {
      // 从当前拖拽位置继续顺畅滑出屏幕，绝不瞬间回弹到 0
      dragOffset = 600;
      closing = true;
      setTimeout(() => {
        closing = false;
        dragOffset = 0;
        onClose();
      }, 200);
    } else {
      // 没达到阈值，平滑弹性回弹归零
      dragOffset = 0;
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && handleClose()} />

<!-- 📜 播放列表 & 下载任务 Drawer 统一抽屉 (SP 底部滑出 Bottom Sheet / PC 右下弹窗) -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10002] flex items-end justify-center md:justify-end md:items-end box-border {closing ? 'animate-[modalFadeIn_0.2s_ease-out_reverse]' : 'animate-[modalFadeIn_0.2s_ease-out]'}"
  onclick={handleClose}
>
  <div
    data-testid="playlist-drawer"
    class="w-full max-md:max-w-full max-md:h-[75vh] max-md:max-h-[85vh] max-md:rounded-t-[20px] max-md:rounded-b-none max-md:pb-[calc(12px+env(safe-area-inset-bottom,0px))] md:w-[420px] md:h-[530px] md:max-w-[calc(100vw-30px)] md:max-h-[calc(100vh-100px)] md:mr-5 md:mb-[75px] md:rounded-2xl bg-[var(--card-bg-solid,#111827)]/95 backdrop-blur-2xl border border-[var(--border-color,rgba(255,255,255,0.12))] shadow-2xl flex flex-col overflow-hidden text-[var(--text-main)] box-border {closing && dragOffset === 0 ? 'max-md:animate-[drawerSlideDownSP_0.2s_ease-in] md:animate-[drawerSlideDownPC_0.2s_ease-in]' : 'max-md:animate-[drawerSlideUpSP_0.25s_cubic-bezier(0.16,1,0.3,1)] md:animate-[drawerSlideUpPC_0.25s_cubic-bezier(0.16,1,0.3,1)]'}"
    style={dragOffset > 0 ? `transform: translateY(${dragOffset}px); transition: ${isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)'};` : ''}
    onclick={(e) => e.stopPropagation()}
  >
    <!-- 移动端手势拖拽指示条 -->
    <div
      class="w-full py-1.5 flex justify-center md:hidden cursor-grab active:cursor-grabbing shrink-0 select-none touch-none"
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
    >
      <div class="w-9 h-1 rounded-full bg-white/25"></div>
    </div>

    <!-- 抽屉头部 (支持移动端下拉手势) -->
    <div
      class="px-3.5 py-2 bg-black/5 dark:bg-white/[0.03] border-b border-[var(--border-subtle,rgba(255,255,255,0.08))] flex justify-between items-center shrink-0 select-none"
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
    >
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer {activeTab === 'queue' ? 'bg-black/10 dark:bg-white/15 text-[var(--text-main)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5'}"
          onclick={() => activeTab = 'queue'}
        >
          📜 播放队列 {offlineOnly ? `(${countServer}/${countAll})` : `(${countAll})`}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 {activeTab === 'tasks' ? 'bg-black/10 dark:bg-white/15 text-[var(--text-main)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5'}"
          onclick={() => activeTab = 'tasks'}
        >
          📥 下载任务
          {#if tasks.length > 0}
            <span class="bg-red-500 text-white text-[10px] font-bold px-1.5 py-px rounded-full leading-tight">
              {tasks.length}
            </span>
          {/if}
        </button>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="px-2.5 py-1 rounded-lg text-xs text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all cursor-pointer"
          onclick={() => {
            if (activeTab === 'queue') onClearQueue();
            else onClearTasks();
          }}
          title="清空列表"
        >
          🗑️ 清空
        </button>
        <button
          type="button"
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          onclick={handleClose}
          title="关闭抽屉"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- 1. 播放队列视图 -->
    {#if activeTab === 'queue'}
      <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
        <!-- 🔍 队列内搜索与快速过滤栏 -->
        <div class="p-3 bg-black/5 dark:bg-white/[0.02] border-b border-[var(--border-subtle,rgba(255,255,255,0.06))] flex flex-col gap-2.5 shrink-0">
          <div class="relative flex items-center">
            <input
              type="text"
              class="w-full pl-3 pr-7 py-1.5 rounded-lg bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-blue-500 transition-all"
              placeholder="🔍 筛选当前列表 (歌名 / 歌手)..."
              bind:value={filterText}
            />
            {#if filterText}
              <button
                type="button"
                class="absolute right-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                onclick={() => filterText = ''}
              >
                ✕
              </button>
            {/if}
          </div>

          <!-- 🏷️ 筛选 Tab 按钮组 -->
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer {filterType === 'all' ? 'bg-blue-500/15 text-blue-500 dark:text-blue-400 border border-blue-500/30 font-semibold' : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'}"
              onclick={() => filterType = 'all'}
            >
              全部 {countAll}
            </button>
            <button
              type="button"
              class="px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer {filterType === 'ready' ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30 font-semibold' : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'}"
              onclick={() => filterType = 'ready'}
              title="本地就绪曲目"
            >
              ✨ 离线就绪 {countServer}
            </button>
            <button
              type="button"
              class="px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer {filterType === 'server' ? 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 border border-indigo-500/30 font-semibold' : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'}"
              onclick={() => filterType = 'server'}
              title="已存在服务器磁盘"
            >
              🖥️ 本地 {countServer}
            </button>
          </div>

          <!-- ⚙️ 智能跳过与播放策略开关 -->
          <div class="flex items-center gap-3.5 text-[11px] text-[var(--text-secondary)] select-none">
            <label class="flex items-center gap-1.5 cursor-pointer" title="播放遇到 30 秒试听曲目时，自动跳过并播放下一首完整歌曲">
              <input
                type="checkbox"
                checked={autoSkipTrial}
                onchange={(e) => onToggleAutoSkip((e.currentTarget as HTMLInputElement).checked)}
                class="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
              />
              <span>🛡️ 自动跳过试听</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer" title="仅播放服务器已下载的歌曲">
              <input
                type="checkbox"
                checked={offlineOnly}
                onchange={(e) => onToggleOfflineOnly((e.currentTarget as HTMLInputElement).checked)}
                class="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
              />
              <span>📴 纯离线模式</span>
            </label>
          </div>
        </div>

        <!-- 队列曲目列表 -->
        <div class="flex-1 overflow-y-auto p-1.5">
          <ul class="divide-y divide-black/5 dark:divide-white/5 m-0 p-0 list-none">
            {#each filteredQueueWithIndex as { t, realIdx }}
              {@const isServer = (downloadedSet && downloadedSet.has(Number(t.id))) || t.isLocal === true}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <li
                class="flex justify-between items-center px-2.5 py-2 rounded-xl transition-all cursor-pointer group {realIdx === qIndex ? 'bg-red-500/10 dark:bg-red-500/15' : 'hover:bg-black/5 dark:hover:bg-white/5'}"
                onclick={() => onPlayIndex(realIdx)}
              >
                <div class="flex-1 overflow-hidden flex items-center gap-1.5 min-w-0 pr-2">
                  <span class="text-xs truncate {realIdx === qIndex ? 'font-bold text-red-500 dark:text-red-400' : 'text-[var(--text-main)]'}">
                    {realIdx + 1}. {t.name}
                  </span>
                  {#if formatArtist(t.artist)}
                    <span class="text-[11px] text-[var(--text-muted)] truncate shrink-0">
                      - {formatArtist(t.artist)}
                    </span>
                  {/if}
                  {#if isServer}
                    <span class="audio-source-badge icon-only badge-server" title="🖥️ 本地已下载">🖥️</span>
                  {/if}
                  {#if realIdx === qIndex}
                    <span class="text-[11px] font-semibold text-emerald-500 shrink-0 ml-1">▶ 播放中</span>
                  {/if}
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <TrackLikeBtn
                    liked={likedSet.has(Number(t.id))}
                    onclick={() => onToggleLike(Number(t.id), t.name)}
                  />
                  <button
                    type="button"
                    class="w-6 h-6 rounded-full flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                    onclick={(e) => { e.stopPropagation(); onRemoveItem(realIdx); }}
                    title="从列表中移除"
                  >
                    ✕
                  </button>
                </div>
              </li>
            {:else}
              <li class="py-8 px-4 text-center text-[var(--text-muted)] text-xs list-none">
                {filterText ? '未找到匹配曲目' : '播放队列为空，请先在歌单或搜索中点播歌曲'}
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {:else}
      <!-- 2. 后台下载任务视图 -->
      <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div class="flex-1 overflow-y-auto p-2.5">
          <div class="flex flex-col gap-1.5">
            {#each tasks as t}
              <div class="flex justify-between items-center px-2.5 py-2 rounded-xl bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 gap-2">
                <div class="flex-1 min-w-0">
                  <span class="truncate block text-xs text-[var(--text-main)] font-medium">
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
              <div class="py-12 px-4 text-center text-[var(--text-muted)] text-xs">暂无下载任务</div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
