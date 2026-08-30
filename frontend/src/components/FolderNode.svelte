<script lang="ts">
  import { api } from '../lib/api';
  let { item, level=0, onPlay } = $props<{item:any, level?:number, onPlay:(path:string,name:string)=>void}>();
  let expanded=$state(false);
  let children:any[] = $state([]);
  let loaded=$state(false);
  let loading=$state(false);
  let showSheet=$state(false);

  async function toggle(){
    if(!item.directory) return;
    if(!expanded && !loaded){
      loading=true;
      try{ const j=await api.folderBrowse(item.path); children=j?.data||[]; loaded=true; }catch{}
      loading=false;
    }
    expanded=!expanded;
  }
  function handlePlay(){ onPlay(item.path, item.name); }
</script>

<div style="margin-left:{level*14}px; border-left:{level>0?'1px dashed rgba(255,255,255,0.08)':'none'}; padding-left:{level>0?'8px':'0'};">
  <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-bottom:1px solid var(--border-subtle); gap:8px; background:{expanded?'rgba(16,185,129,0.04)':'transparent'};">
    <div style="flex:1; display:flex; align-items:center; gap:6px; overflow:hidden; cursor:{item.directory?'pointer':'default'};" onclick={toggle}>
      {#if item.directory}
        <span style="font-size:10px; width:12px; text-align:center; color:var(--text-muted);">{expanded?'▼':'▶'}</span>
        <span style="font-size:14px;">{expanded?'📂':'📁'}</span>
      {:else}
        <span style="width:12px;"></span><span>🎵</span>
      {/if}
      <span style="font-weight:{item.directory?600:500}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{item.name}</span>
      {#if item.directory && item.trackCount}<span style="background:rgba(16,185,129,0.12); padding:1px 6px; border-radius:10px; font-size:11px; color:#4ade80;">{item.trackCount}首</span>{/if}
      {#if !item.directory && item.size}<span style="color:var(--text-muted); font-size:11px;">{item.size}</span>{/if}
    </div>
    <div style="display:flex; gap:5px; flex-shrink:0; flex-wrap:wrap;">
      {#if item.directory}
        {#if item.trackCount>0}
          <button class="tree-btn" style="background:#10b981; color:#fff; padding:4px 8px; border-radius:8px; border:none; font-size:11px; cursor:pointer;" onclick={(e)=>{e.stopPropagation(); handlePlay();}}>▶ 连播</button>
          <button class="sp-hide" style="background:#8b5cf6; color:#fff; padding:4px 8px; border-radius:8px; border:none; font-size:11px; cursor:pointer;" onclick={(e)=>{e.stopPropagation(); handlePlay();}}>➕ 追加</button>
        {/if}
        {#if item.hostPath}<button class="sp-hide" style="background:#0284c7; color:#fff; padding:4px 8px; border-radius:8px; border:none; font-size:11px; cursor:pointer;" onclick={(e)=>{e.stopPropagation(); alert(item.hostPath);}}>📂 定位</button>{/if}
        <button class="sp-hide" style="background:#f59e0b; color:#fff; padding:4px 8px; border-radius:8px; border:none; font-size:11px;" onclick={(e)=>{e.stopPropagation(); toggle();}}>🔄</button>
        <button class="sp-hide" style="background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.25); padding:4px 6px; border-radius:8px; font-size:11px;" onclick={(e)=>{e.stopPropagation(); alert('忽略 '+item.name);}}>🚫</button>
        <button class="sp-hide" style="background:#ef4444; color:#fff; padding:4px 6px; border-radius:8px; border:none; font-size:11px;" onclick={(e)=>{e.stopPropagation(); if(confirm('删除 '+item.name+'?')) alert('删除');}}>🗑️</button>
        <button class="sp-show" style="background:var(--tag-btn-bg); border:1px solid var(--border-color); padding:4px 8px; border-radius:8px; font-size:11px;" onclick={(e)=>{e.stopPropagation(); showSheet=true;}}>···</button>
      {:else}
        <button style="background:#10b981; color:#fff; padding:4px 8px; border-radius:8px; border:none; font-size:11px; cursor:pointer;" onclick={(e)=>{e.stopPropagation(); handlePlay();}}>▶ 播放</button>
        <button class="sp-show" style="background:var(--tag-btn-bg); border:1px solid var(--border-color); padding:4px 8px; border-radius:8px; font-size:11px;" onclick={(e)=>{e.stopPropagation(); showSheet=true;}}>···</button>
      {/if}
    </div>
  </div>
  {#if item.directory && expanded}
    <div style="margin-left:6px;">
      {#if loading}<div style="padding:8px 12px; color:var(--text-muted); font-size:12px;">加载中...</div>
      {:else if children.length===0}<div style="padding:8px 12px; color:var(--text-muted); font-size:12px; padding-left:{(level+1)*14+20}px;">(空)</div>
      {:else}
        {#each children as child}
          <svelte:self item={child} level={level+1} onPlay={onPlay} />
        {/each}
      {/if}
    </div>
  {/if}
</div>

{#if showSheet}
  <div style="position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:10003; display:flex; align-items:flex-end; justify-content:center;" onclick={()=>showSheet=false}>
    <div style="background:var(--card-bg-solid); border-radius:16px 16px 0 0; width:100%; max-width:500px; padding:16px; max-height:70vh; overflow:auto;" onclick={(e)=>e.stopPropagation()}>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div><div style="font-weight:700;">{item.directory?'📁 ':'🎵 '}{item.name}</div><div style="font-size:11px; color:var(--text-muted);">{item.path}</div></div>
        <button onclick={()=>showSheet=false} style="background:none; border:none; font-size:18px; cursor:pointer;">✕</button>
      </div>
      {#if item.directory}
        {#if item.trackCount>0}<button style="width:100%; padding:10px; margin-bottom:8px; border-radius:8px; border:none; background:#10b981; color:#fff; font-weight:600;" onclick={()=>{showSheet=false; handlePlay();}}>▶ 连播此文件夹 ({item.trackCount}首)</button>{/if}
        <button style="width:100%; padding:10px; margin-bottom:8px; border-radius:8px; border:1px solid var(--border-color); background:var(--tag-btn-bg); text-align:left;" onclick={()=>{showSheet=false; handlePlay();}}>➕ 追加到队列</button>
        {#if item.hostPath}<button style="width:100%; padding:10px; margin-bottom:8px; border-radius:8px; border:1px solid var(--border-color); background:var(--tag-btn-bg); text-align:left;" onclick={()=>{showSheet=false; alert(item.hostPath);}}>📂 定位</button>{/if}
        <button style="width:100%; padding:10px; margin-bottom:8px; border-radius:8px; border:1px solid var(--border-color); background:var(--tag-btn-bg); text-align:left;" onclick={()=>{showSheet=false; toggle();}}>🔄 刷新</button>
      {/if}
      <button style="width:100%; padding:10px; margin-bottom:8px; border-radius:8px; border:1px solid rgba(239,68,68,0.3); background:rgba(239,68,68,0.08); color:#ef4444; text-align:left;" onclick={()=>{showSheet=false; if(confirm('忽略 '+item.name+'?')) alert('忽略');}}>🚫 忽略此文件夹 (.musicignore)</button>
      <button style="width:100%; padding:10px; margin-bottom:8px; border-radius:8px; border:none; background:#ef4444; color:#fff; text-align:left;" onclick={()=>{showSheet=false; if(confirm('彻底删除 '+item.name+'?')) alert('删除');}}>🗑️ 彻底删除 (物理删除)</button>
      <button style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:var(--tag-btn-bg);" onclick={()=>showSheet=false}>取消</button>
    </div>
  </div>
{/if}

<style>
  @media (max-width:768px){ .sp-hide{ display:none !important; } }
  @media (min-width:769px){ .sp-show{ display:none !important; } }
</style>
