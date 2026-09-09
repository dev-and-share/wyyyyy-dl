<script lang="ts">
  import type { Track } from '../lib/types';
  import { formatArtist } from '../lib/utils';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast.svelte';
  import TaskQueueView from './TaskQueueView.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';
  import TrackSourceBadge from './TrackSourceBadge.svelte';
  import { getTrackSourceStatus, markSongDownloaded } from '../lib/trackStatus.svelte';

  let {
    queue = [],
    qIndex = 0,
    tasks = [],
    likedSet = new Set<number>(),
    autoSkipTrial = true,
    serverOnly = false,
    offlineOnly = false,
    downloadedSet = new Set<number>(),
    onPlayIndex,
    onClearQueue,
    onRemoveItem,
    onToggleLike,
    onToggleAutoSkip,
    onToggleServerOnly,
    onToggleOfflineOnly,
    onClearTasks,
    onShuffle = () => {},
    onReveal,
    onClose
  } = $props<{
    queue: Track[];
    qIndex: number;
    tasks: any[];
    likedSet: Set<number>;
    autoSkipTrial: boolean;
    serverOnly: boolean;
    offlineOnly: boolean;
    downloadedSet: Set<number>;
    onPlayIndex: (index: number) => void;
    onClearQueue: () => void;
    onRemoveItem: (index: number) => void;
    onToggleLike: (id: number, name: string) => void;
    onToggleAutoSkip: (val: boolean) => void;
    onToggleServerOnly: (val: boolean) => void;
    onToggleOfflineOnly: (val: boolean) => void;
    onClearTasks: () => void;
    onShuffle?: () => void;
    onReveal: (item: any) => void;
    onClose: () => void;
  }>();

  let activeTab: 'queue' | 'tasks' = $state('queue');
  let filterText = $state('');
  let pendingOnly = $state(false);
  let downloadingIds = $state(new Set<string>());

  // 计算过滤后的队列
  let filteredQueueWithIndex = $derived.by(() => {
    return queue.map((t: Track, realIdx: number) => ({ t, realIdx })).filter(({ t }: { t: Track }) => {
      const status = getTrackSourceStatus(t.id, t.isLocal, queue[qIndex]);
      // 范围筛选：仅播服务器已下载
      if (serverOnly && !status.isServer) return false;
      // 范围筛选：纯离线模式 (手机零流量，仅手机本地已缓存)
      if (offlineOnly && !status.isPhone) return false;
      // 搜集癖筛选：仅看待下载到服务器磁盘的曲目
      if (pendingOnly && status.isServer) return false;

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
  let countServer = $derived(queue.filter((t: Track) => getTrackSourceStatus(t.id, t.isLocal, queue[qIndex]).isServer).length);
  let countPhone = $derived(queue.filter((t: Track) => getTrackSourceStatus(t.id, t.isLocal, queue[qIndex]).isPhone).length);
  let countPending = $derived(queue.filter((t: Track) => !getTrackSourceStatus(t.id, t.isLocal, queue[qIndex]).isServer).length);
  let displayedCount = $derived(filteredQueueWithIndex.length);

  async function handleDownloadSingle(e: MouseEvent, track: Track) {
    e.stopPropagation();
    const idStr = String(track.id);
    if (downloadingIds.has(idStr)) return;

    downloadingIds = new Set([...downloadingIds, idStr]);
    try {
      const res = await api.downloadSingle(idStr);
      const task = res?.data;
      if (task?.status === 'SKIP') {
        const msg = task.errorMsg || '';
        if (msg.includes('已存在') || msg.includes('磁盘中')) {
          markSongDownloaded(track.id);
          showToast(`《${track.name}》已存在于本地磁盘，已同步状态`, 'info', 3000);
        } else {
          showToast(`已跳过《${track.name}》: ${msg || '试听片段或已存在'}`, 'warning', 3000);
        }
      } else if (task?.status === 'FAILED') {
        showToast(`下载失败《${track.name}》: ${task.errorMsg || '无法下载'}`, 'error', 3000);
      } else {
        showToast(`已提交下载: 《${track.name}》`, 'info', 2000);
      }
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (err: any) {
      showToast('下载异常: ' + (err?.message || err), 'error', 3000);
    } finally {
      const nextSet = new Set(downloadingIds);
      nextSet.delete(idStr);
      downloadingIds = nextSet;
    }
  }

  async function handleDownloadAllPending() {
    const pendingTracks = queue.filter((t: Track) => !getTrackSourceStatus(t.id, t.isLocal, queue[qIndex]).isServer);
    if (!pendingTracks.length) return;
    showToast(`正在批量提交 ${pendingTracks.length} 首待下载歌曲...`, 'info', 2000);
    const newIds = new Set(downloadingIds);
    for (const t of pendingTracks) {
      newIds.add(String(t.id));
    }
    downloadingIds = newIds;

    for (const t of pendingTracks) {
      api.downloadSingle(String(t.id)).then((res) => {
        const msg = res?.data?.errorMsg || '';
        if (res?.data?.status === 'SKIP' && (msg.includes('已存在') || msg.includes('磁盘中'))) {
          markSongDownloaded(t.id);
        }
      }).catch(() => {}).finally(() => {
        const nextSet = new Set(downloadingIds);
        nextSet.delete(String(t.id));
        downloadingIds = nextSet;
      });
    }
    window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    showToast(`已将 ${pendingTracks.length} 首待下载歌曲加入后台队列`, 'success', 2500);
  }

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

  // 📱 移动端防滚动穿透：抽屉打开时锁定外部页面滚动
  $effect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  });

  // 🎯 自动聚焦/滚动到当前正在播放的曲目
  function scrollActiveTrack(node: HTMLElement, active: boolean) {
    if (active) {
      setTimeout(() => {
        if (typeof node.scrollIntoView === 'function') {
          node.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
      }, 60);
    }
    return {
      update(newActive: boolean) {
        if (newActive && typeof node.scrollIntoView === 'function') {
          node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    };
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
      if (e.cancelable) e.preventDefault();
    } else {
      dragOffset = 0;
    }
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (dragOffset > 75) {
      dragOffset = 600;
      closing = true;
      setTimeout(() => {
        closing = false;
        dragOffset = 0;
        onClose();
      }, 200);
    } else {
      dragOffset = 0;
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && handleClose()} />

<!-- 📜 播放列表 & 下载任务 Drawer 统一抽屉 (SP 底部滑出 Bottom Sheet / PC 右下弹窗) -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10002] flex items-end justify-center md:justify-end md:items-end box-border overscroll-none touch-none {closing ? 'animate-[modalFadeIn_0.2s_ease-out_reverse]' : 'animate-[modalFadeIn_0.2s_ease-out]'}"
  onclick={handleClose}
  ontouchmove={(e) => { if (e.target === e.currentTarget && e.cancelable) e.preventDefault(); }}
>
  <div
    data-testid="playlist-drawer"
    class="w-full max-md:max-w-full max-md:h-[75vh] max-md:max-h-[85vh] max-md:rounded-t-[20px] max-md:rounded-b-none max-md:pb-[calc(12px+env(safe-area-inset-bottom,0px))] md:w-[420px] md:h-[530px] md:max-w-[calc(100vw-30px)] md:max-h-[calc(100vh-100px)] md:mr-5 md:mb-[75px] md:rounded-2xl bg-[var(--card-bg-solid,#111827)]/95 backdrop-blur-2xl border border-[var(--border-color,rgba(255,255,255,0.12))] shadow-2xl flex flex-col overflow-hidden text-[var(--text-main)] box-border overscroll-contain {closing && dragOffset === 0 ? 'max-md:animate-[drawerSlideDownSP_0.2s_ease-in] md:animate-[drawerSlideDownPC_0.2s_ease-in]' : 'max-md:animate-[drawerSlideUpSP_0.25s_cubic-bezier(0.16,1,0.3,1)] md:animate-[drawerSlideUpPC_0.25s_cubic-bezier(0.16,1,0.3,1)]'}"
    style={dragOffset > 0 ? `transform: translateY(${dragOffset}px); transition: ${isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)'};` : ''}
    onclick={(e) => e.stopPropagation()}
  >
    <!-- 移动端手势拖拽指示条 -->
    <div
      class="w-full pt-2.5 pb-1 flex justify-center md:hidden cursor-grab active:cursor-grabbing shrink-0 select-none touch-none"
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
    >
      <div class="w-9 h-1 rounded-full bg-black/20 dark:bg-white/25"></div>
    </div>

    <!-- 抽屉头部 (四个角弧形胶囊设计) -->
    <div
      class="mx-3 my-1.5 px-2.5 py-1.5 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] flex justify-between items-center shrink-0 select-none"
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
    >
      <div class="flex items-center gap-1 sm:gap-1.5 min-w-0">
        <button
          type="button"
          class="px-2 sm:px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer {activeTab === 'queue' ? 'bg-black/10 dark:bg-white/15 text-[var(--text-main)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5'}"
          onclick={() => activeTab = 'queue'}
        >
          📜 <span class="hidden sm:inline">播放</span>队列 {displayedCount < countAll ? `(${displayedCount}/${countAll})` : `(${countAll})`}
        </button>
        <button
          type="button"
          class="px-2 sm:px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-1 {activeTab === 'tasks' ? 'bg-black/10 dark:bg-white/15 text-[var(--text-main)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5'}"
          onclick={() => activeTab = 'tasks'}
        >
          📥 <span class="hidden sm:inline">下载</span>任务
          {#if tasks.length > 0}
            <span class="bg-red-500 text-white text-[10px] font-bold px-1.5 py-px rounded-full leading-tight">
              {tasks.length}
            </span>
          {/if}
        </button>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        {#if activeTab === 'queue' && queue.length > 1}
          <button
            type="button"
            class="px-1.5 sm:px-2 py-1 rounded-lg text-xs text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 active:scale-95 whitespace-nowrap shrink-0 transition-all cursor-pointer font-medium"
            onclick={() => {
              onShuffle();
              showToast('🎲 已随机洗牌！当前曲目置顶，后续顺序播放', 'info', 2000);
            }}
            title="WYSIWYG 洗牌：当前歌曲置顶，剩余曲目随机重排"
          >
            🎲 洗牌
          </button>
        {/if}
        <button
          type="button"
          class="px-1.5 sm:px-2 py-1 rounded-lg text-xs text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 active:scale-95 whitespace-nowrap shrink-0 transition-all cursor-pointer"
          onclick={() => {
            if (activeTab === 'queue') onClearQueue();
            else onClearTasks();
          }}
          title={activeTab === 'queue' ? '清空播放队列' : '清空下载历史任务'}
        >
          清空
        </button>
        <!-- 💻 PC 桌面端保留 X 按钮；📱 SP 移动端去除 X 按钮（靠遮罩层点击与下拉手势关闭） -->
        <button
          type="button"
          class="hidden md:flex w-7 h-7 rounded-lg items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer text-sm"
          onclick={handleClose}
          title="关闭"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- 选项卡内容区 -->
    {#if activeTab === 'queue'}
      <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
        <!-- 队列专属工具栏 -->
        <div class="px-3.5 py-2 border-b border-[var(--border-subtle,rgba(255,255,255,0.08))] flex flex-col gap-1.5 shrink-0 bg-black/[0.02] dark:bg-white/[0.01]">
          <!-- 搜索过滤输入框 -->
          <div class="relative flex items-center">
            <span class="absolute left-2.5 text-xs text-[var(--text-muted)] pointer-events-none">🔍</span>
            <input
              type="text"
              placeholder="搜索当前队列歌曲 / 歌手..."
              bind:value={filterText}
              class="w-full bg-black/5 dark:bg-white/5 border border-[var(--border-subtle,rgba(255,255,255,0.1))] rounded-lg pl-7 pr-7 py-1 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-colors"
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

          <!-- 🏷️ 播放范围 Tab + 🛡️ 跳过试听策略 -->
          <div class="flex items-center justify-between gap-2 text-[11px] select-none pt-0.5">
            <!-- 左侧：播放范围 Tab 切换 -->
            <div class="flex items-center gap-1.5 min-w-0 overflow-x-auto py-0.5">
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap {!serverOnly && !offlineOnly && !pendingOnly ? 'bg-blue-500/15 text-blue-500 dark:text-blue-400 border border-blue-500/30 font-semibold shadow-sm' : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'}"
                onclick={() => { pendingOnly = false; onToggleServerOnly(false); onToggleOfflineOnly(false); }}
                title="浏览并播放当前队列全部歌曲"
              >
                全部 {countAll}
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap {serverOnly ? 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 border border-indigo-500/30 font-semibold shadow-sm' : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'}"
                onclick={() => { pendingOnly = false; onToggleServerOnly(!serverOnly); }}
                title="仅播已下载到服务器磁盘的曲目（💻）"
              >
                💻 服务器 {countServer}
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap {offlineOnly ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold shadow-sm' : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'}"
                onclick={() => { pendingOnly = false; onToggleOfflineOnly(!offlineOnly); }}
                title="手机纯离线模式（仅播手机浏览器本地缓存，绝不消耗手机流量）"
              >
                📴 纯离线 {countPhone}
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap {pendingOnly ? 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30 font-semibold shadow-sm' : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'}"
                onclick={() => {
                  pendingOnly = !pendingOnly;
                  if (pendingOnly) {
                    onToggleServerOnly(false);
                    onToggleOfflineOnly(false);
                  }
                }}
                title="搜集癖专区：仅展示尚未下载到服务器磁盘的歌曲"
              >
                待下载 {countPending}
              </button>
            </div>

            <!-- 右侧：通用跳过试听策略开关 -->
            <label class="flex items-center gap-1.5 cursor-pointer shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors pl-1" title="遇到 30 秒试听曲目自动切下一首完整歌曲">
              <input
                type="checkbox"
                checked={autoSkipTrial}
                onchange={(e) => onToggleAutoSkip((e.currentTarget as HTMLInputElement).checked)}
                class="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
              />
              <span class="whitespace-nowrap {autoSkipTrial ? 'font-medium text-[var(--text-main)]' : ''}">跳过试听</span>
            </label>
          </div>
        </div>

        <!-- 搜集癖待下载提示与一键批量补齐横幅 -->
        {#if pendingOnly && countPending > 0}
          <div class="px-3 py-1.5 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between text-xs text-rose-600 dark:text-rose-300 shrink-0">
            <span class="truncate pr-2">💡 搜集癖专区：发现 <strong>{countPending}</strong> 首待下载</span>
            <button
              type="button"
              class="px-2.5 py-0.5 rounded-lg bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-medium text-[11px] cursor-pointer transition-all shadow-xs shrink-0"
              onclick={handleDownloadAllPending}
              title="一键将所有待下载歌曲提交到服务器后台任务"
            >
              ⬇️ 批量补齐下载
            </button>
          </div>
        {/if}

        <!-- 队列曲目列表 (隔离移动端手势与滚动链) -->
        <div
          class="flex-1 overflow-y-auto overscroll-contain p-1.5 custom-table-scroll"
          style="-webkit-overflow-scrolling: touch; touch-action: pan-y;"
        >
          <ul class="divide-y divide-black/5 dark:divide-white/5 m-0 p-0 list-none">
            {#each filteredQueueWithIndex as { t, realIdx }}
              {@const status = getTrackSourceStatus(t.id, t.isLocal, queue[qIndex])}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <li
                use:scrollActiveTrack={realIdx === qIndex}
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
                  <TrackSourceBadge id={t.id} isLocal={t.isLocal} curTrack={queue[qIndex]} />
                  {#if !status.isServer}
                    <button
                      type="button"
                      class="inline-flex items-center justify-center w-5 h-5 rounded-md bg-blue-500/15 hover:bg-blue-500/25 active:scale-95 text-blue-500 dark:text-blue-400 border border-blue-500/30 text-[10px] shrink-0 transition-all cursor-pointer shadow-2xs {downloadingIds.has(String(t.id)) ? 'animate-pulse' : ''}"
                      onclick={(e) => handleDownloadSingle(e, t)}
                      title="快速下载到服务器磁盘"
                    >
                      {#if downloadingIds.has(String(t.id))}
                        <span class="animate-spin inline-block text-[9px]">⏳</span>
                      {:else}
                        <span>⬇️</span>
                      {/if}
                    </button>
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
                {pendingOnly ? '🎉 太棒了！当前播放列表的所有歌曲已全部下载到服务器！' : (filterText ? '未找到匹配曲目' : '播放队列为空，请先在歌单或搜索中点播歌曲')}
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {:else}
      <!-- 2. 后台下载任务视图 (已抽离为独立子组件 TaskQueueView) -->
      <TaskQueueView {tasks} {onReveal} />
    {/if}
  </div>
</div>
