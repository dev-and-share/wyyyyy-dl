<script lang="ts">
  import { api } from '../lib/api';

  let {
    albumId = '',
    downloadedSet = new Set<number>(),
    onAlbum,
    onPlaylist,
    onPlayQueue,
    onSong,
    onReveal,
    showToast
  } = $props<{
    albumId?: string;
    downloadedSet?: Set<number>;
    onAlbum?: (id: string) => void;
    onPlaylist: (id: string) => void;
    onPlayQueue?: (tracks: any[], idx?: number) => void;
    onSong?: (id: string) => void;
    onReveal?: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let accSearch = $state(true);
  let accAlbum = $state(false);

  // 搜索相关状态
  let kw = $state('');
  let sType = $state('1');
  let sLimit = $state('10');
  let sResults: any[] = $state([]);

  // 专辑相关状态
  let currentAlbumId = $state('');
  let album: any = $state(null);
  let albumLoading = $state(false);

  // 监听外部传入的 albumId（如从单曲详情点击“查看专辑”）
  $effect(() => {
    if (albumId) {
      currentAlbumId = albumId;
      accSearch = false;
      accAlbum = true;
      loadAlbum(albumId);
    }
  });

  async function doSearch() {
    if (!kw.trim()) {
      showToast('请输入关键词', 'warning');
      return;
    }
    try {
      const j = await api.search(kw, sType, sLimit);
      if (j?.code && j.code !== '000000') {
        showToast(j.msg || '搜索失败', 'warning');
        return;
      }
      const d = j?.data;
      if (Array.isArray(d)) sResults = d;
      else sResults = (d as any)?.songs || (d as any)?.albums || (d as any)?.playlists || (d as any)?.artists || (d as any)?.result || [];
      if (!sResults.length) showToast('无结果', 'info');
    } catch (e: any) {
      showToast('搜索失败: ' + e.message, 'error');
    }
  }

  async function loadAlbum(id?: string) {
    const targetId = id || currentAlbumId;
    if (!targetId) {
      showToast('请输入专辑 ID', 'warning');
      return;
    }
    currentAlbumId = targetId;
    accSearch = false;
    accAlbum = true;
    album = null;
    albumLoading = true;
    try {
      const j = await api.album(targetId);
      albumLoading = false;
      if (j?.code && j.code !== '000000') {
        showToast(j.msg || '获取专辑失败', 'warning');
        return;
      }
      album = j?.data?.album || j?.data || null;
      if (!album) showToast('未找到对应专辑数据', 'warning');
    } catch (e: any) {
      albumLoading = false;
      showToast('获取专辑失败: ' + (e.message || e), 'error');
    }
  }

  function handleAlbum(id: string) {
    currentAlbumId = id;
    loadAlbum(id);
  }

  // 整辑播放
  function playFullAlbum() {
    if (!album?.songs?.length) {
      showToast('当前专辑无可播曲目', 'warning');
      return;
    }
    const tracks = album.songs.map((s: any) => ({
      id: s.id,
      name: s.name,
      artist: typeof s.artist === 'object' ? s.artist.name : (s.artist || album.artist || '未知歌手'),
      cover: album.coverImgUrl || album.picUrl || '/favicon.png',
      url: s.url,
      lyric: s.lyric
    }));
    if (onPlayQueue) {
      onPlayQueue(tracks, 0);
      showToast(`已开始播放专辑《${album.name}》共 ${tracks.length} 首`, 'success');
    }
  }

  // 整辑下载
  async function downloadFullAlbum() {
    if (!album?.id) return;
    try {
      await api.downloadAlbum(String(album.id));
      showToast('已提交整辑下载任务', 'success');
    } catch (e: any) {
      showToast('下载失败: ' + e, 'error');
    }
  }
</script>

<!-- Section 1: 关键词综合搜索 -->
<div class="accordion-card" class:active={accSearch}>
  <div class="accordion-header" onclick={() => accSearch = !accSearch}>
    <h3 class="accordion-title">🔍 1. 关键词综合搜索</h3>
    <span class="accordion-icon">▼</span>
  </div>
  <div class="accordion-body">
    <!-- 4 个单选 Radio -->
    <div class="search-type-radios" style="display:flex; gap:16px; margin-bottom:10px; align-items:center; flex-wrap:wrap; font-size:13px; padding:2px 0;">
      <span style="color:var(--text-secondary); font-weight:600;">搜索类型：</span>
      <label class="search-radio-item" style="display:flex; align-items:center; gap:4px; cursor:pointer; color:{sType==='1'?'var(--primary-color)':'var(--text-secondary)'}; font-weight:{sType==='1'?'700':'400'};">
        <input type="radio" name="searchType" value="1" bind:group={sType} style="cursor:pointer;" />
        <span>🎵 单曲</span>
      </label>
      <label class="search-radio-item" style="display:flex; align-items:center; gap:4px; cursor:pointer; color:{sType==='10'?'var(--primary-color)':'var(--text-secondary)'}; font-weight:{sType==='10'?'700':'400'};">
        <input type="radio" name="searchType" value="10" bind:group={sType} style="cursor:pointer;" />
        <span>💽 专辑</span>
      </label>
      <label class="search-radio-item" style="display:flex; align-items:center; gap:4px; cursor:pointer; color:{sType==='1000'?'var(--primary-color)':'var(--text-secondary)'}; font-weight:{sType==='1000'?'700':'400'};">
        <input type="radio" name="searchType" value="1000" bind:group={sType} style="cursor:pointer;" />
        <span>📁 歌单</span>
      </label>
      <label class="search-radio-item" style="display:flex; align-items:center; gap:4px; cursor:pointer; color:{sType==='100'?'var(--primary-color)':'var(--text-secondary)'}; font-weight:{sType==='100'?'700':'400'};">
        <input type="radio" name="searchType" value="100" bind:group={sType} style="cursor:pointer;" />
        <span>🎤 歌手</span>
      </label>
      <select bind:value={sType} style="display:none;" aria-label="搜索类型">
        <option value="1">单曲</option>
        <option value="10">专辑</option>
        <option value="1000">歌单</option>
        <option value="100">歌手</option>
      </select>
    </div>
    <div class="form-row search-form-row">
      <input type="text" placeholder="🔍 搜索歌曲 / 歌手 / 专辑 / 歌单 (按回车搜索)" style="flex:1;" bind:value={kw} onkeydown={(e) => e.key === 'Enter' && doSearch().catch((e:any) => showToast(e.message, 'warning'))} />
      <input type="number" bind:value={sLimit} min="1" max="100" class="search-limit-input" style="width:60px;" title="单页条数" />
      <button class="btn-primary sp-hide-btn" onclick={() => doSearch().catch((e:any) => showToast(e.message, 'warning'))}>搜索</button>
    </div>
    <ul class="data-list scrollable-list">
      {#each sResults as r, idx}
        {#if sType === '1'}
          <li class="track-item-card">
            <div class="track-title-row" style="flex:1; display:flex; align-items:center; gap:6px; overflow:hidden;">
              <strong class="clickable-track-title" style="cursor:pointer;" onclick={() => onSong ? onSong(String(r.id)) : (onPlayQueue && onPlayQueue([{ id: r.id, name: r.name, artist: r.artists || '', cover: '/favicon.png' }]))}>{idx + 1}. {r.name}</strong>
              {#if r.artists}<span style="color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"> - {r.artists}</span>{/if}
              <span style="color:var(--text-muted); font-size:11px; flex-shrink:0;">(ID:{r.id})</span>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              {#if onPlayQueue}
                <button class="jump-link-btn" onclick={() => onPlayQueue([{ id: r.id, name: r.name, artist: r.artists || '', cover: '/favicon.png' }])}>▶️ 播放</button>
              {/if}
              {#if onSong}
                <button class="jump-link-btn" onclick={() => onSong(String(r.id))}>👉 详情</button>
              {/if}
            </div>
          </li>
        {:else if sType === '10'}
          <li>
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              <strong class="clickable-track-title" style="cursor:pointer;" onclick={() => handleAlbum(String(r.id))}>{idx + 1}. {r.name}</strong>
              {#if r.artist}<span style="color:var(--text-secondary);"> - {typeof r.artist === 'object' ? r.artist.name : r.artist}</span>{/if}
              {#if r.size}<span style="color:var(--text-muted); font-size:12px;"> ({r.size} 首歌)</span>{/if}
              <span style="color:var(--text-muted); font-size:12px;"> (ID: {r.id})</span>
            </div>
            <button class="jump-link-btn" onclick={() => handleAlbum(String(r.id))}>👉 查看专辑详情</button>
          </li>
        {:else if sType === '1000'}
          <li>
            <div style="flex:1; overflow:hidden; white-space:nowrap;">
              <strong class="clickable-track-title" style="cursor:pointer;" onclick={() => onPlaylist(String(r.id))}>{idx + 1}. {r.name}</strong>
              <span style="color:var(--text-muted);"> (ID:{r.id})</span>
            </div>
            <button class="jump-link-btn" onclick={() => onPlaylist(String(r.id))}>👉 查看详情</button>
          </li>
        {:else}
          <li>
            <strong>{idx + 1}. {r.name}</strong>
            <span style="color:var(--text-muted);"> (ID:{r.id})</span>
            <button class="jump-link-btn" onclick={() => showToast('歌手功能开发中', 'info')}>查看</button>
          </li>
        {/if}
      {:else}
        <li style="justify-content:center; color:var(--text-muted);">输入关键词搜索</li>
      {/each}
    </ul>
    <div style="font-size:12px; color:var(--text-muted); text-align:center; margin-top:8px;">共搜索到 {sResults.length} 条数据</div>
  </div>
</div>

<!-- Section 2: 专辑解析与整辑下载 -->
<div class="accordion-card" class:active={accAlbum}>
  <div class="accordion-header" onclick={() => accAlbum = !accAlbum}>
    <h3 class="accordion-title">💽 2. 专辑解析与整辑下载</h3>
    <span class="accordion-icon">▼</span>
  </div>
  <div class="accordion-body">
    <div class="form-row flex-input-row" style="display:flex; gap:6px; margin-bottom:12px;">
      <input type="text" placeholder="输入专辑 ID (如 258535483，按回车解析)" style="flex:1;" bind:value={currentAlbumId} onkeydown={(e) => e.key === 'Enter' && loadAlbum()} />
      <button class="btn-primary inline-action-btn" onclick={() => loadAlbum()}>解析<span class="pc-only-text">专辑</span></button>
    </div>

    {#if albumLoading}
      <div style="padding:24px; text-align:center; color:var(--text-secondary); font-size:14px;">🔄 正在解析专辑数据，请稍候...</div>
    {:else if album}
      <div class="detail-header-card" style="margin-bottom:15px;">
        <img
          src={album.coverImgUrl || album.picUrl || '/favicon.png'}
          alt="封面"
          class="detail-cover-img"
          referrerpolicy="no-referrer"
          onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (!img.src.includes('favicon.png')) img.src = '/favicon.png'; }}
        />
        <div class="detail-header-info">
          <h4 class="detail-header-title">{album.name || '未知专辑'}</h4>
          <div class="detail-header-sub">歌手：{typeof album.artist === 'object' ? album.artist.name : (album.artist || '未知歌手')} | 发行时间：{album.publishTime || '-'}</div>
          <div class="detail-header-sub" style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">共包含 {album.songs?.length || 0} 首曲目</div>
          <div class="detail-btn-group" style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn-primary flex-1-btn" onclick={downloadFullAlbum}>🖥️ 下载到电脑</button>
            <button class="btn-primary flex-1-btn" style="background:#22c55e;" onclick={playFullAlbum}>▶️ 播放专辑</button>
          </div>
        </div>
      </div>

      <h4 style="margin:15px 0 8px 0; color:var(--text-main); font-size:15px; font-weight:600;">专辑曲目列表 ({album.songs ? album.songs.length : 0} 首)：</h4>
      <ul class="data-list scrollable-list">
        {#each (album.songs || []) as s, i}
          {@const artistName = typeof s.artist === 'object' ? s.artist.name : (s.artist || album.artist || '')}
          {@const isLocal = (downloadedSet && downloadedSet.has(Number(s.id))) || s.isLocal === true}
          <li class="track-item-card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; gap:8px;">
            <div class="track-title-row" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; gap:6px;">
              <strong class="clickable-track-title" style="cursor:pointer;" onclick={() => onSong ? onSong(String(s.id)) : (onPlayQueue && onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: album.coverImgUrl || album.picUrl || '/favicon.png', isLocal }]))}>
                {i + 1}. {s.name}
              </strong>
              {#if artistName}<span style="color:var(--text-secondary); font-size:12px;"> - {artistName}</span>{/if}
              {#if isLocal}<span class="audio-source-badge icon-only badge-server" title="🖥️ 已下载到本地">🖥️</span>{/if}
            </div>
            <div class="track-action-group" style="display:flex; gap:6px; flex-shrink:0;">
              {#if onPlayQueue}
                <button class="jump-link-btn" onclick={() => onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: album.coverImgUrl || album.picUrl || '/favicon.png', isLocal }])}>
                  {isLocal ? '▶️ 播放' : '▶️ 试听'}
                </button>
              {/if}
              {#if isLocal}
                <button
                  class="jump-link-btn"
                  style="background:rgba(6,182,212,0.15); color:#22d3ee; border-color:rgba(6,182,212,0.3);"
                  onclick={() => onReveal && onReveal({ id: s.id, name: s.name, artist: artistName })}
                  title="在文件管理器中定位"
                >
                  📂 定位
                </button>
              {:else}
                <button class="jump-link-btn" onclick={() => api.downloadSingle(String(s.id)).then(() => showToast('已提交下载', 'success')).catch((e) => showToast('下载失败: ' + e, 'error'))}>
                  📥 下载
                </button>
              {/if}
              {#if onSong}
                <button class="jump-link-btn" onclick={() => onSong(String(s.id))}>🎧 详情</button>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="empty-placeholder-card">
        <div class="empty-icon">💽</div>
        <div class="empty-title">在搜索中选择专辑或输入 ID 解析</div>
      </div>
    {/if}
  </div>
</div>
