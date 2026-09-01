<script lang="ts">
  import { onMount } from 'svelte';
  import { myPlaylists, allTracks, pageSize, getPaged, getTotalPages, getPlaylist, getPlaylistFilter, getCurPage, loadMyPlaylists, loadPlaylistDetail, incPage } from '../lib/playlist.svelte';
  import { api } from '../lib/api';
  import { formatArtist } from '../lib/utils';

  let paged = $derived(getPaged());
  let totalPages = $derived(getTotalPages());
  let playlist = $derived(getPlaylist());
  let playlistFilter = $derived(getPlaylistFilter());
  let curPage = $derived(getCurPage());

  let {
    playlistId,
    likedSet,
    downloadedSet = new Set<number>(),
    onToggleLike,
    onPlayQueue,
    onAlbum,
    onReveal,
    showToast
  } = $props<{
    playlistId: string,
    likedSet: Set<number>,
    downloadedSet?: Set<number>,
    onToggleLike: (id: number, name: string) => void,
    onPlayQueue: (tracks: any[], idx?: number) => void,
    onAlbum?: (albumId: string) => void,
    onReveal?: (item: any) => void,
    showToast: (m: string, t?: string) => void
  }>();

  let pid = $state(playlistId);
  let accMy = $state(true);
  let accDetail = $state(true);
  let accSong = $state(false);

  // 单曲信息状态
  let songId = $state('');
  let songLevel = $state('lossless');
  let songInfo: any = $state(null);

  // 初始化自动拉取/读取 SWR 缓存
  onMount(async () => {
    try {
      await loadMyPlaylists('created');
    } catch (e: any) {
      // 首次未登录等情况静默容错
    }
  });

  // 监听外部传入的歌单 ID 变动
  $effect(() => {
    if (playlistId && playlistId !== pid) {
      pid = playlistId;
      handleViewPlaylist(playlistId);
    }
  });

  // 查看歌单详情交互：瞬间收起卡片1，展开卡片2
  async function handleViewPlaylist(id: string) {
    if (!id) {
      showToast('请输入歌单 ID', 'warning');
      return;
    }
    pid = id;
    accMy = false;
    accDetail = true;
    accSong = false;
    try {
      await loadPlaylistDetail(pid);
    } catch (e: any) {
      showToast(e.message || '获取歌单失败', 'warning');
    }
  }

  // 查看单曲信息交互：瞬间收起其他卡片，展开卡片3
  async function handleViewSong(id: string) {
    if (!id) {
      showToast('请输入歌曲 ID', 'warning');
      return;
    }
    songId = id;
    accMy = false;
    accDetail = false;
    accSong = true;
    try {
      const j = await api.songV1(songId, songLevel);
      if (j?.code && j.code !== '000000') {
        showToast(j.msg || '获取失败', 'warning');
        return;
      }
      songInfo = j?.data || null;
      if (!songInfo) showToast('无歌曲数据', 'warning');
    } catch (e: any) {
      showToast('获取单曲失败: ' + (e.message || e), 'error');
    }
  }
</script>

