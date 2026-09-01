<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER, getApiCache, setApiCache } from '../lib/utils';
  import type { Track } from '../lib/types';
  import AccordionCard from './AccordionCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';
  import AlbumDetailCard from './AlbumDetailCard.svelte';

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

  let kw = $state(getStored(STORAGE_KEY_SEARCH_KW, ''));
  let sType = $state(getStored(STORAGE_KEY_SEARCH_TYPE, '1'));
  let sLimit = $state(20);
  let sResults: any[] = $state([]);
  let searchLoading = $state(false);

  // 展开状态持久化
  let accSearch = $state(getStored(STORAGE_KEY_ACC_SEARCH, 'true') === 'true');
  let accAlbum = $state(getStored(STORAGE_KEY_ACC_ALBUM, 'true') === 'true');

  $effect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACC_SEARCH, String(accSearch));
      localStorage.setItem(STORAGE_KEY_ACC_ALBUM, String(accAlbum));
    } catch {}
  });

  function initAlbumId() {
    return albumId || getStored(STORAGE_KEY_ALBUM_ID, '');
  }

  // 专辑相关状态
  let currentAlbumId = $state(initAlbumId());
  let album: any = $state(null);
  let albumLoading = $state(false);

  $effect(() => {
    if (albumId && albumId !== currentAlbumId) {
      currentAlbumId = albumId;
      loadAlbum(albumId);
    }
  });

  onMount(() => {
    if (currentAlbumId) {
      const cached = getApiCache('album_' + currentAlbumId);
      if (cached?.data) {
        album = cached.data;
      } else {
        loadAlbum(currentAlbumId).catch(() => {});
      }
    }
    if (kw.trim()) {
      const cacheKey = 'search_' + sType + '_' + kw.trim();
      const cached = getApiCache(cacheKey);
      if (cached?.data && Array.isArray(cached.data)) {
        sResults = cached.data;
      }
    }
  });

  function setType(t: string) {
    sType = t;
    if (kw.trim()) doSearch(false).catch(() => {});
  }

  async function doSearch(showEmptyToast = true) {
    if (!kw.trim()) {
      showToast('请输入搜索关键词', 'warning');
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
      const j = await api.search(kw, sType, String(sLimit));
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

  async function handleDownloadPlaylist(id: string, name: string) {
    try {
      await api.downloadPlaylist(id);
      showToast(`已提交歌单《${name}》下载任务`, 'success');
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast('提交下载失败: ' + (e.message || e), 'error');
    }
  }

  async function loadAlbum(id?: string) {
    const targetId = id || currentAlbumId;
    if (!targetId) {
      showToast('请输入专辑 ID', 'warning');
      return;
    }
    currentAlbumId = targetId;
    accAlbum = true;
    const cachedAlbum = getApiCache('album_' + targetId);
    if (cachedAlbum?.data) {
      album = cachedAlbum.data;
    } else {
      albumLoading = true;
    }
    try {
      localStorage.setItem(STORAGE_KEY_ALBUM_ID, targetId);
    } catch {}
    try {
      const j = await api.album(targetId);
      albumLoading = false;
      if (j?.code && j.code !== '000000') {
        showToast(j.msg || '获取专辑失败', 'warning');
        return;
      }
      album = j?.data || j;
      setApiCache('album_' + targetId, album);
    } catch (e: any) {
      albumLoading = false;
      showToast('获取专辑失败: ' + e.message, 'error');
    }
  }

  function handleAlbum(id: string) {
    currentAlbumId = id;
    if (onAlbum) onAlbum(id);
    else loadAlbum(id);
  }

  async function downloadFullAlbum() {
    if (!album || !album.songs?.length) return;
    try {
      await api.downloadAlbum(String(album.id || currentAlbumId));
      showToast('已提交整张专辑下载任务', 'success');
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast('提交下载失败: ' + (e.message || e), 'error');
    }
  }

  function playFullAlbum() {
    if (!album?.songs?.length || !onPlayQueue) return;
    const q = album.songs.map((s: any) => ({
      id: s.id,
      name: s.name,
      artist: formatArtist(s.artist || s.ar || s.artists || album.artist || ''),
      cover: album.coverImgUrl || album.picUrl || DEFAULT_VINYL_COVER,
      isLocal: (downloadedSet && downloadedSet.has(Number(s.id))) || s.isLocal === true
    }));
    onPlayQueue(q, 0);
  }

  async function downloadSingleTrack(id: string) {
    try {
      await api.downloadSingle(id);
      showToast('已提交单曲下载任务', 'success');
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast('提交单曲下载失败: ' + e.message, 'error');
    }
  }
</script>

<!-- Section 1: 在线搜索 -->
<AccordionCard title="🔍 1. 全网搜索" bind:open={accSearch}>
  <div class="flex gap-1.5 flex-nowrap w-auto max-sm:w-full max-sm:grid max-sm:grid-cols-4 max-sm:gap-1.5">
    <button type="button" class="btn-secondary rounded-lg px-3 py-1.5 max-sm:px-1 max-sm:py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 {sType === '1' ? 'bg-gradient-to-br from-red-500 to-red-600 ring-2 ring-red-400/30' : 'bg-gradient-to-br from-slate-600 to-slate-700 opacity-80'}" onclick={() => setType('1')}>🎵 单曲</button>
    <button type="button" class="btn-secondary rounded-lg px-3 py-1.5 max-sm:px-1 max-sm:py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 {sType === '10' ? 'bg-gradient-to-br from-red-500 to-red-600 ring-2 ring-red-400/30' : 'bg-gradient-to-br from-slate-600 to-slate-700 opacity-80'}" onclick={() => setType('10')}>💽 专辑</button>
    <button type="button" class="btn-secondary rounded-lg px-3 py-1.5 max-sm:px-1 max-sm:py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 {sType === '1000' ? 'bg-gradient-to-br from-red-500 to-red-600 ring-2 ring-red-400/30' : 'bg-gradient-to-br from-slate-600 to-slate-700 opacity-80'}" onclick={() => setType('1000')}>📋 歌单</button>
    <button type="button" class="btn-secondary rounded-lg px-3 py-1.5 max-sm:px-1 max-sm:py-1.5 text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1 shrink-0 {sType === '100' ? 'bg-gradient-to-br from-red-500 to-red-600 ring-2 ring-red-400/30' : 'bg-gradient-to-br from-slate-600 to-slate-700 opacity-80'}" onclick={() => setType('100')}>🎤 歌手</button>
  </div>
  <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
    <input type="text" placeholder="🔍 搜索歌曲 / 歌手 / 专辑 / 歌单 (按回车搜索)" class="flex-1 min-w-0" bind:value={kw} onkeydown={(e) => e.key === 'Enter' && doSearch().catch((e:any) => showToast(e.message, 'warning'))} />
    <input type="number" bind:value={sLimit} min="1" max="100" class="w-[60px] text-center shrink-0" title="单页条数" />
    <button type="button" class="btn-primary shrink-0 whitespace-nowrap" onclick={() => doSearch().catch((e:any) => showToast(e.message, 'warning'))}>搜索</button>
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
              <button
                type="button"
                class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors"
                onclick={() => onSong ? onSong(String(r.id)) : (onPlayQueue && onPlayQueue([{ id: r.id, name: r.name, artist: artistName, cover: r.picUrl || DEFAULT_VINYL_COVER, isLocal }]))}
              >
                {idx + 1}. {r.name}
              </button>
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
              <button
                type="button"
                class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors"
                onclick={() => handleAlbum(String(r.id))}
              >
                {idx + 1}. {r.name}
              </button>
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
              <button
                type="button"
                class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors"
                onclick={() => onPlaylist(String(r.id))}
              >
                {idx + 1}. {r.name}
              </button>
              <span class="text-xs text-[var(--text-muted)] shrink-0"> (ID:{r.id})</span>
            </div>
            <div class="track-action-group">
              <SlotBtn onclick={() => handleDownloadPlaylist(String(r.id), r.name)} title="立即下载整张歌单全部歌曲">📥 下载整单</SlotBtn>
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

<!-- Section 2: 专辑解析与整辑下载 (已拆分组件) -->
<AlbumDetailCard
  {album}
  {albumLoading}
  bind:open={accAlbum}
  bind:currentAlbumId
  {curTrack}
  {playing}
  {likedSet}
  {downloadedSet}
  onLoadAlbum={loadAlbum}
  onDownloadFullAlbum={downloadFullAlbum}
  onPlayFullAlbum={playFullAlbum}
  onDownloadSingleTrack={downloadSingleTrack}
  {onToggleLike}
  {onPlayQueue}
  {onReveal}
  {onSong}
/>
