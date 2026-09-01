<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './lib/api';
  import { formatTime, getApiCache, setApiCache } from './lib/utils';
  import type { Track } from './lib/types';

  import TopBar from './components/TopBar.svelte';
  import PlaylistTab from './components/PlaylistTab.svelte';
  import SearchTab from './components/SearchTab.svelte';
  import DownloadMgrTab from './components/DownloadMgrTab.svelte';
  import LyricModal from './components/LyricModal.svelte';
  import PeqDrawer from './components/PeqDrawer.svelte';
  import PlaylistDrawer from './components/PlaylistDrawer.svelte';
  import RevealModal from './components/RevealModal.svelte';

  function getInitialTab(): 'playlist' | 'search' | 'download-mgr' {
    if (typeof window !== 'undefined') {
      const h = location.hash.replace('#', '');
      if (h === 'playlist' || h === 'search' || h === 'download-mgr') return h as any;
      const saved = localStorage.getItem('wyyyy_active_tab');
      if (saved === 'playlist' || saved === 'search' || saved === 'download-mgr') return saved as any;
    }
    return 'playlist';
  }

  // ---------- 全局状态 ----------
  let tab: 'playlist' | 'search' | 'download-mgr' = $state(getInitialTab());
  let playlistId = $state('');
  let albumId = $state('');
  let repeat = $state(false);
  let themeMode: 'dark' | 'light' | 'auto' = $state((typeof localStorage !== 'undefined' ? localStorage.getItem('theme_mode') : 'dark') as any || 'dark');

  // ---------- 响应式数据集合 (类似 Redux Store) ----------
  let likedSet = $state(new Set<number>());
  let downloadedSet = $state(new Set<number>());
  let tasks: any[] = $state([]);
  let monVisible = $state(false);

  // ---------- 定位弹窗状态 ----------
  let revealData: { path: string; msg: string } | null = $state(null);

  // ---------- Toast 提示系统 ----------
  let toasts: { id: number; msg: string; type: string }[] = $state([]);
  let toastSeed = 0;
  function showToast(msg: string, type = 'info', dur = 3000) {
    const id = ++toastSeed;
    toasts = [...toasts, { id, msg, type }];
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, dur);
  }

  // ---------- 播放器核心状态 ----------
  let queue: Track[] = $state([]);
  let qIndex = $state(0);
  let playMode: 'list' | 'single' | 'shuffle' = $state('list');
  let curTime = $state(0);
  let duration = $state(0);
  let playing = $state(false);
  let autoSkipTrial = $state(true);
  let offlineOnly = $state(false);
  let showDrawer = $state(false);
  let showLyric = $state(false);
  let showPeq = $state(false);
  let audioEl: HTMLAudioElement | null = $state(null);

  let curTrack = $derived(queue[qIndex] || null);

  // ---------- 播放器控制与解析 ----------
  async function resolveUrl(track: Track): Promise<string> {
    if (track.url && track.url.includes('/stream')) return track.url;
    try {
      const j = await api.songV1(String(track.id), 'lossless');
      const song = j?.data;
      if (song) {
        if (song.url) track.url = song.url;
        const newPic = song.pic || song.picUrl || song.al?.picUrl || song.cover;
        if (newPic && (!track.cover || track.cover === '/favicon.png')) {
          track.cover = newPic;
        }
        if (song.lyric && !track.lyric) {
          track.lyric = song.lyric;
        }
        return song.url || track.url || '';
      }
    } catch {}
    return track.url || '';
  }

  function savePlayerState() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('wyyyy_player_queue', JSON.stringify(queue));
      localStorage.setItem('wyyyy_player_index', String(qIndex));
      localStorage.setItem('wyyyy_player_mode', playMode === 'list' ? 'loop' : playMode === 'shuffle' ? 'random' : 'single');
      if (curTime > 0) localStorage.setItem('wyyyy_player_time', String(curTime));
      localStorage.setItem('wyyyy_player_auto_skip_trial', String(autoSkipTrial));
      localStorage.setItem('wyyyy_player_offline_only', String(offlineOnly));
    } catch (e) {}
  }

  async function prepareTrackInUI(track: Track, seekTime: number) {
    let url = track.url || (await resolveUrl(track));
    if (url && audioEl) {
      audioEl.src = url;
      if (seekTime > 0) {
        const onMeta = () => {
          try {
            if (audioEl) audioEl.currentTime = seekTime;
          } catch (e) {}
          audioEl?.removeEventListener('loadedmetadata', onMeta);
        };
        audioEl.addEventListener('loadedmetadata', onMeta);
        if (audioEl.duration) {
          try {
            audioEl.currentTime = seekTime;
          } catch (e) {}
        }
      }
    }
  }

  function restorePlayerState() {
    if (typeof localStorage === 'undefined') return;
    try {
      const qStr = localStorage.getItem('wyyyy_player_queue');
      const idxStr = localStorage.getItem('wyyyy_player_index');
      const modeStr = localStorage.getItem('wyyyy_player_mode');
      const timeStr = localStorage.getItem('wyyyy_player_time');
      const skipTrialStr = localStorage.getItem('wyyyy_player_auto_skip_trial');
      const offlineStr = localStorage.getItem('wyyyy_player_offline_only');

      if (qStr) {
        const savedQueue = JSON.parse(qStr);
        if (Array.isArray(savedQueue) && savedQueue.length > 0) {
          queue = savedQueue;
          let idx = parseInt(idxStr || '0', 10);
          if (isNaN(idx) || idx < 0 || idx >= queue.length) idx = 0;
          qIndex = idx;

          if (modeStr === 'single') playMode = 'single';
          else if (modeStr === 'random') playMode = 'shuffle';
          else playMode = 'list';

          if (skipTrialStr !== null) autoSkipTrial = skipTrialStr === 'true';
          if (offlineStr !== null) offlineOnly = offlineStr === 'true';

          const seekTime = parseFloat(timeStr || '0') || 0;
          if (seekTime > 0) curTime = seekTime;

          const t = queue[qIndex];
          if (t) prepareTrackInUI(t, seekTime);
        }
      }
    } catch (e) {}
  }

  async function ensurePlay() {
    if (!curTrack || !audioEl) return;
    let url = curTrack.url || (await resolveUrl(curTrack));
    if (url && audioEl.src !== url && !audioEl.src.endsWith(url)) {
      audioEl.src = url;
    }
    audioEl.play().catch(() => {
      playing = false;
    });
  }

  function togglePlay() {
    if (!audioEl) return;
    if (audioEl.paused) {
      if (!audioEl.src || audioEl.src === window.location.href) ensurePlay();
      else audioEl.play().catch(() => {});
    } else {
      audioEl.pause();
    }
  }

  async function next() {
    if (queue.length === 0) return;
    if (playMode === 'shuffle') {
      qIndex = Math.floor(Math.random() * queue.length);
    } else {
      let attempts = 0;
      do {
        qIndex = (qIndex + 1) % queue.length;
        attempts++;
        if (!offlineOnly) break;
        if (queue[qIndex]?.isLocal) break;
      } while (attempts < queue.length);
      if (autoSkipTrial && !queue[qIndex]?.isLocal && queue[qIndex]) {
        if (attempts < queue.length) return next();
      }
    }
    curTime = 0;
    savePlayerState();
    await ensurePlay();
    setTimeout(() => audioEl?.play().catch(() => {}), 10);
  }

  async function prev() {
    if (queue.length === 0) return;
    let attempts = 0;
    do {
      qIndex = (qIndex - 1 + queue.length) % queue.length;
      attempts++;
      if (!offlineOnly) break;
      if (queue[qIndex]?.isLocal) break;
    } while (attempts < queue.length);
    curTime = 0;
    savePlayerState();
    await ensurePlay();
    setTimeout(() => audioEl?.play().catch(() => {}), 10);
  }

  function seek(e: MouseEvent) {
    if (!audioEl || !duration) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    audioEl.currentTime = p * duration;
    curTime = audioEl.currentTime;
    savePlayerState();
  }

  function setQueue(tracks: Track[], idx = 0) {
    queue = tracks;
    qIndex = idx;
    curTime = 0;
    savePlayerState();
    setTimeout(() => ensurePlay(), 50);
  }

  // ---------- 喜欢与任务监控 ----------
  async function toggleLike(id: number, name: string) {
    const liked = likedSet.has(Number(id));
    const next = new Set(likedSet);
    if (liked) next.delete(Number(id));
    else next.add(Number(id));
    likedSet = next;
    setApiCache('liked_song_ids', Array.from(next));
    try {
      await api.like(Number(id), !liked);
      showToast(liked ? `已取消红心` : `已收藏 ${name}`, 'success');
    } catch {
      const rb = new Set(likedSet);
      if (!liked) rb.delete(Number(id));
      else rb.add(Number(id));
      likedSet = rb;
    }
  }

  async function fetchTasks() {
    try {
      const j = await api.tasks();
      if (j.code === '000000') {
        tasks = j.data || [];
        if (tasks.length) monVisible = true;
        let changed = false;
        const newSet = new Set(downloadedSet);
        tasks.forEach((t: any) => {
          if ((t.status === 'SUCCESS' || t.status === 'SKIP') && (t.songId || t.id)) {
            const sid = Number(t.songId || t.id);
            if (!newSet.has(sid)) {
              newSet.add(sid);
              changed = true;
            }
          }
        });
        if (changed) {
          downloadedSet = newSet;
        }
      }
    } catch {}
  }

  async function clearTasks() {
    await api.tasksClear();
    tasks = [];
    showToast('已清空', 'info');
  }

  // ---------- 定位处理 (触发 RevealModal 弹窗) ----------
  async function handleReveal(item: any) {
    try {
      const j = await api.reveal({
        id: item.songId || item.id,
        name: item.name || item.songName,
        artist: item.artist || item.ar_name,
        path: item.path || item.filePath,
        taskId: item.taskId
      });
      if (j?.code === '000000') {
        revealData = {
          path: j.data || item.path || item.filePath || '',
          msg: '🚀 已为您在系统文件管理器中定位物理文件！'
        };
      } else {
        revealData = {
          path: item.path || item.filePath || j?.data || '',
          msg: j?.msg || '未找到文件物理路径'
        };
      }
    } catch (e: any) {
      showToast('定位失败: ' + (e.message || e), 'error');
    }
  }

  async function initDownloadedSet() {
    try {
      const j = await api.historyIds();
      if (j?.code === '000000' && Array.isArray(j.data)) {
        downloadedSet = new Set(j.data.map(Number));
        return;
      }
    } catch {}

    // 降级兜底
    try {
      const j = await api.historyList('', 1);
      const list = j?.data?.list || [];
      const s = new Set<number>();
      list.forEach((item: any) => {
        if (item.songId) s.add(Number(item.songId));
      });
      downloadedSet = s;
    } catch {}
  }

  // ---------- 路由与主题切换 ----------
  function switchTab(n: 'playlist' | 'search' | 'download-mgr') {
    tab = n;
    history.pushState(null, '', '#' + n);
    try {
      localStorage.setItem('wyyyy_active_tab', n);
    } catch {}
  }

  function jumpToAlbum(id: string) {
    albumId = id;
    switchTab('search');
  }

  function jumpToPlaylist(id: string) {
    playlistId = id;
    switchTab('playlist');
  }

  function applyTheme(mode: 'dark' | 'light' | 'auto') {
    const root = document.documentElement;
    let eff = mode;
    if (mode === 'auto') {
      eff = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (eff === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
    localStorage.setItem('theme_mode', mode);
  }

  function toggleTheme() {
    themeMode = themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'auto' : 'dark';
    applyTheme(themeMode);
  }

  function switchToLegacy() {
    document.cookie = 'ui_version=legacy; path=/; max-age=31536000';
    localStorage.setItem('wyyyy_ui_version', 'legacy');
    window.location.href = '/?v=legacy';
  }

  onMount(() => {
    applyTheme(themeMode);
    restorePlayerState();
    const h = location.hash.replace('#', '');
    if (h === 'playlist' || h === 'search' || h === 'download-mgr') tab = h as any;
    window.addEventListener('hashchange', () => {
      const hh = location.hash.replace('#', '');
      if (hh === 'playlist' || hh === 'search' || hh === 'download-mgr') tab = hh as any;
    });
    window.addEventListener('beforeunload', savePlayerState);

    window.addEventListener('svelte:playFolder', ((e: CustomEvent) => {
      const { tracks, name } = (e as CustomEvent).detail;
      if (!tracks?.length) {
        showToast('该目录无可播文件', 'warning');
        return;
      }
      const q = tracks.map((t: any, idx: number) => ({
        id: t.songId || t.id || `local_${Date.now()}_${idx}`,
        name: t.songName || t.name || '未知',
        artist: t.artist || '未知',
        cover: '/favicon.png',
        url: t.relativePath
          ? `/v2/history/stream?path=${encodeURIComponent(t.relativePath)}`
          : t.filePath
          ? `/v2/history/stream?path=${encodeURIComponent(t.filePath)}`
          : t.streamUrl || '',
        isLocal: true
      }));
      setQueue(q, 0);
      showToast(`已连播 ${name} 共 ${q.length} 首`, 'success', 3000);
    }) as EventListener);

    api.getRepeat().then((j: any) => {
      if (j?.code === '000000') repeat = j.data === true;
    }).catch(() => {});

    fetchTasks();
    setInterval(fetchTasks, 3000);
    initDownloadedSet();

    const c = getApiCache('liked_song_ids');
    if (c?.data) likedSet = new Set(c.data.map((n: any) => Number(n)));
    api.likeList().then((j: any) => {
      if (j?.code === '000000' && Array.isArray(j.data)) {
        likedSet = new Set(j.data.map((n: any) => Number(n)));
        setApiCache('liked_song_ids', j.data);
      }
    }).catch(() => {});
  });
</script>

<!-- 顶栏导航 -->
<TopBar
  tab={tab}
  themeMode={themeMode}
  repeat={repeat}
  onSwitchTab={switchTab}
  onToggleTheme={toggleTheme}
  onToggleRepeat={() => { repeat = !repeat; api.setRepeat(repeat); }}
  onSwitchToLegacy={switchToLegacy}
/>

<!-- 内容区 -->
<div class="accordion-wrapper">
  {#if tab === 'playlist'}
    <PlaylistTab
      playlistId={playlistId}
      likedSet={likedSet}
      downloadedSet={downloadedSet}
      onToggleLike={toggleLike}
      onPlayQueue={setQueue}
      onAlbum={jumpToAlbum}
      onReveal={handleReveal}
      showToast={showToast}
    />
  {:else if tab === 'search'}
    <SearchTab
      albumId={albumId}
      downloadedSet={downloadedSet}
      onAlbum={jumpToAlbum}
      onPlaylist={jumpToPlaylist}
      onPlayQueue={setQueue}
      onSong={(sid) => { playlistId = sid; switchTab('playlist'); }}
      onReveal={handleReveal}
      showToast={showToast}
    />
  {:else}
    <DownloadMgrTab
      onPlayQueue={setQueue}
      onReveal={handleReveal}
      showToast={showToast}
    />
  {/if}
</div>

<!-- 底部播放栏 -->
<div class="bottom-audio-bar">
  <audio
    bind:this={audioEl}
    onplay={() => playing = true}
    onpause={() => playing = false}
    ontimeupdate={(e) => {
      const a = e.currentTarget;
      curTime = a.currentTime;
      duration = a.duration || 0;
      if (curTime > 0) {
        try { localStorage.setItem('wyyyy_player_time', String(curTime)); } catch {}
      }
    }}
    onloadedmetadata={(e) => { duration = (e.currentTarget as HTMLAudioElement).duration || 0; }}
    onended={() => { if (playMode === 'single') { if (audioEl) audioEl.currentTime = 0; audioEl?.play(); } else next(); }}
  ></audio>
  <div class="audio-bar-inner">
    <div class="audio-left-section" onclick={() => showLyric = !showLyric} style="cursor:pointer;">
      <div class="vinyl-cover-wrapper">
        <img
          src={curTrack?.cover || '/favicon.png'}
          alt=""
          class="audio-cover"
          class:playing={playing}
          referrerpolicy="no-referrer"
          onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (!img.src.includes('favicon.png')) img.src = '/favicon.png'; }}
        />
      </div>
      <div class="audio-text">
        <div class="audio-title-row"><div class="audio-title">{curTrack?.name || '未在播放'}</div></div>
        <div class="audio-artist">{curTrack?.artist || ''}</div>
      </div>
    </div>
    <div class="audio-center-section">
      <div class="audio-main-controls">
        <button class="ctrl-btn sub-btn" onclick={() => playMode = playMode === 'list' ? 'single' : playMode === 'single' ? 'shuffle' : 'list'} title={playMode}>
          {playMode === 'single' ? '🔂' : playMode === 'shuffle' ? '🔀' : '🔁'}
        </button>
        <button class="ctrl-btn sub-btn" onclick={prev}>⏮</button>
        <button class="ctrl-btn play-main-btn" onclick={togglePlay}>{playing ? '⏸' : '▶'}</button>
        <button class="ctrl-btn sub-btn" onclick={next}>⏭</button>
      </div>
      <div class="audio-progress-container">
        <span class="time-stamp">{formatTime(curTime)}</span>
        <div class="progress-bar-wrapper" onclick={seek}>
          <div class="progress-bar-bg"></div>
          <div class="progress-bar-fill" style="width:{duration ? (curTime / duration * 100) : 0}%"></div>
          <div class="progress-bar-handle" style="left:{duration ? (curTime / duration * 100) : 0}%"></div>
        </div>
        <span class="time-stamp">{formatTime(duration)}</span>
      </div>
    </div>
    <div class="audio-right-section">
      <button class="ctrl-btn sub-btn" onclick={() => showLyric = !showLyric} title="全屏黑胶歌词">🎤</button>
      <button class="ctrl-btn sub-btn" onclick={() => showPeq = !showPeq} title="5段参量均衡器">🎛️</button>
      <button class="ctrl-btn sub-btn" onclick={() => showDrawer = !showDrawer} title="播放列表">📜</button>
    </div>
  </div>
</div>

<!-- 📜 播放列表 & 下载任务 统一抽屉 (就算歌单空也能打开，内含下载任务 Tab) -->
{#if showDrawer}
  <PlaylistDrawer
    queue={queue}
    qIndex={qIndex}
    tasks={tasks}
    likedSet={likedSet}
    autoSkipTrial={autoSkipTrial}
    offlineOnly={offlineOnly}
    downloadedSet={downloadedSet}
    onPlayIndex={(idx) => { qIndex = idx; curTime = 0; ensurePlay(); }}
    onClearQueue={() => { queue = []; qIndex = 0; savePlayerState(); showToast('播放队列已清空', 'info'); }}
    onRemoveItem={(realIdx) => { queue = queue.filter((_, idx) => idx !== realIdx); if (qIndex >= queue.length) qIndex = Math.max(0, queue.length - 1); savePlayerState(); }}
    onToggleLike={toggleLike}
    onToggleAutoSkip={(val) => { autoSkipTrial = val; savePlayerState(); }}
    onToggleOfflineOnly={(val) => { offlineOnly = val; savePlayerState(); }}
    onClearTasks={clearTasks}
    onReveal={handleReveal}
    onClose={() => showDrawer = false}
  />
{/if}

<!-- 全屏黑胶歌词 -->
{#if showLyric && curTrack}
  <LyricModal
    track={curTrack}
    currentTime={curTime}
    duration={duration}
    playing={playing}
    playMode={playMode}
    isLiked={likedSet.has(Number(curTrack.id))}
    onTogglePlay={togglePlay}
    onPrev={prev}
    onNext={next}
    onToggleMode={() => playMode = playMode === 'list' ? 'single' : playMode === 'single' ? 'shuffle' : 'list'}
    onSeek={seek}
    onSeekTime={(t) => { if (audioEl) { audioEl.currentTime = t; curTime = t; } }}
    onToggleLike={() => toggleLike(Number(curTrack.id), curTrack.name)}
    onTogglePeq={() => showPeq = !showPeq}
    onToggleDrawer={() => showDrawer = !showDrawer}
    onClose={() => showLyric = false}
  />
{/if}

<!-- 5段均衡器 -->
{#if showPeq}
  <PeqDrawer onClose={() => showPeq = false} />
{/if}

<!-- 📂 文件物理定位弹窗 (对齐旧版) -->
{#if revealData}
  <RevealModal
    path={revealData.path}
    msg={revealData.msg}
    onClose={() => revealData = null}
    showToast={showToast}
  />
{/if}

<!-- 全局 Toast 容器 -->
<div id="globalToastContainer" class="toast-container" style="position:fixed; top:16px; right:16px; z-index:100000; display:flex; flex-direction:column; gap:8px;">
  {#each toasts as t (t.id)}
    <div class="toast-item toast-{t.type}" style="background:{t.type === 'error' ? '#ef4444' : t.type === 'success' ? '#10b981' : t.type === 'warning' ? '#f59e0b' : '#334155'}; color:#fff; padding:10px 14px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:13px; max-width:360px;">
      {t.msg}
    </div>
  {/each}
</div>
