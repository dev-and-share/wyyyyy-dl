<script lang="ts">
  import { api } from '../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER, getApiCache, setApiCache } from '../lib/utils';
  import type { Track } from '../lib/types';
  import AccordionCard from './AccordionCard.svelte';
  import DetailHeaderCard from './DetailHeaderCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';

  let {
    albumId = '',
    curTrack = null,
    playing = false,
    downloadedSet = new Set<number>(),
    likedSet = new Set<number>(),
    onToggleLike,
    onAlbum,
    onPlaylist,
    onPlayQueue,
    onSong,
    onReveal,
    showToast
  } = $props<{
    albumId?: string;
    curTrack?: Track | null;
    playing?: boolean;
    downloadedSet?: Set<number>;
    likedSet?: Set<number>;
    onToggleLike?: (id: number, name: string, artist?: string) => void;
    onAlbum?: (id: string) => void;
    onPlaylist: (id: string) => void;
    onPlayQueue?: (tracks: any[], idx?: number) => void;
    onSong?: (id: string) => void;
    onReveal?: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  import { onMount } from 'svelte';

  const STORAGE_KEY_SEARCH_KW = 'wyyyy_search_kw';
  const STORAGE_KEY_SEARCH_TYPE = 'wyyyy_search_type';
  const STORAGE_KEY_ALBUM_ID = 'wyyyy_search_album_id';
  const STORAGE_KEY_ACC_SEARCH = 'wyyyy_search_acc_search';
  const STORAGE_KEY_ACC_ALBUM = 'wyyyy_search_acc_album';

  function getStored(key: string, def: string) {
    if (typeof localStorage === 'undefined') return def;
    const v = localStorage.getItem(key);
    return v !== null ? v : def;
  }

  let accSearch = $state(getStored(STORAGE_KEY_ACC_SEARCH, 'true') === 'true');
  let accAlbum = $state(getStored(STORAGE_KEY_ACC_ALBUM, 'false') === 'true');

  // 搜索相关状态
  let kw = $state(getStored(STORAGE_KEY_SEARCH_KW, ''));
  let sType = $state(getStored(STORAGE_KEY_SEARCH_TYPE, '1'));
  let sLimit = $state('10');
  let sResults: any[] = $state([]);
  let searchLoading = $state(false);

  // 专辑相关状态
  let currentAlbumId = $state(albumId || getStored(STORAGE_KEY_ALBUM_ID, ''));
  let album: any = $state(null);
  let albumLoading = $state(false);

  function saveSearchAccState() {
    try {
      localStorage.setItem(STORAGE_KEY_ACC_SEARCH, String(accSearch));
      localStorage.setItem(STORAGE_KEY_ACC_ALBUM, String(accAlbum));
    } catch {}
  }

  function handleTypeChange(val: string) {
    sType = val;
    try {
      localStorage.setItem(STORAGE_KEY_SEARCH_TYPE, val);
    } catch {}
    if (kw.trim()) {
      doSearch(false);
    }
  }

  onMount(() => {
    if (kw.trim()) {
      const cached = getApiCache('search_' + sType + '_' + kw.trim());
      if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
        sResults = cached.data;
      }
      doSearch(false);
    }
    if (currentAlbumId && accAlbum) {
      const cachedAlbum = getApiCache('album_' + currentAlbumId);
      if (cachedAlbum?.data) {
        album = cachedAlbum.data;
      }
      loadAlbum(currentAlbumId);
    }
  });

  // 监听外部传入的 albumId（如从单曲详情点击“查看专辑”）
  $effect(() => {
    if (albumId && albumId !== currentAlbumId) {
      currentAlbumId = albumId;
      accSearch = false;
      accAlbum = true;
      saveSearchAccState();
      try { localStorage.setItem(STORAGE_KEY_ALBUM_ID, albumId); } catch {}
      loadAlbum(albumId);
    }
  });

  async function doSearch(showEmptyToast = true) {
    if (!kw.trim()) {
      if (showEmptyToast) showToast('请输入关键词', 'warning');
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_SEARCH_KW, kw);
      localStorage.setItem(STORAGE_KEY_SEARCH_TYPE, sType);
    } catch {}
    const cacheKey = 'search_' + sType + '_' + kw.trim();
    const cached = getApiCache(cacheKey);
    if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
      sResults = cached.data;
    } else {
      searchLoading = true;
    }
    try {
      const j = await api.search(kw, sType, sLimit);
      searchLoading = false;
      if (j?.code && j.code !== '000000') {
        if (showEmptyToast) showToast(j.msg || '搜索失败', 'warning');
        return;
      }
      const d = j?.data;
      let res: any[] = [];
      if (Array.isArray(d)) res = d;
      else res = (d as any)?.songs || (d as any)?.albums || (d as any)?.playlists || (d as any)?.artists || (d as any)?.result || [];
      sResults = res;
      setApiCache(cacheKey, res);
      if (!res.length && showEmptyToast) showToast('无结果', 'info');
    } catch (e: any) {
      searchLoading = false;
      if (showEmptyToast) showToast('搜索失败: ' + e.message, 'error');
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
    const cachedAlbum = getApiCache('album_' + targetId);
    if (cachedAlbum?.data) {
      album = cachedAlbum.data;
    } else {
      album = null;
      albumLoading = true;
    }
    try {
      const j = await api.album(targetId);
      albumLoading = false;
      if (j?.code && j.code !== '000000') {
        showToast(j.msg || '获取专辑失败', 'warning');
        return;
      }
      const alb = j?.data?.album || j?.data || null;
      album = alb;
      if (alb) setApiCache('album_' + targetId, alb);
      else showToast('未找到对应专辑数据', 'warning');
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
<AccordionCard title="🔍 1. 关键词综合搜索" bind:open={accSearch}>
  <!-- 4 个单选 Radio (保证 SP / 移动端严格一排) -->
  <div class="flex gap-3 mb-2.5 items-center flex-nowrap text-[13px] py-0.5 w-full max-md:gap-0 max-md:mb-2">
    <span class="text-[var(--text-secondary)] font-semibold shrink-0 hidden sm:inline">搜索类型：</span>
    <div class="flex items-center gap-3.5 flex-nowrap flex-1 max-md:w-full max-md:grid max-md:grid-cols-4 max-md:gap-0.5 max-md:justify-items-center">
      <label class="inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 select-none max-md:text-xs max-md:gap-0.5 max-md:justify-center max-md:w-full {sType==='1' ? 'text-[var(--primary-color)] font-bold' : 'text-[var(--text-secondary)] font-normal'}">
        <input type="radio" name="searchType" value="1" checked={sType==='1'} onchange={()=>handleTypeChange('1')} class="cursor-pointer m-0" />
        <span>🎵 单曲</span>
      </label>
      <label class="inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 select-none max-md:text-xs max-md:gap-0.5 max-md:justify-center max-md:w-full {sType==='10' ? 'text-[var(--primary-color)] font-bold' : 'text-[var(--text-secondary)] font-normal'}">
        <input type="radio" name="searchType" value="10" checked={sType==='10'} onchange={()=>handleTypeChange('10')} class="cursor-pointer m-0" />
        <span>💽 专辑</span>
      </label>
      <label class="inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 select-none max-md:text-xs max-md:gap-0.5 max-md:justify-center max-md:w-full {sType==='1000' ? 'text-[var(--primary-color)] font-bold' : 'text-[var(--text-secondary)] font-normal'}">
        <input type="radio" name="searchType" value="1000" checked={sType==='1000'} onchange={()=>handleTypeChange('1000')} class="cursor-pointer m-0" />
        <span>📁 歌单</span>
      </label>
      <label class="inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 select-none max-md:text-xs max-md:gap-0.5 max-md:justify-center max-md:w-full {sType==='100' ? 'text-[var(--primary-color)] font-bold' : 'text-[var(--text-secondary)] font-normal'}">
        <input type="radio" name="searchType" value="100" checked={sType==='100'} onchange={()=>handleTypeChange('100')} class="cursor-pointer m-0" />
        <span>🎤 歌手</span>
      </label>
    </div>
    <select bind:value={sType} onchange={(e)=>handleTypeChange((e.target as HTMLSelectElement).value)} class="hidden" aria-label="搜索类型">
      <option value="1">单曲</option>
      <option value="10">专辑</option>
      <option value="1000">歌单</option>
      <option value="100">歌手</option>
    </select>
  </div>
  <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
    <input type="text" placeholder="🔍 搜索歌曲 / 歌手 / 专辑 / 歌单 (按回车搜索)" class="flex-1 min-w-0" bind:value={kw} onkeydown={(e) => e.key === 'Enter' && doSearch().catch((e:any) => showToast(e.message, 'warning'))} />
    <input type="number" bind:value={sLimit} min="1" max="100" class="w-[60px] text-center shrink-0" title="单页条数" />
    <button class="btn-primary shrink-0 whitespace-nowrap" onclick={() => doSearch().catch((e:any) => showToast(e.message, 'warning'))}>搜索</button>
  </div>
  <ul class="data-list scrollable-list">
    {#if searchLoading}
      <li style="justify-content:center; color:var(--text-secondary); padding:20px 0; font-size:13px;">🔄 正在检索，请稍候...</li>
    {:else}
      {#each sResults as r, idx}
        {#if sType === '1'}
          {@const artistName = formatArtist(r.artists || r.ar || r.artist)}
          {@const isLocal = (downloadedSet && downloadedSet.has(Number(r.id))) || r.isLocal === true}
          {@const isPlayingThis = !!(curTrack && (String(curTrack.id) === String(r.id) || (curTrack.name && curTrack.name === r.name)))}
          <li class="track-item-card" class:is-active-playing={isPlayingThis}>
            <div class="track-title-row">
              <strong class="clickable-track-title cursor-pointer truncate" onclick={() => onSong ? onSong(String(r.id)) : (onPlayQueue && onPlayQueue([{ id: r.id, name: r.name, artist: artistName, cover: r.picUrl || DEFAULT_VINYL_COVER, isLocal }]))}>{idx + 1}. {r.name}</strong>
              {#if artistName}<span class="text-[var(--text-secondary)] truncate"> - {artistName}</span>{/if}
              {#if isLocal}<span class="audio-source-badge icon-only badge-server ml-1.5" title="🖥️ 本地服务器已下载">🖥️</span>{/if}
              <span class="text-[11px] text-[var(--text-muted)] shrink-0">(ID:{r.id})</span>
            </div>
            <div class="track-action-group">
              {#if onToggleLike}
                <TrackLikeBtn liked={likedSet.has(Number(r.id))} onclick={() => onToggleLike(Number(r.id), r.name, artistName)} />
              {/if}
              {#if onPlayQueue}
                <SlotBtn
                  playing={isPlayingThis && playing}
                  onclick={() => onPlayQueue([{ id: r.id, name: r.name, artist: artistName, cover: r.picUrl || DEFAULT_VINYL_COVER, isLocal }])}
                >
                  {isPlayingThis && playing ? '⏸ 播放中' : (isLocal ? '▶️ 播放' : '▶️ 试听')}
                </SlotBtn>
              {/if}
              {#if isLocal}
                <SlotBtn onclick={() => onReveal && onReveal({ id: r.id, name: r.name, artist: artistName })}>📂 定位</SlotBtn>
              {/if}
              {#if onSong}
                <SlotBtn onclick={() => onSong(String(r.id))}>👉 详情</SlotBtn>
              {/if}
            </div>
          </li>
        {:else if sType === '10'}
          {@const albumArtist = formatArtist(r.artist || r.artists)}
          <li class="track-item-card">
            <div class="track-title-row">
              <strong class="clickable-track-title cursor-pointer truncate" onclick={() => handleAlbum(String(r.id))}>{idx + 1}. {r.name}</strong>
              {#if albumArtist}<span class="text-[var(--text-secondary)] truncate"> - {albumArtist}</span>{/if}
              {#if r.size}<span class="text-xs text-[var(--text-muted)] shrink-0"> ({r.size} 首歌)</span>{/if}
              <span class="text-xs text-[var(--text-muted)] shrink-0"> (ID: {r.id})</span>
            </div>
            <div class="track-action-group">
              <SlotBtn onclick={() => handleAlbum(String(r.id))}>👉 查看专辑详情</SlotBtn>
            </div>
          </li>
        {:else if sType === '1000'}
          <li class="track-item-card">
            <div class="track-title-row">
              <strong class="clickable-track-title cursor-pointer truncate" onclick={() => onPlaylist(String(r.id))}>{idx + 1}. {r.name}</strong>
              <span class="text-xs text-[var(--text-muted)] shrink-0"> (ID:{r.id})</span>
            </div>
            <div class="track-action-group">
              <SlotBtn onclick={() => onPlaylist(String(r.id))}>👉 查看详情</SlotBtn>
            </div>
          </li>
        {:else}
          <li class="track-item-card">
            <div class="track-title-row">
              <strong class="truncate">{idx + 1}. {r.name}</strong>
              <span class="text-xs text-[var(--text-muted)] shrink-0"> (ID:{r.id})</span>
            </div>
            <div class="track-action-group">
              <SlotBtn onclick={() => showToast('歌手功能开发中', 'info')}>查看</SlotBtn>
            </div>
          </li>
        {/if}
      {:else}
        <li style="justify-content:center; color:var(--text-muted);">输入关键词搜索</li>
      {/each}
    {/if}
  </ul>
  <div style="font-size:12px; color:var(--text-muted); text-align:center; margin-top:8px;">共搜索到 {sResults.length} 条数据</div>
</AccordionCard>

<!-- Section 2: 专辑解析与整辑下载 -->
<AccordionCard title="💽 2. 专辑解析与整辑下载" bind:open={accAlbum}>
  <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
    <input type="text" placeholder="输入专辑 ID (如 258535483，按回车解析)" class="flex-1 min-w-0" bind:value={currentAlbumId} onkeydown={(e) => e.key === 'Enter' && loadAlbum()} />
    <button class="btn-primary shrink-0 whitespace-nowrap" onclick={() => loadAlbum()}>解析<span class="hidden sm:inline">专辑</span></button>
  </div>

  {#if albumLoading}
    <div style="padding:24px; text-align:center; color:var(--text-secondary); font-size:14px;">🔄 正在解析专辑数据，请稍候...</div>
  {:else if album}
    {@const headerArtist = formatArtist(album.artist || album.artists) || '未知歌手'}
    <DetailHeaderCard
      cover={album.coverImgUrl || album.picUrl || DEFAULT_VINYL_COVER}
      title={album.name || '未知专辑'}
      subtitle={`歌手：${headerArtist} | 发行时间：${album.publishTime || '-'}`}
      subDetail={`共包含 ${album.songs?.length || 0} 首曲目`}
    >
      <button class="btn-primary" onclick={downloadFullAlbum}>🖥️ 下载到电脑</button>
      <button class="btn-secondary" onclick={playFullAlbum}>▶️ 播放专辑</button>
    </DetailHeaderCard>

    <h4 style="margin:15px 0 8px 0; color:var(--text-main); font-size:15px; font-weight:600;">专辑曲目列表 ({album.songs ? album.songs.length : 0} 首)：</h4>
    <ul class="data-list scrollable-list">
      {#each (album.songs || []) as s, i}
        {@const artistName = formatArtist(s.artist || s.ar || s.artists || album.artist || '')}
        {@const isLocal = (downloadedSet && downloadedSet.has(Number(s.id))) || s.isLocal === true}
        {@const isPlayingThis = !!(curTrack && (String(curTrack.id) === String(s.id) || (curTrack.name && curTrack.name === s.name)))}
        <li class="track-item-card" class:is-active-playing={isPlayingThis}>
          <div class="track-title-row">
            <strong class="clickable-track-title cursor-pointer truncate" onclick={() => onSong ? onSong(String(s.id)) : (onPlayQueue && onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: album.coverImgUrl || album.picUrl || DEFAULT_VINYL_COVER, isLocal }]))}>
              {i + 1}. {s.name}
            </strong>
            {#if artistName}<span class="text-xs text-[var(--text-secondary)] truncate"> - {artistName}</span>{/if}
            {#if isLocal}<span class="audio-source-badge icon-only badge-server ml-1.5" title="🖥️ 已下载到本地">🖥️</span>{/if}
          </div>
          <div class="track-action-group">
            {#if onToggleLike}
              <TrackLikeBtn liked={likedSet.has(Number(s.id))} onclick={() => onToggleLike(Number(s.id), s.name, artistName)} />
            {/if}
            {#if onPlayQueue}
              <SlotBtn
                playing={isPlayingThis && playing}
                onclick={() => onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: album.coverImgUrl || album.picUrl || DEFAULT_VINYL_COVER, isLocal }])}
              >
                {isPlayingThis && playing ? '⏸ 播放中' : (isLocal ? '▶️ 播放' : '▶️ 试听')}
              </SlotBtn>
            {/if}
            {#if isLocal}
              <SlotBtn
                onclick={() => onReveal && onReveal({ id: s.id, name: s.name, artist: artistName })}
                title="在文件管理器中定位"
              >
                📂 定位
              </SlotBtn>
            {:else}
              <SlotBtn onclick={() => api.downloadSingle(String(s.id)).then(() => showToast('已提交下载', 'success')).catch((e) => showToast('下载失败: ' + e, 'error'))}>
                📥 下载
              </SlotBtn>
            {/if}
            {#if onSong}
              <SlotBtn onclick={() => onSong(String(s.id))}>🎧 详情</SlotBtn>
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
</AccordionCard>