<!-- Section 1: 我的歌单 -->
<div class="accordion-card" class:active={accMy}>
  <div class="accordion-header" onclick={() => accMy = !accMy}>
    <h3 class="accordion-title">📋 1. 我的歌单</h3>
    <span class="accordion-icon">▼</span>
  </div>
  <div class="accordion-body">
    <div class="my-playlist-filter-bar">
      <span class="filter-bar-label">账号歌单快捷加载：</span>
      <div class="playlist-quick-btn-group">
        <button class="btn-primary quick-btn-item btn-created" onclick={() => loadMyPlaylists('created')}>📂 创建<span class="pc-only-text">的歌单</span></button>
        <button class="btn-primary quick-btn-item btn-subscribed" onclick={() => loadMyPlaylists('subscribed')}>⭐ 收藏<span class="pc-only-text">的歌单</span></button>
        <button class="btn-primary quick-btn-item btn-all" onclick={() => loadMyPlaylists('all')}>📋 全部</button>
        <button class="btn-primary quick-btn-item btn-create" onclick={() => showToast('新建见外层弹窗', 'info')}>➕ 新建<span class="pc-only-text">歌单</span></button>
      </div>
    </div>
    <ul class="data-list scrollable-list">
      {#each myPlaylists.filter(p => playlistFilter === 'all' || (playlistFilter === 'created' ? !p.subscribed : !!p.subscribed)) as pl, idx}
        <li>
          <div style="flex:1; display:flex; align-items:center; gap:6px; overflow:hidden;">
            <span class="status-badge" style="background:{pl.subscribed ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)'}; color:{pl.subscribed ? '#60a5fa' : '#4ade80'}; border:1px solid {pl.subscribed ? 'rgba(59,130,246,0.25)' : 'rgba(34,197,94,0.25)'}; font-weight:600; padding:2px 6px; border-radius:6px; font-size:11px;">{pl.subscribed ? '收藏' : '创建'}</span>
            <strong class="clickable-track-title" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer;" onclick={() => handleViewPlaylist(String(pl.id))}>{pl.name}</strong>
            <span style="color:var(--text-muted); font-size:11px;">({pl.trackCount || 0}首)</span>
          </div>
          <div style="display:flex; gap:6px;">
            {#if pl.subscribed}
              <button class="jump-link-btn" style="background:rgba(239,68,68,0.1); color:#f87171;" onclick={() => api.playlistSubscribe(String(pl.id), false).then(j => j.code === '000000' ? showToast('已取消', 'success') : showToast(j.msg, 'warning'))}>💔 取消收藏</button>
            {:else if idx > 0}
              <button class="jump-link-btn" style="background:rgba(239,68,68,0.08); color:#f87171;" onclick={() => api.playlistDelete(String(pl.id)).then(j => j.code === '000000' ? showToast('已删除', 'success') : showToast(j.msg, 'warning'))}>🗑️ 删除</button>
            {/if}
            <button class="jump-link-btn" onclick={() => handleViewPlaylist(String(pl.id))}>👉 查看详情</button>
          </div>
        </li>
      {:else}
        <li style="justify-content:center; color:var(--text-muted);">暂无歌单</li>
      {/each}
    </ul>
  </div>
</div>

<!-- Section 2: 查看歌单详情 -->
<div class="accordion-card" class:active={accDetail}>
  <div class="accordion-header" onclick={() => accDetail = !accDetail}>
    <h3 class="accordion-title">🎼 2. 查看歌单详情</h3>
    <span class="accordion-icon">▼</span>
  </div>
  <div class="accordion-body">
    <div class="form-row flex-input-row">
      <input type="text" placeholder="输入歌单 ID (如 123456，按回车查看)" style="flex:1;" bind:value={pid} onkeydown={(e) => e.key === 'Enter' && handleViewPlaylist(pid)} />
      <button class="btn-primary inline-action-btn" onclick={() => handleViewPlaylist(pid)}>查看<span class="pc-only-text">歌单详情</span></button>
    </div>
    {#if playlist}
      <div class="detail-header-card">
        <img src={playlist.coverImgUrl || '/favicon.png'} alt="" class="detail-cover-img" />
        <div class="detail-header-info">
          <h4 class="detail-header-title">{playlist.name}</h4>
          <div class="detail-header-sub">{playlist.creator || '未知'} | 共 {allTracks.length} 首</div>
          <div class="detail-btn-group">
            <button class="btn-primary" onclick={() => api.downloadPlaylist(String(playlist.id)).then(() => showToast('已提交下载', 'success'))}>🖥️ 下载到电脑</button>
            <button class="btn-primary" style="background:#22c55e;" onclick={() => onPlayQueue(allTracks.map((t: any) => ({ id: t.id, name: t.name, artist: formatArtist(t), cover: t.al?.picUrl || '/favicon.png' })))}>▶️ 播放歌单</button>
          </div>
        </div>
      </div>
      <ul class="data-list scrollable-list">
        {#each paged as t, i}
          {@const idx = (curPage - 1) * pageSize + i + 1}
          {@const isLocal = (downloadedSet && downloadedSet.has(Number(t.id))) || t.isLocal === true}
          {@const artist = formatArtist(t)}
          <li>
            <div class="track-title-row" style="flex:1; display:flex; align-items:center; gap:6px; overflow:hidden;">
              <strong class="clickable-track-title" style="cursor:pointer;" onclick={() => handleViewSong(String(t.id))}>{idx}. {t.name}{artist ? ' - ' + artist : ''}</strong>
              {#if isLocal}<span class="audio-source-badge icon-only badge-server" style="margin-left:6px;" title="🖥️ 已存在服务器磁盘">🖥️</span>{/if}
              <button class="track-like-btn" class:active={likedSet.has(Number(t.id))} onclick={() => onToggleLike(Number(t.id), t.name)}>{likedSet.has(Number(t.id)) ? '❤️' : '🤍'}</button>
            </div>
            <div class="track-action-group">
              <button class={isLocal ? 'track-btn-slot slot-play-ready' : 'track-btn-slot slot-play-preview'} onclick={() => onPlayQueue([{ id: t.id, name: t.name, artist, cover: t.al?.picUrl || '/favicon.png', isLocal }])}>{isLocal ? '▶️ 播放' : '▶️ 试听'}</button>
              {#if isLocal}
                <button class="track-btn-slot slot-server-locate" onclick={() => onReveal && onReveal({ id: t.id, name: t.name, artist })}>📂 定位</button>
              {:else}
                <button class="track-btn-slot slot-server-download" onclick={() => api.downloadSingle(String(t.id)).then(() => showToast('已提交下载', 'success')).catch((e) => showToast('下载失败: ' + e, 'error'))}>📥 下载</button>
              {/if}
              <button class="track-btn-slot slot-browser-cache" onclick={() => showToast('缓存功能开发中', 'info')}>📲 缓存</button>
              <button class="track-btn-slot slot-add-playlist" onclick={() => showToast('添加歌单功能开发中', 'info')}>➕ 歌单</button>
            </div>
          </li>
        {/each}
      </ul>
      <div class="pagination-container" style="display:flex; justify-content:space-between; align-items:center;">
        <button class="btn-primary" disabled={curPage <= 1} onclick={() => incPage(-1)}>上一页</button>
        <span style="font-size:12px; color:var(--text-secondary);">第 {curPage} / {totalPages} 页 ({allTracks.length}首)</span>
        <button class="btn-primary" disabled={curPage >= totalPages} onclick={() => incPage(1)}>下一页</button>
      </div>
    {/if}
  </div>
</div>

<!-- Section 3: 查看歌曲信息 -->
<div class="accordion-card" class:active={accSong}>
  <div class="accordion-header" onclick={() => accSong = !accSong}>
    <h3 class="accordion-title">🎧 3. 查看歌曲信息</h3>
    <span class="accordion-icon">▼</span>
  </div>
  <div class="accordion-body">
    <div class="form-row flex-input-row" style="display:flex; gap:6px; margin-bottom:10px;">
      <input type="text" placeholder="输入歌曲 ID (按回车查看)" style="flex:1;" bind:value={songId} onkeydown={(e) => e.key === 'Enter' && handleViewSong(songId)} />
      <select bind:value={songLevel} style="width:auto; flex-shrink:0;">
        <option value="standard">标准</option>
        <option value="exhigh">极高</option>
        <option value="lossless">无损</option>
      </select>
      <button class="btn-primary inline-action-btn" onclick={() => handleViewSong(songId)}>查看<span class="pc-only-text">单曲信息</span></button>
    </div>
    {#if songInfo}
      {@const arText = formatArtist(songInfo) || '群星 / 未知'}
      {@const alText = songInfo.al_name || songInfo.album || '暂无专辑'}
      {@const sizeText = songInfo.size || '未知大小'}
      {@const levelText = songInfo.level || songLevel}
      {@const imgSrc = songInfo.pic || songInfo.picUrl || '/favicon.png'}

      <div class="detail-header-card" style="margin-top:10px;">
        <img
          src={imgSrc}
          alt=""
          class="detail-cover-img"
          referrerpolicy="no-referrer"
          onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (!img.src.includes('favicon.png')) img.src = '/favicon.png'; }}
        />
        <div class="detail-header-info" style="flex:1; min-width:0;">
          <h4 class="detail-header-title">{songInfo.name || songInfo.songName || '未知歌曲'}</h4>
          <div class="detail-header-sub">歌手：{arText} | 专辑：{alText}</div>
          <div class="detail-header-sub" style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">大小：{sizeText} | 音质：{levelText}</div>
          <div class="detail-btn-group" style="display:flex; gap:6px; flex-wrap:wrap;">
            <button
              class="btn-primary"
              style="background:linear-gradient(135deg, #10b981, #059669);"
              onclick={() => onPlayQueue([{
                id: songInfo.id || songId,
                name: songInfo.name || '单曲',
                artist: arText,
                cover: imgSrc,
                url: songInfo.url,
                lyric: songInfo.lyric
              }])}
            >
              ▶️ 在线试听
            </button>
            {#if songInfo.al_id || songInfo.albumId || songInfo.al?.id}
              <button
                class="btn-primary"
                style="background:linear-gradient(135deg, #8b5cf6, #7c3aed);"
                onclick={() => {
                  const aid = songInfo.al_id || songInfo.albumId || songInfo.al?.id;
                  if (aid && onAlbum) onAlbum(String(aid));
                }}
              >
                💽 查看专辑
              </button>
            {/if}
            <button
              class="btn-primary"
              onclick={() => api.downloadSingle(String(songInfo.id || songId)).then(() => showToast('已提交单曲下载', 'success')).catch((e) => showToast('下载失败: ' + e, 'error'))}
            >
              📥 下载单曲
            </button>
          </div>
        </div>
      </div>

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
  </div>
</div>
