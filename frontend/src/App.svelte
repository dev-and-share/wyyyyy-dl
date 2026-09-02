<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './lib/api';
  import { formatTime, getApiCache, setApiCache, isIOS } from './lib/utils';
  import { checkForPwaUpdate } from './lib/pwa';
  import { savePlayerStateToStorage, loadPlayerStateFromStorage } from './lib/playerStorage';
  import { applyTheme, getInitialTheme, switchToLegacy, type ThemeMode } from './lib/theme';
  import { resolveTrackUrl } from './lib/playerHelper';
  import type { Track } from './lib/types';

  import TopBar from './components/TopBar.svelte';
  import PlaylistTab from './components/PlaylistTab.svelte';
  import SearchTab from './components/SearchTab.svelte';
  import DownloadMgrTab from './components/DownloadMgrTab.svelte';
  import LyricModal from './components/LyricModal.svelte';
  import PeqDrawer from './components/PeqDrawer.svelte';
  import PlaylistDrawer from './components/PlaylistDrawer.svelte';
  import RevealModal from './components/RevealModal.svelte';
  import PlayerBar from './components/PlayerBar.svelte';
  import PullToRefresh from './components/PullToRefresh.svelte';
  import BottomSheet from './components/BottomSheet.svelte';
  import ToastContainer from './components/ToastContainer.svelte';
  import { sheetState } from './lib/ui.svelte';
  import { executeReveal } from './lib/revealHelper';

  function getInitialTab(): 'playlist' | 'search' | 'download-mgr' {
    const raw = typeof window !== 'undefined' ? location.hash.replace('#', '').split('?')[0] : '';
    if (raw === 'playlist' || raw === 'search' || raw === 'download-mgr') return raw;
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('wyyyy_active_tab') : '';
    return (saved === 'playlist' || saved === 'search' || saved === 'download-mgr') ? saved : 'playlist';
  }

  function getInitialPlaylistId(): string {
    if (typeof window === 'undefined') return '';
    const match = location.hash.match(/id=([0-9]+)/);
    return match?.[1] || (typeof localStorage !== 'undefined' ? localStorage.getItem('wyyyy_last_playlist_id') || '' : '');
  }

  // ---------- 全局状态 ----------
  let tab: 'playlist' | 'search' | 'download-mgr' = $state(getInitialTab());
  let playlistId = $state(getInitialPlaylistId());
  let albumId = $state('');
  let repeat = $state(false);
  let themeMode: ThemeMode = $state(getInitialTheme());

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
  let vol = $state(typeof localStorage !== 'undefined' ? (Number(localStorage.getItem('wyyyy_player_vol')) || 0.8) : 0.8);
  let playing = $state(false);
  let autoSkipTrial = $state(true);
  let offlineOnly = $state(false);
  let showDrawer = $state(false);
  let showLyric = $state(false);
  let showPeq = $state(false);
  let audioEl: HTMLAudioElement | null = $state(null);

  $effect(() => {
    if (audioEl) audioEl.volume = vol;
    try { localStorage.setItem('wyyyy_player_vol', String(vol)); } catch {}
  });

  let curTrack = $derived(queue[qIndex] || null);

  function savePlayerState() {
    savePlayerStateToStorage({ queue, qIndex, playMode, curTime, autoSkipTrial, offlineOnly });
  }

  let isAnyOverlayOpen = $derived(showDrawer || showLyric || showPeq || !!revealData || !!sheetState.data);

  async function prepareTrackInUI(track: Track, seekTime: number) {
    let url = track.url || (await resolveTrackUrl(track));
    if (url && audioEl) {
      audioEl.src = url;
      if (seekTime > 0) {
        const onMeta = () => { try { if (audioEl) audioEl.currentTime = seekTime; } catch (e) {} audioEl?.removeEventListener('loadedmetadata', onMeta); };
        audioEl.addEventListener('loadedmetadata', onMeta);
        if (audioEl.duration) { try { audioEl.currentTime = seekTime; } catch (e) {} }
      }
    }
  }

  function restorePlayerState() {
    const saved = loadPlayerStateFromStorage();
    if (saved.queue?.length) {
      queue = saved.queue;
      qIndex = saved.qIndex ?? 0;
      if (saved.playMode) playMode = saved.playMode;
      if (saved.autoSkipTrial !== undefined) autoSkipTrial = saved.autoSkipTrial;
      if (saved.offlineOnly !== undefined) offlineOnly = saved.offlineOnly;
      if (saved.curTime) curTime = saved.curTime;
      const t = queue[qIndex];
      if (t) prepareTrackInUI(t, saved.curTime || 0);
    }
  }

  async function ensurePlay(resetTime = false) {
    if (!curTrack || !audioEl) return;
    if (resetTime) {
      curTime = 0;
      try { audioEl.currentTime = 0; } catch {}
    }
    let url = curTrack.url || (await resolveTrackUrl(curTrack));
    if (url && audioEl) {
      if (audioEl.src !== url && !audioEl.src.endsWith(url)) {
        audioEl.src = url;
      }
      if (resetTime) {
        try { audioEl.currentTime = 0; } catch {}
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
          }
        }).catch(() => { playing = false; });
      }
    }
  }

  function togglePlay() {
    if (!audioEl) return;
    if (audioEl.paused) {
      if (!audioEl.src || audioEl.src === window.location.href) ensurePlay(false);
      else audioEl.play().catch(() => {});
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
      if (autoSkipTrial && !queue[qIndex]?.isLocal && queue[qIndex]) {
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

  function setQueue(tracks: Track[], idx?: number) {
    if (!tracks || !tracks.length) return;
    queue = tracks;
    if (typeof idx === 'number' && idx >= 0 && idx < tracks.length) {
      qIndex = idx;
    } else {
      // 随机播放模式下，整单播放随机选取起播歌曲；列表模式则从第 0 首开始
      qIndex = playMode === 'shuffle' ? Math.floor(Math.random() * tracks.length) : 0;
    }
    curTime = 0;
    if (audioEl) { try { audioEl.currentTime = 0; } catch {} }
    savePlayerState();
    setTimeout(() => ensurePlay(true), 50);

    // 🌟 共通逻辑提取：当点播/试听非本地服务器曲目时，自动提交后台下载任务
    const targetTrack = tracks[qIndex];
    if (targetTrack && !targetTrack.isLocal && targetTrack.id) {
      api.downloadSingle(String(targetTrack.id)).then(() => {
        showToast(`已将《${targetTrack.name || '歌曲'}》加入自动下载任务`, 'info', 2000);
        window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
      }).catch(() => {});
    }
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

  // ---------- 自适应轮询：有活跃任务时 3s，全部完成后自动停止 ----------
  const ACTIVE_STATUSES = new Set(['WAITING', 'DOWNLOADING', 'PENDING']);
  let taskTimer: ReturnType<typeof setInterval> | null = null;

  function stopTaskPolling() { if (taskTimer !== null) { clearInterval(taskTimer); taskTimer = null; } }
  function startTaskPolling() { if (taskTimer !== null) return; fetchTasks(); taskTimer = setInterval(fetchTasks, 3000); }

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
            if (!newSet.has(sid)) { newSet.add(sid); changed = true; }
          }
        });
        if (changed) downloadedSet = newSet;
        if (!tasks.some((t: any) => ACTIVE_STATUSES.has(t.status))) stopTaskPolling();
      }
    } catch {}
  }

  async function clearTasks() {
    await api.tasksClear();
    tasks = [];
    stopTaskPolling();
    showToast('已清空', 'info');
  }

  async function handleReveal(item: any) {
    try { revealData = await executeReveal(item); } catch (e: any) { showToast('定位失败: ' + (e.message || e), 'error'); }
  }

  async function initDownloadedSet() {
    try {
      const j = await api.historyIds();
      if (j?.code === '000000' && Array.isArray(j.data)) { downloadedSet = new Set(j.data.map(Number)); return; }
      const h = await api.historyList('', 1);
      downloadedSet = new Set((h?.data?.list || []).map((x: any) => Number(x.songId)).filter(Boolean));
    } catch {}
  }

  function switchTab(n: 'playlist' | 'search' | 'download-mgr') {
    tab = n;
    history.pushState(null, '', '#' + n);
    try { localStorage.setItem('wyyyy_active_tab', n); } catch {}
  }
  function jumpToAlbum(id: string) { albumId = id; switchTab('search'); }
  function jumpToPlaylist(id: string) { playlistId = id; switchTab('playlist'); }
  function toggleTheme() {
    themeMode = themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'auto' : 'dark';
    applyTheme(themeMode);
  }

  onMount(() => {
    applyTheme(themeMode);
    restorePlayerState();
    const syncRoute = () => {
      const m = location.hash.match(/id=([0-9]+)/);
      if (m?.[1]) playlistId = m[1];
      const h = location.hash.replace('#', '').split('?')[0];
      if (h === 'playlist' || h === 'search' || h === 'download-mgr') tab = h as any;
    };
    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('beforeunload', savePlayerState);

    window.addEventListener('svelte:playFolder', ((e: CustomEvent) => {
      const { tracks, name } = (e as CustomEvent).detail;
      if (!tracks?.length) return showToast('该目录无可播文件', 'warning');
      const q = tracks.map((t: any, idx: number) => ({
        id: t.songId || t.id || `local_${Date.now()}_${idx}`,
        name: t.songName || t.name || '未知',
        artist: t.artist || '未知',
        cover: t.cover || '/favicon.png',
        url: t.url || (t.relativePath ? `/v2/history/stream?path=${encodeURIComponent(t.relativePath)}` : t.filePath ? `/v2/history/stream?path=${encodeURIComponent(t.filePath)}` : t.streamUrl || ''),
        isLocal: true
      }));
      setQueue(q, 0);
      showToast(`已连播 ${name} 共 ${q.length} 首`, 'success', 3000);
    }) as EventListener);

    api.getRepeat().then((j: any) => {
      if (j?.code === '000000') repeat = j.data === true;
    }).catch(() => {});

    // 监听全局下载提交事件，重启轮询（子组件可通过 dispatchEvent 触发）
    window.addEventListener('wyyyy:download-submitted', () => startTaskPolling());

    startTaskPolling();
    initDownloadedSet();

    const c = getApiCache('liked_song_ids');
    if (c?.data) likedSet = new Set(c.data.map((n: any) => Number(n)));
    api.likeList().then((j: any) => {
      if (j?.code === '000000' && Array.isArray(j.data)) {
        likedSet = new Set(j.data.map((n: any) => Number(n)));
        setApiCache('liked_song_ids', j.data);
      }
    }).catch(() => {});

    // 监听 PWA 新版本就绪事件
    window.addEventListener('wyyyy:pwa-update-available', () => {
      showToast('🎉 发现新版本！下拉即可更新', 'info', 6000);
    });
  });

  async function handleRefresh() {
    showToast('正在检查更新与刷新数据...', 'info', 1200);
    try {
      // 1. 触发 PWA Service Worker 检查更新
      checkForPwaUpdate().catch(() => {});
      // 2. 刷新核心数据
      const j = await api.likeList();
      if (j?.code === '000000' && Array.isArray(j.data)) {
        likedSet = new Set(j.data.map((n: any) => Number(n)));
        setApiCache('liked_song_ids', j.data);
      }
      showToast('已同步最新数据与应用状态', 'success', 1500);
    } catch {
      window.location.reload();
    }
  }
