<script lang="ts">
  import { onMount } from 'svelte';
  import { formatArtist, platform } from '../lib/utils';
  import { showToast } from '../lib/toast.svelte';
  import PlayerProgressBar from './PlayerProgressBar.svelte';
  import PlayerIcon from './PlayerIcon.svelte';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte';
  import SongCommentModal from './SongCommentModal.svelte';
  import LyricPanel from './LyricPanel.svelte';
  import TrackQuickActions from './TrackQuickActions.svelte';
  import SkinPickerSheet from './SkinPickerSheet.svelte';
  import { skin } from '../lib/skinStore.svelte';
  import VinylSkinStage from './skins/VinylSkinStage.svelte';
  import AuroraSkinStage from './skins/AuroraSkinStage.svelte';
  import CassetteSkinStage from './skins/CassetteSkinStage.svelte';
  import WinampSkinStage from './skins/WinampSkinStage.svelte';
  import SpringSkinStage from './skins/SpringSkinStage.svelte';
  import type { SkinId } from './skins/skinTypes';

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
  let showSkinPicker = $state(false);
  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);
  let showCommentModal = $state(false);

  const STAGES = {
    vinyl: VinylSkinStage,
    aurora: AuroraSkinStage,
    cassette: CassetteSkinStage,
    winamp: WinampSkinStage,
    spring: SpringSkinStage
  };

  let Stage = $derived(STAGES[skin.current] || VinylSkinStage);

  // 切歌或封面变动时更新主题色调色板
  $effect(() => {
    skin.updatePalette(track?.cover);
  });

  function handleAddToPlaylist() {
    if (track) {
      addToPlaylistSong = { id: track.id, name: track.name, artist: formatArtist(track.artist) };
    }
  }

  onMount(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSkinPicker) {
          showSkinPicker = false;
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });
</script>

<div
  class="fixed inset-0 w-screen h-screen z-[100000] overflow-hidden flex flex-col transition-colors duration-300 select-none bg-[image:var(--immersive-bg)] bg-[var(--bg-color)]"
  style="{skin.cssVars}"
>
  <!-- 顶部标题栏 -->
  <div class="min-h-[calc(54px+env(safe-area-inset-top,0px))] pt-[max(10px,env(safe-area-inset-top,0px))] pb-2.5 px-4 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--immersive-header-bg)] backdrop-blur-md w-full shrink-0 z-20">
    <!-- 皮肤切换入口按钮 -->
    <button
      type="button"
      class="w-9.5 h-9.5 rounded-full flex items-center justify-center text-base bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] active:scale-92 transition-all cursor-pointer"
      onclick={() => showSkinPicker = true}
      title="切换播放器皮肤"
      data-testid="btn-open-skin-picker"
    >
      <span class="text-sm">🎨</span>
    </button>

    <h3 class="text-base font-bold text-[var(--text-main)] flex-1 text-center truncate px-2">🎵 全屏沉浸播放</h3>

    <!-- 关闭沉浸页 -->
    <button
      type="button"
      class="w-9.5 h-9.5 rounded-full flex items-center justify-center text-base bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-[var(--text-secondary)] hover:text-[var(--text-main)] active:scale-92 transition-all cursor-pointer"
      onclick={onClose}
      title="关闭全屏"
    >
      <PlayerIcon name="close" size={16} />
    </button>
  </div>

  <!-- 中间主体：动态皮肤舞台 + 右侧滚动歌词 + 左下角快捷交互栏 -->
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

    <!-- 左侧：动态皮肤舞台插槽（黑胶/极光/磁带/Winamp/春日） -->
    <Stage
      {track}
      {playing}
      {currentTime}
      {duration}
      palette={skin.palette}
      {isLiked}
      {onToggleLike}
      onOpenComments={() => showCommentModal = true}
      onAddToPlaylist={handleAddToPlaylist}
    />

    <!-- 右侧：滚动歌词展示面板 -->
    <LyricPanel {track} {currentTime} {onSeekTime} skinId={skin.current} />
  </div>

  <!-- 底部：全屏沉浸播放控制条 -->
  <div class="w-full px-4 md:px-12 py-3 border-t border-[var(--border-subtle)] bg-[var(--immersive-footer-bg)] backdrop-blur-xl flex flex-col items-center gap-2.5 shrink-0 z-20">
    <div class="w-full max-w-[680px]">
      <PlayerProgressBar
        curTime={currentTime}
        {duration}
        progressRatio={duration ? (currentTime / duration) : 0}
        {onSeek}
        skinId={skin.current}
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

{#if showSkinPicker}
  <SkinPickerSheet onClose={() => showSkinPicker = false} />
{/if}

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
