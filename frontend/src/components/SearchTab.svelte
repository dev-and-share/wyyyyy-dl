<script lang="ts">
  import { api } from '../lib/api';
  let { onAlbum, onPlaylist, showToast } = $props<{onAlbum:(id:string)=>void, onPlaylist:(id:string)=>void, showToast:(m:string,t?:string)=>void}>();
  let accSearch=$state(true), accAlbum=$state(false);
  let albumId=$state(''), album:any=$state(null);
  let kw=$state(''), sType=$state('1'), sLimit=$state('10'), sResults:any[]=$state([]);
  async function doSearch(){
    if(!kw.trim()){ showToast('请输入关键词','warning'); return; }
    try{
      const j=await api.search(kw, sType, sLimit);
      if(j?.code && j.code!=='000000'){ showToast(j.msg,'warning'); return; }
      const d=j?.data;
      if(Array.isArray(d)) sResults=d;
      else sResults=(d as any)?.songs||(d as any)?.albums||(d as any)?.playlists||(d as any)?.artists||(d as any)?.result||[];
      if(!sResults.length) showToast('无结果','info');
    }catch(e:any){ showToast('搜索失败:'+e.message,'error'); }
  }
  async function loadAlbum(){
    if(!albumId) return showToast('请输入专辑 ID','warning');
    // 立即折叠搜索、展开专辑，显示 loading
    accSearch=false; accAlbum=true; album=null;
    try{ const j=await api.album(albumId); if(j?.code && j.code!=='000000'){ showToast(j.msg,'warning'); return; } album=j?.data?.album||j?.data||null; }catch(e){ showToast('获取专辑失败:'+e,'error'); }
  }
  function handleAlbum(id:string){ albumId=id; accSearch=false; accAlbum=true; album=null; loadAlbum(); }
</script>

<div class="accordion-card" class:active={accSearch}>
  <div class="accordion-header" onclick={()=>accSearch=!accSearch}><h3 class="accordion-title">🔍 1. 关键词综合搜索</h3><span class="accordion-icon">▼</span></div>
  <div class="accordion-body">
    <div class="form-row search-form-row">
      <input type="text" placeholder="🔍 搜索歌曲 / 歌手 / 专辑 / 歌单 (按回车搜索)" style="flex:1;" bind:value={kw} onkeydown={(e)=> e.key==='Enter' && doSearch().catch((e:any)=>showToast(e.message,'warning'))} />
      <select bind:value={sType} style="width:auto; flex-shrink:0;"><option value="1">单曲</option><option value="10">专辑</option><option value="1000">歌单</option><option value="100">歌手</option></select>
      <input type="number" bind:value={sLimit} min="1" max="100" class="search-limit-input" style="width:60px;" />
      <button class="btn-primary sp-hide-btn" onclick={()=>doSearch().catch((e:any)=>showToast(e.message,'warning'))}>搜索</button>
    </div>
    <ul class="data-list scrollable-list">
      {#each sResults as r, idx}
        {#if sType==='1'}
          <li class="track-item-card">
            <div class="track-title-row" style="flex:1; display:flex; align-items:center; gap:6px;">
              <strong>{idx+1}. {r.name}</strong>{#if r.artists}<span style="color:var(--text-secondary);"> - {r.artists}</span>{/if}
              <span style="color:var(--text-muted); font-size:11px;">(ID:{r.id})</span>
            </div>
            <button class="jump-link-btn" onclick={()=>showToast('歌曲 '+r.id,'info')}>👉 查看</button>
          </li>
        {:else if sType==='10'}
          <li>
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              <strong>{idx+1}. {r.name}</strong>{#if r.artist}<span style="color:var(--text-secondary);"> - {typeof r.artist==='object'?r.artist.name:r.artist}</span>{/if}
              {#if r.size}<span style="color:var(--text-muted); font-size:12px;"> ({r.size} 首歌)</span>{/if}
              <span style="color:var(--text-muted); font-size:12px;"> (ID: {r.id})</span>
            </div>
            <button class="jump-link-btn" onclick={()=>handleAlbum(String(r.id))}>👉 查看专辑详情</button>
          </li>
        {:else if sType==='1000'}
          <li>
            <div style="flex:1; overflow:hidden; white-space:nowrap;"><strong>{idx+1}. {r.name}</strong><span style="color:var(--text-muted);"> (ID:{r.id})</span></div>
            <button class="jump-link-btn" onclick={()=>onPlaylist(String(r.id))}>👉 查看详情</button>
          </li>
        {:else}
          <li><strong>{idx+1}. {r.name}</strong><span style="color:var(--text-muted);"> (ID:{r.id})</span><button class="jump-link-btn" onclick={()=>showToast('歌手','info')}>查看</button></li>
        {/if}
      {:else}
        <li style="justify-content:center; color:var(--text-muted);">输入关键词搜索</li>
      {/each}
    </ul>
    <div style="font-size:12px; color:var(--text-muted); text-align:center; margin-top:8px;">共搜索到 {sResults.length} 条数据</div>
  </div>
</div>

<div class="accordion-card" class:active={accAlbum}>
  <div class="accordion-header" onclick={()=>accAlbum=!accAlbum}><h3 class="accordion-title">💽 2. 专辑解析与整辑下载</h3><span class="accordion-icon">▼</span></div>
  <div class="accordion-body">
    <div class="form-row flex-input-row" style="display:flex; gap:6px; margin-bottom:10px;">
      <input type="text" placeholder="输入专辑 ID (如 258535483，按回车解析)" style="flex:1;" bind:value={albumId} onkeydown={(e)=> e.key==='Enter' && loadAlbum()} />
      <button class="btn-primary inline-action-btn" onclick={loadAlbum}>解析<span class="pc-only-text">专辑</span></button>
    </div>
    {#if album}
      <div class="detail-header-card">
        <img src={album.coverImgUrl||album.picUrl||'/favicon.png'} alt="" class="detail-cover-img" />
        <div class="detail-header-info">
          <h4 class="detail-header-title">{album.name||'未知专辑'}</h4>
          <div class="detail-header-sub">歌手：{album.artist||'未知'} | 共 {album.songs?.length||0} 首</div>
          <div style="display:flex; gap:6px;">
            <button class="btn-primary" onclick={()=>showToast('下载专辑','info')}>🖥️ 下载到电脑</button>
            <button class="btn-primary" style="background:#22c55e;" onclick={()=>showToast('播放专辑','info')}>▶️ 播放专辑</button>
          </div>
        </div>
      </div>
      <ul class="data-list scrollable-list">
        {#each (album.songs||[]) as s, i}
          <li><strong>{i+1}. {s.name}</strong><span style="color:var(--text-muted);"> - {s.artist||''}</span></li>
        {/each}
      </ul>
    {:else}
      <div class="empty-placeholder-card"><div class="empty-icon">💽</div><div class="empty-title">在搜索中选择专辑或输入ID解析</div></div>
    {/if}
  </div>
</div>
