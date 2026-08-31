<script lang="ts">
  import { myPlaylists, allTracks, pageSize, getPaged, getTotalPages, getPlaylist, getPlaylistFilter, getCurPage, loadMyPlaylists, loadPlaylistDetail, renderPlaylist, incPage, playlistState } from '../lib/playlist.svelte';
  let paged = $derived(getPaged());
  let totalPages = $derived(getTotalPages());
  let playlist = $derived(getPlaylist());
  let playlistFilter = $derived(getPlaylistFilter());
  let curPage = $derived(getCurPage());
  import { api } from '../lib/api';
  let { playlistId, likedSet, onToggleLike, onPlayQueue, showToast } = $props<{
    playlistId:string, likedSet:Set<number>, onToggleLike:(id:number,name:string)=>void, onPlayQueue:(tracks:any[],idx?:number)=>void, showToast:(m:string,t?:string)=>void
  }>();
  let pid=$state(playlistId);
  $effect(()=>{ pid=playlistId; });
  let accMy=$state(true), accDetail=$state(true), accSong=$state(false);
  // 单曲
  let songId=$state(''), songLevel=$state('lossless'), songInfo:any=$state(null);
  async function loadSong(){
    if(!songId) return showToast('请输入歌曲ID','warning');
    try{ const j=await api.songV1(songId, songLevel); if(j?.code && j.code!=='000000'){ showToast(j.msg||'获取失败','warning'); return; } songInfo=j?.data||null; }catch(e){ showToast('获取单曲失败:'+e,'error'); }
  }
</script>

