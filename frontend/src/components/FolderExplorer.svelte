<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import FolderNode from './FolderNode.svelte';

  let roots:any[] = $state([]);
  let curRoot:any = $state(null);
  let tree:any[] = $state([]);
  let filterKw=$state('');
  let expanded=new Set<string>();

  async function loadRoots(){
    try{ const j=await api.folderRoots(); roots=j?.data||[]; if(roots.length){ const def=roots.find((r:any)=>r.name.includes('外部'))||roots[0]; selectRoot(def);} }catch{}
  }
  async function selectRoot(r:any){
    curRoot=r; tree=[]; expanded.clear();
    await loadBrowse(r.path, true);
  }
  async function loadBrowse(path:string, isRoot=false){
    try{
      const j=await api.folderBrowse(path);
      const items=j?.data||[];
      if(isRoot) tree=items;
      // store in cache for counts
    }catch{}
  }

  // 子目录全体检查：递归展开/折叠
  function expandAll(){ document.querySelectorAll('[data-folder-node]').forEach(el=> (el as HTMLElement).click()); }
  function playFolder(path:string, name:string){
    api.folderTracks(path,true).then((j:any)=>{
      const tracks=j?.data||[];
      window.dispatchEvent(new CustomEvent('svelte:playFolder',{detail:{tracks, name}}));
    });
  }
  onMount(loadRoots);
</script>

<div>
  <!-- 根选择 -->
  <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
    {#each roots as r}
      <button class="folder-root-tab" class:active={curRoot?.path===r.path} onclick={()=>selectRoot(r)}
        style="padding:6px 12px; border-radius:16px; border:1px solid var(--border-color); background:{curRoot?.path===r.path?'#10b981':'var(--tag-btn-bg)'}; color:{curRoot?.path===r.path?'#fff':'var(--text-secondary)'}; font-size:12px; font-weight:600; cursor:pointer;">
        {r.name.includes('外部')?'📦 '+r.name: '📁 '+r.name}
      </button>
    {/each}
  </div>

  <!-- 工具栏 -->
  <div class="tree-control-bar" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; background:var(--stat-bar-bg); border:1px solid var(--border-subtle); padding:8px 10px; border-radius:8px; margin-bottom:8px;">
    <div style="flex:1; min-width:200px; position:relative;">
      <input type="text" placeholder="🔍 搜索过滤曲目 / 歌手 / 文件夹..." bind:value={filterKw} style="width:100%; padding:7px 10px; border-radius:8px;" />
    </div>
    <div style="display:flex; gap:6px;">
      <button class="tree-tool-btn" onclick={()=>expanded=new Set(tree.filter((t:any)=>t.directory).map((t:any)=>t.path))} style="padding:6px 10px; border-radius:6px; border:1px solid var(--border-color); background:var(--tag-btn-bg); font-size:12px; cursor:pointer;">📂 全部展开</button>
      <button class="tree-tool-btn" onclick={()=>expanded.clear()} style="padding:6px 10px; border-radius:6px; border:1px solid var(--border-color); background:var(--tag-btn-bg); font-size:12px; cursor:pointer;">📁 全部折叠</button>
      <button class="tree-tool-btn" onclick={()=> curRoot && loadBrowse(curRoot.path,true)} style="padding:6px 10px; border-radius:6px; border:1px solid var(--border-color); background:var(--tag-btn-bg); font-size:12px; cursor:pointer;">🔄 刷新</button>
    </div>
  </div>

  <!-- 根统计 -->
  {#if curRoot}
    <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:10px; padding:10px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-weight:700;">📁 {curRoot.name}</span>
        <span style="background:rgba(16,185,129,0.15); padding:2px 8px; border-radius:12px; font-size:11px;">{tree.filter((t:any)=>t.directory).length}目录 · {tree.filter((t:any)=>!t.directory).length}首</span>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="tree-btn tree-btn-play" style="background:#10b981; color:#fff; padding:6px 12px; border-radius:8px; border:none; font-size:12px; cursor:pointer;" onclick={()=>playFolder(curRoot.path, curRoot.name)}>▶ 连播整库</button>
        <button class="tree-btn tree-btn-queue sp-hide" style="background:#8b5cf6; color:#fff; padding:6px 12px; border-radius:8px; border:none; font-size:12px; cursor:pointer;" onclick={()=>playFolder(curRoot.path, curRoot.name)}>➕ 追加</button>
      </div>
    </div>
  {/if}

  <!-- 列表：递归子树，支持折叠与 … 抽屉 -->
  <div style="border:1px solid var(--border-subtle); border-radius:10px; overflow:hidden; background:var(--card-bg);">
    {#each tree.filter((t:any)=> !filterKw || (t.name+t.path).toLowerCase().includes(filterKw.toLowerCase())) as item}
      <FolderNode item={item} level={0} onPlay={playFolder} />
    {:else}
      <div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">暂无目录 · 试试切换根或刷新</div>
    {/each}
  </div>
</div>

<style>
  @media (max-width: 768px){
    .sp-hide{ display:none !important; }
    .sp-show{ display:inline-flex !important; }
  }
  @media (min-width: 769px){
    .sp-show{ display:none !important; }
  }
</style>
