<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './lib/api';
  import { formatTime, formatBytes, getApiCache, setApiCache, deleteApiCache } from './lib/utils';
  import FolderExplorer from './components/FolderExplorer.svelte';
  import LyricModal from './components/LyricModal.svelte';
  import PeqDrawer from './components/PeqDrawer.svelte';
  import CreatePlaylistModal from './components/CreatePlaylistModal.svelte';
  import PlaylistTab from './components/PlaylistTab.svelte';
  import SearchTab from './components/SearchTab.svelte';
  import HistoryTab from './components/HistoryTab.svelte';
  import PlayerBar from './components/PlayerBar.svelte';

  // ---------- 主题 ----------
  let themeMode: 'dark'|'light'|'auto' = $state((localStorage.getItem('theme_mode') as any) || 'dark');
  function applyTheme(m:string){
    const root=document.documentElement;
    let eff=m;
    if(m==='auto') eff = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light';
    if(eff==='light') root.setAttribute('data-theme','light'); else root.removeAttribute('data-theme');
    root.setAttribute('data-theme-mode', m);
  }
  function toggleTheme(){
    const order:any = {dark:'light', light:'auto', auto:'dark'};
    themeMode = order[themeMode] || 'dark';
    localStorage.setItem('theme_mode', themeMode);
    applyTheme(themeMode);
    showToast(`已切换至 ${themeMode==='dark'?'深色':themeMode==='light'?'浅色':'跟随系统'}`, 'info', 1800);
  }

  // ---------- Toast / Modal ----------
  type Toast = {id:number, msg:string, type:string};
  let toasts: Toast[] = $state([]);
  let toastId=0;
  function showToast(msg:string, type='info', dur=3500){
    const id=++toastId;
    toasts = [...toasts, {id, msg, type}];
    setTimeout(()=>{ toasts = toasts.filter(t=>t.id!==id)}, dur);
  }
  type ModalOpt = {title:string, icon:string, content:string, confirmText?:string, cancelText?:string, showCancel?:boolean, danger?:boolean};
  let modal: ModalOpt & {resolve:(v:boolean)=>void} | null = $state(null);
  function showAppModal(opt:ModalOpt):Promise<boolean>{
    return new Promise(res=>{ modal = {...opt, resolve:res} as any });
  }
  function closeModal(v:boolean){ modal?.resolve(v); modal=null; }

  // ---------- Tab ----------
  let tab: 'playlist'|'search'|'download-mgr' = $state('playlist');
  function switchTab(n:any){
    if(n==='album') n='search';
    tab = n as any;
    history.pushState(null,'','#'+n);
  }
  // accordion
  let acc = $state({my:true, detail:true, song:false, search:true, album:false, artist:false, folder:true, history:false, cache:false});
  function toggleAcc(k:string){ (acc as any)[k]=!(acc as any)[k]; }

  // ---------- 全局状态 ----------
  let repeat = $state(false);
  let versionSwitching=false;
  async function switchToLegacy(){
    versionSwitching=true;
    await fetch('/api/ui-version?v=legacy');
    location.href='/?v=legacy';
  }
  async function switchToSvelte(){
    await fetch('/api/ui-version?v=svelte');
    location.href='/?v=svelte';
  }

  // ---------- 播放器 ----------
  type Track = {id:number|string, name:string, artist:string, cover:string, url?:string, lyric?:string, isLocal?:boolean};
  let queue: Track[] = $state([]);
  let qIndex = $state(0);
  let playing = $state(false);
  let curTime = $state(0);
  let duration = $state(0);
  let volume = $state(0.8);
  let playMode:'list'|'single'|'shuffle' = $state('list');
  let audioEl: HTMLAudioElement | undefined = $state(undefined);
  let showLyric = $state(false);
  let showDrawer = $state(false);
  let showPeq = $state(false);
  let drawerFilter = $state('');
  let drawerTab: 'all'|'ready'|'server'|'browser' = $state('all');
  let drawerMainTab: 'queue'|'tasks' = $state('queue');
  let autoSkipTrial = $state(false);
  let offlineOnly = $state(false);
  let drawerPos = $state({x:0,y:0, dragging:false, startX:0, startY:0});
  let showCreateModal = $state(false);

  let curTrack = $derived(queue[qIndex] || null);
  let filteredQueue = $derived(queue.filter(t=> !drawerFilter || (t.name+t.artist).toLowerCase().includes(drawerFilter.toLowerCase())));

  async function resolveUrl(track:Track): Promise<string>{
    if(track.url && track.url.includes('/stream')) return track.url;
    try{
      const j=await api.songV1(String(track.id), 'lossless');
      const url=j?.data?.url;
      if(url) { track.url=url; return url; }
    }catch{}
    return track.url||'';
  }
  async function ensurePlay(){
    if(!audioEl || !curTrack) return;
    let url = curTrack.url || await resolveUrl(curTrack);
    if(url && audioEl.src!==url) audioEl.src=url;
    // 监听 src 变化自动播放
    if(audioEl.src) audioEl.play().catch(()=> showToast('播放失败，尝试试听','warning'));
  }
  function togglePlay(){
    if(!audioEl) return;
    if(audioEl.paused) ensurePlay().then(()=>{ if(audioEl?.paused) audioEl.play().catch(()=>{}); }); else audioEl.pause();
  }
  async function playAt(i:number){ qIndex=i; await ensurePlay(); setTimeout(()=> audioEl?.play().catch(()=>{}),10); }
  async function next(){
    if(queue.length===0) return;
    let attempts=0;
    do{
      if(playMode==='shuffle') qIndex=Math.floor(Math.random()*queue.length); else qIndex=(qIndex+1)%queue.length;
      attempts++;
      if(!offlineOnly) break;
      if(queue[qIndex]?.isLocal) break;
    }while(attempts<queue.length);
    // autoSkipTrial: if not isLocal and is trial, skip
    if(autoSkipTrial && !queue[qIndex]?.isLocal && queue[qIndex]){ if(attempts<queue.length) return next(); }
    await ensurePlay(); setTimeout(()=>audioEl?.play().catch(()=>{}),10);
  }
  async function prev(){
    if(queue.length===0) return;
    let attempts=0;
    do{
      qIndex=(qIndex-1+queue.length)%queue.length;
      attempts++;
      if(!offlineOnly) break;
      if(queue[qIndex]?.isLocal) break;
    }while(attempts<queue.length);
    await ensurePlay(); setTimeout(()=>audioEl?.play().catch(()=>{}),10);
  }
  function seek(e:MouseEvent){ if(!audioEl||!duration) return; const rect=(e.currentTarget as HTMLElement).getBoundingClientRect(); const p=(e.clientX-rect.left)/rect.width; audioEl.currentTime=p*duration; }
  function setQueue(tracks:Track[], idx=0){ queue=tracks; qIndex=idx; setTimeout(()=>ensurePlay(),50); }

  // ---------- 歌单 ----------
  let myPlaylists:any[] = $state([]);
  let playlistFilter:'created'|'subscribed'|'all' = $state('created');
  let playlistId = $state('');
  let playlist:any = $state(null);
  let allTracks:any[] = $state([]);
  let curPage=$state(1); const pageSize=10;
  let paged = $derived(allTracks.slice((curPage-1)*pageSize, curPage*pageSize));
  let totalPages = $derived(Math.max(1, Math.ceil(allTracks.length/pageSize)));
  let likedSet = $state(new Set<number>());

  async function loadMyPlaylists(f:any=playlistFilter){
    playlistFilter=f;
    const cached=getApiCache('my_playlists');
    if(cached?.data?.playlists) myPlaylists=cached.data.playlists;
    try{
      const j=await api.myPlaylist();
      const pls=j?.data?.playlists||[];
      if(JSON.stringify(pls)!==JSON.stringify(cached?.data?.playlists||[])){
        setApiCache('my_playlists', j.data); myPlaylists=pls;
      }
    }catch(e){ if(!cached) showToast('加载歌单失败','error'); }
  }
  async function loadPlaylistDetail(){
    if(!playlistId) return showToast('请输入歌单 ID','warning');
    const key='playlist_'+playlistId;
    const cached=getApiCache(key);
    if(cached?.data?.playlist?.tracks?.length){ renderPlaylist(cached.data.playlist); }
    try{
      const j=await api.playlist(playlistId);
      if(j?.code && j.code!=='000000'){ showToast(j.msg || '获取失败，请先扫码登录设置 Cookie','warning', 4000); return; }
      const pl=j?.data?.playlist;
      if(!pl?.tracks?.length){ if(!cached) showToast('未找到歌单','warning'); return; }
      setApiCache(key, j.data); renderPlaylist(pl);
      // 手风琴：收起我的歌单，展开歌单详情
      acc.my=false; acc.detail=true; acc.song=false;
    }catch(e){ showToast('获取歌单失败: '+e,'error'); }
  }
  function renderPlaylist(pl:any){
    playlist=pl; allTracks=pl.tracks||[]; curPage=1;
  }
  function jumpToPlaylist(id:string){ playlistId=id; loadPlaylistDetail(); switchTab('playlist'); }

  // ---------- 搜索 ----------
  let kw=$state(''), sType=$state('1'), sLimit=$state('10');
  let sResults:any[]=$state([]); let sPage=$state(1);
  async function doSearch(){
    if(!kw.trim()) return showToast('请输入关键词','warning');
    try{
      const j=await api.search(kw, sType, sLimit);
      if(j?.code && j.code!=='000000'){ showToast(j.msg || '搜索失败，请先登录','warning'); return; }
      const d=j?.data;
      if(Array.isArray(d)) sResults=d;
      else sResults = (d as any)?.songs||(d as any)?.albums||(d as any)?.playlists||(d as any)?.artists||(d as any)?.result||[];
      if(sResults.length===0) showToast('无结果','info');
    }catch(e){ showToast('搜索失败: '+e,'error'); }
  }

  // ---------- 单曲 ----------
  let songId=$state(''), songLevel=$state('lossless');
  let songInfo:any=$state(null);
  async function loadSong(){
    if(!songId) return showToast('请输入歌曲ID','warning');
    try{ const j=await api.songV1(songId, songLevel); if(j?.code && j.code!=='000000'){ showToast(j.msg || '获取失败','warning'); return; } songInfo=j?.data||null; if(!songInfo) showToast('无歌曲数据','warning'); else { acc.my=false; acc.detail=false; acc.song=true; } }catch(e){ showToast('获取单曲失败: '+e,'error'); }
  }
  // ---------- 专辑 ----------
  let albumId=$state(''), album:any=$state(null);
  async function loadAlbum(){
    if(!albumId) return showToast('请输入专辑 ID','warning');
    try{
      const j=await api.album(albumId);
      if(j?.code && j.code!=='000000'){ showToast(j.msg||'获取专辑失败','warning'); return; }
      album=j?.data?.album || j?.data || null;
      if(!album) showToast('未找到专辑','warning');
      else { acc.search=true; acc.album=true; }
    }catch(e){ showToast('获取专辑失败:'+e,'error'); }
  }
  function jumpToAlbum(id:string){ albumId=id; loadAlbum(); switchTab('search'); acc.album=true; }

  // ---------- 下载监控 ----------
  let tasks:any[]=$state([]); let monVisible=$state(false);
  async function fetchTasks(){
    try{ const j=await api.tasks(); if(j.code==='000000'){ tasks=j.data||[]; if(tasks.length) monVisible=true; }}catch{}
  }
  async function clearTasks(){ await api.tasksClear(); tasks=[]; showToast('已清空','info'); }

  // ---------- 历史 ----------
  let histKw=$state(''), histPage=$state(1), histList:any[]=$state([]), histStats:any=$state(null), histTotal=$state(0);
  async function loadHistory(p=1){
    histPage=p;
    try{
      const j=await api.historyList(histKw, p);
      histList=j?.data?.list||[];
      histTotal=j?.data?.total||0;
      const s=await api.historyStats(); histStats=s?.data||null;
    }catch(e){ showToast('加载历史失败:'+e,'error'); }
  }
  let histTotalPages=$derived(Math.max(1, Math.ceil(histTotal/10)));

  // ---------- 文件夹 ----------
  let roots:any[]=$state([]), curRoot:any=$state(null), tree:any[]=$state([]);
  async function loadRoots(){ try{ const j=await api.folderRoots(); roots=j?.data||[]; if(roots.length&&!curRoot){ curRoot=roots[0]; loadBrowse(curRoot.path);} }catch{} }
  async function loadBrowse(path:string){
    try{ const j=await api.folderBrowse(path); tree=j?.data||[]; }catch{}
  }

  // ---------- 生命周期 ----------
  onMount(()=>{
    applyTheme(themeMode);
    const h=location.hash.replace('#',''); if(h) tab=h as any;
    window.addEventListener('hashchange',()=>{ const hh=location.hash.replace('#',''); if(hh) tab=hh as any; });
    // 监听曲库连播事件（来自 FolderExplorer）
    window.addEventListener('svelte:playFolder', ((e:CustomEvent)=>{
      const {tracks, name} = (e as CustomEvent).detail;
      if(!tracks?.length){ showToast('该目录无可播文件','warning'); return; }
      const q = tracks.map((t:any, idx:number)=> ({
        id: t.songId||t.id||`local_${Date.now()}_${idx}`,
        name: t.songName||t.name||'未知',
        artist: t.artist||'未知',
        cover: '/favicon.png',
        url: t.relativePath ? `/v2/history/stream?path=${encodeURIComponent(t.relativePath)}` : (t.filePath ? `/v2/history/stream?path=${encodeURIComponent(t.filePath)}` : t.streamUrl||''),
        isLocal: true
      }));
      setQueue(q, 0);
      showToast(`已连播 ${name} 共 ${q.length} 首`,'success',3000);
    }) as EventListener);
    api.getRepeat().then((j:any)=>{ if(j?.code==='000000') repeat=j.data===true; }).catch(()=>{});
    fetchTasks(); setInterval(fetchTasks, 3000);
    loadMyPlaylists(); loadRoots(); loadHistory(1);
    const c=getApiCache('liked_song_ids'); if(c?.data) likedSet=new Set(c.data.map((n:any)=>Number(n)));
    api.likeList().then((j:any)=>{ if(j?.code==='000000'&&Array.isArray(j.data)){ likedSet=new Set(j.data.map((n:any)=>Number(n))); setApiCache('liked_song_ids', j.data);} }).catch(()=>{});
    try{ const q=JSON.parse(localStorage.getItem('svelte_queue')||'null'); if(q?.queue?.length){ queue=q.queue; qIndex=q.qIndex||0; } }catch{}
  });
  $effect(()=>{ try{ localStorage.setItem('svelte_queue', JSON.stringify({queue,qIndex})) }catch{} });

  function toggleRepeat(){ repeat=!repeat; api.setRepeat(repeat); }
  function formatBytesLocal(n:number){ return formatBytes(n); }
  function copyText(t:string){ navigator.clipboard?.writeText(t).then(()=>showToast('已复制','success')); }

  // 收藏/取消
  async function toggleLike(id:number, name:string){
    const liked=likedSet.has(Number(id));
    const next=new Set(likedSet); if(liked) next.delete(Number(id)); else next.add(Number(id));
    likedSet=next; setApiCache('liked_song_ids', Array.from(next));
    try{ await api.like(Number(id), !liked); showToast(liked?`已取消红心`:`已收藏 ${name}`,'success'); }catch{ // rollback
      const rb=new Set(likedSet); if(!liked) rb.delete(Number(id)); else rb.add(Number(id)); likedSet=rb;
    }
  }
