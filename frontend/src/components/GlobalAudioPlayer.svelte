<script lang="ts">
  import { onMount } from 'svelte';
  import { isIOS } from '../lib/utils';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast.svelte';
  import { taskState, clearTasks } from '../lib/taskStore.svelte';
  import { markSongDownloaded } from '../lib/trackStatus.svelte';
  import { resolveTrackUrl, preloadSurroundingTracks } from '../lib/playerHelper';
  import { setupMediaSession, updateMediaSessionMetadata, updateMediaSessionPlaybackState, updateMediaSessionPosition } from '../lib/mediaSession';
  import { parseLrc, getActiveLyric } from '../lib/lyricParser';
  import { playerStore } from '../lib/playerStore.svelte';
  import { handleTrackPlayback, resetTrackPlayback } from '../lib/pwaCache.svelte';
  import type { Track } from '../lib/types';

  import PlayerBar from './PlayerBar.svelte';
  import PlaylistDrawer from './PlaylistDrawer.svelte';
  import LyricModal from './LyricModal.svelte';
  import PeqDrawer from './PeqDrawer.svelte';

  let {
    curTrack = $bindable(null),
    playing = $bindable(false),
    setQueue = $bindable(),
    isOverlayOpen = $bindable(false),
    likedSet = new Set<number>(),
    onToggleLike = () => {},
    onReveal = () => {}
  } = $props<{
    curTrack?: Track | null;
    playing?: boolean;
    setQueue?: (tracks: Track[], idx?: number) => void;
    isOverlayOpen?: boolean;
    likedSet?: Set<number>;
    onToggleLike?: (id: number, name: string) => void;
    onReveal?: (item: any) => void;
  }>();

  // ---------- 视图与 DOM 状态 ----------
  let showDrawer = $state(false);
  let showLyric = $state(false);
  let showPeq = $state(false);
  let pendingSeekTime = $state<number | null>(null);
  let audioEl: HTMLAudioElement | null = $state(null);
  let parsedLyrics = $derived(parseLrc(playerStore.activeTrack?.lyric));
  let lastLyricIndex = $state(-2);

  // 状态同步
  $effect(() => { curTrack = playerStore.activeTrack; });
  $effect(() => { playing = playerStore.playing; });
  $effect(() => { isOverlayOpen = showDrawer || showLyric || showPeq; });
  $effect(() => {
    if (audioEl) audioEl.volume = playerStore.vol;
    try { localStorage.setItem('wyyyy_player_vol', String(playerStore.vol)); } catch {}
  });
  $effect(() => {
    const t = playerStore.activeTrack;
    lastLyricIndex = -2;
    updateMediaSessionMetadata(t);
  });
  $effect(() => {
    const t = playerStore.activeTrack;
    if (t?.id && !t.lyric) {
      api.songV1(String(t.id), 'lossless').then((j: any) => {
        if (j?.data?.lyric && playerStore.activeTrack?.id === t.id) {
          t.lyric = j.data.lyric;
          playerStore.activeTrack.lyric = j.data.lyric;
        }
      }).catch(() => {});
    }
  });
  $effect(() => { updateMediaSessionPlaybackState(playerStore.playing); });

  async function prepareTrackInUI(track: Track) {
    if (track.isLocal && track.id) markSongDownloaded(track.id);
    const url = track.url || (await resolveTrackUrl(track));
    if (track.isLocal && track.id) markSongDownloaded(track.id);
    if (url && audioEl && (!audioEl.src || audioEl.src === window.location.href)) {
      audioEl.src = url;
    }
  }

  function applyPendingSeek() {
    if (!pendingSeekTime || pendingSeekTime <= 0 || !audioEl) return;
    const target = pendingSeekTime;
    pendingSeekTime = null;

    const doSeek = () => {
      if (!audioEl) return;
      try {
        if (audioEl.duration && !isNaN(audioEl.duration) && isFinite(audioEl.duration)) {
          if (target < audioEl.duration) audioEl.currentTime = target;
        } else {
          const onMeta = () => {
            try {
              if (audioEl && audioEl.duration && target < audioEl.duration) audioEl.currentTime = target;
            } catch {}
            audioEl?.removeEventListener('loadedmetadata', onMeta);
          };
          audioEl.addEventListener('loadedmetadata', onMeta);
        }
      } catch (e) {
        console.warn('[Player] 恢复断点进度失败:', e);
      }
    };
    setTimeout(doSeek, 60);
  }

  async function ensurePlay(resetTime = false) {
    const track = playerStore.activeTrack;
    if (!track || !audioEl) return;

    if (resetTime) pendingSeekTime = null;

    const existingUrl = track.url;
    if (existingUrl && audioEl.src !== existingUrl) {
      audioEl.src = existingUrl;
      if (resetTime) {
        try { audioEl.currentTime = 0; } catch {}
      }
    }

    // 智能跳过已知试听曲目
    if (playerStore.autoSkipTrial && track.freeTrial === true) {
      showToast(`🛡️ 已跳过试听曲目《${track.name}》`, 'info', 1500);
      return next();
    }

    // ① 已有 URL：同步触发播放，保留 iOS 手势令牌
    if (existingUrl) {
      if (resetTime) {
        playerStore.curTime = 0;
        const onMeta = () => {
          try { if (audioEl) audioEl.currentTime = 0; } catch {}
          audioEl?.removeEventListener('loadedmetadata', onMeta);
        };
        audioEl.addEventListener('loadedmetadata', onMeta);
      }
      const p = audioEl.play();
      if (p !== undefined) {
        p.then(() => {
          if (resetTime && audioEl) {
            try { audioEl.currentTime = 0; } catch {}
            playerStore.curTime = 0;
          } else {
            applyPendingSeek();
          }
          preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
        }).catch(() => { playerStore.playing = false; });
      }
      return;
    }

    // ② URL 尚未解析：使用 muted=true 静音占位保住 iOS 手势令牌，严禁旧音频漏音！
    if (resetTime) playerStore.curTime = 0;
    const prevMuted = audioEl.muted;
    try {
      audioEl.muted = true;
      audioEl.play().catch(() => {});
    } catch {}

    const url = await resolveTrackUrl(track);
    audioEl.muted = prevMuted;

    if (playerStore.autoSkipTrial && track.freeTrial === true) {
      showToast(`🛡️ 已跳过试听曲目《${track.name}》`, 'info', 1500);
      return next();
    }

    if (url && audioEl && playerStore.activeTrack === track) {
      audioEl.src = url;
      if (resetTime) {
        try { audioEl.currentTime = 0; } catch {}
      }
      const p = audioEl.play();
      if (p !== undefined) {
        p.then(() => {
          if (resetTime && audioEl) {
            try { audioEl.currentTime = 0; } catch {}
            playerStore.curTime = 0;
          } else {
            applyPendingSeek();
          }
          preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
        }).catch(() => { playerStore.playing = false; });
      }
    }
  }

  function togglePlay() {
    if (!audioEl) return;
    if (audioEl.paused) {
      if (!audioEl.src || audioEl.src === window.location.href) {
        ensurePlay(false);
      } else {
        const p = audioEl.play();
        if (p !== undefined) {
          p.then(() => {
            applyPendingSeek();
            preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
          }).catch(() => { playerStore.playing = false; });
        }
      }
    } else {
      audioEl.pause();
    }
  }

  async function next() {
    if (playerStore.queue.length === 0) return;
    resetTrackPlayback();
    playerStore.stepNext();
    if (playerStore.autoSkipTrial && (playerStore.activeTrack as any)?.freeTrial === true) {
      playerStore.stepNext();
    }
    if (audioEl) { try { audioEl.currentTime = 0; } catch {} }
    await ensurePlay(true);
  }

  async function prev() {
    if (playerStore.queue.length === 0) return;
    resetTrackPlayback();
    playerStore.stepPrev();
    if (audioEl) { try { audioEl.currentTime = 0; } catch {} }
    await ensurePlay(true);
  }

  function seek(e: MouseEvent) {
    if (!audioEl || !playerStore.duration) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    audioEl.currentTime = p * playerStore.duration;
    playerStore.curTime = audioEl.currentTime;
    playerStore.save();
  }

  function handleSetQueue(tracks: Track[], idx = 0) {
    if (!tracks || !tracks.length) return;
    playerStore.setQueue(tracks, idx);
    if (audioEl) { try { audioEl.currentTime = 0; } catch {} }
    preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
    setTimeout(() => ensurePlay(true), 50);

    const targetTrack = playerStore.activeTrack;
    if (targetTrack?.id) {
      if (targetTrack.isLocal) {
        markSongDownloaded(targetTrack.id);
      } else {
        api.downloadSingle(String(targetTrack.id)).then(() => {
          showToast(`已将《${targetTrack.name || '歌曲'}》加入自动下载任务`, 'info', 2000);
          window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
        }).catch(() => {});
      }
    }
  }

  setQueue = handleSetQueue;

  function handleToggleMode() {
    const nextMode = playerStore.togglePlayMode();
    if (nextMode === 'shuffle') {
      showToast('🎲 已随机洗牌！当前歌曲置顶，后续顺序播放', 'info', 2000);
      preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
    }
  }

  function handleShuffleAction() {
    playerStore.shuffleQueue();
    preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
  }

  onMount(() => {
    playerStore.restore();
    if (playerStore.curTime > 0) pendingSeekTime = playerStore.curTime;
    const t = playerStore.activeTrack;
    if (t) prepareTrackInUI(t);

    setupMediaSession({
      onPlay: () => { if (audioEl?.paused) togglePlay(); },
      onPause: () => { if (!audioEl?.paused) togglePlay(); },
      onPrev: prev,
      onNext: next
      // 🛡️ 禁用锁屏 seekto：防止锁屏拖动触发 iOS 熄屏后台断流静音、假走针与 15s 跳秒退化
      // onSeekTo: (time) => {
      //   if (audioEl) {
      //     audioEl.currentTime = time;
      //     playerStore.curTime = time;
      //     updateMediaSessionPosition(audioEl);
      //   }
      // }
    });

    window.addEventListener('beforeunload', () => playerStore.save());

    // 📱 iOS 熄屏返回前台：若音频流已断裂，原地续播
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !audioEl) return;
      if (!audioEl.paused && audioEl.readyState < 3) {
        const time = audioEl.currentTime || 0;
        const onMeta = () => {
          try { if (audioEl && audioEl.duration && time < audioEl.duration) audioEl.currentTime = time; } catch {}
          audioEl?.removeEventListener('loadedmetadata', onMeta);
          audioEl?.play().catch(() => {});
        };
        audioEl.addEventListener('loadedmetadata', onMeta);
        try { audioEl.load(); } catch {}
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const onPlayFolder = (e: CustomEvent) => {
      const { tracks, name } = e.detail;
      if (!tracks?.length) return showToast('该目录无可播文件', 'warning');
      const q = tracks.map((item: any, i: number) => ({
        id: item.songId || item.id || `local_${Date.now()}_${i}`,
        name: item.songName || item.name || '未知',
        artist: item.artist || '未知',
        cover: item.cover || '/favicon.png',
        url: item.url || (item.relativePath ? `/v3/history/stream?path=${encodeURIComponent(item.relativePath)}` : item.filePath ? `/v3/history/stream?path=${encodeURIComponent(item.filePath)}` : item.streamUrl || ''),
        isLocal: true
      }));
      handleSetQueue(q, 0);
      showToast(`已连播 ${name} 共 ${q.length} 首`, 'success', 3000);
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
    playerStore.playing = true;
    updateMediaSessionPlaybackState(true);
    if (playerStore.activeTrack) {
      updateMediaSessionMetadata(playerStore.activeTrack);
      handleTrackPlayback(playerStore.activeTrack, () => playerStore.playing);
    }
    updateMediaSessionPosition(audioEl);
    preloadSurroundingTracks(playerStore.queue, playerStore.qIndex, playerStore.playMode);
  }}
  onpause={() => {
    playerStore.playing = false;
    updateMediaSessionPlaybackState(false);
    updateMediaSessionPosition(audioEl);
  }}
  ontimeupdate={(e) => {
    const a = e.currentTarget;
    playerStore.curTime = a.currentTime;
    if (a.duration && !isNaN(a.duration) && isFinite(a.duration)) {
      playerStore.duration = a.duration;
    }
    if (playerStore.curTime > 0) {
      try { localStorage.setItem('wyyyy_player_time', String(playerStore.curTime)); } catch {}
    }
    // 🎵 锁屏歌词增量比对：仅在歌词行实际切换瞬间（数秒才发生一次）低频更新 MediaSession
    if (parsedLyrics.length > 0 && playerStore.activeTrack) {
      const activeLyric = getActiveLyric(parsedLyrics, a.currentTime);
      if (activeLyric.index !== lastLyricIndex) {
        lastLyricIndex = activeLyric.index;
        updateMediaSessionMetadata(playerStore.activeTrack, activeLyric);
      }
    }
  }}
  onloadedmetadata={(e) => {
    const a = e.currentTarget as HTMLAudioElement;
    if (a.duration && !isNaN(a.duration) && isFinite(a.duration)) {
      playerStore.duration = a.duration;
    }
    updateMediaSessionPosition(a);
  }}
  onseeked={(e) => {
    const a = e.currentTarget as HTMLAudioElement;
    updateMediaSessionPosition(a);
    if (parsedLyrics.length > 0 && playerStore.activeTrack) {
      const activeLyric = getActiveLyric(parsedLyrics, a.currentTime);
      lastLyricIndex = activeLyric.index;
      updateMediaSessionMetadata(playerStore.activeTrack, activeLyric);
    }
  }}
  onerror={() => {
    console.warn('[Player] 原生音频流加载失败:', audioEl?.error);
    playerStore.playing = false;
  }}
  onended={(e) => {
    resetTrackPlayback();
    const a = e.currentTarget as HTMLAudioElement;
    // 🛡️ 弱网防抖：若播放时间过短且总时长正常，可能是网络提前断裂导致误发 ended，尝试重试拉流
    if (a.currentTime < 3 && a.duration > 10) {
      console.warn('[Player] 检测到音频流提前中断，尝试重连而非跳切');
      try { a.load(); a.play().catch(() => {}); return; } catch {}
    }
    if (playerStore.playMode === 'single') {
      playerStore.curTime = 0;
      if (audioEl) { try { audioEl.currentTime = 0; } catch {} audioEl.play().catch(() => {}); }
    } else {
      next();
    }
  }}
></audio>

<!-- 🎬 现代专业音频播放控制栏 -->
<PlayerBar
  curTrack={playerStore.activeTrack}
  queue={playerStore.queue}
  playing={playerStore.playing}
  curTime={playerStore.curTime}
  duration={playerStore.duration}
  playMode={playerStore.playMode}
  bind:vol={playerStore.vol}
  onTogglePlay={togglePlay}
  onPrev={prev}
  onNext={next}
  onToggleMode={handleToggleMode}
  onSeek={seek}
  onLyric={() => showLyric = !showLyric}
  onPeq={() => showPeq = !showPeq}
  onQueue={() => showDrawer = !showDrawer}
  onClearQueue={() => { playerStore.clearQueue(); showToast('播放队列已清空', 'info'); }}
/>

<!-- 📜 播放列表统一抽屉 -->
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
    onPlayIndex={(idx) => {
      playerStore.qIndex = idx;
      playerStore.curTime = 0;
      if (audioEl) { try { audioEl.currentTime = 0; } catch {} }
      ensurePlay(true);
    }}
    onClearQueue={() => { playerStore.clearQueue(); showToast('播放队列已清空', 'info'); }}
    onRemoveItem={(realIdx) => playerStore.removeItem(realIdx)}
    onToggleLike={onToggleLike}
    onToggleAutoSkip={(val) => playerStore.toggleAutoSkipTrial(val)}
    onToggleServerOnly={(val) => playerStore.toggleServerOnly(val)}
    onToggleOfflineOnly={(val) => playerStore.toggleOfflineOnly(val)}
    onClearTasks={clearTasks}
    onShuffle={handleShuffleAction}
    {onReveal}
    onClose={() => showDrawer = false}
  />
{/if}

<!-- 全屏黑胶歌词 -->
{#if showLyric && playerStore.activeTrack}
  <LyricModal
    track={playerStore.activeTrack}
    currentTime={playerStore.curTime}
    duration={playerStore.duration}
    playing={playerStore.playing}
    playMode={playerStore.playMode}
    bind:vol={playerStore.vol}
    isLiked={likedSet.has(Number(playerStore.activeTrack.id))}
    onTogglePlay={togglePlay}
    onPrev={prev}
    onNext={next}
    onToggleMode={handleToggleMode}
    onSeek={seek}
    onSeekTime={(t) => { if (audioEl) { audioEl.currentTime = t; playerStore.curTime = t; } }}
    onToggleLike={() => onToggleLike(Number(playerStore.activeTrack?.id), playerStore.activeTrack?.name || '')}
    onTogglePeq={() => showPeq = !showPeq}
    onToggleDrawer={() => showDrawer = !showDrawer}
    onClose={() => showLyric = false}
  />
{/if}

<!-- iOS Web Audio API 熄屏会导致挂起中断音频，故在 iOS 设备上彻底不加载 PEQ -->
{#if !isIOS() && showPeq}
  <PeqDrawer onClose={() => showPeq = false} />
{/if}
