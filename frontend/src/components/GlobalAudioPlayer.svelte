<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast.svelte';
  import { markSongDownloaded } from '../lib/trackStatus.svelte';
  import {
    resolveTrackUrl, preloadSurroundingTracks, isSameAudioSource, applySeekToAudio, parseFolderTracks,
    computeNextTrackOnSkip, handleRestrictedAudioCheck, prepareTrackInUI, fetchMissingLyric,
    isTrackUrlExpired, interruptionController
  } from '../lib/playerHelper';
  import { setupMediaSession, updateMediaSessionMetadata, updateMediaSessionPlaybackState, updateMediaSessionPosition, clearMediaSessionPosition, getLastPositionSyncedKey, getCurrentTrackKey } from '../lib/mediaSession';
  import { parseLrc, getActiveLyric } from '../lib/lyricParser';
  import { playerStore, type SetQueueOptions } from '../lib/playerStore.svelte';
  import { handleTrackPlayback, resetTrackPlayback } from '../lib/pwaCache.svelte';
  import type { Track } from '../lib/types';
  import { t } from '../lib/i18n';
  import { platform } from '../lib/platform';
  import { isIosF3Holding, handleIosF3Pause, handleIosF3Resume, resetIosF3State, updateIosF3SavedTime, holdTransitionKeepAlive } from '../lib/iosF3KeepAlive';
  import { playbackTelemetry } from '../lib/player/playbackTelemetry.svelte';
  import { sleepTimer } from '../lib/sleepTimer.svelte';
  import { audioVisualizer } from '../lib/player/audioVisualizer.svelte';
  import { skin } from '../lib/skinStore.svelte';
  import { checkAndTriggerAutoArchive } from '../lib/player/autoArchive';
  import { handleTrackEndedScrobble } from '../lib/player/scrobble';
  import {
    canRetryTrackStream, markTrackStreamRetried, clearTrackStreamRetry,
    clearStreamWatchdog, classifyPlayRejection, bindAndPlayWithWatchdog
  } from 'pwa-audio-player';
  import { getPreloadedTrackBlobUrl, isPreloadedBlobUrlForTrack, clearPreloadedTrackBlob } from '../lib/player/nextTrackPrecache';
  import { createSpacebarShortcutHandler } from '../lib/player/keyboardShortcuts';

  import PlayerBar from './PlayerBar.svelte';
  import PlayerOverlays from './PlayerOverlays.svelte';

  let {
    curTrack = $bindable(null), playing = $bindable(false), setQueue = $bindable(),
    togglePlay = $bindable(() => {}), isOverlayOpen = $bindable(false), likedSet = new Set<number>(),
    onToggleLike = () => {}, onReveal = () => {}, showPeq = $bindable(false), isPlayerMinimized = $bindable(false)
  } = $props<{
    curTrack?: Track | null; playing?: boolean;
    setQueue?: (tracks: Track[], optionsOrIdx?: number | SetQueueOptions, maybePlaylistId?: string | number | null) => void;
    togglePlay?: () => void; isOverlayOpen?: boolean; likedSet?: Set<number>;
    onToggleLike?: (id: any, name?: string, artist?: string, extra?: any) => void; onReveal?: (item: any) => void;
    showPeq?: boolean; isPlayerMinimized?: boolean;
  }>();

  let showDrawer = $state(false), showLyric = $state(false), pendingSeekTime = $state<number | null>(null), audioEl: HTMLAudioElement | null = $state(null);
  let needsReloadOnResume = false, isPlaybackDesired = false, parsedLyrics = $derived(parseLrc(playerStore.activeTrack?.lyric)), lastLyricIndex = $state(-2), playSessionId = 0, consecutiveSkipCount = 0;

  $effect(() => {
    curTrack = playerStore.activeTrack;
    playing = playerStore.playing;
    isOverlayOpen = showDrawer || showLyric || showPeq;
    if (audioEl && platform.canAdjustVolume) audioEl.volume = playerStore.vol;
    try { localStorage.setItem('wyy_player_vol', String(playerStore.vol)); } catch {}
  });
  $effect(() => {
    const tr = playerStore.activeTrack;
    lastLyricIndex = -2;
    updateMediaSessionMetadata(tr);
    fetchMissingLyric(tr);
  });

  function applyPendingSeek() {
    if (!pendingSeekTime || pendingSeekTime <= 0 || !audioEl) return;
    applySeekToAudio(audioEl, pendingSeekTime);
    pendingSeekTime = null;
  }

  function advanceToNextTrack(track: Track, reason: string, isTrial = false): boolean {
    resetIosF3State(audioEl);
    const res = computeNextTrackOnSkip(track, reason, consecutiveSkipCount, isTrial);
    consecutiveSkipCount = res.nextCount;
    if (!res.hasNext) {
      isPlaybackDesired = false;
      if (audioEl) {
        interruptionController.markIntentionalPause();
        interruptionController.cancelRecovery();
        audioEl.pause();
        updateMediaSessionPlaybackState(false);
      }
    }
    return res.hasNext;
  }

  function handleStreamFailure(track: Track, session: number, reason = t('player.audioStreamFailed')) {
    if (session !== playSessionId) return;
    clearStreamWatchdog(); playbackTelemetry.recordStreamFailure(track, reason);
    if (audioEl?.src && isPreloadedBlobUrlForTrack(audioEl.src, track)) clearPreloadedTrackBlob();
    if (!track.isLocal && canRetryTrackStream(track)) {
      markTrackStreamRetried(track); track.url = ''; track.unplayable = false; ensurePlay(true); return;
    }
    track.unplayable = true; track.unplayableReason = reason;
    if (advanceToNextTrack(track, reason, false)) ensurePlay(true);
  }

  function handlePlayRejection(err: any, onStreamError: () => void) {
    const kind = classifyPlayRejection(err);
    if (kind === 'abort') return;
    playbackTelemetry.recordPlayRejection(kind, err, playerStore.activeTrack);
    if (kind === 'not_allowed') { isPlaybackDesired = false; playerStore.playing = false; updateMediaSessionPlaybackState(false); return; }
    onStreamError();
  }

  async function checkRestrictedAudio(a: HTMLAudioElement) {
    const res = await handleRestrictedAudioCheck(a.duration, playerStore.activeTrack, playerStore.playing, a.src);
    if (!res.isRestricted) return;
    if (res.fallbackUrl && audioEl) {
      if (playerStore.activeTrack) playerStore.activeTrack.url = res.fallbackUrl;
      audioEl.src = res.fallbackUrl; ensurePlay(true); return;
    }
    if (res.shouldSkip && playerStore.activeTrack) {
      showToast(`「${playerStore.activeTrack.name}」为端内受限音频(11s提示)，已自动跳过`, 'info', 2000);
      if (advanceToNextTrack(playerStore.activeTrack, '受限试听音频', true)) ensurePlay(true);
    }
  }

  function bindAndStartAudio(track: Track, url: string, session: number, resetTime: boolean) {
    if (!audioEl) return;
    playerStore.loading = false;
    const effectiveUrl = getPreloadedTrackBlobUrl(track) || url;
    bindAndPlayWithWatchdog({
      audioEl, track, url: effectiveUrl, session, getCurrentSession: () => playSessionId, resetTime,
      onMetadataSync: () => updateMediaSessionMetadata(track),
      onResetTimeApplied: () => { playerStore.curTime = 0; },
      onWatchdogTimeout: () => { playbackTelemetry.recordWatchdogTimeout(track); handleStreamFailure(track, session, t('player.networkFailed')); },
      onPlaySuccess: () => {
        consecutiveSkipCount = 0; playerStore.playing = true;
        if (resetTime && audioEl) { try { audioEl.currentTime = 0; } catch {} playerStore.curTime = 0; } else { applyPendingSeek(); }
        preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
      },
      onNotAllowed: () => { isPlaybackDesired = false; playerStore.playing = false; updateMediaSessionPlaybackState(false); },
      onStreamError: () => handleStreamFailure(track, session, t('player.audioStreamFailed'))
    });
  }

  async function ensurePlay(resetTime = false) {
    const currentSession = ++playSessionId;
    if (!audioEl) return;
    resetIosF3State(audioEl); clearStreamWatchdog(); interruptionController.cancelRecovery(); interruptionController.clearIntentionalPause();
    isPlaybackDesired = true; needsReloadOnResume = false;
    if (resetTime) { pendingSeekTime = null; clearMediaSessionPosition(); }

    while (true) {
      if (currentSession !== playSessionId) return;
      const track = playerStore.queue[playerStore.qIndex] || playerStore.activeTrack;
      if (!track) { isPlaybackDesired = false; playerStore.playing = false; return; }
      const isTrial = playerStore.autoSkipTrial && !track.isLocal && track.freeTrial === true && !track.allowTrial;
      if (isTrial || track.unplayable === true) {
        const reason = isTrial ? t('player.isTrialClip') : (track.unplayableReason || t('player.regionOrCopyrightRestricted'));
        if (!advanceToNextTrack(track, reason, isTrial)) return;
        resetTime = true; continue;
      }
      if (track.url && !track.isLocal && isTrackUrlExpired(track) && !getPreloadedTrackBlobUrl(track)) track.url = '';
      if (track.url) { playerStore.playing = true; bindAndStartAudio(track, track.url, currentSession, resetTime); return; }

      // 🌟 新曲目没有现成 URL，必须异步解析
      playerStore.playing = true; playerStore.loading = true;
      if (resetTime) playerStore.curTime = 0;
      holdTransitionKeepAlive(audioEl);
      try {
        const url = await resolveTrackUrl(track);
        if (currentSession !== playSessionId) return;
        const isTrialAfterResolve = playerStore.autoSkipTrial && !track.isLocal && track.freeTrial === true && !track.allowTrial;
        if (isTrialAfterResolve || !url || track.unplayable) {
          track.unplayable = true; playerStore.loading = false;
          const reason = isTrialAfterResolve ? t('player.isTrialClip') : (track.unplayableReason || t('player.regionOrCopyrightRestricted'));
          if (!advanceToNextTrack(track, reason, isTrialAfterResolve)) return;
          resetTime = true; continue;
        }
        const active = playerStore.queue[playerStore.qIndex] || playerStore.activeTrack;
        if (url && audioEl && active === track) bindAndStartAudio(track, url, currentSession, resetTime);
        return;
      } finally {
        if (currentSession === playSessionId) playerStore.loading = false;
      }
    }
  }

  function pauseAudio(isSleepTimer = false) {
    if (!audioEl) return;
    isPlaybackDesired = false; clearStreamWatchdog(); interruptionController.markIntentionalPause(); interruptionController.cancelRecovery();
    if (audioEl.currentTime > 0) playerStore.curTime = audioEl.currentTime;
    if (isSleepTimer) { resetIosF3State(audioEl); playerStore.playing = false; updateMediaSessionPlaybackState(false); audioEl.pause(); return; }
    if (platform.isIOS) {
      if (handleIosF3Pause(audioEl, playerStore.activeTrack, playerStore.curTime, playerStore.duration, audioEl.src, () => { playerStore.playing = true; })) {
        playerStore.playing = false; return;
      }
      if (typeof document === 'undefined' || document.visibilityState === 'hidden') needsReloadOnResume = true;
    }
    audioEl.pause();
  }

  function handleSleepTimerTrigger() { pauseAudio(true); showToast(t('settings.sleepTimerTriggered'), 'info', 4000); }

  function handleTogglePlay() {
    if (!audioEl) return;
    if (isIosF3Holding()) {
      interruptionController.cancelRecovery(); interruptionController.clearIntentionalPause(); isPlaybackDesired = true;
      if (handleIosF3Resume(audioEl, () => { playerStore.playing = true; preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode); })) {
        playerStore.playing = true; return;
      }
    }
    if (playerStore.loading) {
      playSessionId++; playerStore.loading = false; playerStore.playing = false;
      pauseAudio(); updateMediaSessionPlaybackState(false); showToast(t('player.loadingCancelled'), 'info', 1500); return;
    }
    if (!audioEl.paused) { pauseAudio(); return; }
    interruptionController.cancelRecovery(); interruptionController.clearIntentionalPause(); isPlaybackDesired = true;
    const currentSrc = audioEl.src, cur = playerStore.queue[playerStore.qIndex] || playerStore.activeTrack;
    if (audioEl.error || !currentSrc || currentSrc === window.location.href || currentSrc.startsWith('blob:') || !cur?.url || !isSameAudioSource(currentSrc, cur.url) || (!cur.isLocal && isTrackUrlExpired(cur))) {
      ensurePlay(false); return;
    }
    const resumeTime = audioEl.currentTime || playerStore.curTime || 0;
    if (platform.isIOS && (needsReloadOnResume || audioEl.readyState < 2)) {
      needsReloadOnResume = false;
      if (resumeTime > 0) pendingSeekTime = resumeTime;
      audioEl.src = currentSrc;
    }
    audioEl.play()?.then(() => { playerStore.playing = true; applyPendingSeek(); preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode); })
      .catch((err: any) => handlePlayRejection(err, () => { if (resumeTime > 0) pendingSeekTime = resumeTime; if (audioEl) audioEl.src = currentSrc; ensurePlay(false); }));
  }

  async function next() {
    resetIosF3State(audioEl); clearMediaSessionPosition();
    if (playerStore.queue.length === 0) return;
    resetTrackPlayback();
    const nextIdx = playerStore.getNextTrackIndex();
    if ((nextIdx < 0 || nextIdx === playerStore.qIndex) && playerStore.autoSkipTrial && !playerStore.activeTrack?.isLocal && (playerStore.activeTrack as any)?.freeTrial === true && !(playerStore.activeTrack as any)?.allowTrial) {
      playerStore.playing = false; if (audioEl) { audioEl.pause(); try { audioEl.currentTime = 0; } catch {} }
      showToast(t('player.noMoreCompleteTracksToPlay'), 'info', 2000); return;
    }
    playerStore.stepNext();
    await ensurePlay(true);
  }

  async function prev() {
    resetIosF3State(audioEl); clearMediaSessionPosition();
    if (playerStore.queue.length === 0) return;
    resetTrackPlayback(); playerStore.stepPrev();
    await ensurePlay(true);
  }

  function applyTargetSeek(targetTime: number) {
    if (!audioEl) return;
    if (isIosF3Holding()) { playerStore.curTime = targetTime; updateIosF3SavedTime(targetTime); playerStore.save(); return; }
    audioEl.currentTime = targetTime; playerStore.curTime = audioEl.currentTime; playerStore.save();
  }
  function seek(e: MouseEvent) {
    if (!audioEl || !playerStore.duration) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    applyTargetSeek(((e.clientX - rect.left) / rect.width) * playerStore.duration);
  }
  function handleClearQueue() {
    resetIosF3State(audioEl); playSessionId++; isPlaybackDesired = false; clearPreloadedTrackBlob();
    clearStreamWatchdog(); interruptionController.markIntentionalPause(); interruptionController.cancelRecovery(); clearTrackStreamRetry();
    playerStore.loading = false;
    if (audioEl) { audioEl.pause(); try { audioEl.currentTime = 0; } catch {} audioEl.removeAttribute('src'); audioEl.load(); }
    playerStore.clearQueue(); showToast(t('player.queueCleared'), 'info');
  }

  function handleSetQueue(tracks: Track[], optionsOrIdx: number | SetQueueOptions = 0, maybePlaylistId?: string | number | null) {
    resetIosF3State(audioEl);
    if (!tracks || !tracks.length) return;
    const targetPlaylistId = typeof optionsOrIdx === 'number' ? (maybePlaylistId ?? null) : (optionsOrIdx?.playlistId ?? null);

    if (targetPlaylistId != null && playerStore.playlistId && String(playerStore.playlistId) === String(targetPlaylistId) && playerStore.queue.length > 0) {
      showToast(playerStore.playing ? t('player.playingThisPlaylistNow') : t('player.continuePlayingThisPlaylist'), 'info', 1500);
      if (!playerStore.playing) handleTogglePlay();
      return;
    }

    clearTrackStreamRetry();
    playerStore.setQueue(tracks, optionsOrIdx, maybePlaylistId);
    preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
    ensurePlay(true);

    const targetTrack = playerStore.queue[playerStore.qIndex] || playerStore.activeTrack;
    if (targetTrack?.id) {
      if (targetTrack.isLocal) markSongDownloaded(targetTrack.id);
      else if (!targetTrack.freeTrial) {
        api.downloadSingle(String(targetTrack.id)).then(() => {
          showToast(t('player.addedAutoDownload', { name: targetTrack.name || t('common.song') }), 'info', 2000);
          window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
        }).catch(() => {});
      }
    }
  }

  setQueue = handleSetQueue;
  togglePlay = handleTogglePlay;

  function handleToggleMode() {
    if (playerStore.togglePlayMode() === 'shuffle') showToast(t('player.shuffledNotice'), 'info', 2000);
    preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
  }
  function handleShuffleAction() {
    playerStore.shuffleQueue();
    preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
  }

  function bindMediaSessionHandlers() {
    setupMediaSession({
      onPlay: () => { if (isIosF3Holding() || audioEl?.paused) handleTogglePlay(); },
      onPause: () => pauseAudio(),
      onPrev: () => { resetIosF3State(audioEl); prev(); },
      onNext: () => { resetIosF3State(audioEl); next(); }
    });
  }

  onMount(() => {
    playerStore.restore();
    if (playerStore.curTime > 0) pendingSeekTime = playerStore.curTime;
    const currentTrack = playerStore.activeTrack;
    if (currentTrack) prepareTrackInUI(currentTrack, audioEl);
    bindMediaSessionHandlers();
    // ⚠️ iOS 严禁调用 navigator.audioSession (会导致 Safari 系统级死锁崩溃循环刷新)

    const onBeforeUnload = () => playerStore.save();
    const tryForegroundResume = () => interruptionController.executeForegroundResume({
      audioEl, track: playerStore.queue[playerStore.qIndex] || playerStore.activeTrack, curTime: playerStore.curTime, needsReload: needsReloadOnResume,
      onPendingSeek: (t) => { pendingSeekTime = t; }, onClearedReload: () => { needsReloadOnResume = false; },
      onRecovered: () => { playbackTelemetry.recordInterruptionRecovery('recovered'); isPlaybackDesired = true; playerStore.playing = true; applyPendingSeek(); updateMediaSessionPlaybackState(true); updateMediaSessionPosition(audioEl); },
      onFallbackPlay: () => ensurePlay(false)
    });
    const handleVisibilityChange = () => {
      if (!audioEl || isIosF3Holding()) return;
      if (document.visibilityState === 'hidden') {
        if (audioEl.currentTime > 0) playerStore.curTime = audioEl.currentTime;
        playerStore.save();
        if (platform.isIOS && audioEl.paused) needsReloadOnResume = true;
        return;
      }
      if (interruptionController.isInterrupted()) { tryForegroundResume(); return; }
      if (!audioEl.paused && audioEl.currentTime > 0) playerStore.curTime = audioEl.currentTime;
    };

    const onPlayFolder = (e: CustomEvent) => {
      const { tracks, name } = e.detail;
      const q = parseFolderTracks(tracks);
      if (!q.length) return showToast(t('folder.noPlayableFiles'), 'warning');
      handleSetQueue(q, 0);
      showToast(t('folder.playingFolderStats', { name, count: q.length }), 'success', 3000);
    };

    const onPlayTracksEvent = (e: CustomEvent) => { if (e.detail?.tracks) handleSetQueue(e.detail.tracks, e.detail.optionsOrIdx || 0, e.detail.playlistId); };
    const onToggleLyricModal = () => { if (playerStore.activeTrack) showLyric = !showLyric; };
    const onTogglePlayEvent = () => handleTogglePlay();

    const spaceShortcut = createSpacebarShortcutHandler({
      hasActiveTrack: () => Boolean(playerStore.activeTrack),
      hasQueue: () => playerStore.queue.length > 0,
      onTogglePlay: handleTogglePlay,
      onToggleLyric: () => { showLyric = !showLyric; },
      onStartQueueLyric: () => { playerStore.qIndex = 0; showLyric = true; ensurePlay(true); }
    });

    const listeners: [string, EventListener, EventTarget?][] = [
      ['keydown', spaceShortcut.handler as EventListener], ['beforeunload', onBeforeUnload as EventListener], ['focus', tryForegroundResume as EventListener],
      ['svelte:playFolder', onPlayFolder as EventListener], ['wyy:play-tracks', onPlayTracksEvent as EventListener],
      ['wyy:sleep-timer-trigger', handleSleepTimerTrigger as EventListener], ['wyy:toggle-lyric-modal', onToggleLyricModal as EventListener],
      ['wyy:toggle-play', onTogglePlayEvent as EventListener], ['visibilitychange', handleVisibilityChange as EventListener, document]
    ];
    listeners.forEach(([ev, fn, target]) => (target || window).addEventListener(ev, fn));
    const detachTelemetry = playbackTelemetry.attachAudioElement({ getAudioEl: () => audioEl, getDesired: () => isPlaybackDesired, isUrlExpired: isTrackUrlExpired });

    return () => {
      spaceShortcut.cleanup(); detachTelemetry();
      listeners.forEach(([ev, fn, target]) => (target || window).removeEventListener(ev, fn));
    };
  });
  function onAudioPlay() {
    if (isIosF3Holding()) return;
    clearStreamWatchdog();
    interruptionController.clearIntentionalPause();
    interruptionController.consumePendingResumePosition(audioEl, playerStore.activeTrack?.id);
    isPlaybackDesired = true;
    playerStore.playing = true;
    if (audioEl) {
      if (!platform.isIOS && platform.canUseAudioProcessing) audioVisualizer.attach(audioEl);
      audioVisualizer.start();
    }
    bindMediaSessionHandlers();
    updateMediaSessionPlaybackState(true);
    if (playerStore.activeTrack) {
      updateMediaSessionMetadata(playerStore.activeTrack);
      handleTrackPlayback(playerStore.activeTrack, () => playerStore.playing);
    }
    updateMediaSessionPosition(audioEl);
    preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
  }

  function onAudioPause() {
    if (isIosF3Holding() || audioEl?.ended || playerStore.loading || !audioEl) return;
    audioVisualizer.stop();
    if (audioEl.currentTime > 0) { playerStore.curTime = audioEl.currentTime; playerStore.save(); }
    const wasPlaying = playerStore.playing;
    playerStore.playing = false;
    interruptionController.dispatchPauseEvent({
      audioEl, wasPlaying, curTime: playerStore.curTime, duration: playerStore.duration, trackId: playerStore.activeTrack?.id,
      onSyncPaused: () => { updateMediaSessionPlaybackState(false); updateMediaSessionPosition(audioEl); },
      onRecovered: () => { playbackTelemetry.recordInterruptionRecovery('recovered'); isPlaybackDesired = true; playerStore.playing = true; updateMediaSessionPlaybackState(true); updateMediaSessionPosition(audioEl); },
      onGiveUp: () => { playbackTelemetry.recordInterruptionRecovery('give_up'); isPlaybackDesired = false; playerStore.playing = false; updateMediaSessionPlaybackState(false); updateMediaSessionPosition(audioEl); needsReloadOnResume = true; }
    });
  }

  function syncLyricMetadata(curTime: number, force = false) {
    if (parsedLyrics.length === 0 || !playerStore.activeTrack) return;
    const active = getActiveLyric(parsedLyrics, curTime);
    if (force || active.index !== lastLyricIndex) {
      lastLyricIndex = active.index;
      updateMediaSessionMetadata(playerStore.activeTrack, active);
    }
  }

  function onAudioTimeUpdate(e: Event) {
    if (isIosF3Holding() || sleepTimer.checkTick(() => handleSleepTimerTrigger())) return;
    const a = e.currentTarget as HTMLAudioElement;
    playerStore.curTime = a.currentTime;
    if (a.duration && !isNaN(a.duration) && isFinite(a.duration)) {
      playerStore.duration = a.duration;
      if (getLastPositionSyncedKey() !== getCurrentTrackKey() && a.duration > 0) updateMediaSessionPosition(a);
    }
    if (playerStore.activeTrack && playerStore.duration > 0) checkAndTriggerAutoArchive(playerStore.activeTrack, a.currentTime, playerStore.duration);
    if (playerStore.curTime > 0) { try { localStorage.setItem('wyy_player_time', String(playerStore.curTime)); } catch {} }
    syncLyricMetadata(a.currentTime);
  }

  function onAudioLoadedMetadata(e: Event) {
    if (isIosF3Holding()) return;
    const a = e.currentTarget as HTMLAudioElement;
    if (a.duration && !isNaN(a.duration) && isFinite(a.duration)) playerStore.duration = a.duration;
    bindMediaSessionHandlers(); updateMediaSessionPosition(a); checkRestrictedAudio(a);
  }

  function onAudioSeeked(e: Event) {
    if (isIosF3Holding()) return;
    const a = e.currentTarget as HTMLAudioElement;
    bindMediaSessionHandlers(); updateMediaSessionPosition(a);
    syncLyricMetadata(a.currentTime, true);
  }

  function onAudioError() {
    if (isIosF3Holding()) return;
    console.warn('[Player] Native audio stream load failed:', audioEl?.error);
    const cur = playerStore.activeTrack;
    const isBlobMatch = Boolean(audioEl?.src && cur && isPreloadedBlobUrlForTrack(audioEl.src, cur));
    if (cur?.url && audioEl?.src && (isSameAudioSource(audioEl.src, cur.url) || isBlobMatch) && (playerStore.playing || isPlaybackDesired)) {
      if (isBlobMatch) clearPreloadedTrackBlob();
      handleStreamFailure(cur, playSessionId, t('player.audioStreamFailed'));
    } else if (!cur || !playerStore.playing) {
      playerStore.playing = false;
    }
  }

  function onAudioEnded(e: Event) {
    if (isIosF3Holding()) return;
    interruptionController.cancelRecovery(); clearStreamWatchdog();
    if (sleepTimer.isEndOfTrack()) { sleepTimer.cancelTimer(); handleSleepTimerTrigger(); return; }
    resetTrackPlayback();
    const a = e.currentTarget as HTMLAudioElement;
    const onPlayErr = (err: any) => handlePlayRejection(err, () => { if (playerStore.activeTrack) handleStreamFailure(playerStore.activeTrack, playSessionId, t('player.audioStreamFailed')); });
    if (a.currentTime < 3 && a.duration > 10) {
      console.warn('[Player] Audio stream interrupted prematurely, attempting reconnect');
      try { a.load(); a.play().catch(onPlayErr); return; } catch {}
    }
    handleTrackEndedScrobble(playerStore.activeTrack, a.duration, playerStore.playlistId);
    if (playerStore.playMode === 'single') {
      playerStore.curTime = 0; playerStore.playing = true; isPlaybackDesired = true;
      if (audioEl) { try { audioEl.currentTime = 0; } catch {} audioEl.play().catch(onPlayErr); }
    } else { next(); }
  }
