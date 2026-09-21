<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Modal from './Modal.svelte';

  let {
    songId,
    songName = '单曲',
    artist = '',
    totalCount = 0,
    zIndex = 'z-[100030]',
    onClose
  } = $props<{
    songId: string | number;
    songName?: string;
    artist?: string;
    totalCount?: number;
    zIndex?: string;
    onClose: () => void;
  }>();

  let loading = $state(true);
  let loadingMore = $state(false);
  let errorMsg = $state('');
  let hotComments = $state<any[]>([]);
  let comments = $state<any[]>([]);
  let total = $state(0);
  let offset = $state(0);
  const pageSize = 20;

  let hasMore = $derived(comments.length < total);

  function formatTime(ts: number) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isSameYear = d.getFullYear() === now.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return isSameYear ? `${m}-${day} ${h}:${min}` : `${d.getFullYear()}-${m}-${day}`;
  }

  function formatCount(cnt: number) {
    if (!cnt || cnt <= 0) return '0';
    if (cnt > 100000) return (cnt / 10000).toFixed(0) + '万+';
    if (cnt >= 10000) return (cnt / 10000).toFixed(1) + '万';
    return String(cnt);
  }

  async function loadComments(isNext = false) {
    if (!songId) return;
    if (isNext) {
      loadingMore = true;
    } else {
      loading = true;
      errorMsg = '';
    }

    try {
      const curOffset = isNext ? offset + pageSize : 0;
      const res = await api.songComments(songId, curOffset, pageSize);
      if (res?.code === '000000' && res.data) {
        const d = res.data;
        if (typeof d.total === 'number') total = d.total;
        if (!isNext) {
          hotComments = d.hotComments || [];
          comments = d.comments || [];
        } else {
          comments = [...comments, ...(d.comments || [])];
        }
        offset = curOffset;
      } else {
        if (!isNext) errorMsg = res?.msg || '暂无评论或获取评论失败';
      }
    } catch (e: any) {
      if (!isNext) errorMsg = '网络异常: ' + (e.message || e);
    } finally {
      loading = false;
      loadingMore = false;
    }
  }

  onMount(() => {
    loadComments(false);
  });
</script>

