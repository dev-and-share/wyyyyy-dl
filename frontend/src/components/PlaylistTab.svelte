<script lang="ts">
  import { onMount } from 'svelte';
  import {
    allTracks,
    pageSize,
    getPaged,
    getTotalPages,
    getPlaylist,
    getCurPage,
    loadMyPlaylists,
    loadPlaylistDetail,
    isPlaylistLoading,
    incPage,
    recordPlaylistPlay
  } from '../lib/playlist.svelte';
  import { api } from '../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';
  import { playPlaylistTracks } from '../lib/playerHelper';
  import AccordionCard from './AccordionCard.svelte';
  import DetailHeaderCard from './DetailHeaderCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';
  import TrackSourceBadge from './TrackSourceBadge.svelte';
  import MyPlaylistsSection from './MyPlaylistsSection.svelte';
  import SongDetailSection from './SongDetailSection.svelte';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte';
  import ForkPlaylistModal from './ForkPlaylistModal.svelte';
  import { cacheTrackToBrowser } from '../lib/pwaCache.svelte';
  import { getTrackSourceStatus } from '../lib/trackStatus.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { layoutState } from '../lib/layout.svelte';

  let paged = $derived(getPaged());
  let totalPages = $derived(getTotalPages());
  let playlist = $derived(getPlaylist());
  let curPage = $derived(getCurPage());

  let {
    playlistId,
    playlistTrigger = 0,
    curTrack = null,
    playing = false,
    likedSet,
    downloadedSet = new Set<number>(),
    onToggleLike,
    onPlayQueue,
    onAlbum,
    onReveal,
    showToast
  } = $props<{
    playlistId: string;
    playlistTrigger?: number;
    curTrack?: any;
    playing?: boolean;
    likedSet: Set<number>;
    downloadedSet?: Set<number>;
    onToggleLike: (id: number, name: string) => void;
    onPlayQueue: (tracks: any[], idx?: number) => void;
    onAlbum?: (albumId: string) => void;
    onReveal?: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let showForkModal = $state(false);

  const STORAGE_KEY_PLAYLIST_ID = 'wyyyy_last_playlist_id';
  const STORAGE_KEY_ACC_MY = 'wyyyy_pl_acc_my';
  const STORAGE_KEY_ACC_DETAIL = 'wyyyy_pl_acc_detail';
  const STORAGE_KEY_ACC_SONG = 'wyyyy_pl_acc_song';
  const STORAGE_KEY_SONG_ID = 'wyyyy_last_song_id';

  function getStored(key: string, def: string) {
    if (typeof localStorage === 'undefined') return def;
    const v = localStorage.getItem(key);
    return v !== null ? v : def;
  }

  function initPlaylistId() {
    return playlistId || getStored(STORAGE_KEY_PLAYLIST_ID, '');
  }

  let pid = $state(initPlaylistId());
  let pidInput = $state(initPlaylistId());
  let lastSeenPlaylistId = $state('');
  let lastSeenTrigger = $state(-1);
  let accMy = $state(getStored(STORAGE_KEY_ACC_MY, 'true') === 'true');
  let accDetail = $state(getStored(STORAGE_KEY_ACC_DETAIL, 'true') === 'true');
  let accSong = $state(getStored(STORAGE_KEY_ACC_SONG, 'false') === 'true');

  // 单曲信息状态
  let songId = $state(getStored(STORAGE_KEY_SONG_ID, ''));
  let songLevel = $state('lossless');
  let songInfo: any = $state(null);

  // 弹窗与交互状态
  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);
  let cachingTrackId = $state<string | number | null>(null);

  function saveAccState() {
    try {
      localStorage.setItem(STORAGE_KEY_ACC_MY, String(accMy));
      localStorage.setItem(STORAGE_KEY_ACC_DETAIL, String(accDetail));
      localStorage.setItem(STORAGE_KEY_ACC_SONG, String(accSong));
    } catch {}
  }

  // 初始化自动拉取/读取 SWR 缓存
  onMount(() => {
    const isDesktopMode = layoutState.mode === 'desktop-sidebar' && layoutState.isDesktop;
    const targetPid = playlistId || (!isDesktopMode ? (pid || getStored(STORAGE_KEY_PLAYLIST_ID, '')) : '');
    if (targetPid) {
      pid = targetPid;
      loadPlaylistDetail(targetPid).catch(() => {});
    }
    if (accSong && songId) {
      handleViewSong(songId, false).catch(() => {});
    }
    loadMyPlaylists('created').catch(() => {});
  });

  // 监听外部传入的歌单 ID 变动或 trigger 刷新动作
  $effect(() => {
    const curId = playlistId;
    const curTrig = playlistTrigger;
    if (curId && (curId !== lastSeenPlaylistId || curTrig !== lastSeenTrigger)) {
      lastSeenPlaylistId = curId;
      lastSeenTrigger = curTrig;
      pid = curId;
      pidInput = curId;
      handleViewPlaylist(curId, true);
    }
  });

  // 查看歌单详情交互：瞬间收起卡片1，展开卡片2
  async function handleViewPlaylist(id: string, switchCards = true) {
    const trimmed = id.trim();
    if (!trimmed) {
      showToast('请输入歌单 ID', 'warning');
      return;
    }
    pid = trimmed;
    pidInput = trimmed;
    try {
      localStorage.setItem(STORAGE_KEY_PLAYLIST_ID, trimmed);
      history.replaceState(null, '', `#/playlist?id=${trimmed}`);
    } catch {}
    if (switchCards) {
      accMy = false;
      accDetail = true;
      accSong = false;
      saveAccState();
    }
    try {
      await loadPlaylistDetail(pid);
    } catch (e: any) {
      if (switchCards) showToast(e.message || '获取歌单失败', 'warning');
    }
  }

  // 查看单曲信息交互：瞬间收起其他卡片，展开卡片3
  async function handleViewSong(id: string, switchCards = true) {
    if (!id) {
      showToast('请输入歌曲 ID', 'warning');
      return;
    }
    songId = id;
    try { localStorage.setItem(STORAGE_KEY_SONG_ID, id); } catch {}
    if (switchCards) {
      accMy = false;
      accDetail = false;
      accSong = true;
      saveAccState();
    }
    try {
      const j = await api.songV1(songId, songLevel);
      if (j?.code && j.code !== '000000') {
        if (switchCards) showToast(j.msg || '获取失败', 'warning');
        return;
      }
      songInfo = j?.data || null;
      if (!songInfo && switchCards) showToast('无歌曲数据', 'warning');
    } catch (e: any) {
      if (switchCards) showToast('获取单曲失败: ' + (e.message || e), 'error');
    }
  }

  // 一键直接播放整张歌单
  function playPlaylistDirect(id: string, name: string) {
    if (!id || !onPlayQueue) return;
    playPlaylistTracks(id, name, onPlayQueue, showToast);
  }

  async function downloadSingleTrack(id: string, name?: string) {
    try {
      const res = await api.downloadSingle(id);
      const task = res?.data;
      if (task && typeof task === 'object') {
        if (task.status === 'SKIP') {
          showToast(`已跳过《${task.name || name || '歌曲'}》: ${task.errorMsg || '试听片段或已存在'}`, 'warning', 4000);
        } else if (task.status === 'FAILED') {
          showToast(`下载失败《${task.name || name || '歌曲'}》: ${task.errorMsg || '下载失败'}`, 'error', 4000);
        } else if (task.status === 'SUCCESS') {
          showToast(`下载成功: 《${task.name || name || '歌曲'}》`, 'success', 2500);
        } else {
          showToast(`已提交下载: 《${task.name || name || '歌曲'}》`, 'info', 2000);
        }
      } else {
        showToast('已提交下载', 'info', 1500);
      }
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast('下载请求异常: ' + (e.message || e), 'error');
    }
  }

  async function handleCacheTrack(t: any) {
    cachingTrackId = t.id;
    showToast(`正在缓存《${t.name}》...`, 'info', 1500);
    try {
      const res = await cacheTrackToBrowser({
        id: t.id,
        name: t.name,
        artist: formatArtist(t),
        cover: t.al?.picUrl || t.picUrl || DEFAULT_VINYL_COVER,
        album: t.al?.name || t.album
      });
      if (res.success) {
        showToast(res.isTrial ? `已缓存(试听片段): 《${t.name}》` : `已离线缓存: 《${t.name}》`, res.isTrial ? 'warning' : 'success');
      } else {
        showToast(res.msg || '缓存失败', 'error');
      }
    } catch (e: any) {
      showToast('缓存失败: ' + (e.message || e), 'error');
    } finally {
      cachingTrackId = null;
    }
  }

  async function downloadPlaylistById(id: string) {
    try {
      await api.downloadPlaylist(id);
      showToast('已提交下载', 'success');
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast('下载失败: ' + e, 'error');
    }
  }

  async function handleToggleSubscribe() {
    if (!playlist?.id) return;
    const nextSub = !playlist.subscribed;
    try {
      const res = await api.playlistSubscribe(String(playlist.id), nextSub);
      if (res?.code && res.code !== '000000') {
        showToast(res.msg || (nextSub ? '收藏失败：网易云官方有设备风控限制，推荐使用「转存为自建歌单」' : '取消收藏失败'), 'warning', 5000);
        return;
      }
      playlist.subscribed = nextSub;
      showToast(nextSub ? `已收藏歌单《${playlist.name}》` : `已取消收藏歌单《${playlist.name}》`, 'success');
      window.dispatchEvent(new CustomEvent('wyyyy:playlist-created'));
    } catch (e: any) {
      showToast('操作异常，推荐使用「转存为自建歌单」', 'warning', 4000);
    }
  }

  function openTrackSheet(t: any, isLocal: boolean, isPhone: boolean, isServer: boolean, artist: string, isPlayingThis: boolean) {
    openSheet({
      title: t.name,
      subtitle: artist || '未知歌手',
      actions: [
        {
          label: isPlayingThis && playing ? '⏸ 暂停当前播放' : (isLocal ? '▶️ 播放本地音频' : '▶️ 试听在线歌曲'),
          style: 'primary',
          onclick: () => onPlayQueue([{ id: t.id, name: t.name, artist, cover: t.al?.picUrl || DEFAULT_VINYL_COVER, isLocal }])
        },
        isServer
          ? { label: '📂 在服务器磁盘中定位', style: 'default', onclick: () => onReveal && onReveal({ id: t.id, name: t.name, artist }) }
          : { label: '📥 下载到电脑服务器', style: 'default', onclick: () => downloadSingleTrack(String(t.id), t.name) },
        {
          label: cachingTrackId === t.id ? '⏳ 正在离线缓存...' : (isPhone ? '📲 重新离线缓存 (手机已存)' : '📲 离线缓存到本手机 (PWA)'),
          style: 'default',
          onclick: () => handleCacheTrack(t)
        },
        { label: '➕ 添加到歌单', style: 'default', onclick: () => { addToPlaylistSong = { id: t.id, name: t.name, artist }; } },
        { label: '🎧 查看歌曲详情 / 音质', style: 'default', onclick: () => handleViewSong(String(t.id)) },
        { label: likedSet.has(Number(t.id)) ? '💔 取消喜欢' : '❤️ 收藏到我的喜欢', style: 'default', onclick: () => onToggleLike(Number(t.id), t.name) }
      ]
    });
  }
