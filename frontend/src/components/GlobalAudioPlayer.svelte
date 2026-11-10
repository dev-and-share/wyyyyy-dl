<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast.svelte';
  import { markSongDownloaded } from '../lib/trackStatus.svelte';
  import { resolveTrackUrl, preloadSurroundingTracks, isSameAudioSource, applySeekToAudio, parseFolderTracks, computeNextTrackOnSkip, handleRestrictedAudioCheck, prepareTrackInUI, fetchMissingLyric } from '../lib/playerHelper';
  import { setupMediaSession, updateMediaSessionMetadata, updateMediaSessionPlaybackState, updateMediaSessionPosition, clearMediaSessionPosition, getLastPositionSyncedKey, getCurrentTrackKey } from '../lib/mediaSession';
  import { parseLrc, getActiveLyric } from '../lib/lyricParser';
  import { playerStore, type SetQueueOptions } from '../lib/playerStore.svelte';
  import { handleTrackPlayback, resetTrackPlayback } from '../lib/pwaCache.svelte';
  import type { Track } from '../lib/types';
  import { t } from '../lib/i18n';
  import { platform } from '../lib/platform';
  import { isIosF3Holding, handleIosF3Pause, handleIosF3Resume, resetIosF3State, updateIosF3SavedTime, holdTransitionKeepAlive } from '../lib/iosF3KeepAlive';
  import { sleepTimer } from '../lib/sleepTimer.svelte';
  import { audioVisualizer } from '../lib/player/audioVisualizer.svelte';
  import { skin } from '../lib/skinStore.svelte';
  import { checkAndTriggerAutoArchive } from '../lib/player/autoArchive';

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
  let needsReloadOnResume = false, parsedLyrics = $derived(parseLrc(playerStore.activeTrack?.lyric)), lastLyricIndex = $state(-2), playSessionId = 0, consecutiveSkipCount = 0;

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
    if (audioEl) { audioEl.pause(); try { audioEl.currentTime = 0; } catch {} audioEl.removeAttribute('src'); audioEl.load(); }
    const res = computeNextTrackOnSkip(track, reason, consecutiveSkipCount, isTrial);
    consecutiveSkipCount = res.nextCount;
    return res.hasNext;
  }

  async function checkRestrictedAudio(a: HTMLAudioElement) {
    const res = await handleRestrictedAudioCheck(a.duration, playerStore.activeTrack, playerStore.playing, a.src);
    if (!res.isRestricted) return;
    if (res.fallbackUrl && audioEl) {
      if (playerStore.activeTrack) playerStore.activeTrack.url = res.fallbackUrl;
      audioEl.src = res.fallbackUrl;
      ensurePlay(true);
      return;
    }
    if (res.shouldSkip && playerStore.activeTrack) {
      showToast(`「${playerStore.activeTrack.name}」为端内受限音频(11s提示)，已自动跳过`, 'info', 2000);
      if (advanceToNextTrack(playerStore.activeTrack, '受限试听音频', true)) ensurePlay(true);
    }
  }

  async function ensurePlay(resetTime = false) {
    const currentSession = ++playSessionId;
    if (!audioEl) return;
    resetIosF3State(audioEl);
    needsReloadOnResume = false;
    if (resetTime) { pendingSeekTime = null; clearMediaSessionPosition(); }

    const startAudio = (session: number) => {
      const p = audioEl?.play();
      if (p !== undefined) {
        p.then(() => {
          if (session !== playSessionId) return;
          consecutiveSkipCount = 0;
          if (resetTime && audioEl) { try { audioEl.currentTime = 0; } catch {} playerStore.curTime = 0; } else { applyPendingSeek(); }
          preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
        }).catch(() => {
          if (session !== playSessionId) return;
          playerStore.playing = false; updateMediaSessionPlaybackState(false);
        });
      }
    };

    while (true) {
      if (currentSession !== playSessionId) return;
      const track = playerStore.queue[playerStore.qIndex] || playerStore.activeTrack;
      if (!track) return;

      const isTrial = playerStore.autoSkipTrial && !track.isLocal && track.freeTrial === true;
      if (isTrial || track.unplayable === true) {
        const reason = isTrial ? t('player.isTrialClip') : (track.unplayableReason || t('player.regionOrCopyrightRestricted'));
        const hasNext = advanceToNextTrack(track, reason, isTrial);
        if (!hasNext) return;
        resetTime = true;
        continue;
      }

      const existingUrl = track.url;
      if (existingUrl) {
        playerStore.loading = false;
        try { audioEl.loop = false; } catch {}
        if (!isSameAudioSource(audioEl.src, existingUrl)) {
          updateMediaSessionMetadata(track);
          audioEl.src = existingUrl;
          if (resetTime) { try { audioEl.currentTime = 0; } catch {} }
        }
        if (resetTime) {
          playerStore.curTime = 0;
          const onMeta = () => { try { if (audioEl) audioEl.currentTime = 0; } catch {} audioEl?.removeEventListener('loadedmetadata', onMeta); };
          audioEl.addEventListener('loadedmetadata', onMeta);
        }
        startAudio(currentSession);
        return;
      }

      // 🌟 新曲目没有现成 URL，必须异步解析！
      playerStore.loading = true;
      if (resetTime) playerStore.curTime = 0;

      holdTransitionKeepAlive(audioEl);

      try {
        const url = await resolveTrackUrl(track);
        if (currentSession !== playSessionId) return;

        const isTrialAfterResolve = playerStore.autoSkipTrial && !track.isLocal && track.freeTrial === true;
        if (isTrialAfterResolve || !url || track.unplayable) {
          track.unplayable = true;
          playerStore.loading = false;
          const reason = isTrialAfterResolve ? t('player.isTrialClip') : (track.unplayableReason || t('player.regionOrCopyrightRestricted'));
          const hasNext = advanceToNextTrack(track, reason, isTrialAfterResolve);
          if (!hasNext) return;
          resetTime = true;
          continue;
        }

        const active = playerStore.queue[playerStore.qIndex] || playerStore.activeTrack;
        if (url && audioEl && active === track) {
          playerStore.loading = false;
          try { audioEl.loop = false; } catch {}
          if (!isSameAudioSource(audioEl.src, url)) {
            updateMediaSessionMetadata(track);
            audioEl.src = url;
            if (resetTime) { try { audioEl.currentTime = 0; } catch {} }
          }
          startAudio(currentSession);
        }
        return;
      } finally {
        if (currentSession === playSessionId) {
          playerStore.loading = false;
        }
      }
    }
  }

  function pauseAudio(isSleepTimer = false) {
    if (!audioEl) return;
    if (audioEl.currentTime > 0) playerStore.curTime = audioEl.currentTime;
    if (isSleepTimer) {
      resetIosF3State(audioEl); playerStore.playing = false; updateMediaSessionPlaybackState(false); audioEl.pause(); return;
    }
    if (platform.isIOS) {
      if (handleIosF3Pause(audioEl, playerStore.activeTrack, playerStore.curTime, playerStore.duration, audioEl.src, () => { playerStore.playing = true; })) {
        playerStore.playing = false; return;
      }
      if (typeof document === 'undefined' || document.visibilityState === 'hidden') needsReloadOnResume = true;
    }
    audioEl.pause();
  }

  function handleSleepTimerTrigger() {
    pauseAudio(true); showToast(t('settings.sleepTimerTriggered'), 'info', 4000);
  }

  function handleTogglePlay() {
    if (!audioEl) return;
    if (isIosF3Holding()) {
      if (handleIosF3Resume(audioEl, () => {
        playerStore.playing = true; preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
      })) { playerStore.playing = true; return; }
    }
    // 🛑 核心打断：正在异步加载/解析音频（如 MusicFree 音源检索）中，点击按钮立即中止会话并取消
    if (playerStore.loading) {
      playSessionId++;
      playerStore.loading = false;
      playerStore.playing = false;
      pauseAudio();
      updateMediaSessionPlaybackState(false);
      showToast(t('player.loadingCancelled'), 'info', 1500);
      return;
    }
    if (audioEl.paused) {
      const currentSrc = audioEl.src;
      const cur = playerStore.queue[playerStore.qIndex] || playerStore.activeTrack;
      if (audioEl.error || !currentSrc || currentSrc === window.location.href || currentSrc.startsWith('blob:') || !cur?.url || !isSameAudioSource(currentSrc, cur.url)) {
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
        p.then(() => { applyPendingSeek(); preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode); }).catch(() => { playerStore.playing = false; ensurePlay(false); });
      }
    } else {
      pauseAudio();
    }
  }

  async function next() {
    resetIosF3State(audioEl); clearMediaSessionPosition();
    if (playerStore.queue.length === 0) return;
    resetTrackPlayback();
    const nextIdx = playerStore.getNextTrackIndex();
    if ((nextIdx < 0 || nextIdx === playerStore.qIndex) && playerStore.autoSkipTrial && !playerStore.activeTrack?.isLocal && (playerStore.activeTrack as any)?.freeTrial === true) {
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
    resetIosF3State(audioEl);
    playSessionId++;
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
    const handleVisibilityChange = () => {
      if (!audioEl || isIosF3Holding()) return;
      if (document.visibilityState === 'hidden') {
        if (platform.isIOS && audioEl.paused) needsReloadOnResume = true;
        return;
      }
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

    // ⌨️ 全局空格快捷键：单按延迟 250ms 切换播控；连按两次切换沉浸大屏且绝不暂停音乐
    let spaceTimer: any = null;
    let lastDoublePressTime = 0;
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastDoublePressTime < 280) return;
      if (spaceTimer) {
        clearTimeout(spaceTimer); spaceTimer = null; lastDoublePressTime = now;
        if (playerStore.activeTrack) { showLyric = !showLyric; }
        else if (playerStore.queue.length > 0) { playerStore.qIndex = 0; showLyric = true; ensurePlay(true); }
        return;
      }
      spaceTimer = setTimeout(() => { spaceTimer = null; handleTogglePlay(); }, 250);
    };

    const listeners: [string, EventListener, EventTarget?][] = [
      ['keydown', onGlobalKeyDown as EventListener], ['beforeunload', onBeforeUnload as EventListener],
      ['svelte:playFolder', onPlayFolder as EventListener], ['wyy:play-tracks', onPlayTracksEvent as EventListener],
      ['wyy:sleep-timer-trigger', handleSleepTimerTrigger as EventListener], ['wyy:toggle-lyric-modal', onToggleLyricModal as EventListener],
      ['wyy:toggle-play', onTogglePlayEvent as EventListener], ['visibilitychange', handleVisibilityChange as EventListener, document]
    ];
    listeners.forEach(([ev, fn, target]) => (target || window).addEventListener(ev, fn));

    return () => {
      if (spaceTimer) { clearTimeout(spaceTimer); spaceTimer = null; }
      listeners.forEach(([ev, fn, target]) => (target || window).removeEventListener(ev, fn));
    };
  });
  function onAudioPlay() {
    if (isIosF3Holding()) return;
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
    if (isIosF3Holding()) return;
    playerStore.playing = false; audioVisualizer.stop();
    updateMediaSessionPlaybackState(false); updateMediaSessionPosition(audioEl);
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
    if (parsedLyrics.length > 0 && playerStore.activeTrack) {
      const active = getActiveLyric(parsedLyrics, a.currentTime);
      if (active.index !== lastLyricIndex) {
        lastLyricIndex = active.index;
        updateMediaSessionMetadata(playerStore.activeTrack, active);
      }
    }
  }

  function onAudioLoadedMetadata(e: Event) {
    if (isIosF3Holding()) return;
    const a = e.currentTarget as HTMLAudioElement;
    if (a.duration && !isNaN(a.duration) && isFinite(a.duration)) playerStore.duration = a.duration;
    bindMediaSessionHandlers();
    updateMediaSessionPosition(a);
    checkRestrictedAudio(a);
  }

  function onAudioSeeked(e: Event) {
    if (isIosF3Holding()) return;
    const a = e.currentTarget as HTMLAudioElement;
    bindMediaSessionHandlers(); updateMediaSessionPosition(a);
    if (parsedLyrics.length > 0 && playerStore.activeTrack) {
      const active = getActiveLyric(parsedLyrics, a.currentTime);
      lastLyricIndex = active.index; updateMediaSessionMetadata(playerStore.activeTrack, active);
    }
  }

  function onAudioError() {
    if (isIosF3Holding()) return;
    console.warn('[Player] Native audio stream load failed:', audioEl?.error);
    const cur = playerStore.activeTrack;
    if (cur?.url && audioEl?.src && isSameAudioSource(audioEl.src, cur.url) && cur && playerStore.playing) {
      cur.unplayable = true;
      cur.unplayableReason = t('player.audioStreamFailed');
      if (advanceToNextTrack(cur, t('player.audioStreamFailed'), false)) ensurePlay(true);
    } else if (!cur || !playerStore.playing) {
      playerStore.playing = false;
    }
  }

  function onAudioEnded(e: Event) {
    if (isIosF3Holding()) return;
    if (sleepTimer.isEndOfTrack()) { sleepTimer.cancelTimer(); handleSleepTimerTrigger(); return; }
    resetTrackPlayback();
    const a = e.currentTarget as HTMLAudioElement;
    if (a.currentTime < 3 && a.duration > 10) {
      console.warn('[Player] Audio stream interrupted prematurely, attempting reconnect');
      try { a.load(); a.play().catch(() => {}); return; } catch {}
    }
    if (playerStore.playMode === 'single') {
      playerStore.curTime = 0; if (audioEl) { try { audioEl.currentTime = 0; } catch {} audioEl.play().catch(() => {}); }
    } else {
      next();
    }
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
  curTrack={playerStore.activeTrack} queue={playerStore.queue} playing={playerStore.playing}
  loading={playerStore.loading}
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
  onClearQueue={handleClearQueue} onShuffle={handleShuffleAction} onTogglePlay={handleTogglePlay}
  onPrev={prev} onNext={next} onToggleMode={handleToggleMode} onSeek={seek} onSeekTime={(t) => applyTargetSeek(t)}
/>
