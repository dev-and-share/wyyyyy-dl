<script lang="ts">
  import { onMount } from 'svelte';
  import { formatArtist, DEFAULT_VINYL_COVER, formatCoverUrl, platform } from '../lib/utils';
  import { showToast } from '../lib/toast.svelte';
  import PlayerProgressBar from './PlayerProgressBar.svelte';
  import PlayerIcon from './PlayerIcon.svelte';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte';
  import SongCommentModal from './SongCommentModal.svelte';
  import LyricPanel from './LyricPanel.svelte';
  import TrackQuickActions from './TrackQuickActions.svelte';

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

  let showVolPopup = $state(false);
  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);
  let showCommentModal = $state(false);

  function handleAddToPlaylist() {
    if (track) {
      addToPlaylistSong = { id: track.id, name: track.name, artist: formatArtist(track.artist) };
    }
  }

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
    <!-- 移动端专属（md:hidden）：左下角快捷操作栏，大拇指舒适热区 -->
    <div class="absolute left-3.5 bottom-3 z-30 md:hidden">
      <TrackQuickActions
        {track}
        {isLiked}
        layout="col"
        {onToggleLike}
        onOpenComments={() => showCommentModal = true}
        onAddToPlaylist={handleAddToPlaylist}
      />
    </div>

    <!-- 左侧：大黑胶唱片与歌曲元信息 -->
    <div class="flex flex-col items-center justify-center gap-3 md:gap-4 max-w-[440px] w-full md:w-auto shrink-0">
      <div class="w-[140px] h-[140px] md:w-[220px] md:h-[220px] flex items-center justify-center">
        <div class="w-full h-full rounded-full bg-[var(--immersive-ring-bg)] shadow-[var(--immersive-ring-shadow)] p-1.5 flex items-center justify-center transition-all duration-300">
          <img
            src={formatCoverUrl(track?.cover, 400)}
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

        <!-- PC 宽屏专属（hidden md:flex）：歌名下方横排 -->
        <div class="hidden md:flex mt-3">
          <TrackQuickActions
            {track}
            {isLiked}
            layout="row"
            {onToggleLike}
            onOpenComments={() => showCommentModal = true}
            onAddToPlaylist={handleAddToPlaylist}
          />
        </div>
      </div>
    </div>

    <!-- 右侧：滚动歌词展示面板 -->
    <LyricPanel {track} {currentTime} {onSeekTime} />
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
        onclick={handleAddToPlaylist}
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