</script>

<!-- 全局原生 Audio 引擎 (严禁 crossorigin 与 iOS Web Audio 接入，确保外链 CDN 与熄屏直通播放) -->
<audio
  bind:this={audioEl} playsinline preload="auto"
  onplay={onAudioPlay} onpause={onAudioPause} ontimeupdate={onAudioTimeUpdate}
  onloadedmetadata={onAudioLoadedMetadata} onseeked={onAudioSeeked} onerror={onAudioError} onended={onAudioEnded}
></audio>

<!-- 🎬 现代专业音频播放控制栏 -->
<PlayerBar
  curTrack={playerStore.activeTrack} queue={playerStore.queue} playing={playerStore.playing} loading={playerStore.loading}
  curTime={playerStore.curTime} duration={playerStore.duration} playMode={playerStore.playMode}
  bind:vol={playerStore.vol} bind:minimized={isPlayerMinimized} onTogglePlay={handleTogglePlay} onPrev={prev} onNext={next}
  onToggleMode={handleToggleMode} onSeek={seek} onLyric={() => showLyric = !showLyric}
  onPeq={() => showPeq = !showPeq} onQueue={() => showDrawer = !showDrawer} onClearQueue={handleClearQueue}
  {likedSet} onToggleLike={() => onToggleLike(playerStore.activeTrack?.id, playerStore.activeTrack?.name || '', playerStore.activeTrack?.artist, playerStore.activeTrack)}
/>

<!-- 📜 全局弹出层组件群 (播放列表抽屉 · 黑胶歌词大屏 · PEQ 均衡器) -->
<PlayerOverlays
  bind:showDrawer bind:showLyric bind:showPeq {likedSet} {onToggleLike} {onReveal}
  onPlayIndex={(idx) => { playerStore.qIndex = idx; playerStore.curTime = 0; if (audioEl) { try { audioEl.currentTime = 0; } catch {} } ensurePlay(true); }}
  onClearQueue={handleClearQueue} onShuffle={handleShuffleAction} onTogglePlay={handleTogglePlay} onPrev={prev} onNext={next} onToggleMode={handleToggleMode} onSeek={seek} onSeekTime={(t) => applyTargetSeek(t)}
/>