</script>

<!-- Section 1: 我的歌单 -->
<MyPlaylistsSection
  bind:open={accMy}
  onToggle={saveAccState}
  onViewPlaylist={(id) => handleViewPlaylist(id)}
  onPlayPlaylist={(id, name) => playPlaylistDirect(id, name)}
  {showToast}
/>

<!-- Section 2: 查看歌单详情 -->
<AccordionCard title="🎼 2. 查看歌单详情" bind:open={accDetail} onToggle={saveAccState}>
    <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
      <input
        type="text"
        placeholder="输入歌单 ID (如 123456，按回车查看)"
        class="flex-1 min-w-0"
        bind:value={pidInput}
        disabled={isPlaylistLoading()}
        onkeydown={(e) => e.key === 'Enter' && !isPlaylistLoading() && handleViewPlaylist(pidInput)}
      />
      <button
        class="btn-primary shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 min-w-[84px] md:min-w-[100px]"
        disabled={isPlaylistLoading()}
        onclick={() => handleViewPlaylist(pidInput)}
      >
        {#if isPlaylistLoading()}
          <span class="inline-block animate-spin text-xs">⏳</span>
          <span>加载中...</span>
        {:else}
          <span>查看<span class="hidden sm:inline">歌单详情</span></span>
        {/if}
      </button>
    </div>

    {#if isPlaylistLoading() && (!playlist || String(playlist.id) !== pid)}
      <!-- 优雅加载骨架屏与提示 -->
      <div class="py-8 px-4 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)] rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] my-3 shadow-sm">
        <div class="text-3xl animate-spin text-red-500">⏳</div>
        <div class="text-sm font-semibold text-[var(--text-main)]">正在拉取歌单 #{pid} 数据...</div>
        <p class="text-xs text-[var(--text-muted)] text-center max-w-sm m-0 leading-relaxed">
          若为包含上千首曲目的超大歌单（如置顶红心歌单），系统正在并发补全完整歌曲详情，首次加载需数秒，请稍候
        </p>
        <div class="w-full max-w-sm flex flex-col gap-2 mt-2">
          <div class="h-12 rounded-xl bg-white/5 animate-pulse w-full"></div>
          <div class="h-6 rounded-lg bg-white/5 animate-pulse w-4/5"></div>
          <div class="h-6 rounded-lg bg-white/5 animate-pulse w-3/5"></div>
        </div>
      </div>
    {:else if playlist}
      <DetailHeaderCard
        cover={playlist.coverImgUrl || '/favicon.png'}
        title={playlist.name}
        subtitle={`${playlist.creator || '未知'} | 共 ${allTracks.length} 首`}
      >
        <button class="btn-primary" onclick={() => downloadPlaylistById(String(playlist.id))}>🖥️ 下载到电脑</button>
        <button class="btn-secondary" onclick={() => {
          if (playlist?.id) recordPlaylistPlay(playlist.id);
          onPlayQueue && onPlayQueue(allTracks.map((t: any) => ({ id: t.id, name: t.name, artist: formatArtist(t), cover: t.al?.picUrl || '/favicon.png' })));
        }}>▶️ 播放歌单</button>
        {#if playlist && !playlist.isCreator}
          <button class="btn-secondary !text-purple-400 !border-purple-500/30" onclick={() => showForkModal = true} title="转存为自建歌单，绕过官方风控">📦 转存自建</button>
          <button class="btn-secondary {playlist.subscribed ? '!text-red-400 !border-red-500/30' : ''}" onclick={handleToggleSubscribe} title={playlist.subscribed ? '取消收藏' : '收藏歌单'}>
            {playlist.subscribed ? '💔 取消收藏' : '⭐ 收藏歌单'}
          </button>
        {/if}
      </DetailHeaderCard>
      <ul class="data-list scrollable-list">
        {#each paged as t, i}
          {@const idx = (curPage - 1) * pageSize + i + 1}
          {@const status = getTrackSourceStatus(t.id, t.isLocal, curTrack)}
          {@const artist = formatArtist(t)}
          {@const isPlayingThis = !!(curTrack && (String(curTrack.id) === String(t.id) || (curTrack.name && curTrack.name === t.name)))}
          <li class="track-item-card" class:is-active-playing={isPlayingThis}>
            <div class="track-title-row">
              <button
                type="button"
                class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors"
                onclick={() => handleViewSong(String(t.id))}
              >
                {idx}. {t.name}{artist ? ' - ' + artist : ''}
              </button>
              <TrackSourceBadge id={t.id} isLocal={t.isLocal} {curTrack} class="ml-1.5" />
              <TrackLikeBtn liked={likedSet.has(Number(t.id))} onclick={() => onToggleLike(Number(t.id), t.name)} />
            </div>
            <div class="track-action-group">
              <!-- 💻 PC 桌面端：宽屏时显示完整快捷按钮组 -->
              <div class="hidden md:inline-flex items-center gap-1.5">
                <SlotBtn
                  playing={isPlayingThis && playing}
                  onclick={() => onPlayQueue([{ id: t.id, name: t.name, artist, cover: t.al?.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                >
                  {isPlayingThis && playing ? '⏸ 播放中' : (status.isLocal ? '▶️ 播放' : '▶️ 试听')}
                </SlotBtn>
                {#if status.isServer}
                  <SlotBtn onclick={() => onReveal && onReveal({ id: t.id, name: t.name, artist })}>📂 定位</SlotBtn>
                {:else}
                  <SlotBtn onclick={() => downloadSingleTrack(String(t.id), t.name)}>📥 下载</SlotBtn>
                {/if}
                <SlotBtn onclick={() => handleCacheTrack(t)}>{status.isPhone ? '✅ 已缓存' : cachingTrackId === t.id ? '⏳ 缓存中' : '📲 缓存'}</SlotBtn>
                <SlotBtn onclick={() => addToPlaylistSong = { id: t.id, name: t.name, artist }}>➕ 歌单</SlotBtn>
              </div>

              <!-- 📱 SP 移动端：外面仅保留核心常用功能 (▶️播放) + (··· 更多选项抽屉) -->
              <div class="inline-flex md:hidden items-center gap-1.5">
                <SlotBtn
                  playing={isPlayingThis && playing}
                  onclick={() => onPlayQueue([{ id: t.id, name: t.name, artist, cover: t.al?.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                >
                  {isPlayingThis && playing ? '⏸ 播放中' : (status.isLocal ? '▶️ 播放' : '▶️ 试听')}
                </SlotBtn>
                <button
                  type="button"
                  class="btn-more-actions"
                  onclick={() => openTrackSheet(t, status.isLocal, status.isPhone, status.isServer, artist, isPlayingThis)}
                  title="更多操作"
                  aria-label="更多操作"
                >
                  ···
                </button>
              </div>
            </div>
          </li>
        {/each}
      </ul>
      <div class="flex justify-between items-center gap-2.5 mt-3">
        <button class="btn-secondary" disabled={curPage <= 1} onclick={() => incPage(-1)}>上一页</button>
        <span class="text-xs text-[var(--text-secondary)] whitespace-nowrap">第 {curPage} / {totalPages} 页 ({allTracks.length}首)</span>
        <button class="btn-secondary" disabled={curPage >= totalPages} onclick={() => incPage(1)}>下一页</button>
      </div>
    {:else}
      <div class="empty-placeholder-card">
        <div class="empty-icon">🎼</div>
        <div class="empty-title">请输入歌单 ID 查看，或从上方账号歌单中选择</div>
      </div>
    {/if}
  </AccordionCard>

<!-- Section 3: 查看歌曲信息 -->
<SongDetailSection
  bind:open={accSong}
  onToggle={saveAccState}
  bind:songId
  bind:songLevel
  {songInfo}
  onViewSong={(sid) => handleViewSong(sid)}
  onPlayQueue={(tracks) => onPlayQueue(tracks)}
  onDownloadSingle={(sid, sname) => downloadSingleTrack(sid, sname)}
  {onAlbum}
/>

{#if addToPlaylistSong}
  <AddToPlaylistModal
    song={addToPlaylistSong}
    onClose={() => addToPlaylistSong = null}
    {showToast}
  />
{/if}

{#if showForkModal && playlist}
  <ForkPlaylistModal
    playlistName={playlist.name}
    trackCount={allTracks.length}
    trackIds={allTracks.map((t: any) => t.id)}
    onClose={() => showForkModal = false}
    onSuccess={(newId) => { if (newId) handleViewPlaylist(newId); }}
    {showToast}
  />
{/if}
