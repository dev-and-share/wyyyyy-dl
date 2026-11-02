<script lang="ts">
  import { onMount } from 'svelte';
  import { formatArtist, platform, formatCoverUrl } from '../lib/utils';
  import { showToast } from '../lib/toast.svelte';
  import { t } from '../lib/i18n/index.svelte';
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
  class="fixed inset-0 w-screen h-screen z-[100000] overflow-hidden flex flex-col select-none bg-[image:var(--immersive-bg)] bg-[var(--bg-color)] transition-colors duration-500 text-white"
  style="{skin.cssVars} color-scheme: dark;"
>
  <!-- 动态全屏皮肤流光层（真正铺满 100vw × 100vh 大画布，不被中间容器截断） -->
  {#if skin.current === 'aurora'}
    <div class="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      <div
        class="aurora-orb orb-1 absolute -top-1/4 -left-1/4 w-[55vw] h-[55vw] min-w-[380px] min-h-[380px] rounded-full blur-[90px] md:blur-[130px] opacity-60 mix-blend-screen transition-colors duration-1000"
        style="background: var(--skin-dominant, #7c3aed); animation-play-state: {playing ? 'running' : 'paused'};"
      ></div>
      <div
        class="aurora-orb orb-2 absolute top-1/3 -right-1/4 w-[50vw] h-[50vw] min-w-[340px] min-h-[340px] rounded-full blur-[80px] md:blur-[120px] opacity-55 mix-blend-screen transition-colors duration-1000"
        style="background: var(--skin-accent, #db2777); animation-play-state: {playing ? 'running' : 'paused'};"
      ></div>
      <div
        class="aurora-orb orb-3 hidden md:block absolute -bottom-1/4 left-1/3 w-[45vw] h-[45vw] min-w-[300px] min-h-[300px] rounded-full blur-[90px] md:blur-[130px] opacity-40 mix-blend-screen transition-colors duration-1000"
        style="background: var(--skin-muted, #2563eb); animation-play-state: {playing ? 'running' : 'paused'};"
      ></div>
    </div>
  {:else if skin.current === 'spring'}
    <div class="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      <div
        class="spring-pollen absolute -top-10 left-1/4 w-[50vw] h-[50vw] min-w-[340px] min-h-[340px] rounded-full blur-[100px] md:blur-[140px] bg-emerald-500/20 opacity-70 mix-blend-screen"
        style="animation-play-state: {playing ? 'running' : 'paused'};"
      ></div>
      <div
        class="spring-pollen absolute -bottom-10 right-1/4 w-[55vw] h-[55vw] min-w-[380px] min-h-[380px] rounded-full blur-[110px] md:blur-[150px] bg-teal-400/20 opacity-60 mix-blend-screen"
        style="animation-play-state: {playing ? 'running' : 'paused'};"
      ></div>
    </div>
  {/if}

  <!-- 顶部轻盈浮空按钮（无横跨整屏的 bar，纯净大画布） -->
  <!-- 左上角：皮肤切换入口按钮 -->
  <button
    type="button"
    class="absolute top-[max(14px,env(safe-area-inset-top,0px))] left-4 md:left-8 z-30 w-10 h-10 rounded-full flex items-center justify-center text-base bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white backdrop-blur-md border border-white/15 shadow-lg transition-all cursor-pointer"
    onclick={() => showSkinPicker = true}
    title={t('player.skin')}
    data-testid="btn-open-skin-picker"
  >
    <span class="text-sm">🎨</span>
  </button>

  <!-- 右上角：关闭沉浸页按钮 -->
  <button
    type="button"
    class="absolute top-[max(14px,env(safe-area-inset-top,0px))] right-4 md:right-8 z-30 w-10 h-10 rounded-full flex items-center justify-center text-base bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white backdrop-blur-md border border-white/15 shadow-lg transition-all cursor-pointer"
    onclick={onClose}
    title={t('common.close')}
  >
    <PlayerIcon name="close" size={17} />
  </button>

  <!-- 中间主体：动态皮肤舞台 + 右侧滚动歌词 + 左下角快捷交互栏 -->
  <div class="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden px-4 md:px-12 pt-[max(64px,calc(env(safe-area-inset-top,0px)+40px))] pb-28 md:pb-24 gap-4 md:gap-10 max-w-[1240px] w-full mx-auto items-center justify-center">
    <!-- 移动端专属（md:hidden）：左下角快捷操作栏 -->
    <div class="absolute left-3.5 bottom-24 z-30 md:hidden">
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

  <!-- 底部：全屏沉浸播放控制条（自然渐隐悬浮，无突兀边框切割） -->
  <div class="absolute bottom-0 inset-x-0 z-20 w-full px-4 md:px-12 pt-10 pb-[max(14px,env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-black/60 via-black/25 to-transparent flex flex-col items-center gap-2.5">
    <div class="w-full max-w-[680px]">
      <PlayerProgressBar
        curTime={currentTime}
        {duration}
        progressRatio={duration ? (currentTime / duration) : 0}
        {onSeek}
        skinId={skin.current}
      />
    </div>

    <!-- 控制按键组（高对比度清晰明亮） -->
    <div class="flex items-center justify-center gap-4 md:gap-6">
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onToggleMode}
        title={t('player.toggleMode')}
      >
        <PlayerIcon name={playMode === 'single' ? 'repeat-1' : playMode === 'shuffle' ? 'shuffle' : 'repeat'} size={19} />
      </button>
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
        onclick={onPrev}
        title={t('player.previous')}
      >
        <PlayerIcon name="prev" size={20} />
      </button>
      <button
        type="button"
        class="w-11 h-11 rounded-full flex items-center justify-center text-lg bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        onclick={onTogglePlay}
        title={playing ? t('player.pause') : t('player.play')}
      >
        <PlayerIcon name={playing ? 'pause' : 'play'} size={22} />
      </button>
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
        onclick={onNext}
        title={t('player.next')}
      >
        <PlayerIcon name="next" size={20} />
      </button>
      {#if platform.canUseAudioProcessing}
        <button
          type="button"
          class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          onclick={onTogglePeq}
          title={t('player.peq')}
        >
          <PlayerIcon name="equalizer" size={19} />
        </button>
      {/if}
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-emerald-400 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={handleAddToPlaylist}
        title={t('playlist.addTo')}
      >
        <PlayerIcon name="plus" size={19} />
      </button>
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onToggleDrawer}
        title={t('player.playlist')}
      >
        <PlayerIcon name="list" size={19} />
      </button>

      {#if platform.canAdjustVolume}
        <!-- 音量竖立弹出滑块 -->
        <div class="relative">
          <button
            type="button"
            class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            onclick={() => showVolPopup = !showVolPopup}
            title={t('player.volume')}
          >
            <PlayerIcon name={vol === 0 ? 'volume-mute' : vol < 0.4 ? 'volume-low' : 'volume'} size={19} />
          </button>
          {#if showVolPopup}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="fixed inset-0 z-[100001]" onclick={() => showVolPopup = false}></div>
            <div class="absolute bottom-11 left-1/2 -translate-x-1/2 w-9 py-2.5 bg-neutral-900/90 border border-white/20 rounded-2xl shadow-2xl z-[100002] flex flex-col items-center gap-1.5 backdrop-blur-2xl">
              <span class="text-[10px] font-mono text-white/80">{Math.round(vol * 100)}%</span>
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
              <span class="cursor-pointer select-none flex items-center justify-center text-white/80 hover:text-white" onclick={() => { vol = vol > 0 ? 0 : 0.8; }} title={t('player.muteToggle')}>
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

<style>
  /* ── 极光流动动画（大画布全屏） ───────────────────────── */
  @keyframes drift1 {
    0%   { transform: translate(0, 0) scale(1); }
    50%  { transform: translate(6vw, 4vh) scale(1.15); }
    100% { transform: translate(0, 0) scale(1); }
  }
  @keyframes drift2 {
    0%   { transform: translate(0, 0) scale(1.1); }
    50%  { transform: translate(-5vw, -3vh) scale(0.95); }
    100% { transform: translate(0, 0) scale(1.1); }
  }
  @keyframes drift3 {
    0%   { transform: translate(0, 0) scale(1); }
    50%  { transform: translate(4vw, -5vh) scale(1.1); }
    100% { transform: translate(0, 0) scale(1); }
  }

  .orb-1 { animation: drift1 18s ease-in-out infinite; will-change: transform; }
  .orb-2 { animation: drift2 22s ease-in-out infinite; will-change: transform; }
  .orb-3 { animation: drift3 26s ease-in-out infinite; will-change: transform; }

  /* ── 春日草木微粒动画（大画布全屏） ───────────────────── */
  @keyframes floatPollen {
    0%   { transform: translateY(0) scale(1); }
    50%  { transform: translateY(4vh) scale(1.08); }
    100% { transform: translateY(0) scale(1); }
  }
  .spring-pollen { animation: floatPollen 14s ease-in-out infinite; will-change: transform; }

  @media (prefers-reduced-motion: reduce) {
    .aurora-orb, .spring-pollen { animation: none !important; }
  }
</style>
