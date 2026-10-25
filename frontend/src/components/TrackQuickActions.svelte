<script lang="ts">
  import { api } from '../lib/api';
  import PlayerIcon from './PlayerIcon.svelte';

  let {
    track,
    isLiked,
    layout = 'row',
    onToggleLike,
    onOpenComments,
    onAddToPlaylist
  } = $props<{
    track: any;
    isLiked: boolean;
    layout?: 'row' | 'col';
    onToggleLike: () => void;
    onOpenComments: () => void;
    onAddToPlaylist: () => void;
  }>();

  let redCount = $state<number | null>(null);
  let commentCount = $state<number | null>(null);
  let statsLoading = $state(false);
  let lastStatsTrackId = -1;

  let hasValidId = $derived(Boolean(track?.id && Number(track.id) > 0));

  function formatBadgeCount(cnt: number) {
    if (cnt >= 100000) return (cnt / 10000).toFixed(0) + 'w';
    if (cnt >= 10000) return (cnt / 10000).toFixed(1) + 'w';
    if (cnt >= 1000) return (cnt / 1000).toFixed(1) + 'k';
    return String(cnt);
  }

  // 模块级缓存避免同一 trackId 并发多实例重复请求
  const statsCache = new Map<number, Promise<{ redCount: number | null; commentCount: number | null }>>();

  $effect(() => {
    const tId = Number(track?.id);
    if (tId && tId > 0 && tId !== lastStatsTrackId) {
      lastStatsTrackId = tId;
      statsLoading = true;
      redCount = null;
      commentCount = null;

      let req = statsCache.get(tId);
      if (!req) {
        req = api.songStats(tId).then((res) => {
          let rCnt: number | null = null;
          let cCnt: number | null = null;
          if (res?.code === '000000' && res.data) {
            if (typeof res.data.redCount === 'number' && res.data.redCount > 0) {
              rCnt = res.data.redCount;
            }
            if (typeof res.data.commentCount === 'number' && res.data.commentCount > 0) {
              cCnt = res.data.commentCount;
            }
          }
          return { redCount: rCnt, commentCount: cCnt };
        }).catch(() => ({ redCount: null, commentCount: null }));
        statsCache.set(tId, req);
      }

      req.then((stats) => {
        if (lastStatsTrackId === tId) {
          statsLoading = false;
          redCount = stats.redCount;
          commentCount = stats.commentCount;
        }
      });
    } else if (!tId || tId <= 0) {
      lastStatsTrackId = -1;
      statsLoading = false;
      redCount = null;
      commentCount = null;
    }
  });
</script>

{#if layout === 'col'}
  <!-- 移动端专属（md:hidden）：竖立排列，大拇指舒适热区 -->
  <div class="flex flex-col items-center gap-2 select-none pointer-events-auto">
    {#if track?.isLocal}
      <span class="audio-source-badge icon-only badge-server shadow-sm" title="🖥️ 本地磁盘">🖥️</span>
    {/if}

    <!-- 喜欢 -->
    <button
      type="button"
      class="flex flex-col items-center justify-center min-w-[42px] h-[46px] px-1 rounded-2xl bg-transparent hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:scale-105 active:scale-92 transition-all cursor-pointer"
      onclick={onToggleLike}
      title={redCount ? `喜欢（${redCount}人收藏）` : '喜欢'}
    >
      <PlayerIcon name="heart" liked={isLiked} size={18} />
      {#if statsLoading}
        <span class="inline-block w-4 h-1.5 rounded-full bg-black/10 dark:bg-white/20 animate-pulse mt-1"></span>
      {:else if redCount !== null && redCount > 0}
        <span class="text-[10px] font-medium {isLiked ? 'text-red-500' : 'text-red-400/90'} select-none tabular-nums mt-0.5 leading-none">
          {formatBadgeCount(redCount)}
        </span>
      {/if}
    </button>

    <!-- 评论 -->
    {#if hasValidId}
      <button
        type="button"
        class="flex flex-col items-center justify-center min-w-[42px] h-[46px] px-1 rounded-2xl bg-transparent hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:scale-105 active:scale-92 transition-all cursor-pointer"
        onclick={onOpenComments}
        title={commentCount ? `查看评论（共 ${commentCount} 条）` : '查看评论'}
      >
        <span class="text-sm leading-none">💬</span>
        {#if statsLoading}
          <span class="inline-block w-4 h-1.5 rounded-full bg-black/10 dark:bg-white/20 animate-pulse mt-1"></span>
        {:else if commentCount !== null && commentCount > 0}
          <span class="text-[10px] font-medium select-none tabular-nums mt-0.5 leading-none">
            {formatBadgeCount(commentCount)}
          </span>
        {/if}
      </button>
    {/if}

    <!-- 收藏到歌单 -->
    <button
      type="button"
      class="w-[42px] h-[42px] rounded-2xl flex items-center justify-center bg-transparent hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-emerald-400 hover:scale-105 active:scale-92 transition-all cursor-pointer"
      onclick={onAddToPlaylist}
      title="收藏到歌单"
    >
      <PlayerIcon name="plus" size={17} />
    </button>
  </div>
{:else}
  <!-- PC 宽屏专属（hidden md:flex）：歌名下方横排 -->
  <div class="flex items-center justify-center gap-2.5 max-w-full">
    {#if track?.isLocal}
      <span class="audio-source-badge icon-only badge-server shadow-none" title="🖥️ 本地磁盘">🖥️</span>
    {/if}

    <!-- 喜欢 -->
    <button
      type="button"
      class="flex items-center justify-center gap-1.5 px-3 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all duration-300 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-main)] {hasValidId ? 'min-w-[72px]' : ''}"
      onclick={onToggleLike}
      title={redCount ? `喜欢（${redCount}人收藏）` : '喜欢'}
    >
      <PlayerIcon name="heart" liked={isLiked} size={17} />
      {#if hasValidId}
        <div class="min-w-[30px] flex items-center justify-center">
          {#if statsLoading}
            <span class="inline-block w-5 h-2 rounded-full bg-black/10 dark:bg-white/20 animate-pulse"></span>
          {:else if redCount !== null && redCount > 0}
            <span class="text-xs font-medium {isLiked ? 'text-red-500' : 'text-red-400/90'} select-none tabular-nums leading-none">
              {formatBadgeCount(redCount)}
            </span>
          {/if}
        </div>
      {/if}
    </button>

    <!-- 评论 -->
    {#if hasValidId}
      <button
        type="button"
        class="flex items-center justify-center gap-1.5 px-3 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all duration-300 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-main)] min-w-[72px]"
        onclick={onOpenComments}
        title={commentCount ? `查看评论（共 ${commentCount} 条）` : '查看评论'}
      >
        <span class="text-xs leading-none">💬</span>
        <div class="min-w-[30px] flex items-center justify-center">
          {#if statsLoading}
            <span class="inline-block w-5 h-2 rounded-full bg-black/10 dark:bg-white/20 animate-pulse"></span>
          {:else if commentCount !== null && commentCount > 0}
            <span class="text-xs font-medium select-none tabular-nums leading-none">
              {formatBadgeCount(commentCount)}
            </span>
          {/if}
        </div>
      </button>
    {/if}

    <!-- 收藏到歌单 -->
    <button
      type="button"
      class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-emerald-400 hover:scale-105 active:scale-95 transition-all cursor-pointer"
      onclick={onAddToPlaylist}
      title="收藏到歌单"
    >
      <PlayerIcon name="plus" size={17} />
    </button>
  </div>
{/if}