</script>

<!-- 📱 手机端下拉刷新指示器 (模态框/抽屉打开时自动禁用避免手势冲突) -->
<PullToRefresh disabled={isAnyOverlayOpen} onRefresh={handleRefresh} />

<!-- 顶栏导航 -->
<TopBar
  {tab} {themeMode} {repeat}
  onSwitchTab={switchTab}
  onToggleTheme={toggleTheme}
  onToggleRepeat={() => { repeat = !repeat; api.setRepeat(repeat); }}
  onSwitchToLegacy={switchToLegacy}
  onRefresh={handleRefresh}
/>

<!-- 内容区 (3 个 Tab 保持常驻 DOM，零重绘、零抖动、瞬时切换) -->
<div class="max-w-[900px] mx-auto flex flex-col gap-3 pb-[120px]">
  <div style="display: {tab === 'playlist' ? 'contents' : 'none'};">
    <PlaylistTab
      {playlistId} {curTrack} {playing} {likedSet} {downloadedSet}
      onToggleLike={toggleLike} onPlayQueue={setQueue} onAlbum={jumpToAlbum} onReveal={handleReveal} {showToast}
    />
  </div>
  <div style="display: {tab === 'search' ? 'contents' : 'none'};">
    <SearchTab
      {albumId} {curTrack} {playing} {downloadedSet} {likedSet}
      onToggleLike={toggleLike} onPlayQueue={setQueue} onAlbum={jumpToAlbum} onPlaylist={jumpToPlaylist}
      onSong={(sid) => { playlistId = sid; switchTab('playlist'); }} onReveal={handleReveal} {showToast}
    />
  </div>
  <div style="display: {tab === 'download-mgr' ? 'contents' : 'none'};">
    <DownloadMgrTab {curTrack} {playing} onPlayQueue={setQueue} onReveal={handleReveal} {showToast} />
  </div>

  <!-- 底部低调版本号 -->
  <footer class="text-center text-[11px] text-[var(--text-muted)] font-mono py-3 select-none opacity-40 hover:opacity-80 transition-opacity">
    网易云音乐下载器 · PWA v{__APP_VERSION__}
  </footer>
