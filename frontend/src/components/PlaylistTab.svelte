<script lang="ts">
  import { onMount } from 'svelte';
  import { myPlaylists, allTracks, pageSize, getPaged, getTotalPages, getPlaylist, getPlaylistFilter, getCurPage, loadMyPlaylists, loadPlaylistDetail, incPage } from '../lib/playlist.svelte';
  import { api } from '../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';
  import AccordionCard from './AccordionCard.svelte';
  import DetailHeaderCard from './DetailHeaderCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';

  let paged = $derived(getPaged());
  let totalPages = $derived(getTotalPages());
  let playlist = $derived(getPlaylist());
  let playlistFilter = $derived(getPlaylistFilter());
  let curPage = $derived(getCurPage());

  let {
    playlistId,
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
    playlistId: string,
    curTrack?: any,
    playing?: boolean,
    likedSet: Set<number>,
    downloadedSet?: Set<number>,
    onToggleLike: (id: number, name: string) => void,
    onPlayQueue: (tracks: any[], idx?: number) => void,
    onAlbum?: (albumId: string) => void,
    onReveal?: (item: any) => void,
    showToast: (m: string, t?: string) => void
  }>();

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

  let pid = $state(playlistId || getStored(STORAGE_KEY_PLAYLIST_ID, ''));
  let accMy = $state(getStored(STORAGE_KEY_ACC_MY, 'true') === 'true');
  let accDetail = $state(getStored(STORAGE_KEY_ACC_DETAIL, 'true') === 'true');
  let accSong = $state(getStored(STORAGE_KEY_ACC_SONG, 'false') === 'true');

  // 单曲信息状态
  let songId = $state(getStored(STORAGE_KEY_SONG_ID, ''));
  let songLevel = $state('lossless');
  let songInfo: any = $state(null);

  function saveAccState() {
    try {
      localStorage.setItem(STORAGE_KEY_ACC_MY, String(accMy));
      localStorage.setItem(STORAGE_KEY_ACC_DETAIL, String(accDetail));
      localStorage.setItem(STORAGE_KEY_ACC_SONG, String(accSong));
    } catch {}
  }

  // 初始化自动拉取/读取 SWR 缓存
  onMount(() => {
    // 1. 优先即时恢复上次查看的歌单详情（SWR 缓存优先秒显）
    const targetPid = pid || playlistId || getStored(STORAGE_KEY_PLAYLIST_ID, '');
    if (targetPid) {
      pid = targetPid;
      loadPlaylistDetail(targetPid).catch(() => {});
    }
    if (accSong && songId) {
      handleViewSong(songId, false).catch(() => {});
    }
    // 2. 异步拉取账号歌单列表
    loadMyPlaylists('created').catch(() => {});
  });

  // 监听外部传入的歌单 ID 变动
  $effect(() => {
    if (playlistId && playlistId !== pid) {
      pid = playlistId;
      handleViewPlaylist(playlistId);
    }
  });

  // 查看歌单详情交互：瞬间收起卡片1，展开卡片2
  async function handleViewPlaylist(id: string, switchCards = true) {
    if (!id) {
      showToast('请输入歌单 ID', 'warning');
      return;
    }
    pid = id;
    try {
      localStorage.setItem(STORAGE_KEY_PLAYLIST_ID, id);
      history.replaceState(null, '', `#/playlist?id=${id}`);
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
  async function playPlaylistDirect(id: string, name: string) {
    if (!id) return;
    try {
      showToast(`正在载入《${name}》...`, 'info', 1500);
      const res = await api.playlist(id);
      const tracks = res?.data?.playlist?.tracks || res?.data?.tracks || [];
      if (tracks && tracks.length > 0) {
        const queueTracks = tracks.map((t: any) => ({
          id: t.id,
          name: t.name,
          artist: formatArtist(t.artists || t.ar || t.artist),
          cover: t.picUrl || t.al?.picUrl || DEFAULT_VINYL_COVER,
          isLocal: (downloadedSet && downloadedSet.has(Number(t.id))) || t.isLocal === true
        }));
        if (onPlayQueue) {
          onPlayQueue(queueTracks, 0);
          showToast(`已开始播放歌单《${name}》(${queueTracks.length} 首)`, 'success', 2000);
        }
      } else {
        showToast('歌单内暂无曲目', 'warning');
      }
    } catch (e: any) {
      showToast('播放歌单失败: ' + (e.message || e), 'error');
    }
  }
</script>

<!-- Section 1: 我的歌单 -->
<AccordionCard title="📋 1. 我的歌单" bind:open={accMy} onToggle={saveAccState}>
  <div class="flex justify-between items-center flex-wrap gap-2 mb-3">
    <span class="text-[13px] text-[var(--text-secondary)] font-medium">账号歌单快捷加载：</span>
    <div class="flex gap-1.5 flex-nowrap w-auto max-sm:w-full max-sm:grid max-sm:grid-cols-4 max-sm:gap-1.5">
      <button class="btn-secondary rounded-lg px-3 py-1.5 max-sm:px-1 max-sm:py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 bg-gradient-to-br from-sky-600 to-sky-700" onclick={() => loadMyPlaylists('created')}>📂 创建<span class="hidden sm:inline">的歌单</span></button>
      <button class="btn-secondary rounded-lg px-3 py-1.5 max-sm:px-1 max-sm:py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 bg-gradient-to-br from-purple-600 to-purple-700" onclick={() => loadMyPlaylists('subscribed')}>⭐ 收藏<span class="hidden sm:inline">的歌单</span></button>
      <button class="btn-secondary rounded-lg px-3 py-1.5 max-sm:px-1 max-sm:py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 bg-gradient-to-br from-slate-600 to-slate-700" onclick={() => loadMyPlaylists('all')}>📋 全部</button>
      <button class="btn-secondary rounded-lg px-3 py-1.5 max-sm:px-1 max-sm:py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 bg-gradient-to-br from-emerald-600 to-emerald-700" onclick={() => showToast('新建见外层弹窗', 'info')}>➕ 新建<span class="hidden sm:inline">歌单</span></button>
    </div>
  </div>
  <ul class="data-list scrollable-list">
    {#each myPlaylists.filter(p => playlistFilter === 'all' || (playlistFilter === 'created' ? !p.subscribed : !!p.subscribed)) as pl, idx}
      <li class="track-item-card">
        <div class="track-title-row">
          <span class="status-badge shrink-0">{pl.subscribed ? '收藏' : '创建'}</span>
          <strong class="clickable-track-title truncate cursor-pointer" onclick={() => handleViewPlaylist(String(pl.id))}>{pl.name}</strong>
          <span class="text-xs text-[var(--text-muted)] shrink-0">({pl.trackCount || 0}首)</span>
        </div>
        <div class="track-action-group">
          <SlotBtn
            onclick={() => playPlaylistDirect(String(pl.id), pl.name)}
            title="立即播放整张歌单"
          >
            ▶️ 播放
          </SlotBtn>
          {#if pl.subscribed}
            <SlotBtn onclick={() => api.playlistSubscribe(String(pl.id), false).then(j => j.code === '000000' ? showToast('已取消', 'success') : showToast(j.msg, 'warning'))}>💔 取消</SlotBtn>
          {:else if idx > 0}
            <SlotBtn onclick={() => api.playlistDelete(String(pl.id)).then(j => j.code === '000000' ? showToast('已删除', 'success') : showToast(j.msg, 'warning'))}>🗑️ 删除</SlotBtn>
          {/if}
          <SlotBtn onclick={() => handleViewPlaylist(String(pl.id))}>👉 详情</SlotBtn>
        </div>
      </li>
    {:else}
      <li style="justify-content:center; color:var(--text-muted);">暂无歌单</li>
    {/each}
  </ul>
</AccordionCard>

<!-- Section 2: 查看歌单详情 -->
<AccordionCard title="🎼 2. 查看歌单详情" bind:open={accDetail} onToggle={saveAccState}>
  <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
    <input type="text" placeholder="输入歌单 ID (如 123456，按回车查看)" class="flex-1 min-w-0" bind:value={pid} oninput={() => { if (pid) { try { localStorage.setItem(STORAGE_KEY_PLAYLIST_ID, pid); } catch {} } }} onkeydown={(e) => e.key === 'Enter' && handleViewPlaylist(pid)} />
    <button class="btn-primary shrink-0 whitespace-nowrap" onclick={() => handleViewPlaylist(pid)}>查看<span class="hidden sm:inline">歌单详情</span></button>
  </div>
  {#if playlist}
    <DetailHeaderCard
      cover={playlist.coverImgUrl || '/favicon.png'}
      title={playlist.name}
      subtitle={`${playlist.creator || '未知'} | 共 ${allTracks.length} 首`}
    >
      <button class="btn-primary" onclick={() => api.downloadPlaylist(String(playlist.id)).then(() => showToast('已提交下载', 'success'))}>🖥️ 下载到电脑</button>
      <button class="btn-secondary" onclick={() => onPlayQueue(allTracks.map((t: any) => ({ id: t.id, name: t.name, artist: formatArtist(t), cover: t.al?.picUrl || '/favicon.png' })))}>▶️ 播放歌单</button>
    </DetailHeaderCard>
    <ul class="data-list scrollable-list">
      {#each paged as t, i}
        {@const idx = (curPage - 1) * pageSize + i + 1}
        {@const isLocal = (downloadedSet && downloadedSet.has(Number(t.id))) || t.isLocal === true}
        {@const artist = formatArtist(t)}
        {@const isPlayingThis = !!(curTrack && (String(curTrack.id) === String(t.id) || (curTrack.name && curTrack.name === t.name)))}
        <li class="track-item-card" class:is-active-playing={isPlayingThis}>
          <div class="track-title-row">
            <strong class="clickable-track-title cursor-pointer truncate" onclick={() => handleViewSong(String(t.id))}>{idx}. {t.name}{artist ? ' - ' + artist : ''}</strong>
            {#if isLocal}<span class="audio-source-badge icon-only badge-server ml-1.5" title="🖥️ 已存在服务器磁盘">🖥️</span>{/if}
            <TrackLikeBtn liked={likedSet.has(Number(t.id))} onclick={() => onToggleLike(Number(t.id), t.name)} />
          </div>
          <div class="track-action-group">
            <SlotBtn
              playing={isPlayingThis && playing}
              onclick={() => onPlayQueue([{ id: t.id, name: t.name, artist, cover: t.al?.picUrl || DEFAULT_VINYL_COVER, isLocal }])}
            >
              {isPlayingThis && playing ? '⏸ 播放中' : (isLocal ? '▶️ 播放' : '▶️ 试听')}
            </SlotBtn>
            {#if isLocal}
              <SlotBtn onclick={() => onReveal && onReveal({ id: t.id, name: t.name, artist })}>📂 定位</SlotBtn>
            {:else}
              <SlotBtn onclick={() => api.downloadSingle(String(t.id)).then(() => showToast('已提交下载', 'success')).catch((e) => showToast('下载失败: ' + e, 'error'))}>📥 下载</SlotBtn>
            {/if}
            <SlotBtn onclick={() => showToast('缓存功能开发中', 'info')}>📲 缓存</SlotBtn>
            <SlotBtn onclick={() => showToast('添加歌单功能开发中', 'info')}>➕ 歌单</SlotBtn>
          </div>
        </li>
      {/each}
    </ul>
    <div class="flex justify-between items-center gap-2.5 mt-3">
      <button class="btn-secondary" disabled={curPage <= 1} onclick={() => incPage(-1)}>上一页</button>
      <span class="text-xs text-[var(--text-secondary)] whitespace-nowrap">第 {curPage} / {totalPages} 页 ({allTracks.length}首)</span>
      <button class="btn-secondary" disabled={curPage >= totalPages} onclick={() => incPage(1)}>下一页</button>
    </div>
  {/if}
</AccordionCard>

<!-- Section 3: 查看歌曲信息 -->
<AccordionCard title="🎧 3. 查看歌曲信息" bind:open={accSong} onToggle={saveAccState}>
  <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
    <input type="text" placeholder="输入歌曲 ID (按回车查看)" class="flex-1 min-w-0" bind:value={songId} onkeydown={(e) => e.key === 'Enter' && handleViewSong(songId)} />
    <select bind:value={songLevel} class="w-auto shrink-0">
      <option value="standard">标准</option>
      <option value="exhigh">极高</option>
      <option value="lossless">无损</option>
    </select>
    <button class="btn-primary shrink-0 whitespace-nowrap" onclick={() => handleViewSong(songId)}>查看<span class="hidden sm:inline">单曲信息</span></button>
  </div>
  {#if songInfo}
    {@const arText = formatArtist(songInfo) || '群星 / 未知'}
    {@const alText = songInfo.al_name || songInfo.album || '暂无专辑'}
    {@const sizeText = songInfo.size || '未知大小'}
    {@const levelText = songInfo.level || songLevel}
    {@const imgSrc = songInfo.pic || songInfo.picUrl || '/favicon.png'}

    <DetailHeaderCard
      cover={imgSrc}
      title={songInfo.name || songInfo.songName || '未知歌曲'}
      subtitle={`歌手：${arText} | 专辑：${alText}`}
      subDetail={`大小：${sizeText} | 音质：${levelText}`}
    >
      <button
        class="btn-primary"
        onclick={() => onPlayQueue([{
          id: songInfo.id || songId,
          name: songInfo.name || '单曲',
          artist: arText,
          cover: imgSrc,
          url: songInfo.url,
          lyric: songInfo.lyric
        }])}
      >
        ▶️ 试听
      </button>
      <button
        class="btn-secondary"
        onclick={() => api.downloadSingle(String(songInfo.id || songId)).then(() => showToast('已提交单曲下载', 'success')).catch((e) => showToast('下载失败: ' + e, 'error'))}
      >
        📥 下载
      </button>
      {#if songInfo.al_id || songInfo.albumId || songInfo.al?.id}
        <button
          class="btn-secondary"
          onclick={() => {
            const aid = songInfo.al_id || songInfo.albumId || songInfo.al?.id;
            if (aid && onAlbum) onAlbum(String(aid));
          }}
        >
          💽 专辑
        </button>
      {/if}
    </DetailHeaderCard>

    <!-- 📄 查看 Raw JSON 响应数据 -->
    <div style="margin-top:10px;">
      <details style="border:1px solid var(--border-color); border-radius:6px; padding:6px 10px; background:var(--tag-btn-bg);">
        <summary style="font-size:12px; color:var(--primary-color); cursor:pointer; font-weight:600; outline:none;">▶ 📄 查看 Raw JSON 响应数据</summary>
        <pre style="background:#0f172a; color:#38bdf8; padding:10px; border-radius:6px; font-size:11px; max-height:200px; overflow-y:auto; margin-top:6px; font-family:Consolas, monospace; border:1px solid rgba(255,255,255,0.06); white-space:pre-wrap;">{JSON.stringify(songInfo.rawData || songInfo, null, 2)}</pre>
      </details>
    </div>

    <!-- 歌词预览面板 -->
    <div style="margin-top:10px; font-size:12px; color:var(--text-secondary); max-height:150px; overflow-y:auto; background:var(--tag-btn-bg); padding:8px 12px; border-radius:6px; border:1px solid var(--border-subtle);">
      <pre style="margin:0; font-family:inherit; white-space:pre-wrap; line-height:1.6;">{songInfo.lyric || '暂无歌词'}</pre>
    </div>
  {:else}
    <div class="empty-placeholder-card"><div class="empty-icon">🎧</div><div class="empty-title">在歌单中点击歌曲或输入歌曲 ID 查看</div></div>
  {/if}
</AccordionCard>