</script>

<!-- 顶栏 -->
<div class="app-top-bar">
  <div class="app-brand"><span class="brand-logo">🎵</span><span class="brand-title">网易云下载器</span><span style="font-size:10px; background:#8b5cf6; color:#fff; padding:1px 6px; border-radius:8px; margin-left:4px;">Svelte 5</span></div>
  <div class="app-nav-tabs">
    <button class="nav-tab-btn" class:active={tab==='playlist'} onclick={()=>switchTab('playlist')}>📁 歌单</button>
    <button class="nav-tab-btn" class:active={tab==='search'} onclick={()=>switchTab('search')}>🔍 搜索</button>
    <button class="nav-tab-btn" class:active={tab==='download-mgr'} onclick={()=>switchTab('download-mgr')}>📥 本地</button>
  </div>
  <div class="app-top-actions">
    <button class="theme-toggle-btn" onclick={toggleTheme} title="切换主题">{themeMode==='dark'?'🌙':themeMode==='light'?'☀️':'🌓'}</button>
    <label class="compact-switch-label"><input type="checkbox" checked={repeat} onchange={toggleRepeat} /><span>允许重复</span></label>
    <button class="theme-toggle-btn" style="background:rgba(139,92,246,0.15); border-color:rgba(139,92,246,0.3); color:#a78bfa;" onclick={switchToLegacy} title="返回旧版 (localStorage+Cookie)">↩️ 旧版</button>
  </div>