</div>

<!-- 全局原生 Audio 引擎 (静默挂载) -->
<audio
  bind:this={audioEl}
  onplay={() => playing = true}
  onpause={() => playing = false}
  ontimeupdate={(e) => {
    const a = e.currentTarget;
    curTime = a.currentTime;
    duration = a.duration || 0;
    if (curTime > 0) { try { localStorage.setItem('wyyyy_player_time', String(curTime)); } catch {} }
  }}
  onloadedmetadata={(e) => { duration = (e.currentTarget as HTMLAudioElement).duration || 0; }}
  onended={() => {
    if (playMode === 'single') {
      curTime = 0;
      if (audioEl) { try { audioEl.currentTime = 0; } catch {} audioEl.play().catch(() => {}); }
    } else {
      next();
    }
  }}
></audio>

<!-- 🎬 现代专业音频播放控制栏 (SP 大触控 / PC 优雅三段式) -->
<PlayerBar
  {curTrack} {queue} {playing} {curTime} {duration} {playMode} bind:vol
  onTogglePlay={togglePlay} onPrev={prev} onNext={next}
  onToggleMode={() => playMode = playMode === 'list' ? 'single' : playMode === 'single' ? 'shuffle' : 'list'}
  onSeek={seek} onLyric={() => showLyric = !showLyric} onPeq={() => showPeq = !showPeq}
  onQueue={() => showDrawer = !showDrawer}
  onClearQueue={() => { queue = []; qIndex = 0; savePlayerState(); showToast('播放队列已清空', 'info'); }}