<div class="accordion-card" class:active={accMy}>
  <div class="accordion-header" onclick={()=>accMy=!accMy}><h3 class="accordion-title">📋 1. 我的歌单</h3><span class="accordion-icon">▼</span></div>
  <div class="accordion-body">
    <div class="my-playlist-filter-bar">
      <span class="filter-bar-label">账号歌单快捷加载：</span>
      <div class="playlist-quick-btn-group">
        <button class="btn-primary quick-btn-item btn-created" onclick={()=>loadMyPlaylists('created')}>📂 创建<span class="pc-only-text">的歌单</span></button>
        <button class="btn-primary quick-btn-item btn-subscribed" onclick={()=>loadMyPlaylists('subscribed')}>⭐ 收藏<span class="pc-only-text">的歌单</span></button>
        <button class="btn-primary quick-btn-item btn-all" onclick={()=>loadMyPlaylists('all')}>📋 全部</button>
        <button class="btn-primary quick-btn-item btn-create" onclick={()=>showToast('新建见外层弹窗','info')}>➕ 新建<span class="pc-only-text">歌单</span></button>
      </div>
    </div>
    <ul class="data-list scrollable-list">
      {#each myPlaylists.filter(p=> playlistFilter==='all'|| (playlistFilter==='created'? !p.subscribed : !!p.subscribed)) as pl, idx}
        <li>
          <div style="flex:1; display:flex; align-items:center; gap:6px; overflow:hidden;">
            <span class="status-badge" style="background:{pl.subscribed?'rgba(59,130,246,0.15)':'rgba(34,197,94,0.15)'}; color:{pl.subscribed?'#60a5fa':'#4ade80'}; border:1px solid {pl.subscribed?'rgba(59,130,246,0.25)':'rgba(34,197,94,0.25)'}; font-weight:600; padding:2px 6px; border-radius:6px; font-size:11px;">{pl.subscribed?'收藏':'创建'}</span>
            <strong class="clickable-track-title" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer;" onclick={()=>{ pid=String(pl.id); loadPlaylistDetail(pid); }}>{pl.name}</strong>
            <span style="color:var(--text-muted); font-size:11px;">({pl.trackCount||0}首)</span>
          </div>
          <div style="display:flex; gap:6px;">
            {#if pl.subscribed}<button class="jump-link-btn" style="background:rgba(239,68,68,0.1); color:#f87171;" onclick={()=> api.playlistSubscribe(String(pl.id), false).then(j=>j.code==='000000'?showToast('已取消','success'):showToast(j.msg,'warning'))}>💔 取消收藏</button>
            {:else if idx>0}<button class="jump-link-btn" style="background:rgba(239,68,68,0.08); color:#f87171;" onclick={()=> api.playlistDelete(String(pl.id)).then(j=>j.code==='000000'?showToast('已删除','success'):showToast(j.msg,'warning'))}>🗑️ 删除</button>{/if}
            <button class="jump-link-btn" onclick={()=>{ pid=String(pl.id); loadPlaylistDetail(pid); }}>👉 查看详情</button>
          </div>
        </li>
      {:else}
        <li style="justify-content:center; color:var(--text-muted);">暂无歌单</li>
      {/each}
    </ul>
  </div>
</div>

<div class="accordion-card" class:active={accDetail}>
  <div class="accordion-header" onclick={()=>accDetail=!accDetail}><h3 class="accordion-title">🎼 2. 查看歌单详情</h3><span class="accordion-icon">▼</span></div>
  <div class="accordion-body">
    <div class="form-row flex-input-row">
      <input type="text" placeholder="输入歌单 ID (如 123456，按回车查看)" style="flex:1;" bind:value={pid} onkeydown={(e)=> e.key==='Enter' && loadPlaylistDetail(pid)} />
      <button class="btn-primary inline-action-btn" onclick={()=>loadPlaylistDetail(pid)}>查看<span class="pc-only-text">歌单详情</span></button>
    </div>
    {#if playlist}
      <div class="detail-header-card">
        <img src={playlist.coverImgUrl || '/favicon.png'} alt="" class="detail-cover-img" />
        <div class="detail-header-info">
          <h4 class="detail-header-title">{playlist.name}</h4>
          <div class="detail-header-sub">{playlist.creator || '未知'} | 共 {allTracks.length} 首</div>
          <div class="detail-btn-group">
            <button class="btn-primary" onclick={()=> api.downloadPlaylist(String(playlist.id)).then(()=>showToast('已提交下载','success'))}>🖥️ 下载到电脑</button>
            <button class="btn-primary" style="background:#22c55e;" onclick={()=> onPlayQueue(allTracks.map((t:any)=>({id:t.id, name:t.name, artist:(t.ar?.map((a:any)=>a.name).join('/')||t.artists||''), cover:t.al?.picUrl||'/favicon.png'})))}>▶️ 播放歌单</button>
          </div>
        </div>
      </div>
      <ul class="data-list scrollable-list">
        {#each paged as t,i}
          {@const idx=(curPage-1)*pageSize+i+1}
          {@const isLocal=t.isLocal===true}
          {@const artist=t.ar?.map((a:any)=>a.name).join('/')||t.artists||''}
          <li>
            <div class="track-title-row" style="flex:1; display:flex; align-items:center; gap:6px; overflow:hidden;">
              <strong class="clickable-track-title" style="cursor:pointer;" onclick={()=>{ songId=String(t.id); loadSong(); }}>{idx}. {t.name}{artist?' - '+artist:''}</strong>
              {#if isLocal}<span class="audio-source-badge icon-only badge-server" style="margin-left:6px;">🖥️</span>{/if}
              <button class="track-like-btn" class:active={likedSet.has(Number(t.id))} onclick={()=>onToggleLike(Number(t.id), t.name)}>{likedSet.has(Number(t.id))?'❤️':'🤍'}</button>
            </div>
            <div class="track-action-group">
              <button class={isLocal?'track-btn-slot slot-play-ready':'track-btn-slot slot-play-preview'} onclick={()=> onPlayQueue([{id:t.id, name:t.name, artist, cover:t.al?.picUrl||'/favicon.png'}])}>{isLocal?'▶️ 播放':'▶️ 试听'}</button>
              <button class={isLocal?'track-btn-slot slot-server-locate':'track-btn-slot slot-server-download'}>{isLocal?'📂 定位':'📥 下载'}</button>
              <button class="track-btn-slot slot-browser-cache">📲 缓存</button>
              <button class="track-btn-slot slot-add-playlist">➕ 歌单</button>
            </div>
          </li>
        {/each}
      </ul>
      <div class="pagination-container" style="display:flex; justify-content:space-between; align-items:center;">
        <button class="btn-primary" disabled={curPage<=1} onclick={()=>incPage(-1)}>上一页</button>
        <span style="font-size:12px; color:var(--text-secondary);">第 {curPage} / {totalPages} 页 ({allTracks.length}首)</span>
        <button class="btn-primary" disabled={curPage>=totalPages} onclick={()=>incPage(1)}>下一页</button>
      </div>
    {/if}
  </div>
</div>
