<script lang="ts">
  import { onMount } from 'svelte';
  import { isIOS } from '../lib/utils';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast.svelte';
  import { taskState, clearTasks } from '../lib/taskStore.svelte';
  import { savePlayerStateToStorage, loadPlayerStateFromStorage } from '../lib/playerStorage';
  import { resolveTrackUrl, preloadSurroundingTracks } from '../lib/playerHelper';
  import { setupMediaSession, updateMediaSessionMetadata, updateMediaSessionPlaybackState, updateMediaSessionPosition } from '../lib/mediaSession';
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

  // ---------- 播放器核心内部状态 ----------
  let queue: Track[] = $state([]);
  let qIndex = $state(0);
  let playMode: 'list' | 'single' | 'shuffle' = $state('list');
  let curTime = $state(0);
  let duration = $state(0);
  let pendingSeekTime = $state<number | null>(null);
  let vol = $state(typeof localStorage !== 'undefined' ? (Number(localStorage.getItem('wyyyy_player_vol')) || 0.8) : 0.8);
  let autoSkipTrial = $state(true);
  let offlineOnly = $state(false);
  let showDrawer = $state(false);
  let showLyric = $state(false);
  let showPeq = $state(false);
  let audioEl: HTMLAudioElement | null = $state(null);

  // 同步当前正在播放的曲目给外部
  let activeTrack = $derived(queue[qIndex] || null);
  $effect(() => { curTrack = activeTrack; });
  $effect(() => { isOverlayOpen = showDrawer || showLyric || showPeq; });

  $effect(() => {
    if (audioEl) audioEl.volume = vol;
    try { localStorage.setItem('wyyyy_player_vol', String(vol)); } catch {}
  });
  $effect(() => { updateMediaSessionMetadata(activeTrack); });
  $effect(() => { updateMediaSessionPlaybackState(playing); });

  function savePlayerState() {
    savePlayerStateToStorage({ queue, qIndex, playMode, curTime, autoSkipTrial, offlineOnly });
  }

  async function prepareTrackInUI(track: Track) {
    let url = track.url || (await resolveTrackUrl(track));
    if (url && audioEl && (!audioEl.src || audioEl.src === window.location.href)) {
      audioEl.src = url;
    }
  }

  function restorePlayerState() {
    const s = loadPlayerStateFromStorage();
    if (!s.queue?.length) return;
    queue = s.queue; qIndex = s.qIndex ?? 0;
    if (s.playMode) playMode = s.playMode;
    if (s.autoSkipTrial !== undefined) autoSkipTrial = s.autoSkipTrial;
    if (s.offlineOnly !== undefined) offlineOnly = s.offlineOnly;
    if (s.curTime && s.curTime > 0) {
      curTime = s.curTime;
      pendingSeekTime = s.curTime;
    }
    const t = queue[qIndex];
    if (t) prepareTrackInUI(t);
  }

  /**
   * 🛡️ 在播放流建立后安全跳转至断点进度（避免 WebKit 未缓冲前设置 currentTime 导致死锁卡死）
   */
  function applyPendingSeek() {
    if (!pendingSeekTime || pendingSeekTime <= 0 || !audioEl) return;
    const target = pendingSeekTime;
    pendingSeekTime = null;

    const doSeek = () => {
      if (!audioEl) return;
      try {
        if (audioEl.duration && !isNaN(audioEl.duration) && isFinite(audioEl.duration)) {
          if (target < audioEl.duration) {
            audioEl.currentTime = target;
          }
        } else {
          const onMeta = () => {
            try {
              if (audioEl && audioEl.duration && target < audioEl.duration) {
                audioEl.currentTime = target;
              }
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
    const track = queue[qIndex] || null;
    if (!track || !audioEl) return;

    if (resetTime) {
      pendingSeekTime = null;
    }

    const existingUrl = track.url;
    if (existingUrl && audioEl.src !== existingUrl) {
      audioEl.src = existingUrl;
      if (resetTime) {
        try { audioEl.currentTime = 0; } catch {}
      }
    }

    // ① 在 await 之前同步触发 play()，保留 iOS 手势上下文
    if (existingUrl) {
      if (resetTime) {
        curTime = 0;
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
            curTime = 0;
          } else {
            applyPendingSeek();
          }
          preloadSurroundingTracks(queue, qIndex, playMode);
        }).catch(() => { playing = false; });
      }
      return;
    }

    // ② URL 尚未解析：先触发静默 play() 占位保住 iOS 手势上下文，再异步拿 URL 更新 src
    if (resetTime) curTime = 0;
    try { audioEl.play().catch(() => {}); } catch {}
    const url = await resolveTrackUrl(track);
    if (url && audioEl && queue[qIndex] === track) {
      audioEl.src = url;
      if (resetTime) {
        try { audioEl.currentTime = 0; } catch {}
      }
      const p = audioEl.play();
      if (p !== undefined) {
        p.then(() => {
          if (resetTime && audioEl) {
            try { audioEl.currentTime = 0; } catch {}
            curTime = 0;
          } else {
            applyPendingSeek();
          }
          preloadSurroundingTracks(queue, qIndex, playMode);
        }).catch(() => { playing = false; });
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
            preloadSurroundingTracks(queue, qIndex, playMode);
          }).catch(() => { playing = false; });
        }
      }
    } else {
      audioEl.pause();
    }
  }

  async function next() {
    if (queue.length === 0) return;
    if (playMode === 'shuffle') {
      let nextIdx = Math.floor(Math.random() * queue.length);
      if (queue.length > 1 && nextIdx === qIndex) nextIdx = (qIndex + 1) % queue.length;
      qIndex = nextIdx;
    } else {
      let attempts = 0;
      do {
        qIndex = (qIndex + 1) % queue.length;
        attempts++;
        if (!offlineOnly) break;
        if (queue[qIndex]?.isLocal) break;
      } while (attempts < queue.length);
      // autoSkipTrial：只跳过真正的试听片段（freeTrial===true），不误判普通在线歌曲
      if (autoSkipTrial && (queue[qIndex] as any)?.freeTrial === true) {
        if (attempts < queue.length) return next();
      }
    }
    curTime = 0;
    if (audioEl) { try { audioEl.currentTime = 0; } catch {} }
    savePlayerState();
    await ensurePlay(true);
  }

  async function prev() {
    if (queue.length === 0) return;
    if (playMode === 'shuffle') {
      let prevIdx = Math.floor(Math.random() * queue.length);
      if (queue.length > 1 && prevIdx === qIndex) prevIdx = (qIndex - 1 + queue.length) % queue.length;
      qIndex = prevIdx;
    } else {
      let attempts = 0;
      do {
        qIndex = (qIndex - 1 + queue.length) % queue.length;
        attempts++;
        if (!offlineOnly) break;
        if (queue[qIndex]?.isLocal) break;
      } while (attempts < queue.length);
    }
    curTime = 0;
    if (audioEl) { try { audioEl.currentTime = 0; } catch {} }
    savePlayerState();
    await ensurePlay(true);
  }

  function seek(e: MouseEvent) {
    if (!audioEl || !duration) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    audioEl.currentTime = p * duration;
    curTime = audioEl.currentTime;
    savePlayerState();
  }

  function handleSetQueue(tracks: Track[], idx?: number) {
    if (!tracks || !tracks.length) return;
    queue = tracks;
    if (typeof idx === 'number' && idx >= 0 && idx < tracks.length) {
      qIndex = idx;
    } else {
      qIndex = playMode === 'shuffle' ? Math.floor(Math.random() * tracks.length) : 0;
    }
    curTime = 0;
    if (audioEl) { try { audioEl.currentTime = 0; } catch {} }
    savePlayerState();
    preloadSurroundingTracks(tracks, qIndex, playMode);
    setTimeout(() => ensurePlay(true), 50);

    const targetTrack = tracks[qIndex];
    if (targetTrack && !targetTrack.isLocal && targetTrack.id) {
      api.downloadSingle(String(targetTrack.id)).then(() => {
        showToast(`已将《${targetTrack.name || '歌曲'}》加入自动下载任务`, 'info', 2000);
        window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
      }).catch(() => {});
    }
  }

  // 绑定对外暴露的方法
  setQueue = handleSetQueue;

  onMount(() => {
    restorePlayerState();
    setupMediaSession({
      onPlay: () => { if (audioEl?.paused) togglePlay(); },
      onPause: () => { if (!audioEl?.paused) togglePlay(); },
      onPrev: prev,
      onNext: next,
      onSeekTo: (t) => { if (audioEl) { audioEl.currentTime = t; curTime = t; updateMediaSessionPosition(audioEl); } }
    });
    window.addEventListener('beforeunload', savePlayerState);

    // 📱 iOS 熄屏返回前台：若音频流已在后台断裂（readyState 不足），原地续播，避免"需重开 PWA"
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !audioEl) return;
      if (!audioEl.paused && audioEl.readyState < 3) {
        const t = audioEl.currentTime || 0;
        const onMeta = () => {
          try { if (audioEl && audioEl.duration && t < audioEl.duration) audioEl.currentTime = t; } catch {}
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
      const q = tracks.map((t: any, idx: number) => ({
        id: t.songId || t.id || `local_${Date.now()}_${idx}`,
        name: t.songName || t.name || '未知', artist: t.artist || '未知', cover: t.cover || '/favicon.png',
        url: t.url || (t.relativePath ? `/v2/history/stream?path=${encodeURIComponent(t.relativePath)}` : t.filePath ? `/v2/history/stream?path=${encodeURIComponent(t.filePath)}` : t.streamUrl || ''),
        isLocal: true
      }));
      handleSetQueue(q, 0);
      showToast(`已连播 ${name} 共 ${q.length} 首`, 'success', 3000);
    };

    window.addEventListener('svelte:playFolder', onPlayFolder as EventListener);
    return () => {
      window.removeEventListener('beforeunload', savePlayerState);
      window.removeEventListener('svelte:playFolder', onPlayFolder as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });
</script>

<!-- 全局原生 Audio 引擎 (静默挂载) -->
<audio
  bind:this={audioEl}
  playsinline
  preload="auto"
  onplay={() => {
    playing = true;
    updateMediaSessionPlaybackState(true);
    if (activeTrack) updateMediaSessionMetadata(activeTrack);
    preloadSurroundingTracks(queue, qIndex, playMode);
  }}
  onpause={() => {
    playing = false;
    updateMediaSessionPlaybackState(false);
  }}
  ontimeupdate={(e) => {
    const a = e.currentTarget;
    curTime = a.currentTime;
    if (a.duration && !isNaN(a.duration) && isFinite(a.duration)) {
      duration = a.duration;
    }
    if (curTime > 0) { try { localStorage.setItem('wyyyy_player_time', String(curTime)); } catch {} }
    updateMediaSessionPosition(a);
  }}
  onloadedmetadata={(e) => {
    const a = e.currentTarget as HTMLAudioElement;
    if (a.duration && !isNaN(a.duration) && isFinite(a.duration)) {
      duration = a.duration;
    }
    updateMediaSessionPosition(a);
  }}
  onended={() => {
    if (playMode === 'single') {
      curTime = 0;
      if (audioEl) { try { audioEl.currentTime = 0; } catch {} audioEl.play().catch(() => {}); }
    } else next();
  }}
></audio>

<!-- 🎬 现代专业音频播放控制栏 (SP 大触控 / PC 优雅三段式) -->
<PlayerBar
  curTrack={activeTrack} {queue} {playing} {curTime} {duration} {playMode} bind:vol
  onTogglePlay={togglePlay} onPrev={prev} onNext={next}
  onToggleMode={() => playMode = playMode === 'list' ? 'single' : playMode === 'single' ? 'shuffle' : 'list'}
  onSeek={seek} onLyric={() => showLyric = !showLyric} onPeq={() => showPeq = !showPeq}
  onQueue={() => showDrawer = !showDrawer}
  onClearQueue={() => { queue = []; qIndex = 0; savePlayerState(); showToast('播放队列已清空', 'info'); }}
/>

<!-- 📜 播放列表 & 下载任务 统一抽屉 -->
{#if showDrawer}
  <PlaylistDrawer
    {queue} {qIndex} tasks={taskState.tasks} {likedSet} {autoSkipTrial} {offlineOnly} downloadedSet={taskState.downloadedSet}
    onPlayIndex={(idx) => { qIndex = idx; curTime = 0; if (audioEl) { try { audioEl.currentTime = 0; } catch {} } ensurePlay(true); }}
    onClearQueue={() => { queue = []; qIndex = 0; savePlayerState(); showToast('播放队列已清空', 'info'); }}
    onRemoveItem={(realIdx) => { queue = queue.filter((_, idx) => idx !== realIdx); if (qIndex >= queue.length) qIndex = Math.max(0, queue.length - 1); savePlayerState(); }}
    onToggleLike={onToggleLike}
    onToggleAutoSkip={(val) => { autoSkipTrial = val; savePlayerState(); }}
    onToggleOfflineOnly={(val) => { offlineOnly = val; savePlayerState(); }}
    onClearTasks={clearTasks} {onReveal} onClose={() => showDrawer = false}
  />
{/if}

<!-- 全屏黑胶歌词 -->
{#if showLyric && activeTrack}
  <LyricModal
    track={activeTrack} currentTime={curTime} {duration} {playing} {playMode} bind:vol
    isLiked={likedSet.has(Number(activeTrack.id))}
    onTogglePlay={togglePlay} onPrev={prev} onNext={next}
    onToggleMode={() => playMode = playMode === 'list' ? 'single' : playMode === 'single' ? 'shuffle' : 'list'}
    onSeek={seek} onSeekTime={(t) => { if (audioEl) { audioEl.currentTime = t; curTime = t; } }}
    onToggleLike={() => onToggleLike(Number(activeTrack.id), activeTrack.name)}
    onTogglePeq={() => showPeq = !showPeq} onToggleDrawer={() => showDrawer = !showDrawer}
    onClose={() => showLyric = false}
  />
{/if}

<!-- iOS Web Audio API 熄屏会导致挂起中断音频，故在 iOS 设备上彻底不加载 PEQ -->
{#if !isIOS() && showPeq}
  <PeqDrawer onClose={() => showPeq = false} />
{/if}
