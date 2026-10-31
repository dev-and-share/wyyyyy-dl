<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    loadMyPlaylists, loadPlaylistDetail, recordPlaylistPlay
  } from '../lib/playlist.svelte';
  import { toPlayerTrack } from '../lib/playerHelper';
  import MyPlaylistsSection from './MyPlaylistsSection.svelte';
  import PlaylistDetailSection from './PlaylistDetailSection.svelte';
  import DailyRecommendSection from './DailyRecommendSection.svelte';
  import SegmentedTabs from './sp/SegmentedTabs.svelte';
  import SwipeableTabsView from './sp/SwipeableTabsView.svelte';
  import { layoutState } from '../lib/layout.svelte';
  import { t } from '../lib/i18n';

  let {
    playlistId, playlistTrigger = 0, curTrack = null, playing = false, likedSet,
    downloadedSet = new Set<number>(), onToggleLike, onPlayQueue, onAlbum, onReveal, onSong, showToast
  } = $props<{
    playlistId: string; playlistTrigger?: number; curTrack?: any; playing?: boolean; likedSet: Set<number>;
    downloadedSet?: Set<number>; onToggleLike: (id: number, name: string) => void;
    onPlayQueue: (tracks: any[], optionsOrIdx?: any) => void; onAlbum?: (albumId: string) => void;
    onReveal?: (item: any) => void; onSong?: (id: string) => void; showToast: (m: string, t?: string) => void;
  }>();

  const STORAGE_KEY_PLAYLIST_ID = 'wyyyy_last_playlist_id';
  const STORAGE_KEY_SUBTAB = 'wyyyy_pl_subtab';
  const getStored = (k: string, def: string) => typeof localStorage !== 'undefined' ? (localStorage.getItem(k) ?? def) : def;
  const initPlaylistId = () => playlistId || getStored(STORAGE_KEY_PLAYLIST_ID, '');

  let pid = $state(initPlaylistId());
  let lastSeenPlaylistId = $state('');
  let lastSeenTrigger = $state(-1);

  function initSubtab(): 'my' | 'detail' | 'recommend' {
    return playlistId ? 'detail' : ((getStored(STORAGE_KEY_SUBTAB, 'my') as any) || 'my');
  }

  let activeSubtab: 'my' | 'detail' | 'recommend' = $state(initSubtab());
  const SUBTABS: ('my' | 'detail' | 'recommend')[] = ['my', 'detail', 'recommend'];

  let activeTabIndex = $derived(Math.max(0, SUBTABS.indexOf(activeSubtab)));
  let accMy = $state(true), accDetail = $state(true), accRecommend = $state(true);

  function saveAccState() {
    try { localStorage.setItem(STORAGE_KEY_SUBTAB, activeSubtab); } catch {}
  }

  function setSubtab(id: 'my' | 'detail' | 'recommend') {
    activeSubtab = id;
    saveAccState();
  }

  function handleSwipeIndexChange(newIndex: number) {
    const nextTab = SUBTABS[newIndex] || 'my';
    activeSubtab = nextTab;
    saveAccState();
  }

  function scrollToDetail() {
    tick().then(() => {
      const el = document.getElementById('section-playlist-detail');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // 初始化自动拉取/读取 SWR 缓存
  onMount(() => {
    const isDesktopMode = layoutState.isDesktop;
    const targetPid = playlistId || (!isDesktopMode ? (pid || getStored(STORAGE_KEY_PLAYLIST_ID, '')) : '');
    if (targetPid && targetPid !== 'daily-recommend') {
      pid = targetPid;
      loadPlaylistDetail(targetPid).catch(() => {});
    } else if (targetPid === 'daily-recommend') {
      pid = 'daily-recommend';
    }
    loadMyPlaylists('created').catch(() => {});
  });

  // 监听外部传入的歌单 ID 变更与强制刷新触发器
  $effect(() => {
    const curId = playlistId;
    const curTrig = playlistTrigger;
    if (curId && (curId !== lastSeenPlaylistId || curTrig !== lastSeenTrigger)) {
      lastSeenPlaylistId = curId;
      lastSeenTrigger = curTrig;
      pid = curId;
      setSubtab('detail');
      accDetail = true;
      scrollToDetail();
      if (curId !== 'daily-recommend') {
        loadPlaylistDetail(curId, false).catch(() => {});
      }
    }
  });

  function handleViewPlaylist(targetId: string, force = false) {
    if (!targetId || !targetId.trim()) {
      showToast(t('playlist.enterId'), 'warning');
      return;
    }
    const cleanId = targetId.trim();
    pid = cleanId;
    setSubtab('detail');
    accDetail = true;
    try {
      localStorage.setItem(STORAGE_KEY_PLAYLIST_ID, cleanId);
      localStorage.setItem(STORAGE_KEY_SUBTAB, 'detail');
    } catch {}
    scrollToDetail();
    loadPlaylistDetail(cleanId, force).then(() => {
      if (force) showToast(t('playlist.refreshed'), 'success');
    }).catch(e => {
      showToast(t('playlist.fetchFailed', { error: e.message || e }), 'error');
    });
  }

  function playPlaylistDirect(targetId: string, targetName?: string) {
    if (!targetId) return;
    showToast(t('playlist.loadingTracks', { name: targetName || t('topbar.playlist') }), 'info', 1500);
    recordPlaylistPlay(targetId);
    loadPlaylistDetail(targetId).then(pl => {
      if (pl?.tracks?.length) {
        onPlayQueue && onPlayQueue(pl.tracks.map((tItem: any) => toPlayerTrack(tItem)), {
          startIndex: 0,
          playlistId: targetId,
          isExplicitTrack: false
        });
        showToast(t('playlist.startPlaying', { name: pl.name || targetName, count: pl.tracks.length }), 'success');
      } else {
        showToast(t('playlist.emptyOrError'), 'warning');
      }
    }).catch(e => {
      showToast(t('playlist.playFailed', { error: e.message || e }), 'error');
    });
  }
</script>

<!-- 📱 SP 移动端顶部三段式分段切换器 (焦点精准、原生高亮) -->
<SegmentedTabs
  items={[
    { id: 'my', label: t('playlist.tabMy'), icon: '📋', accent: 'red' },
    { id: 'detail', label: t('playlist.tabDetail'), icon: '🎼', accent: 'blue' },
    { id: 'recommend', label: t('playlist.tabRecommend'), icon: '📅', accent: 'amber' }
  ]}
  activeId={activeSubtab}
  onChange={(id) => setSubtab(id as any)}
/>

<!-- 🛝 移动端原生合成器级 120Hz 零卡顿丝滑滚动容器 -->
<SwipeableTabsView
  activeIndex={activeTabIndex}
  count={3}
  onChange={handleSwipeIndexChange}
>
  <!-- Section 1: 我的歌单 -->
  <div class="w-full">
    <MyPlaylistsSection
      flat bind:open={accMy} onToggle={saveAccState}
      onViewPlaylist={(id) => handleViewPlaylist(id)}
      onPlayPlaylist={(id, name) => playPlaylistDirect(id, name)}
      {showToast}
    />
  </div>

  <!-- Section 2: 查看歌单详情 -->
  <div id="section-playlist-detail" class="w-full">
    <PlaylistDetailSection
      bind:open={accDetail}
      {pid}
      {curTrack}
      {playing}
      {likedSet}
      {downloadedSet}
      {onToggleLike}
      {onPlayQueue}
      {onAlbum}
      {onReveal}
      {onSong}
      onViewPlaylist={handleViewPlaylist}
      onToggle={saveAccState}
      {showToast}
    />
  </div>

  <!-- Section 3: 每日专属推荐 -->
  <div class="w-full">
    <DailyRecommendSection
      flat bind:open={accRecommend} onToggle={saveAccState} {curTrack} {playing} {likedSet}
      {onToggleLike} {onPlayQueue} {onSong} {onAlbum} {onReveal} {showToast}
    />
  </div>
</SwipeableTabsView>