/>

<!-- 📜 播放列表 & 下载任务 统一抽屉 -->
{#if showDrawer}
  <PlaylistDrawer
    {queue} {qIndex} {tasks} {likedSet} {autoSkipTrial} {offlineOnly} {downloadedSet}
    onPlayIndex={(idx) => { qIndex = idx; curTime = 0; if (audioEl) { try { audioEl.currentTime = 0; } catch {} } ensurePlay(true); }}
    onClearQueue={() => { queue = []; qIndex = 0; savePlayerState(); showToast('播放队列已清空', 'info'); }}
    onRemoveItem={(realIdx) => { queue = queue.filter((_, idx) => idx !== realIdx); if (qIndex >= queue.length) qIndex = Math.max(0, queue.length - 1); savePlayerState(); }}
    onToggleLike={toggleLike}
    onToggleAutoSkip={(val) => { autoSkipTrial = val; savePlayerState(); }}
    onToggleOfflineOnly={(val) => { offlineOnly = val; savePlayerState(); }}
    onClearTasks={clearTasks} onReveal={handleReveal} onClose={() => showDrawer = false}
  />
{/if}

<!-- 全屏黑胶歌词 -->
{#if showLyric && curTrack}
  <LyricModal
    track={curTrack} currentTime={curTime} {duration} {playing} {playMode} bind:vol
    isLiked={likedSet.has(Number(curTrack.id))}
    onTogglePlay={togglePlay} onPrev={prev} onNext={next}
    onToggleMode={() => playMode = playMode === 'list' ? 'single' : playMode === 'single' ? 'shuffle' : 'list'}
    onSeek={seek} onSeekTime={(t) => { if (audioEl) { audioEl.currentTime = t; curTime = t; } }}
    onToggleLike={() => toggleLike(Number(curTrack.id), curTrack.name)}
    onTogglePeq={() => showPeq = !showPeq} onToggleDrawer={() => showDrawer = !showDrawer}
    onClose={() => showLyric = false}
  />
{/if}

<!-- iOS Web Audio API 熄屏会导致挂起中断音频，故在 iOS 设备上彻底不加载 PEQ -->
{#if !isIOS() && showPeq}
  <PeqDrawer onClose={() => showPeq = false} />
{/if}

{#if revealData}
  <RevealModal path={revealData.path} msg={revealData.msg} onClose={() => revealData = null} {showToast} />
{/if}

<!-- 🔔 全局 Toast 浮动提示容器 -->
<ToastContainer {toasts} />

<!-- 🌐 Global Bottom Sheet — rendered at root to escape any backdrop-blur containing blocks -->
<BottomSheet />
