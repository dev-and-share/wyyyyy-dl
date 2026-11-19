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
  import {
    AppRoute,
    PlaylistSubTab,
    type PlaylistSubTabType,
    SpecialRouteId,
    RouteUrl,
    isDailyRecommendRoute,
    parseRouteFromHash,
    STORAGE_KEYS,
    scrollToPageTop,
    routerState
  } from '../lib/router.svelte';
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

  function parseInitialState(): { subtab: PlaylistSubTabType; pid: string } {
    const hash = typeof window !== 'undefined' ? location.hash : '';
    const { playlistId: hashPid, subTab } = parseRouteFromHash(hash);
    const targetId = playlistId || hashPid || '';

    if (isDailyRecommendRoute(targetId)) {
      return { subtab: PlaylistSubTab.RECOMMEND, pid: '' };
    }
    if (targetId) {
      return { subtab: PlaylistSubTab.DETAIL, pid: targetId };
    }
    if (subTab === PlaylistSubTab.RECOMMEND) {
      return { subtab: PlaylistSubTab.RECOMMEND, pid: '' };
    }
    if (subTab === PlaylistSubTab.DETAIL) {
      return { subtab: PlaylistSubTab.DETAIL, pid: '' };
    }
    return { subtab: PlaylistSubTab.MY, pid: '' };
  }

  const initState = parseInitialState();
  let pid = $state(initState.pid);
  let lastSeenPlaylistId = $state<string | null>(null);
  let lastSeenTrigger = $state<number | null>(null);
  let activeSubtab: PlaylistSubTabType = $state(initState.subtab);
  const SUBTABS: PlaylistSubTabType[] = [PlaylistSubTab.MY, PlaylistSubTab.DETAIL, PlaylistSubTab.RECOMMEND];

  let activeTabIndex = $derived(Math.max(0, SUBTABS.indexOf(activeSubtab)));
  let accMy = $state(true), accDetail = $state(true), accRecommend = $state(true);

  function saveAccState() {
    try { localStorage.setItem(STORAGE_KEYS.PLAYLIST_SUBTAB, activeSubtab); } catch {}
  }

  function setSubtab(id: PlaylistSubTabType, syncUrl = true) {
    if (activeSubtab === id) {
      scrollToPageTop();
      return;
    }
    activeSubtab = id;
    saveAccState();

    if (syncUrl) {
      const url = RouteUrl.playlistSubTab(id, pid);
      if (id === PlaylistSubTab.MY) {
        routerState.playlistId = '';
        history.pushState(null, '', url);
        try {
          localStorage.removeItem(STORAGE_KEYS.LAST_PLAYLIST_ID);
        } catch {}
      } else if (id === PlaylistSubTab.RECOMMEND) {
        routerState.playlistId = SpecialRouteId.DAILY_RECOMMEND;
        history.pushState(null, '', url);
        try {
          localStorage.setItem(STORAGE_KEYS.LAST_PLAYLIST_ID, SpecialRouteId.DAILY_RECOMMEND);
        } catch {}
      } else if (id === PlaylistSubTab.DETAIL) {
        if (pid && !isDailyRecommendRoute(pid)) {
          routerState.playlistId = pid;
          history.pushState(null, '', url);
          try {
            localStorage.setItem(STORAGE_KEYS.LAST_PLAYLIST_ID, pid);
          } catch {}
        } else {
          routerState.playlistId = '';
          history.pushState(null, '', url);
        }
      }
    }
  }

  function handleSwipeIndexChange(newIndex: number) {
    const nextTab = SUBTABS[newIndex] || PlaylistSubTab.MY;
    setSubtab(nextTab, true);
  }

  function scrollToDetail() {
    tick().then(() => {
      const el = document.getElementById('section-playlist-detail');
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // 初始化自动拉取/读取 SWR 缓存
  onMount(() => {
    const isDesktopMode = layoutState.isDesktop;
    const targetPid = playlistId || (!isDesktopMode ? pid : '');
    if (targetPid && !isDailyRecommendRoute(targetPid)) {
      pid = targetPid;
      loadPlaylistDetail(targetPid).catch(() => {});
    }
    loadMyPlaylists().catch(() => {});
  });

  // 监听外部传入的歌单 ID 变更与强制刷新触发器
  $effect(() => {
    const curId = playlistId;
    const curTrig = playlistTrigger;
    if (lastSeenPlaylistId === null) {
      lastSeenPlaylistId = curId;
      lastSeenTrigger = curTrig;
      return;
    }
    if (curId !== lastSeenPlaylistId || curTrig !== lastSeenTrigger) {
      lastSeenPlaylistId = curId;
      lastSeenTrigger = curTrig;
      if (isDailyRecommendRoute(curId)) {
        activeSubtab = PlaylistSubTab.RECOMMEND;
        accRecommend = true;
        saveAccState();
      } else if (curId) {
        pid = curId;
        activeSubtab = PlaylistSubTab.DETAIL;
        accDetail = true;
        scrollToDetail();
        loadPlaylistDetail(curId, false).catch(() => {});
        saveAccState();
      } else {
        const hash = typeof window !== 'undefined' ? location.hash : '';
        const { playlistId: hashPid, subTab } = parseRouteFromHash(hash);
        if (isDailyRecommendRoute(hashPid) || subTab === PlaylistSubTab.RECOMMEND) {
          activeSubtab = PlaylistSubTab.RECOMMEND;
        } else if (subTab === PlaylistSubTab.DETAIL) {
          activeSubtab = PlaylistSubTab.DETAIL;
        } else {
          activeSubtab = PlaylistSubTab.MY;
        }
        saveAccState();
      }
    }
  });

  function handleViewPlaylist(targetId: string, force = false) {
    if (!targetId || !targetId.trim()) {
      showToast(t('playlist.enterId'), 'warning');
      return;
    }
    const cleanId = targetId.trim();
    if (isDailyRecommendRoute(cleanId)) {
      setSubtab(PlaylistSubTab.RECOMMEND, true);
      return;
    }
    pid = cleanId;
    setSubtab(PlaylistSubTab.DETAIL, false);
    accDetail = true;

    // 同步更新 URL Hash 与历史记录，使用户刷新后依然停留在该歌单
    routerState.playlistId = cleanId;
    history.pushState(null, '', RouteUrl.playlist(cleanId));

    try {
      localStorage.setItem(STORAGE_KEYS.LAST_PLAYLIST_ID, cleanId);
      localStorage.setItem(STORAGE_KEYS.PLAYLIST_SUBTAB, PlaylistSubTab.DETAIL);
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
  <div class="w-full flex-1 flex flex-col">
    <MyPlaylistsSection
      flat bind:open={accMy} onToggle={saveAccState}
      onViewPlaylist={(id) => handleViewPlaylist(id)}
      onPlayPlaylist={(id, name) => playPlaylistDirect(id, name)}
      {showToast}
    />
  </div>

  <!-- Section 2: 查看歌单详情 -->
  <div id="section-playlist-detail" class="w-full flex-1 flex flex-col">
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
  <div class="w-full flex-1 flex flex-col">
    <DailyRecommendSection
      flat bind:open={accRecommend} onToggle={saveAccState} {curTrack} {playing} {likedSet}
      {onToggleLike} {onPlayQueue} {onSong} {onAlbum} {onReveal} {showToast}
    />
  </div>
</SwipeableTabsView>
