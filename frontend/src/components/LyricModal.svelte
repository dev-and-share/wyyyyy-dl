<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { formatArtist, DEFAULT_VINYL_COVER, platform } from '../lib/utils';
  import type { Track } from '../lib/types';
  import { api } from '../lib/api';
  import { parseLrc, type LrcLine } from '../lib/lyricParser';
  import { showToast } from '../lib/toast.svelte';
  import PlayerProgressBar from './PlayerProgressBar.svelte';
  import PlayerIcon from './PlayerIcon.svelte';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte';
  import SongCommentModal from './SongCommentModal.svelte';

  type Lrc = LrcLine;

  let {
    track,
    currentTime,
    duration,
    playing,
    playMode,
    vol = $bindable(0.8),
    isLiked,
    onTogglePlay,
    onPrev,
    onNext,
    onToggleMode,
    onSeek,
    onSeekTime,
    onToggleLike,
    onTogglePeq,
    onToggleDrawer,
    onClose
  } = $props<{
    track: any;
    currentTime: number;
    duration: number;
    playing: boolean;
    playMode: 'list' | 'single' | 'shuffle';
    vol?: number;
    isLiked: boolean;
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    onToggleMode: () => void;
    onSeek: (e: MouseEvent) => void;
    onSeekTime: (time: number) => void;
    onToggleLike: () => void;
    onTogglePeq: () => void;
    onToggleDrawer: () => void;
    onClose: () => void;
  }>();

  let fetchedLyric = $state('');
  let showVolPopup = $state(false);
  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);
  let rawLyricText = $derived(track?.lyric || fetchedLyric || '');
  let redCount = $state<number | null>(null);
  let commentCount = $state<number | null>(null);
  let statsLoading = $state(false);
  let showCommentModal = $state(false);
  let lastStatsTrackId = -1;

  let hasValidId = $derived(Boolean(track?.id && Number(track.id) > 0));

  function formatBadgeCount(cnt: number) {
    if (cnt >= 100000) return (cnt / 10000).toFixed(0) + 'w';
    if (cnt >= 10000) return (cnt / 10000).toFixed(1) + 'w';
    if (cnt >= 1000) return (cnt / 1000).toFixed(1) + 'k';
    return String(cnt);
  }

  // 沉浸模式异步拉取红心数与评论数（只要拥有有效 ID，即便是本地磁盘下载的歌曲也拉取）
  $effect(() => {
    const tId = Number(track?.id);
    if (tId && tId > 0 && tId !== lastStatsTrackId) {
      lastStatsTrackId = tId;
      statsLoading = true;
      redCount = null;
      commentCount = null;
      api.songStats(tId).then((res) => {
        if (lastStatsTrackId === tId) {
          statsLoading = false;
          if (res?.code === '000000' && res.data) {
            if (typeof res.data.redCount === 'number' && res.data.redCount > 0) {
              redCount = res.data.redCount;
            }
            if (typeof res.data.commentCount === 'number' && res.data.commentCount > 0) {
              commentCount = res.data.commentCount;
            }
          }
        }
      }).catch(() => {
        if (lastStatsTrackId === tId) statsLoading = false;
      });
    } else if (!tId || tId <= 0) {
      lastStatsTrackId = -1;
      statsLoading = false;
      redCount = null;
      commentCount = null;
    }
  });

  // 用户手动点击歌词跳转后，暂停自动滚动 3s
  let userSeekedAt = $state(0);
  const AUTO_SCROLL_PAUSE_MS = 3000;

  let lrcs = $derived(parseLrc(rawLyricText));

  // 计算当前高亮行
  let activeIdx = $derived.by(() => {
    let idx = -1;
    for (let i = 0; i < lrcs.length; i++) {
      if (currentTime >= lrcs[i].time) idx = i;
      else break;
    }
    return idx;
  });

  // 歌词自动居中平滑滚动（用户点击跳转后暂停 3s）
  $effect(() => {
    if (activeIdx >= 0) {
      const now = Date.now();
      if (now - userSeekedAt < AUTO_SCROLL_PAUSE_MS) return;
      const el = document.getElementById(`sv-lrc-${activeIdx}`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  // 若 track 缺少歌词，自动异步拉取
  async function loadTrackLyric(t: any) {
    if (!t || t.lyric) return;
    try {
      const j = await api.songV1(String(t.id), 'lossless');
      if (j?.data?.lyric) {
        fetchedLyric = j.data.lyric;
        t.lyric = j.data.lyric;
      }
    } catch {}
  }

  $effect(() => {
    if (track) loadTrackLyric(track);
  });

  onMount(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });
</script>

<div
  class="fixed inset-0 w-screen h-screen z-[100000] overflow-hidden flex flex-col transition-colors duration-300 select-none bg-[image:var(--immersive-bg)] bg-[var(--bg-color)]"
>
  <!-- 顶部标题栏 -->
  <div class="min-h-[calc(54px+env(safe-area-inset-top,0px))] pt-[max(10px,env(safe-area-inset-top,0px))] pb-2.5 px-4 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--immersive-header-bg)] backdrop-blur-md w-full shrink-0">
    <div class="w-9.5 h-9.5 shrink-0 pointer-events-none" aria-hidden="true"></div>
    <h3 class="text-base font-bold text-[var(--text-main)] flex-1 text-center truncate px-2">🎵 全屏沉浸播放</h3>
    <button
      type="button"
      class="w-9.5 h-9.5 rounded-full flex items-center justify-center text-base bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] active:scale-92 transition-all cursor-pointer"
      onclick={onClose}
      title="关闭全屏"
    >
      <PlayerIcon name="close" size={16} />
    </button>
  </div>

  <!-- 中间主体：左侧大黑胶唱片 + 右侧滚动歌词 + 左下角快捷交互栏 -->
  <div class="flex-1 relative flex flex-col md:flex-row overflow-hidden p-3 md:p-10 gap-3 md:gap-10 max-w-[1200px] w-full mx-auto items-center">
    <!-- 移动端专属（md:hidden）：左下角快捷操作栏，大拇指舒适热区，竖立排列消除字宽违和感 -->
    <div class="absolute left-3.5 bottom-3 z-30 flex flex-col items-center gap-2 select-none pointer-events-auto md:hidden">
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
          onclick={() => showCommentModal = true}
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
        onclick={() => {
          if (track) {
            addToPlaylistSong = { id: track.id, name: track.name, artist: formatArtist(track.artist) };
          }
        }}
        title="收藏到歌单"
      >
        <PlayerIcon name="plus" size={17} />
      </button>
    </div>

    <!-- 左侧：大黑胶唱片与歌曲元信息 -->
    <div class="flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[440px] w-full md:w-auto shrink-0">
      <div class="w-[140px] h-[140px] md:w-[220px] md:h-[220px] flex items-center justify-center">
        <div class="w-full h-full rounded-full bg-[var(--immersive-ring-bg)] shadow-[var(--immersive-ring-shadow)] p-1.5 flex items-center justify-center transition-all duration-300">
          <img
            src={track?.cover || DEFAULT_VINYL_COVER}
            class="w-full h-full rounded-full object-cover shadow-inner {playing ? 'animate-[spin_20s_linear_infinite]' : ''}"
            alt="大图封面"
            referrerpolicy="no-referrer"
            onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (img.src !== DEFAULT_VINYL_COVER) img.src = DEFAULT_VINYL_COVER; }}
          />
        </div>
      </div>
      <div class="flex flex-col items-center text-center max-w-[340px] w-full">
        <!-- 歌名 -->
        <h4 class="text-base md:text-lg font-bold text-[var(--text-main)] truncate max-w-full px-2" title={track?.name}>
          {track?.name || '未在播放'}
        </h4>

        <!-- 歌手名 -->
        <div class="text-xs md:text-sm text-[var(--text-secondary)] truncate max-w-full mt-1 px-2" title={formatArtist(track?.artist)}>
          {formatArtist(track?.artist) || '未知歌手'}
        </div>

        <!-- PC 宽屏专属（hidden md:flex）：歌名下方横排，预留充足展位彻底杜绝突然撑大 -->
        <div class="hidden md:flex items-center justify-center gap-2.5 max-w-full mt-3">
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
              onclick={() => showCommentModal = true}
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
            onclick={() => {
              if (track) {
                addToPlaylistSong = { id: track.id, name: track.name, artist: formatArtist(track.artist) };
              }
            }}
            title="收藏到歌单"
          >
            <PlayerIcon name="plus" size={17} />
          </button>
        </div>
      </div>
    </div>

    <!-- 右侧：滚动歌词展示面板 -->
    <div class="flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col justify-center">
      <div
        class="w-full h-full max-h-[540px] overflow-y-auto px-4 py-8 flex flex-col gap-4 text-center scroll-smooth [mask-image:linear-gradient(to_bottom,transparent_0%,black_12%,black_93%,transparent_100%)]"
        id="lyricModalContent"
      >
        {#if lrcs.length > 0}
          {#each lrcs as l, i}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              id="sv-lrc-{i}"
              class="cursor-pointer transition-all duration-300 {i === activeIdx ? 'text-lg md:text-xl font-bold text-red-500 scale-105 drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]' : 'text-sm md:text-base text-[var(--text-muted)] hover:text-[var(--text-main)]'}"
              onclick={() => { userSeekedAt = Date.now(); onSeekTime(l.time); }}
            >
              {l.text}
            </div>
          {/each}
        {:else if rawLyricText}
          {#each rawLyricText.split(/\r?\n/) as lineStr}
            {#if lineStr.trim()}
              <p class="text-sm md:text-base text-[var(--text-muted)] my-1 leading-relaxed">{lineStr}</p>
            {/if}
          {/each}
        {:else}
          <div class="py-16 text-[var(--text-muted)] text-sm">暂无歌词</div>
        {/if}
      </div>
    </div>
  </div>

  <!-- 底部：全屏沉浸播放控制条 -->
  <div class="w-full px-4 md:px-12 py-3 border-t border-[var(--border-subtle)] bg-[var(--immersive-footer-bg)] backdrop-blur-xl flex flex-col items-center gap-2.5 shrink-0">
    <div class="w-full max-w-[680px]">
      <PlayerProgressBar
        curTime={currentTime}
        {duration}
        progressRatio={duration ? (currentTime / duration) : 0}
        {onSeek}
      />
    </div>

    <!-- 控制按键组 -->
    <div class="flex items-center justify-center gap-4 md:gap-6">
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-sm text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onToggleMode}
        title="切换播放模式"
      >
        <PlayerIcon name={playMode === 'single' ? 'repeat-1' : playMode === 'shuffle' ? 'shuffle' : 'repeat'} size={19} />
      </button>
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-sm text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onPrev}
        title="上一首"
      >
        <PlayerIcon name="prev" size={20} />
      </button>
      <button
        type="button"
        class="w-11 h-11 rounded-full flex items-center justify-center text-lg bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        onclick={onTogglePlay}
        title="播放 / 暂停"
      >
        <PlayerIcon name={playing ? 'pause' : 'play'} size={22} />
      </button>
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-sm text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onNext}
        title="下一首"
      >
        <PlayerIcon name="next" size={20} />
      </button>
      {#if platform.canUseAudioProcessing}
        <button
          type="button"
          class="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          onclick={onTogglePeq}
          title="打开均衡器"
        >
          <PlayerIcon name="equalizer" size={19} />
        </button>
      {/if}
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-emerald-400 hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={() => {
          if (track) {
            addToPlaylistSong = { id: track.id, name: track.name, artist: formatArtist(track.artist) };
          }
        }}
        title="收藏当前歌曲到歌单"
      >
        <PlayerIcon name="plus" size={19} />
      </button>
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onToggleDrawer}
        title="播放列表"
      >
        <PlayerIcon name="list" size={19} />
      </button>

      <!-- iOS (Safari/PWA) HTML5 audio volume 属性为只读，系统强制由实体键控制，隐藏滑块避免误解 -->
      {#if platform.canAdjustVolume}
        <!-- 音量竖立弹出滑块 -->
        <div class="relative">
          <button
            type="button"
            class="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            onclick={() => showVolPopup = !showVolPopup}
            title="调节音量"
          >
            <PlayerIcon name={vol === 0 ? 'volume-mute' : vol < 0.4 ? 'volume-low' : 'volume'} size={19} />
          </button>
          {#if showVolPopup}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="fixed inset-0 z-[100001]" onclick={() => showVolPopup = false}></div>
            <div class="absolute bottom-11 left-1/2 -translate-x-1/2 w-9 py-2.5 bg-[var(--card-bg-solid)] border border-[var(--border-color)] rounded-2xl shadow-xl z-[100002] flex flex-col items-center gap-1.5 backdrop-blur-xl">
              <span class="text-[10px] font-mono text-[var(--text-muted)]">{Math.round(vol * 100)}%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                bind:value={vol}
                class="w-1.5 h-20 accent-red-500 cursor-pointer"
                style="writing-mode: vertical-lr; direction: rtl; -webkit-appearance: slider-vertical;"
              />
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span class="cursor-pointer select-none flex items-center justify-center text-[var(--text-secondary)]" onclick={() => { vol = vol > 0 ? 0 : 0.8; }} title="点击切换静音">
                <PlayerIcon name={vol === 0 ? 'volume-mute' : 'volume'} size={15} />
              </span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

{#if addToPlaylistSong}
  <AddToPlaylistModal
    song={addToPlaylistSong}
    onClose={() => addToPlaylistSong = null}
    {showToast}
  />
{/if}

{#if showCommentModal && track?.id}
  <SongCommentModal
    songId={track.id}
    songName={track.name}
    onClose={() => showCommentModal = false}
  />
{/if}

