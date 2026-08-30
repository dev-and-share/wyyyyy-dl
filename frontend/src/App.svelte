<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './lib/api';
  import { formatTime, formatBytes, getApiCache, setApiCache, deleteApiCache } from './lib/utils';

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
  type Track = {id:number|string, name:string, artist:string, cover:string, url?:string, lyric?:string};
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

  let curTrack = $derived(queue[qIndex] || null);
  let filteredQueue = $derived(queue.filter(t=> !drawerFilter || (t.name+t.artist).toLowerCase().includes(drawerFilter.toLowerCase())));

  function togglePlay(){
    if(!audioEl) return;
    if(audioEl.paused) audioEl.play().catch(()=>{}); else audioEl.pause();
  }
  function playAt(i:number){ qIndex=i; setTimeout(()=> audioEl?.play().catch(()=>{}),0); }
  function next(){ if(queue.length===0) return; if(playMode==='shuffle') qIndex=Math.floor(Math.random()*queue.length); else qIndex=(qIndex+1)%queue.length; setTimeout(()=>audioEl?.play().catch(()=>{}),10); }
  function prev(){ if(queue.length===0) return; qIndex=(qIndex-1+queue.length)%queue.length; setTimeout(()=>audioEl?.play().catch(()=>{}),10); }
  function seek(e:MouseEvent){ if(!audioEl||!duration) return; const rect=(e.currentTarget as HTMLElement).getBoundingClientRect(); const p=(e.clientX-rect.left)/rect.width; audioEl.currentTime=p*duration; }
  function setQueue(tracks:Track[], idx=0){ queue=tracks; qIndex=idx; }

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
      const pl=j?.data?.playlist;
      if(!pl?.tracks?.length){ if(!cached) showToast('未找到歌单','warning'); return; }
      setApiCache(key, j.data); renderPlaylist(pl);
    }catch(e){ showToast('获取歌单失败','error'); }
  }
  function renderPlaylist(pl:any){
    playlist=pl; allTracks=pl.tracks||[]; curPage=1;
  }
  function jumpToPlaylist(id:string){ playlistId=id; loadPlaylistDetail(); switchTab('playlist'); acc.detail=true; }

  // ---------- 搜索 ----------
  let kw=$state(''), sType=$state('1'), sLimit=$state('10');
  let sResults:any[]=$state([]); let sPage=$state(1);
  async function doSearch(){
    if(!kw.trim()) return showToast('请输入关键词','warning');
    try{
      const j=await api.search(kw, sType, sLimit);
      // 后端 Search 返回结构 {songs|albums|playlists|artists}
      const data=j?.data||{};
      sResults = data.songs||data.albums||data.playlists||data.artists||data.result||[];
      if(sResults.length===0) showToast('无结果','info');
    }catch{ showToast('搜索失败','error'); }
  }

  // ---------- 单曲 ----------
  let songId=$state(''), songLevel=$state('lossless');
  let songInfo:any=$state(null);
  async function loadSong(){
    if(!songId) return showToast('请输入歌曲ID','warning');
    try{ const j=await api.songV1(songId, songLevel); songInfo=j?.data||null; if(!songInfo) showToast('无歌曲数据','warning'); }catch{ showToast('获取单曲失败','error'); }
  }

  // ---------- 下载监控 ----------
  let tasks:any[]=$state([]); let monVisible=$state(false);
  async function fetchTasks(){
    try{ const j=await api.tasks(); if(j.code==='000000'){ tasks=j.data||[]; if(tasks.length) monVisible=true; }}catch{}
  }
  async function clearTasks(){ await api.tasksClear(); tasks=[]; showToast('已清空','info'); }

  // ---------- 历史 ----------
  let histKw=$state(''), histPage=$state(1), histList:any[]=$state([]), histStats:any=$state(null);
  async function loadHistory(p=1){
    histPage=p;
    try{
      const j=await api.historyList(histKw, p);
      histList=j?.data?.records||j?.data||[];
      const s=await api.historyStats(); histStats=s?.data||null;
    }catch{}
  }

  // ---------- 文件夹 ----------
  let roots:any[]=$state([]), curRoot:any=$state(null), tree:any[]=$state([]);
  async function loadRoots(){ try{ const j=await api.folderRoots(); roots=j?.data||[]; if(roots.length&&!curRoot){ curRoot=roots[0]; loadBrowse(curRoot.path);} }catch{} }
  async function loadBrowse(path:string){
    try{ const j=await api.folderBrowse(path); tree=j?.data||[]; }catch{}
  }

  // ---------- 生命周期 ----------
  onMount(()=>{
    applyTheme(themeMode);
    // hash 初始
    const h=location.hash.replace('#',''); if(h) tab=h as any;
    window.addEventListener('hashchange',()=>{ const hh=location.hash.replace('#',''); if(hh) tab=hh as any; });
    api.getRepeat().then((j:any)=>{ if(j?.code==='000000') repeat=j.data===true; }).catch(()=>{});
    fetchTasks(); setInterval(fetchTasks, 3000);
    loadMyPlaylists(); loadRoots(); loadHistory(1);
    // 初始化红心
    const c=getApiCache('liked_song_ids'); if(c?.data) likedSet=new Set(c.data.map((n:any)=>Number(n)));
    api.likeList().then((j:any)=>{ if(j?.code==='000000'&&Array.isArray(j.data)){ likedSet=new Set(j.data.map((n:any)=>Number(n))); setApiCache('liked_song_ids', j.data);} }).catch(()=>{});
    // 从 localStorage 恢复队列
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
    <div class="accordion-card" class:active={acc.my}>
      <div class="accordion-header" onclick={()=>toggleAcc('my')}><h3 class="accordion-title">📋 1. 我的歌单</h3><span class="accordion-icon">▼</span></div>
      <div class="accordion-body">
        <div class="my-playlist-filter-bar" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-bottom:8px;">
          <button class="btn-primary" style="padding:6px 10px; font-size:12px;" onclick={()=>loadMyPlaylists('created')}>📂 创建</button>
          <button class="btn-primary" style="padding:6px 10px; font-size:12px; background:#0284c7;" onclick={()=>loadMyPlaylists('subscribed')}>⭐ 收藏</button>
          <button class="btn-primary" style="padding:6px 10px; font-size:12px; background:#64748b;" onclick={()=>loadMyPlaylists('all')}>📋 全部</button>
          <button class="btn-primary" style="padding:6px 10px; font-size:12px; background:linear-gradient(135deg,#10b981,#059669);" onclick={async()=>{
            const name=prompt('新歌单名称'); if(!name) return;
            const j=await api.playlistCreate(name,false); if(j.code==='000000'){ showToast('创建成功','success'); loadMyPlaylists('created'); } else showToast(j.msg,'error');
          }}>➕ 新建</button>
        </div>
        <ul class="data-list scrollable-list">
          {#each myPlaylists.filter(p=> playlistFilter==='all'|| (playlistFilter==='created'? !p.subscribed : !!p.subscribed)) as pl}
            <li>
              <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <span class="status-badge" style="margin-right:6px; font-size:11px;">{pl.subscribed?'收藏':'创建'}</span>
                <strong class="clickable-track-title" onclick={()=>jumpToPlaylist(String(pl.id))}>{pl.name}</strong>
                <span style="color:var(--text-muted); font-size:11px; margin-left:4px;">({pl.trackCount||0}首)</span>
              </div>
              <button class="jump-link-btn" onclick={()=>jumpToPlaylist(String(pl.id))}>👉 查看详情</button>
            </li>
          {:else}
            <li style="justify-content:center; color:var(--text-muted); font-size:13px;">暂无歌单</li>
          {/each}
        </ul>
      </div>
    </div>

    <div class="accordion-card" class:active={acc.detail}>
      <div class="accordion-header" onclick={()=>toggleAcc('detail')}><h3 class="accordion-title">🎼 2. 查看歌单详情</h3><span class="accordion-icon">▼</span></div>
      <div class="accordion-body">
        <div class="form-row flex-input-row" style="display:flex; gap:6px;">
          <input style="flex:1;" placeholder="输入歌单 ID 按回车" bind:value={playlistId} onkeydown={(e)=> e.key==='Enter' && loadPlaylistDetail()} />
          <button class="btn-primary inline-action-btn" onclick={loadPlaylistDetail}>查看</button>
        </div>
        {#if playlist}
          <div class="detail-header-card">
            <img src={playlist.coverImgUrl || '/favicon.png'} alt="" class="detail-cover-img" />
            <div class="detail-header-info">
              <h4 class="detail-header-title">{playlist.name}</h4>
              <div class="detail-header-sub">{playlist.creator || '未知'} | 共 {allTracks.length} 首</div>
              <div class="detail-btn-group">
                <button class="btn-primary" onclick={()=> api.downloadPlaylist(String(playlist.id)).then(()=>{showToast('已提交下载','success'); fetchTasks();})}>🖥️ 下载到电脑</button>
                <button class="btn-primary" style="background:#22c55e;" onclick={()=> setQueue(allTracks.map((t:any)=>({id:t.id, name:t.name, artist:(t.ar?.map((a:any)=>a.name).join('/')||t.artists||''), cover:t.al?.picUrl||'/favicon.png'})),0)}>▶️ 播放歌单</button>
              </div>
            </div>
          </div>
          <ul class="data-list scrollable-list">
            {#each paged as t, i}
              {@const idx=(curPage-1)*pageSize+i+1}
              <li>
                <div class="track-title-row" style="flex:1; display:flex; align-items:center; gap:6px;">
                  <strong class="clickable-track-title" onclick={()=>{
                    const tr={id:t.id, name:t.name, artist:t.ar?.map((a:any)=>a.name).join('/')||t.artists||'', cover:t.al?.picUrl||'/favicon.png'};
                    const q=[tr, ...queue]; setQueue(q,0);
                  }}>{idx}. {t.name}</strong>
                  <span style="color:var(--text-muted); font-size:12px;">{t.ar?.map((a:any)=>a.name).join('/') || t.artists || ''}</span>
                  <button class="track-like-btn" class:active={likedSet.has(Number(t.id))} onclick={()=>toggleLike(Number(t.id), t.name)} title="红心">
                    {#if likedSet.has(Number(t.id))}❤️{:else}🤍{/if}
                  </button>
                </div>
                <div class="track-action-group">
                  <button class="track-btn-slot slot-play-preview" onclick={()=>{
                    const tr={id:t.id, name:t.name, artist:t.ar?.map((a:any)=>a.name).join('/')||'', cover:t.al?.picUrl||'/favicon.png'};
                    setQueue([tr],0); setTimeout(()=>audioEl?.play(),0);
                  }}>▶️ 试听</button>
                  <button class="track-btn-slot slot-server-download" onclick={()=> api.downloadSingle(String(t.id)).then(()=>{showToast('已提交单曲下载','success'); fetchTasks();})}>📥 下载</button>
                </div>
              </li>
            {/each}
          </ul>
          <div class="pagination-container" style="display:flex; justify-content:space-between; align-items:center;">
            <button class="btn-primary" disabled={curPage<=1} onclick={()=>curPage--}>上一页</button>
            <span style="font-size:12px; color:var(--text-secondary);">第 {curPage} / {totalPages} 页 ({allTracks.length}首)</span>
            <button class="btn-primary" disabled={curPage>=totalPages} onclick={()=>curPage++}>下一页</button>
          </div>
        {/if}
      </div>
    </div>

    <div class="accordion-card" class:active={acc.song}>
      <div class="accordion-header" onclick={()=>toggleAcc('song')}><h3 class="accordion-title">🎧 3. 查看歌曲信息</h3><span class="accordion-icon">▼</span></div>
      <div class="accordion-body">
        <div class="form-row" style="display:flex; gap:6px;">
          <input style="flex:1;" placeholder="歌曲ID" bind:value={songId} onkeydown={(e)=> e.key==='Enter' && loadSong()} />
          <select bind:value={songLevel}><option value="standard">标准</option><option value="exhigh">极高</option><option value="lossless">无损</option></select>
          <button class="btn-primary" onclick={loadSong}>查看</button>
        </div>
        {#if songInfo}
          <div class="detail-header-card">
            <img src={songInfo.pic || songInfo.picUrl || '/favicon.png'} alt="" style="width:80px; height:80px; border-radius:8px; object-fit:cover;" />
            <div style="flex:1;">
              <h4 style="margin:0;">{songInfo.name}</h4>
              <div style="font-size:12px; color:var(--text-secondary);">{songInfo.ar_name || ''} | {songInfo.al_name||''}</div>
              <button class="btn-primary" style="margin-top:6px; background:#10b981;" onclick={()=>{
                const tr={id:songInfo.id, name:songInfo.name, artist:songInfo.ar_name||'', cover:songInfo.pic||'/favicon.png', url:songInfo.url, lyric:songInfo.lyric};
                setQueue([tr],0); setTimeout(()=>audioEl?.play(),0);
              }}>▶️ 在线试听</button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {:else if tab==='search'}
    <div class="accordion-card" class:active={acc.search}>
      <div class="accordion-header" onclick={()=>toggleAcc('search')}><h3 class="accordion-title">🔍 1. 关键词综合搜索</h3><span class="accordion-icon">▼</span></div>
      <div class="accordion-body">
        <div class="form-row" style="display:flex; gap:6px;">
          <input style="flex:1;" placeholder="搜索歌曲/歌手/专辑/歌单 回车" bind:value={kw} onkeydown={(e)=> e.key==='Enter' && doSearch()} />
          <select bind:value={sType}><option value="1">单曲</option><option value="10">专辑</option><option value="1000">歌单</option><option value="100">歌手</option></select>
          <input type="number" style="width:60px;" bind:value={sLimit} />
          <button class="btn-primary" onclick={doSearch}>搜索</button>
        </div>
        <ul class="data-list scrollable-list">
          {#each sResults as r}
            <li>
              <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <strong>{r.name || r.title || r.nickname || '未知'}</strong>
                <span style="color:var(--text-muted); font-size:11px; margin-left:6px;">ID:{r.id}</span>
              </div>
              <button class="jump-link-btn" onclick={()=>{
                if(sType==='1'){ songId=String(r.id); loadSong(); switchTab('playlist'); acc.song=true; }
                else if(sType==='10'){ showToast('专辑ID:'+r.id,'info'); }
                else if(sType==='1000'){ jumpToPlaylist(String(r.id)); }
                else if(sType==='100'){ showToast('歌手ID:'+r.id,'info'); }
              }}>👉 查看</button>
            </li>
          {:else}
            <li style="justify-content:center; color:var(--text-muted);">输入关键词搜索</li>
          {/each}
        </ul>
      </div>
    </div>
    <div class="accordion-card" class:active={acc.album}>
      <div class="accordion-header" onclick={()=>toggleAcc('album')}><h3 class="accordion-title">💽 2. 专辑解析</h3><span class="accordion-icon">▼</span></div>
      <div class="accordion-body">
        <div class="empty-placeholder-card"><div class="empty-icon">💽</div><div class="empty-title">在搜索中选择专辑或输入ID</div></div>
      </div>
    </div>
  {:else}
    <div class="accordion-card" class:active={acc.folder}>
      <div class="accordion-header" onclick={()=>toggleAcc('folder')}><h3 class="accordion-title">📁 1. 本地曲库与文件夹树</h3><span class="accordion-icon">▼</span></div>
      <div class="accordion-body">
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
          {#each roots as r}
            <button class="btn-primary" style="padding:6px 10px; font-size:12px; background: curRoot?.path===r.path ? '#2563eb' : '#334155';" onclick={()=>{curRoot=r; loadBrowse(r.path);}}>{r.name}</button>
          {:else}
            <span style="color:var(--text-muted); font-size:12px;">无本地曲库</span>
          {/each}
        </div>
        <div class="scrollable-list" style="border:1px solid var(--border-subtle); border-radius:8px; padding:6px;">
          {#each tree as node}
            <div style="padding:6px 8px; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:13px;">📁 {node.name || node.path}</span>
              <button class="jump-link-btn" onclick={()=>api.folderTracks(node.path,true).then((j:any)=> {
                const tracks=j?.data||[];
                if(tracks.length) setQueue(tracks.map((t:any)=>({id:t.id||t.path, name:t.name, artist:t.artist||'', cover:'/favicon.png'})),0);
              })}>▶️ 播放此目录</button>
            </div>
          {:else}
            <div style="padding:20px; text-align:center; color:var(--text-muted);">选择根目录查看</div>
          {/each}
        </div>
      </div>
    </div>
    <div class="accordion-card" class:active={acc.history}>
      <div class="accordion-header" onclick={()=>toggleAcc('history')}><h3 class="accordion-title">📥 2. 本地下载历史与文件管理</h3><span class="accordion-icon">▼</span></div>
      <div class="accordion-body">
        <div style="display:flex; gap:8px; flex-wrap:wrap; background:var(--stat-bar-bg); padding:10px 12px; border-radius:8px; margin-bottom:8px; font-size:13px; align-items:center;">
          <span>已记录 {histStats?.total ?? histList.length} 首</span>
          <span>占用 {histStats?.totalSize ? formatBytesLocal(histStats.totalSize) : '-'}</span>
          <span style="margin-left:auto; display:flex; gap:6px;">
            <button class="btn-primary" style="padding:6px 10px; font-size:11px;" onclick={()=>loadHistory(1)}>🔄 刷新</button>
            <button class="btn-primary" style="padding:6px 10px; font-size:11px; background:#6366f1;" onclick={()=>{
              const p=prompt('搜索关键词'); if(p!==null){ histKw=p; loadHistory(1); }
            }}>🔍 搜索</button>
          </span>
        </div>
        <ul class="data-list scrollable-list">
          {#each histList as h}
            <li>
              <div style="flex:1; overflow:hidden;">
                <strong style="font-size:13px;">{h.title || h.name || h.fileName}</strong>
                <div style="font-size:11px; color:var(--text-muted);">{h.artist || ''} | {h.album || ''}</div>
              </div>
              <button class="jump-link-btn" onclick={()=>copyText(h.filePath||'')}>📋 路径</button>
            </li>
          {:else}
            <li style="justify-content:center; color:var(--text-muted);">暂无历史</li>
          {/each}
        </ul>
        <div style="display:flex; justify-content:space-between; margin-top:8px;">
          <button class="btn-primary" disabled={histPage<=1} onclick={()=>loadHistory(histPage-1)}>上一页</button>
          <span style="font-size:12px; color:var(--text-secondary);">第 {histPage} 页</span>
          <button class="btn-primary" onclick={()=>loadHistory(histPage+1)}>下一页</button>
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
        <button class="ctrl-btn sub-btn" onclick={()=>showLyric=!showLyric} title="歌词">🎤</button>
        <button class="ctrl-btn sub-btn" onclick={()=>showDrawer=!showDrawer} title="队列">📜<span style="font-size:10px; margin-left:2px;">{queue.length}</span></button>
        <input type="range" min="0" max="1" step="0.05" value={volume} oninput={(e)=>{ volume=parseFloat((e.target as HTMLInputElement).value); if(audioEl) audioEl.volume=volume; }} style="width:70px;" />
        <button class="ctrl-btn mini-btn" onclick={()=>{ queue=[]; showDrawer=false; }}>✕</button>
      </div>
    </div>
  </div>
{/if}

<!-- 抽屉 -->
{#if showDrawer}
  <div class="playlist-drawer" style="display:flex;">
    <div class="playlist-drawer-header"><span>📜 队列 ({queue.length})</span><button class="drawer-header-btn" onclick={()=>showDrawer=false}>✕</button></div>
    <div class="playlist-drawer-filter-bar">
      <div class="drawer-search-wrap"><input class="drawer-search-input" placeholder="筛选 歌名/歌手" bind:value={drawerFilter} /></div>
      <div class="drawer-filter-tabs">
        <button class="drawer-tab-btn" class:active={drawerTab==='all'} onclick={()=>drawerTab='all'}>全部</button>
        <button class="drawer-tab-btn" class:active={drawerTab==='ready'} onclick={()=>drawerTab='ready'}>就绪</button>
      </div>
    </div>
    <div class="playlist-drawer-body">
      <ul class="playlist-drawer-list">
        {#each filteredQueue as t,i}
          <li class="drawer-item" class:active={i===qIndex} onclick={()=>playAt(i)}>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{i+1}. {t.name} - {t.artist}</span>
            <button class="drawer-item-del-btn" onclick={(e)=>{e.stopPropagation(); queue=queue.filter((_,idx)=>idx!==i); if(qIndex>=queue.length) qIndex=Math.max(0,queue.length-1);}}>🗑️</button>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<!-- 全屏歌词 (简化) -->
{#if showLyric && curTrack}
  <div class="lyric-modal-overlay" style="display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); z-index:10001; align-items:center; justify-content:center; padding:16px;" onclick={()=>showLyric=false}>
    <div class="lyric-modal-card" onclick={(e)=>e.stopPropagation()} style="background:rgba(15,23,42,0.96); border:1px solid rgba(255,255,255,0.12); border-radius:16px; width:100%; max-width:520px; max-height:80vh; overflow:auto; padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"><h3 style="margin:0; color:#fff;">🎤 {curTrack.name}</h3><button class="btn-primary" style="padding:4px 8px; font-size:12px;" onclick={()=>showLyric=false}>✕ 关闭</button></div>
      <pre style="white-space:pre-wrap; color:#cbd5e1; font-size:13px; line-height:1.6;">{curTrack.lyric || songInfo?.lyric || '暂无歌词'}</pre>
    </div>
  </div>
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

<style>
  /* 兜底：若 /css/style.css 未加载，保留最小布局 */
  :global(body){ padding-bottom:120px; }
</style>
