<script lang="ts">
  import PlayerProgressBar from './PlayerProgressBar.svelte';
  import PlayerIcon from './PlayerIcon.svelte';
  import { platform } from '../lib/utils';
  import { t } from '../lib/i18n/index.svelte';

  let {
    track,
    currentTime,
    duration,
    playing,
    playMode,
    isLiked,
    uiVisible,
    skinId = 'vinyl',
    onTogglePlay,
    onPrev,
    onNext,
    onToggleMode,
    onSeek,
    onToggleLike,
    onTogglePeq,
    onToggleDrawer,
    onAddToPlaylist,
    onOpenComments,
    onMouseEnterControls,
    onMouseLeaveControls,
    onBottomZoneEnter,
    onKickTimer
  } = $props<{
    track: any;
    currentTime: number;
    duration: number;
    playing: boolean;
    playMode: 'list' | 'single' | 'shuffle';
    isLiked: boolean;
    uiVisible: boolean;
    skinId?: string;
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    onToggleMode: () => void;
    onSeek: (e: MouseEvent) => void;
    onToggleLike: () => void;
    onTogglePeq: () => void;
    onToggleDrawer: () => void;
    onAddToPlaylist: () => void;
    onOpenComments: () => void;
    onMouseEnterControls: () => void;
    onMouseLeaveControls: () => void;
    onBottomZoneEnter: () => void;
    onKickTimer: () => void;
  }>();
</script>

<!-- 底部：全屏沉浸播放控制条（上下两层结构 + 3秒自动渐隐，hover 时常显不消失） -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  data-testid="immersive-bottom-controls"
  class="interactive-el absolute bottom-0 inset-x-0 z-20 w-full px-4 md:px-12 pt-6 pb-[max(14px,env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center gap-2 transition-all duration-500 {uiVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}"
  onmouseenter={onMouseEnterControls}
  onmouseleave={onMouseLeaveControls}
>
  <!-- 第一层：轻量级歌曲互动横栏 (喜欢、评论、加歌单、EQ) -->
  <div class="w-full max-w-[640px] flex items-center justify-between px-2 text-white/80">
    <div class="flex items-center gap-3">
      <!-- ❤️ 喜欢 -->
      <button
        type="button"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-xs cursor-pointer {isLiked ? 'text-red-400' : 'text-white/80'}"
        onclick={() => { onToggleLike(); onKickTimer(); }}
        title={isLiked ? t('player.likeRemove') : t('player.likeAdd')}
      >
        <PlayerIcon name="heart" liked={isLiked} size={15} />
        <span class="text-[11px] font-medium">{t('player.like')}</span>
      </button>

      <!-- 💬 评论 -->
      {#if track?.id}
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-xs cursor-pointer text-white/80"
          onclick={() => { onOpenComments(); onKickTimer(); }}
          title={t('comment.view')}
        >
          <span class="text-xs">💬</span>
          <span class="text-[11px] font-medium">{t('comment.view')}</span>
        </button>
      {/if}
    </div>

    <div class="flex items-center gap-2">
      <!-- ➕ 收藏到歌单 -->
      <button
        type="button"
        class="w-7.5 h-7.5 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-emerald-400 transition-all cursor-pointer"
        onclick={() => { onAddToPlaylist(); onKickTimer(); }}
        title={t('playlist.collectTo')}
      >
        <PlayerIcon name="plus" size={15} />
      </button>

      <!-- 🎚️ PEQ -->
      {#if platform.canUseAudioProcessing}
        <button
          type="button"
          class="w-7.5 h-7.5 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white transition-all cursor-pointer"
          onclick={() => { onTogglePeq(); onKickTimer(); }}
          title={t('player.peq')}
        >
          <PlayerIcon name="equalizer" size={15} />
        </button>
      {/if}
    </div>
  </div>

  <!-- 进度条 -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="w-full max-w-[640px]" onclick={() => onKickTimer()}>
    <PlayerProgressBar
      curTime={currentTime}
      {duration}
      progressRatio={duration ? (currentTime / duration) : 0}
      {onSeek}
      {skinId}
    />
  </div>

  <!-- 第二层：5个核心播控大拇指操作区 (大间距防误触) -->
  <div class="flex items-center justify-center gap-5 md:gap-8 pt-1">
    <!-- 循环模式 -->
    <button
      type="button"
      class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
      onclick={() => { onToggleMode(); onKickTimer(); }}
      title={t('player.toggleMode')}
    >
      <PlayerIcon name={playMode === 'single' ? 'repeat-1' : playMode === 'shuffle' ? 'shuffle' : 'repeat'} size={18} />
    </button>

    <!-- 上一首 -->
    <button
      type="button"
      class="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
      onclick={() => { onPrev(); onKickTimer(); }}
      title={t('player.previous')}
    >
      <PlayerIcon name="prev" size={19} />
    </button>

    <!-- 播放/暂停核心大键 -->
    <button
      type="button"
      class="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
      onclick={() => { onTogglePlay(); onKickTimer(); }}
      title={playing ? t('player.pause') : t('player.play')}
    >
      <PlayerIcon name={playing ? 'pause' : 'play'} size={21} />
    </button>

    <!-- 下一首 -->
    <button
      type="button"
      class="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
      onclick={() => { onNext(); onKickTimer(); }}
      title={t('player.next')}
    >
      <PlayerIcon name="next" size={19} />
    </button>

    <!-- 播放队列 -->
    <button
      type="button"
      class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
      onclick={() => { onToggleDrawer(); onKickTimer(); }}
      title={t('player.playlist')}
    >
      <PlayerIcon name="list" size={18} />
    </button>
  </div>
</div>

<!-- 沉浸模式极细贴底进度指示线与底部感应展开区 (PC mouse on 触发显示，高 2px 发光) -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  data-testid="immersive-bottom-progress-trigger"
  class="interactive-el absolute bottom-0 inset-x-0 h-4 z-30 cursor-pointer flex flex-col justify-end transition-opacity duration-500 {uiVisible ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}"
  onmouseenter={onBottomZoneEnter}
  title={t('player.expandControls') || '显示控制面板'}
>
  <div class="w-full h-[2px] bg-white/10 hover:h-[3px] transition-all">
    <div
      class="h-full bg-gradient-to-r from-red-500 to-rose-400 rounded-r-full transition-all duration-300"
      style="width: {duration ? Math.min(100, (currentTime / duration) * 100) : 0}%; box-shadow: 0 0 6px rgba(244, 63, 94, 0.6);"
    ></div>
  </div>
</div>