</div>

<!-- 内容区 -->
<div class="accordion-wrapper">
  {#if tab==='playlist'}
    <PlaylistTab playlistId={playlistId} likedSet={likedSet} onToggleLike={toggleLike} onPlayQueue={setQueue} showToast={showToast} />
  {:else if tab==='search'}
    <SearchTab onAlbum={jumpToAlbum} onPlaylist={jumpToPlaylist} showToast={showToast} />
  {:else}
    <div class="accordion-card" class:active={acc.folder}>
      <div class="accordion-header" onclick={()=>toggleAcc('folder')}><h3 class="accordion-title">📁 1. 本地曲库与文件夹树连播</h3><span class="accordion-icon">▼</span></div>
      <div class="accordion-body">
        <FolderExplorer />
      </div>
    </div>
    <div class="accordion-card" class:active={acc.history}>
      <div class="accordion-header" onclick={()=>toggleAcc('history')}><h3 class="accordion-title">📥 2. 本地下载历史与文件管理</h3><span class="accordion-icon">▼</span></div>
      <div class="accordion-body">
        <div style="display:flex; flex-wrap:wrap; gap:8px; background:var(--stat-bar-bg); border:1px solid var(--border-subtle); padding:10px 12px; border-radius:8px; margin-bottom:10px; align-items:center; font-size:13px;">
          <span>已记录下载：<strong>{histStats?.totalCount ?? histTotal ?? 0}</strong> 首</span>
          <span>占用空间：<strong>{histStats?.totalSize ? formatBytesLocal(histStats.totalSize) : '-'}</strong></span>
          <span style="color:#ef4444; cursor:pointer;" onclick={()=> showToast('缺失 '+histStats?.missingCount+' 首','info')}>⚠️ 文件缺失：{histStats?.missingCount ?? 0} 首 <span style="font-size:10px; border:1px solid rgba(239,68,68,0.3); padding:1px 4px; border-radius:6px;">查看 ↗</span></span>
          <span style="color:#f59e0b; cursor:pointer;" onclick={()=> showToast('非MP3 '+histStats?.nonMp3Count+' 首','info')}>📁 非 MP3 格式：{histStats?.nonMp3Count ?? 0} 首 <span style="font-size:10px; border:1px solid rgba(245,158,11,0.3); padding:1px 4px; border-radius:6px;">查看 ↗</span></span>
          <div style="margin-left:auto; display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn-primary" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed); padding:6px 10px; font-size:11px;" onclick={()=> showToast('外部曲库扫描开发中','info')}>📁 外部曲库</button>
            <button class="btn-primary" style="background:linear-gradient(135deg,#06b6d4,#0891b2); padding:6px 10px; font-size:11px;" onclick={()=> showToast('对齐磁盘开发中','info')}>🔍 对齐磁盘</button>
            <button class="btn-primary" style="background:linear-gradient(135deg,#ef4444,#dc2626); padding:6px 10px; font-size:11px;" onclick={()=> showToast('清理失效开发中','info')}>🧹 清理失效</button>
            <button class="btn-primary" style="padding:6px 10px; font-size:11px;" onclick={()=>loadHistory(1)}>🔄 刷新</button>
          </div>
        </div>
        <div class="form-row" style="display:flex; gap:6px; margin-bottom:8px;">
          <input type="text" placeholder="🔍 搜索已下载歌曲 / 歌手 / 专辑 (按回车搜索)" style="flex:1;" bind:value={histKw} onkeydown={(e)=> e.key==='Enter' && loadHistory(1)} />
          <button class="btn-primary sp-hide-btn" onclick={()=>loadHistory(1)}>搜索</button>
        </div>
        <ul class="data-list scrollable-list">
          {#each histList as h}
            <li style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:10px 12px;">
              <div style="flex:1; min-width:0; overflow:hidden;">
                <div style="font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{h.songName || h.title || h.name}</div>
                <div style="font-size:12px; color:var(--text-secondary); display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                  <span>{h.artist || '未知歌手'}</span>
                  <span style="color:var(--text-muted);">{h.fileSize ? formatBytesLocal(h.fileSize) : ''}</span>
                  <span style="background:rgba(16,185,129,0.12); color:#4ade80; border:1px solid rgba(16,185,129,0.25); padding:1px 6px; border-radius:6px; font-size:11px;">{h.fileExists ? '正常' : '缺失'}</span>
                </div>
              </div>
              <div style="display:flex; gap:6px; flex-shrink:0;">
                <button class="tree-btn" style="background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); padding:5px 10px; border-radius:12px; font-size:11px; cursor:pointer;" onclick={()=>{
                  const url=`/v2/history/stream?path=${encodeURIComponent(h.filePath||'')}`;
                  setQueue([{id:h.songId||h.id, name:h.songName||'未知', artist:h.artist||'', cover:'/favicon.png', url}],0); setTimeout(()=>audioEl?.play().catch(()=>{}),100);
                }}>▶ 播放</button>
                <button class="tree-btn" style="background:rgba(100,116,139,0.15); color:#94a3b8; border:1px solid rgba(100,116,139,0.25); padding:5px 10px; border-radius:12px; font-size:11px; cursor:pointer;" onclick={()=> copyText(h.hostFilePath||h.filePath||'')}>📂 定位</button>
                <button class="tree-btn" style="background:rgba(239,68,68,0.12); color:#f87171; border:1px solid rgba(239,68,68,0.25); padding:5px 10px; border-radius:12px; font-size:11px; cursor:pointer;" onclick={()=> {if(confirm('删除 '+ (h.songName||'' )+'?')) showToast('删除开发中','info');}}>🗑️ 删除</button>
              </div>
            </li>
          {:else}
            <li style="justify-content:center; color:var(--text-muted);">暂无历史</li>
          {/each}
        </ul>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; gap:8px;">
          <button class="btn-primary" disabled={histPage<=1} onclick={()=>loadHistory(histPage-1)}>上一页</button>
          <span style="font-size:12px; color:var(--text-secondary);">第 {histPage} 页 / 共 {histTotalPages} 页 (共 {histTotal} 条)</span>
          <button class="btn-primary" disabled={histPage>=histTotalPages} onclick={()=>loadHistory(histPage+1)}>下一页</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- 播放器 -->
{#if queue.length}
  <div class="bottom-audio-bar" style="display:flex;">
    <audio
      bind:this={audioEl}
      src={curTrack?.url || ''}
      onplay={()=>playing=true}
      onpause={()=>playing=false}
      ontimeupdate={(e)=>{ const a=e.currentTarget; curTime=a.currentTime; duration=a.duration||0; if(curTrack && !curTrack.url && songInfo?.url) curTrack.url=songInfo.url; }}
      onloadedmetadata={(e)=>{ duration=(e.currentTarget as HTMLAudioElement).duration||0; }}
      onended={()=>{ if(playMode==='single'){ if(audioEl) audioEl.currentTime=0; audioEl?.play(); } else next(); }}
    ></audio>
    <div class="audio-bar-inner">
      <div class="audio-left-section" onclick={()=>showLyric=!showLyric} style="cursor:pointer;">
        <div class="vinyl-cover-wrapper"><img src={curTrack?.cover || '/favicon.png'} alt="" class="audio-cover" class:playing={playing} /></div>
        <div class="audio-text">
          <div class="audio-title-row"><div class="audio-title">{curTrack?.name || '未在播放'}</div></div>
          <div class="audio-artist">{curTrack?.artist || ''}</div>
        </div>
      </div>
      <div class="audio-center-section">
        <div class="audio-main-controls">
          <button class="ctrl-btn sub-btn" onclick={()=> playMode=playMode==='list'?'single':playMode==='single'?'shuffle':'list'} title={playMode}>{playMode==='single'?'🔂':playMode==='shuffle'?'🔀':'🔁'}</button>
          <button class="ctrl-btn sub-btn" onclick={prev}>⏮</button>
          <button class="ctrl-btn play-main-btn" onclick={togglePlay}>{playing?'⏸':'▶'}</button>
          <button class="ctrl-btn sub-btn" onclick={next}>⏭</button>
        </div>
        <div class="audio-progress-container">
          <span class="time-stamp">{formatTime(curTime)}</span>
          <div class="progress-bar-wrapper" onclick={seek}>
            <div class="progress-bar-bg"></div>
            <div class="progress-bar-fill" style="width:{duration? (curTime/duration*100):0}%"></div>
            <div class="progress-bar-handle" style="left:{duration? (curTime/duration*100):0}%"></div>
          </div>
          <span class="time-stamp">{formatTime(duration)}</span>
        </div>
      </div>
      <div class="audio-right-section" style="display:flex; align-items:center; gap:6px;">
        <button class="ctrl-btn sub-btn" onclick={()=>showLyric=!showLyric} title="全屏歌词">🎤</button>
        <button class="ctrl-btn sub-btn playlist-btn-badge" onclick={()=>showDrawer=!showDrawer} title="当前播放列表">📜<span style="font-size:10px; margin-left:2px;">{queue.length}</span></button>
        <div class="volume-container" style="display:flex; align-items:center; gap:4px;">
          <span style="cursor:pointer;" onclick={()=>{ if(audioEl) audioEl.muted=!audioEl.muted; }}>{volume>0?'🔊':'🔇'}</span>
          <input type="range" min="0" max="1" step="0.05" value={volume} oninput={(e)=>{ volume=parseFloat((e.target as HTMLInputElement).value); if(audioEl) audioEl.volume=volume; }} class="volume-slider" style="width:70px;" />
        </div>
        <button class="ctrl-btn sub-btn peq-btn-badge" onclick={()=>showPeq=!showPeq} title="5段参量均衡器">🎛️</button>
        <button class="ctrl-btn mini-btn" onclick={()=>{ queue=[]; showDrawer=false; }}>✕</button>
      </div>
    </div>
  </div>
{/if}

<!-- 抽屉：对齐旧版播放队列 + 下载任务双 Tab + 拖拽 -->
{#if showDrawer}
  {@const serverCount = queue.filter(t=>t.isLocal).length}
  {@const readyCount = serverCount}
  {@const cacheCount = 0}
  {@const drawerList = drawerTab==='all' ? filteredQueue : drawerTab==='ready' ? filteredQueue.filter(t=>t.isLocal) : drawerTab==='server' ? filteredQueue.filter(t=>t.isLocal) : filteredQueue.filter(t=>false)}
  <div class="playlist-drawer" style="display:flex; {drawerPos.dragging ? `transform:translate(${drawerPos.x}px,${drawerPos.y}px);` : ''}"
       onmousedown={(e)=>{
         const target = e.target as HTMLElement;
         if(!target.closest('.playlist-drawer-header')) return;
         drawerPos.dragging=true; drawerPos.startX=e.clientX-drawerPos.x; drawerPos.startY=e.clientY-drawerPos.y;
         const move=(ev:MouseEvent)=>{ drawerPos.x=ev.clientX-drawerPos.startX; drawerPos.y=ev.clientY-drawerPos.startY; };
         const up=()=>{ drawerPos.dragging=false; window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up); };
         window.addEventListener('mousemove',move); window.addEventListener('mouseup',up);
       }}>
    <div class="playlist-drawer-header" style="cursor:move; user-select:none;" title="拖拽移动">
      <div class="drawer-header-tabs" style="display:flex; gap:4px;">
        <button class="drawer-main-tab" style="background:{drawerMainTab==='queue'?'rgba(255,255,255,0.16)':'transparent'}; color:{drawerMainTab==='queue'?'#fff':'#94a3b8'}; padding:4px 10px; border-radius:6px; border:none; font-size:12px; font-weight:600;" onclick={()=>drawerMainTab='queue'}>📜 播放队列 ({queue.length})</button>
        <button class="drawer-main-tab" style="background:{drawerMainTab==='tasks'?'rgba(255,255,255,0.16)':'transparent'}; color:{drawerMainTab==='tasks'?'#fff':'#94a3b8'}; padding:4px 10px; border-radius:6px; border:none; font-size:12px;" onclick={()=>drawerMainTab='tasks'}>📥 下载任务 <span style="background:#f59e0b; color:#fff; padding:1px 5px; border-radius:8px; font-size:10px; display:{tasks.filter(t=>t.status==='DOWNLOADING'||t.status==='PENDING').length?'inline':'none'};">{tasks.filter(t=>t.status==='DOWNLOADING'||t.status==='PENDING').length}</span></button>
      </div>
      <div style="display:flex; gap:6px; align-items:center;">
        <button class="drawer-header-btn" onclick={()=>{ if(drawerMainTab==='queue'){ queue=[]; showToast('已清空队列','info'); } else { clearTasks(); }}}>🗑️ 清空</button>
        <button class="drawer-header-btn" onclick={()=>showDrawer=false}>✕</button>
      </div>
    </div>
    <div class="playlist-drawer-filter-bar">
      <div class="drawer-search-wrap"><input class="drawer-search-input" placeholder="🔍 筛选当前列表 (歌名 / 歌手)..." bind:value={drawerFilter} /><button style="display:{drawerFilter?'block':'none'}; position:absolute; right:6px; top:50%; transform:translateY(-50%); background:none; border:none; color:#94a3b8; cursor:pointer;" onclick={()=>drawerFilter=''}>✕</button></div>
      <div class="drawer-filter-tabs" style="display:flex; gap:4px; overflow-x:auto;">
        <button class="drawer-tab-btn" class:active={drawerTab==='all'} onclick={()=>drawerTab='all'}>全部 {queue.length}</button>
        <button class="drawer-tab-btn" class:active={drawerTab==='ready'} onclick={()=>drawerTab='ready'}>✨ 离线就绪 {readyCount}</button>
        <button class="drawer-tab-btn" class:active={drawerTab==='server'} onclick={()=>drawerTab='server'}>🖥️ 本地 {serverCount}</button>
        <button class="drawer-tab-btn" class:active={drawerTab==='browser'} onclick={()=>drawerTab='browser'}>📲 缓存 {cacheCount}</button>
      </div>
      <div class="drawer-switches-row" style="display:flex; justify-content:space-between; margin-top:6px; font-size:11px; color:#94a3b8;">
        <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" checked={autoSkipTrial} onchange={(e)=>autoSkipTrial=(e.target as HTMLInputElement).checked} /> 🛡️ 自动跳过试听</label>
        <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" checked={offlineOnly} onchange={(e)=>offlineOnly=(e.target as HTMLInputElement).checked} /> 📴 纯离线模式</label>
      </div>
    </div>
    <div class="playlist-drawer-body">
      {#if drawerMainTab==='tasks'}
        <ul class="playlist-drawer-list">
          {#each tasks as t}
            <li class="drawer-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px;">
              <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px;">{t.name || t.id}</span>
              <span class="badge" style="padding:2px 6px; border-radius:8px; font-size:10px; background:{t.status==='DOWNLOADING'?'#f59e0b':t.status==='PENDING'?'#64748b':t.status==='SUCCESS'?'#10b981':'#ef4444'}; color:#fff;">{t.status}</span>
            </li>
          {:else}
            <li style="padding:20px; text-align:center; color:var(--text-muted);">暂无下载任务</li>
          {/each}
        </ul>
      {:else}
      <ul class="playlist-drawer-list">
        {#each drawerList.filter(t=> !offlineOnly || t.isLocal) as t,i}
          {@const realIdx = queue.indexOf(t)}
          <li class="drawer-item" class:active={realIdx===qIndex} onclick={()=>playAt(realIdx)} style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; gap:8px;">
            <div style="flex:1; overflow:hidden; display:flex; align-items:center; gap:6px;">
              <span style="font-weight:{realIdx===qIndex?700:500}; color:{realIdx===qIndex?'#4ade80':'inherit'};">{realIdx+1}. {t.name}</span>
              <span style="color:var(--text-muted); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">- {t.artist}</span>
              {#if t.isLocal}<span style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3); padding:1px 4px; border-radius:6px; font-size:10px; margin-left:4px;">🖥️</span>{/if}
              {#if realIdx===qIndex}<span style="color:#f87171; font-size:12px; margin-left:4px;">▶ 播放中</span>{/if}
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <button class="drawer-like-btn" style="background:none; border:none; cursor:pointer; font-size:14px;" onclick={(e)=>{e.stopPropagation(); toggleLike(Number(t.id), t.name);}}>{likedSet.has(Number(t.id))?'❤️':'🤍'}</button>
              <button class="drawer-item-del-btn" onclick={(e)=>{e.stopPropagation(); queue=queue.filter((_,idx)=>idx!==realIdx); if(qIndex>=queue.length) qIndex=Math.max(0,queue.length-1);}}>✕</button>
            </div>
          </li>
        {:else}
          <li style="padding:20px; text-align:center; color:var(--text-muted);">暂无队列</li>
        {/each}
      </ul>
      {/if}
    </div>
  </div>
{/if}

<!-- 全屏黑胶歌词（对齐旧版） -->
{#if showLyric && curTrack}
  <LyricModal track={curTrack} currentTime={curTime} playing={playing} onClose={()=>showLyric=false} />
{/if}
{#if showPeq}
  <PeqDrawer onClose={()=>showPeq=false} />
{/if}

<!-- 下载监控 -->
{#if monVisible}
  <div class="floating-monitor" style="display:block;">
    <div class="monitor-header" onclick={()=>monVisible=!monVisible}><span class="monitor-header-title">📥 下载监控 ({tasks.length})</span><div class="monitor-header-actions"><button class="btn-icon" onclick={(e)=>{e.stopPropagation(); clearTasks();}}>🗑️</button><button class="btn-icon" onclick={(e)=>{e.stopPropagation(); monVisible=false}}>✕</button></div></div>
    <div class="monitor-body"><div class="monitor-task-list">
      {#each tasks as t}
        <div class="monitor-task-item"><div class="task-info"><span class="task-name">{t.name || t.id}</span></div><span class="badge badge-{String(t.status).toLowerCase()}">{t.status}</span></div>
      {:else}
        <div style="padding:12px; text-align:center; color:var(--text-muted); font-size:12px;">暂无任务</div>
      {/each}
    </div></div>
  </div>
{/if}

<!-- Toast -->
<div id="globalToastContainer" class="toast-container" style="position:fixed; top:16px; right:16px; z-index:100000; display:flex; flex-direction:column; gap:8px;">
  {#each toasts as t (t.id)}
    <div class="toast-item toast-{t.type}" style="background:{t.type==='error'?'#ef4444':t.type==='success'?'#10b981':t.type==='warning'?'#f59e0b':'#334155'}; color:#fff; padding:10px 14px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:13px; max-width:360px;">{t.msg}</div>
  {/each}
</div>

<!-- Modal -->
{#if modal}
  <div class="app-modal-backdrop" style="opacity:1;" onclick={(e)=> e.target===e.currentTarget && closeModal(false)}>
    <div class="app-modal-card" style="transform:scale(1);">
      <div class="app-modal-header"><span>{modal.icon} {modal.title}</span><button class="app-modal-close-btn" onclick={()=>closeModal(false)}>✕</button></div>
      <div class="app-modal-body">{@html modal.content}</div>
      <div class="app-modal-footer">
        {#if modal.showCancel}<button class="app-modal-btn app-modal-btn-cancel" onclick={()=>closeModal(false)}>{modal.cancelText||'取消'}</button>{/if}
        <button class="app-modal-btn {modal.danger?'app-modal-btn-danger':'app-modal-btn-confirm'}" onclick={()=>closeModal(true)}>{modal.confirmText||'确定'}</button>
      </div>
    </div>
  </div>
{/if}
{#if showCreateModal}
  <CreatePlaylistModal onClose={()=>showCreateModal=false} onSuccess={(id)=>{ showToast('创建成功','success'); loadMyPlaylists('created'); if(id){ playlistId=String(id); loadPlaylistDetail(); } }} />
{/if}

<style>
  /* 兜底：若 /css/style.css 未加载，保留最小布局 */
  :global(body){ padding-bottom:120px; }
</style>
