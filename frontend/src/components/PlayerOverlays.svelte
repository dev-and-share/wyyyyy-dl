<script lang="ts">
  import { playerStore } from '../lib/playerStore.svelte';
  import { taskState, clearTasks } from '../lib/taskStore.svelte';
  import { isTrackLiked } from '../lib/likeStore.svelte';
  import PlaylistDrawer from './PlaylistDrawer.svelte';
  import LyricModal from './LyricModal.svelte';
  import PeqDrawer from './PeqDrawer.svelte';

  let {
    showDrawer = $bindable(false),
    showLyric = $bindable(false),
    showPeq = $bindable(false),
    likedSet = new Set<number>(),
    onToggleLike = () => {},
    onReveal = () => {},
    onPlayIndex = () => {},
    onClearQueue = () => {},
    onShuffle = () => {},
    onTogglePlay = () => {},
    onPrev = () => {},
    onNext = () => {},
    onToggleMode = () => {},
    onSeek = () => {},
    onSeekTime = () => {}
  } = $props<{
    showDrawer: boolean;
    showLyric: boolean;
    showPeq: boolean;
    likedSet?: Set<number>;
    onToggleLike?: (id: any, name?: string, artist?: string, extra?: any) => void;
    onReveal?: (item: any) => void;
    onPlayIndex?: (idx: number) => void;
    onClearQueue?: () => void;
    onShuffle?: () => void;
    onTogglePlay?: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    onToggleMode?: () => void;
    onSeek?: (e: MouseEvent) => void;
    onSeekTime?: (time: number) => void;
  }>();
</script>

<!-- 📜 播放列表抽屉 -->
{#if showDrawer}
  <PlaylistDrawer
    queue={playerStore.queue}
    qIndex={playerStore.qIndex}
    tasks={taskState.tasks}
    {likedSet}
    autoSkipTrial={playerStore.autoSkipTrial}
    serverOnly={playerStore.serverOnly}
    offlineOnly={playerStore.offlineOnly}
    downloadedSet={taskState.downloadedSet}
    {onPlayIndex}
    {onClearQueue}
    onRemoveItem={(realIdx) => playerStore.removeItem(realIdx)}
    {onToggleLike}
    onToggleAutoSkip={(val) => playerStore.toggleAutoSkipTrial(val)}
    onToggleServerOnly={(val) => playerStore.toggleServerOnly(val)}
    onToggleOfflineOnly={(val) => playerStore.toggleOfflineOnly(val)}
    onClearTasks={clearTasks}
    {onShuffle}
    {onReveal}
    onClose={() => (showDrawer = false)}
  />
{/if}

<!-- 🎤 全屏黑胶歌词 -->
{#if showLyric && playerStore.activeTrack}
  <LyricModal
    track={playerStore.activeTrack}
    currentTime={playerStore.curTime}
    duration={playerStore.duration}
    playing={playerStore.playing}
    playMode={playerStore.playMode}
    bind:vol={playerStore.vol}
    isLiked={isTrackLiked(playerStore.activeTrack.id, playerStore.activeTrack.name, playerStore.activeTrack.artist)}
    {onTogglePlay}
    {onPrev}
    {onNext}
    {onToggleMode}
    {onSeek}
    {onSeekTime}
    onToggleLike={() => onToggleLike(playerStore.activeTrack?.id, playerStore.activeTrack?.name || '', playerStore.activeTrack?.artist, playerStore.activeTrack)}
    onTogglePeq={() => (showPeq = !showPeq)}
    onToggleDrawer={() => (showDrawer = !showDrawer)}
    onClose={() => (showLyric = false)}
  />
{/if}

<!-- 🎛️ 5 段参量均衡器统一抽屉 -->
{#if showPeq}
  <PeqDrawer onClose={() => (showPeq = false)} />
{/if}
