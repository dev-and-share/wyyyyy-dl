<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast.svelte';
  import { taskState, clearTasks } from '../lib/taskStore.svelte';
  import { markSongDownloaded } from '../lib/trackStatus.svelte';
  import { resolveTrackUrl, preloadSurroundingTracks, isSameAudioSource, applySeekToAudio, parseFolderTracks } from '../lib/playerHelper';
  import { setupMediaSession, updateMediaSessionMetadata, updateMediaSessionPlaybackState, updateMediaSessionPosition, clearMediaSessionPosition, getLastPositionSyncedKey, getCurrentTrackKey } from '../lib/mediaSession';
  import { parseLrc, getActiveLyric } from '../lib/lyricParser';
  import { playerStore, type SetQueueOptions } from '../lib/playerStore.svelte';
  import { handleTrackPlayback, resetTrackPlayback } from '../lib/pwaCache.svelte';
  import type { Track } from '../lib/types';
  import { t } from '../lib/i18n';
  import { platform } from '../lib/platform';
  import { isIosF3Holding, handleIosF3Pause, handleIosF3Resume, resetIosF3State, updateIosF3SavedTime } from '../lib/iosF3KeepAlive';

  import PlayerBar from './PlayerBar.svelte';
  import PlaylistDrawer from './PlaylistDrawer.svelte';
  import LyricModal from './LyricModal.svelte';
  import PeqDrawer from './PeqDrawer.svelte';

  let {
    curTrack = $bindable(null), playing = $bindable(false), setQueue = $bindable(),
    togglePlay = $bindable(() => {}), isOverlayOpen = $bindable(false), likedSet = new Set<number>(),
    onToggleLike = () => {}, onReveal = () => {}, showPeq = $bindable(false), isPlayerMinimized = $bindable(false)
  } = $props<{
    curTrack?: Track | null; playing?: boolean;
    setQueue?: (tracks: Track[], optionsOrIdx?: number | SetQueueOptions, maybePlaylistId?: string | number | null) => void;
    togglePlay?: () => void; isOverlayOpen?: boolean; likedSet?: Set<number>;
    onToggleLike?: (id: number, name: string) => void; onReveal?: (item: any) => void;
    showPeq?: boolean; isPlayerMinimized?: boolean;
  }>();

  let showDrawer = $state(false), showLyric = $state(false), pendingSeekTime = $state<number | null>(null), audioEl: HTMLAudioElement | null = $state(null);
  let needsReloadOnResume = false, parsedLyrics = $derived(parseLrc(playerStore.activeTrack?.lyric)), lastLyricIndex = $state(-2);

  $effect(() => {
    curTrack = playerStore.activeTrack;
    playing = playerStore.playing;
    isOverlayOpen = showDrawer || showLyric || showPeq;
  });
  $effect(() => {
    if (audioEl && platform.canAdjustVolume) audioEl.volume = playerStore.vol;
    try { localStorage.setItem('wyyyy_player_vol', String(playerStore.vol)); } catch {}
  });
  $effect(() => {
    const tr = playerStore.activeTrack;
    lastLyricIndex = -2;
    updateMediaSessionMetadata(tr);
    if (tr?.id && !tr.lyric) {
      api.songV1(String(tr.id), 'lossless').then((j: any) => {
        if (j?.data?.lyric && playerStore.activeTrack?.id === tr.id) {
          tr.lyric = j.data.lyric;
          playerStore.activeTrack.lyric = j.data.lyric;
        }
      }).catch(() => {});
    }
  });

  async function prepareTrackInUI(track: Track) {
    if (track.isLocal && track.id) markSongDownloaded(track.id);
    if (track.url && track.url.startsWith('blob:')) track.url = track.id ? `/v3/stream?id=${track.id}` : '';
    const url = track.url || (await resolveTrackUrl(track));
    if (url && audioEl && (!audioEl.src || audioEl.src === window.location.href || audioEl.src.startsWith('blob:') || !isSameAudioSource(audioEl.src, url))) {
      audioEl.src = url;
    }
  }

  function applyPendingSeek() {
    if (!pendingSeekTime || pendingSeekTime <= 0 || !audioEl) return;
    applySeekToAudio(audioEl, pendingSeekTime);
    pendingSeekTime = null;
  }

  async function handleSkipTrack(track: Track, reason: string, isTrial = false) {
    resetIosF3State(audioEl);
    if (audioEl) { audioEl.pause(); try { audioEl.currentTime = 0; } catch {} audioEl.src = ''; }
    const nextIdx = playerStore.getNextTrackIndex();
    if (nextIdx < 0 || nextIdx === playerStore.qIndex) {
      playerStore.playing = false;
      showToast(isTrial ? t('player.trialNoMoreCompleteTracks', { name: track.name }) : t('player.noMorePlayableTracks'), 'warning', 2500);
      return;
    }
    showToast(isTrial ? t('player.skippedTrialTrack', { name: track.name }) : t('player.autoPlayNextReason', { name: track.name, reason }), isTrial ? 'info' : 'warning', 2000);
    playerStore.qIndex = nextIdx;
    playerStore.curTime = 0;
    playerStore.save();
    await ensurePlay(true);
  }

  async function ensurePlay(resetTime = false) {
    const track = playerStore.queue[playerStore.qIndex] || playerStore.activeTrack;
    if (!track || !audioEl) return;
    resetIosF3State(audioEl);
    needsReloadOnResume = false;
    if (resetTime) { pendingSeekTime = null; clearMediaSessionPosition(); }

    const existingUrl = track.url;
    if (existingUrl && !isSameAudioSource(audioEl.src, existingUrl)) {
      audioEl.src = existingUrl;
      if (resetTime) { try { audioEl.currentTime = 0; } catch {} }
    }
    if (playerStore.autoSkipTrial && track.freeTrial === true) return handleSkipTrack(track, t('player.isTrialClip'), true);
    if (track.unplayable === true) return handleSkipTrack(track, track.unplayableReason || t('player.regionOrCopyrightRestricted'), false);

    const startAudio = () => {
      const p = audioEl?.play();
      if (p !== undefined) {
        p.then(() => {
          if (resetTime && audioEl) { try { audioEl.currentTime = 0; } catch {} playerStore.curTime = 0; } else { applyPendingSeek(); }
          preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
        }).catch(() => { playerStore.playing = false; updateMediaSessionPlaybackState(false); });
      }
    };

    if (existingUrl) {
      if (resetTime) {
        playerStore.curTime = 0;
        const onMeta = () => { try { if (audioEl) audioEl.currentTime = 0; } catch {} audioEl?.removeEventListener('loadedmetadata', onMeta); };
        audioEl.addEventListener('loadedmetadata', onMeta);
      }
      startAudio();
      return;
    }

    if (resetTime) playerStore.curTime = 0;
    const url = await resolveTrackUrl(track);

    if (playerStore.autoSkipTrial && track.freeTrial === true) return handleSkipTrack(track, t('player.isTrialClip'), true);
    if (!url || track.unplayable) {
      track.unplayable = true;
      if (audioEl) { audioEl.pause(); try { audioEl.currentTime = 0; } catch {} audioEl.src = ''; }
      return handleSkipTrack(track, track.unplayableReason || t('player.regionOrCopyrightRestricted'), false);
    }
    const active = playerStore.queue[playerStore.qIndex] || playerStore.activeTrack;
    if (url && audioEl && active === track) {
      if (!isSameAudioSource(audioEl.src, url)) {
        updateMediaSessionMetadata(track);
        audioEl.src = url;
        if (resetTime) { try { audioEl.currentTime = 0; } catch {} }
      }
      startAudio();
    }
  }

  function pauseAudio() {
    if (!audioEl) return;
    if (audioEl.currentTime > 0) playerStore.curTime = audioEl.currentTime;
    if (platform.isIOS) {
      if (handleIosF3Pause(audioEl, playerStore.activeTrack, playerStore.curTime, playerStore.duration, audioEl.src, () => {
        playerStore.playing = true;
      })) {
        playerStore.playing = false;
        return;
      }
    }
    if (platform.isIOS && (typeof document === 'undefined' || document.visibilityState === 'hidden')) {
      needsReloadOnResume = true;
    }
    audioEl.pause();
  }

  function handleTogglePlay() {
    if (!audioEl) return;
    if (isIosF3Holding()) {
      if (handleIosF3Resume(audioEl, () => {
        playerStore.playing = true;
        preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
      })) {
        playerStore.playing = true;
        return;
      }
    }
    if (audioEl.paused) {
      const currentSrc = audioEl.src;
      if (!currentSrc || currentSrc === window.location.href || currentSrc.startsWith('blob:')) {
        ensurePlay(false);
        return;
      }
      const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      if (platform.isIOS && (needsReloadOnResume || isHidden || audioEl.readyState < 3)) {
        needsReloadOnResume = false;
        const resumeTime = audioEl.currentTime || playerStore.curTime || 0;
        if (resumeTime > 0) pendingSeekTime = resumeTime;
        audioEl.src = currentSrc;
      }
      const p = audioEl.play();
      if (p !== undefined) {
        p.then(() => {
          applyPendingSeek();
          preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
        }).catch(() => { playerStore.playing = false; });
      }
    } else {
      pauseAudio();
    }
  }

  async function next() {
    resetIosF3State(audioEl);
    clearMediaSessionPosition();
    if (playerStore.queue.length === 0) return;
    resetTrackPlayback();
    const nextIdx = playerStore.getNextTrackIndex();
    if (nextIdx < 0 || nextIdx === playerStore.qIndex) {
      if (playerStore.autoSkipTrial && (playerStore.activeTrack as any)?.freeTrial === true) {
        playerStore.playing = false;
        if (audioEl) { audioEl.pause(); try { audioEl.currentTime = 0; } catch {} }
        showToast(t('player.noMoreCompleteTracksToPlay'), 'info', 2000);
        return;
      }
    }
    playerStore.stepNext();
    if (audioEl) { try { audioEl.currentTime = 0; } catch {} }
    await ensurePlay(true);
  }

  async function prev() {
    resetIosF3State(audioEl);
    clearMediaSessionPosition();
    if (playerStore.queue.length === 0) return;
    resetTrackPlayback();
    playerStore.stepPrev();
    if (audioEl) { try { audioEl.currentTime = 0; } catch {} }
    await ensurePlay(true);
  }

  function applyTargetSeek(targetTime: number) {
    if (!audioEl) return;
    if (isIosF3Holding()) {
      playerStore.curTime = targetTime;
      updateIosF3SavedTime(targetTime);
      playerStore.save();
      return;
    }
    audioEl.currentTime = targetTime;
    playerStore.curTime = audioEl.currentTime;
    playerStore.save();
  }

  function seek(e: MouseEvent) {
    if (!audioEl || !playerStore.duration) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    applyTargetSeek(p * playerStore.duration);
  }

  function handleClearQueue() {
    resetIosF3State(audioEl);
    if (audioEl) { audioEl.pause(); try { audioEl.currentTime = 0; } catch {} audioEl.src = ''; }
    playerStore.clearQueue();
    showToast(t('player.queueCleared'), 'info');
  }

  function handleSetQueue(tracks: Track[], optionsOrIdx: number | SetQueueOptions = 0, maybePlaylistId?: string | number | null) {
    resetIosF3State(audioEl);
    if (!tracks || !tracks.length) return;
    let targetPlaylistId: string | number | null = null;
    if (typeof optionsOrIdx === 'number') {
      if (maybePlaylistId !== undefined) targetPlaylistId = maybePlaylistId;
    } else if (optionsOrIdx && typeof optionsOrIdx === 'object') {
      targetPlaylistId = optionsOrIdx.playlistId ?? null;
    }

    if (targetPlaylistId != null && playerStore.playlistId && String(playerStore.playlistId) === String(targetPlaylistId) && playerStore.queue.length > 0) {
      showToast(playerStore.playing ? t('player.playingThisPlaylistNow') : t('player.continuePlayingThisPlaylist'), 'info', 1500);
      if (!playerStore.playing) handleTogglePlay();
      return;
    }

    playerStore.setQueue(tracks, optionsOrIdx, maybePlaylistId);
    if (audioEl) { try { audioEl.currentTime = 0; } catch {} }
    preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
    ensurePlay(true);

    const targetTrack = playerStore.queue[playerStore.qIndex] || playerStore.activeTrack;
    if (targetTrack?.id) {
      if (targetTrack.isLocal) {
        markSongDownloaded(targetTrack.id);
      } else {
        api.downloadSingle(String(targetTrack.id)).then(() => {
          showToast(t('player.addedAutoDownload', { name: targetTrack.name || t('common.song') }), 'info', 2000);
          window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
        }).catch(() => {});
      }
    }
  }

  setQueue = handleSetQueue;
  togglePlay = handleTogglePlay;

  function handleToggleMode() {
    const nextMode = playerStore.togglePlayMode();
    if (nextMode === 'shuffle') {
      showToast(t('player.shuffledNotice'), 'info', 2000);
      preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
    }
  }

  function handleShuffleAction() {
    playerStore.shuffleQueue();
    preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
  }

  function bindMediaSessionHandlers() {
    setupMediaSession({
      onPlay: () => {
        if (isIosF3Holding()) {
          handleTogglePlay();
          return;
        }
        if (audioEl?.paused) handleTogglePlay();
      },
      onPause: () => {
        pauseAudio();
      },
      onPrev: () => {
        resetIosF3State(audioEl);
        prev();
      },
      onNext: () => {
        resetIosF3State(audioEl);
        next();
      }
    });
  }

  onMount(() => {
    playerStore.restore();
    if (playerStore.curTime > 0) pendingSeekTime = playerStore.curTime;
    const currentTrack = playerStore.activeTrack;
    if (currentTrack) prepareTrackInUI(currentTrack);
    bindMediaSessionHandlers();
    window.addEventListener('beforeunload', () => playerStore.save());

    const handleVisibilityChange = () => {
      if (!audioEl || isIosF3Holding()) return;
      if (document.visibilityState === 'hidden') {
        if (platform.isIOS && audioEl.paused) needsReloadOnResume = true;
        return;
      }
      if (audioEl.paused || audioEl.readyState >= 3) return;
      const time = audioEl.currentTime || playerStore.curTime || 0;
      if (time > 0) pendingSeekTime = time;
      const currentSrc = audioEl.src;
      if (currentSrc) audioEl.src = currentSrc;
      audioEl.play().then(() => applyPendingSeek()).catch(() => {});
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const onPlayFolder = (e: CustomEvent) => {
      const { tracks, name } = e.detail;
      const q = parseFolderTracks(tracks);
      if (!q.length) return showToast(t('folder.noPlayableFiles'), 'warning');
      handleSetQueue(q, 0);
      showToast(t('folder.playingFolderStats', { name, count: q.length }), 'success', 3000);
    };

    window.addEventListener('svelte:playFolder', onPlayFolder as EventListener);
    return () => {
      window.removeEventListener('beforeunload', () => playerStore.save());
      window.removeEventListener('svelte:playFolder', onPlayFolder as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });
</script>

<!-- 全局原生 Audio 引擎 -->
<audio
  bind:this={audioEl}
  playsinline
  preload="auto"
  onplay={() => {
    if (isIosF3Holding()) return;
    playerStore.playing = true;
    bindMediaSessionHandlers();
    updateMediaSessionPlaybackState(true);
    if (playerStore.activeTrack) {
      updateMediaSessionMetadata(playerStore.activeTrack);
      handleTrackPlayback(playerStore.activeTrack, () => playerStore.playing);
    }
    updateMediaSessionPosition(audioEl);
    preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
  }}
  onpause={() => {
    if (isIosF3Holding()) return;
    playerStore.playing = false;
    updateMediaSessionPlaybackState(false);
    updateMediaSessionPosition(audioEl);
  }}
  ontimeupdate={(e) => {
    if (isIosF3Holding()) return;
    const a = e.currentTarget;
    playerStore.curTime = a.currentTime;
    if (a.duration && !isNaN(a.duration) && isFinite(a.duration)) {
      playerStore.duration = a.duration;
      if (getLastPositionSyncedKey() !== getCurrentTrackKey() && a.duration > 0) {
        updateMediaSessionPosition(a);
      }
    }
    if (playerStore.curTime > 0) { try { localStorage.setItem('wyyyy_player_time', String(playerStore.curTime)); } catch {} }
    if (parsedLyrics.length > 0 && playerStore.activeTrack) {
      const activeLyric = getActiveLyric(parsedLyrics, a.currentTime);
      if (activeLyric.index !== lastLyricIndex) {
        lastLyricIndex = activeLyric.index;
        updateMediaSessionMetadata(playerStore.activeTrack, activeLyric);
      }
    }
  }}
  onloadedmetadata={(e) => {
    if (isIosF3Holding()) return;
    const a = e.currentTarget as HTMLAudioElement;
    if (a.duration && !isNaN(a.duration) && isFinite(a.duration)) playerStore.duration = a.duration;
    bindMediaSessionHandlers();
    updateMediaSessionPosition(a);
  }}
  onseeked={(e) => {
    if (isIosF3Holding()) return;
    const a = e.currentTarget as HTMLAudioElement;
    bindMediaSessionHandlers();
    updateMediaSessionPosition(a);
    if (parsedLyrics.length > 0 && playerStore.activeTrack) {
      const activeLyric = getActiveLyric(parsedLyrics, a.currentTime);
      lastLyricIndex = activeLyric.index;
      updateMediaSessionMetadata(playerStore.activeTrack, activeLyric);
    }
  }}
  onerror={() => {
    if (isIosF3Holding()) return;
    console.warn('[Player] Native audio stream load failed:', audioEl?.error);
    const cur = playerStore.activeTrack;
    if (audioEl?.src && audioEl.src !== window.location.href && cur && playerStore.playing) {
      cur.unplayable = true; cur.unplayableReason = t('player.audioStreamFailed');
      handleSkipTrack(cur, t('player.audioStreamFailed'), false);
    } else { playerStore.playing = false; }
  }}
  onended={(e) => {
    if (isIosF3Holding() || !playerStore.playing) return;
    resetTrackPlayback();
    const a = e.currentTarget as HTMLAudioElement;
    if (a.currentTime < 3 && a.duration > 10) {
      console.warn('[Player] Audio stream interrupted prematurely, attempting reconnect');
      try { a.load(); a.play().catch(() => {}); return; } catch {}
    }
    if (playerStore.playMode === 'single') {
      playerStore.curTime = 0;
      if (audioEl) { try { audioEl.currentTime = 0; } catch {} audioEl.play().catch(() => {}); }
    } else { next(); }
  }}
></audio>

<!-- 🎬 现代专业音频播放控制栏 -->
<PlayerBar
  curTrack={playerStore.activeTrack} queue={playerStore.queue} playing={playerStore.playing}
  curTime={playerStore.curTime} duration={playerStore.duration} playMode={playerStore.playMode}
  bind:vol={playerStore.vol} bind:minimized={isPlayerMinimized} onTogglePlay={handleTogglePlay} onPrev={prev} onNext={next}
  onToggleMode={handleToggleMode} onSeek={seek} onLyric={() => showLyric = !showLyric}
  onPeq={() => showPeq = !showPeq} onQueue={() => showDrawer = !showDrawer}
  onClearQueue={handleClearQueue}
  {likedSet} onToggleLike={() => onToggleLike(Number(playerStore.activeTrack?.id), playerStore.activeTrack?.name || '')}
/>

<!-- 📜 播放列表统一抽屉 -->
{#if showDrawer}
  <PlaylistDrawer
    queue={playerStore.queue} qIndex={playerStore.qIndex} tasks={taskState.tasks} {likedSet}
    autoSkipTrial={playerStore.autoSkipTrial} serverOnly={playerStore.serverOnly} offlineOnly={playerStore.offlineOnly}
    downloadedSet={taskState.downloadedSet}
    onPlayIndex={(idx) => { playerStore.qIndex = idx; playerStore.curTime = 0; if (audioEl) { try { audioEl.currentTime = 0; } catch {} } ensurePlay(true); }}
    onClearQueue={handleClearQueue}
    onRemoveItem={(realIdx) => playerStore.removeItem(realIdx)}
    onToggleLike={onToggleLike} onToggleAutoSkip={(val) => playerStore.toggleAutoSkipTrial(val)}
    onToggleServerOnly={(val) => playerStore.toggleServerOnly(val)} onToggleOfflineOnly={(val) => playerStore.toggleOfflineOnly(val)}
    onClearTasks={clearTasks} onShuffle={handleShuffleAction} {onReveal} onClose={() => showDrawer = false}
  />
{/if}

<!-- 全屏黑胶歌词 -->
{#if showLyric && playerStore.activeTrack}
  <LyricModal
    track={playerStore.activeTrack} currentTime={playerStore.curTime} duration={playerStore.duration}
    playing={playerStore.playing} playMode={playerStore.playMode} bind:vol={playerStore.vol}
    isLiked={likedSet.has(Number(playerStore.activeTrack.id))}
    onTogglePlay={handleTogglePlay} onPrev={prev} onNext={next} onToggleMode={handleToggleMode} onSeek={seek}
    onSeekTime={(t) => applyTargetSeek(t)}
    onToggleLike={() => onToggleLike(Number(playerStore.activeTrack?.id), playerStore.activeTrack?.name || '')}
    onTogglePeq={() => showPeq = !showPeq} onToggleDrawer={() => showDrawer = !showDrawer} onClose={() => showLyric = false}
  />
{/if}

<!-- 🎛️ 5 段参量均衡器统一抽屉 -->
{#if showPeq}
  <PeqDrawer onClose={() => showPeq = false} />
{/if}