<Modal title="歌曲热评与讨论" icon="💬" maxWidth="max-w-[560px]" height="max-sm:h-[85vh] sm:h-[620px]" {zIndex} {onClose}>
  <!-- 顶部曲目摘要卡片 -->
  <div class="flex items-center justify-between p-3 rounded-2xl bg-black/5 dark:bg-white/[0.04] border border-black/5 dark:border-white/10 mb-3.5 shrink-0">
    <div class="flex items-center gap-2.5 min-w-0 pr-2">
      <div class="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center text-sm shrink-0">
        🎵
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-xs font-bold text-[var(--text-main)] truncate" title={songName}>{songName}</div>
        <div class="text-[11px] text-[var(--text-secondary)] truncate">{artist || '未知歌手'}</div>
      </div>
    </div>
    {#if total > 0}
      <span class="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-red-500/15 text-red-500 border border-red-500/20 whitespace-nowrap shrink-0">
        共 {formatCount(total)} 条评论
      </span>
    {/if}
  </div>

  <!-- 评论内容主区域 -->
  {#if loading}
    <div class="py-16 flex flex-col items-center justify-center gap-2.5 text-xs text-[var(--text-muted)]">
      <span class="text-2xl animate-spin">⏳</span>
      <span>正在读取云端评论与热评...</span>
    </div>
  {:else if errorMsg && comments.length === 0 && hotComments.length === 0}
    <div class="py-16 text-center text-xs text-[var(--text-muted)] bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl p-6">
      <span class="text-2xl block mb-2">🍃</span>
      <span>{errorMsg || '暂无评论，快去网易云音乐留下第一条吧~'}</span>
    </div>
  {:else}
    <div class="space-y-4">
      <!-- 1. 精彩热评区域 (仅在第一页且存在热评时展示) -->
      {#if hotComments && hotComments.length > 0}
        <div class="space-y-2.5">
          <div class="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5 px-1">
            <span>🔥 精彩热评</span>
            <span class="text-[10px] text-[var(--text-muted)] font-normal">({hotComments.length})</span>
          </div>
          {#each hotComments as c (c.commentId || c.id)}
            <div class="p-3 rounded-2xl bg-gradient-to-r from-red-500/[0.04] to-transparent border border-red-500/15 dark:border-red-500/20 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0">
                  <img
                    src={c.user?.avatarUrl || '/favicon.png'}
                    alt={c.user?.nickname}
                    referrerpolicy="no-referrer"
                    class="w-6 h-6 rounded-full object-cover border border-black/10 shrink-0"
                    onerror={(e) => { (e.currentTarget as HTMLImageElement).src = '/favicon.png'; }}
                  />
                  <span class="text-xs font-semibold text-[var(--text-main)] truncate max-w-[180px] sm:max-w-[240px]">
                    {c.user?.nickname || '云音乐听友'}
                  </span>
                </div>
                <div class="flex items-center gap-1 text-[11px] text-[var(--text-muted)] shrink-0">
                  <span>👍</span>
                  <span>{formatCount(c.likedCount)}</span>
                </div>
              </div>
              <div class="text-xs text-[var(--text-main)] leading-relaxed whitespace-pre-line pl-8 pr-1 font-normal select-text">
                {c.content}
              </div>
              <div class="pl-8 text-[10px] text-[var(--text-muted)]">
                {formatTime(c.time)}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- 2. 最新评论列表 -->
      <div class="space-y-2.5 pt-1">
        <div class="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5 px-1">
          <span>💬 最新评论</span>
        </div>
        {#each comments as c (c.commentId || c.id)}
          <div class="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/10 flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <img
                  src={c.user?.avatarUrl || '/favicon.png'}
                  alt={c.user?.nickname}
                  referrerpolicy="no-referrer"
                  class="w-6 h-6 rounded-full object-cover border border-black/10 shrink-0"
                  onerror={(e) => { (e.currentTarget as HTMLImageElement).src = '/favicon.png'; }}
                />
                <span class="text-xs font-semibold text-[var(--text-main)] truncate max-w-[180px] sm:max-w-[240px]">
                  {c.user?.nickname || '云音乐听友'}
                </span>
              </div>
              <div class="flex items-center gap-1 text-[11px] text-[var(--text-muted)] shrink-0">
                <span>👍</span>
                <span>{formatCount(c.likedCount)}</span>
              </div>
            </div>
            <div class="text-xs text-[var(--text-main)] leading-relaxed whitespace-pre-line pl-8 pr-1 font-normal select-text">
              {c.content}
            </div>
            <!-- 引用的被回复评论 -->
            {#if c.beReplied && c.beReplied.length > 0 && c.beReplied[0]?.content}
              <div class="ml-8 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 text-[11px] text-[var(--text-secondary)] leading-normal select-text">
                <span class="font-semibold text-[var(--text-main)]">@{c.beReplied[0].user?.nickname}：</span>
                {c.beReplied[0].content}
              </div>
            {/if}
            <div class="pl-8 text-[10px] text-[var(--text-muted)]">
              {formatTime(c.time)}
            </div>
          </div>
        {:else}
          {#if !loading && hotComments.length === 0}
            <div class="py-8 text-center text-xs text-[var(--text-muted)]">
              暂无最新评论
            </div>
          {/if}
        {/each}
      </div>

      <!-- 加载更多 -->
      {#if hasMore}
        <div class="pt-2 pb-4 text-center">
          <button
            type="button"
            class="btn-secondary px-4 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
            disabled={loadingMore}
            onclick={() => loadComments(true)}
          >
            {#if loadingMore}
              <span class="inline-block animate-spin text-xs">⏳</span>
              <span>正在加载更多评论...</span>
            {:else}
              <span>加载更多评论</span>
            {/if}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</Modal>
