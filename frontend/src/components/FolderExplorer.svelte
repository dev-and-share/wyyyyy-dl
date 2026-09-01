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
      <button class={curRoot?.path===r.path ? 'btn-primary' : 'btn-secondary'} onclick={()=>selectRoot(r)}
        style="padding:5px 12px; border-radius:14px; font-size:12px; font-weight:600; cursor:pointer;">
        {r.name.includes('外部')?'📦 '+r.name: '📁 '+r.name}
      </button>
    {/each}
  </div>

  <!-- 树形全局控制与搜索 Bar -->
  <div class="tree-control-bar" style="margin-bottom:10px;">
    <div class="tree-search-wrap" style="margin-bottom:6px;">
      <input type="text" class="tree-filter-input" style="width:100%; box-sizing:border-box;" placeholder="🔍 搜索过滤曲目 / 歌手 / 文件夹..." bind:value={filterKw} />
    </div>
    <div class="tree-global-actions" style="display:flex; gap:6px; flex-wrap:wrap;">
      <button class="btn-secondary" style="padding:4px 10px; font-size:12px;" onclick={()=>expanded=new Set(tree.filter((t:any)=>t.directory).map((t:any)=>t.path))} title="展开所有子文件夹">📂 全部展开</button>
      <button class="btn-secondary" style="padding:4px 10px; font-size:12px;" onclick={()=>expanded.clear()} title="折叠所有子文件夹">📁 全部折叠</button>
      <button class="btn-secondary" style="padding:4px 10px; font-size:12px;" onclick={()=> curRoot && loadBrowse(curRoot.path,true)} title="刷新整库">🔄 刷新</button>
    </div>
  </div>

  <!-- 根统计 -->
  {#if curRoot}
    <div style="background:var(--stat-bar-bg); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-weight:700; color:var(--text-main);">📁 {curRoot.name}</span>
        <span style="background:var(--btn-slot-bg); border:1px solid var(--btn-slot-border); padding:2px 8px; border-radius:12px; font-size:11px; color:var(--text-muted);">{tree.filter((t:any)=>t.directory).length}目录 · {tree.filter((t:any)=>!t.directory).length}首</span>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn-primary" style="padding:5px 12px; font-size:12px;" onclick={()=>playFolder(curRoot.path, curRoot.name)}>▶ 连播整库</button>
        <button class="btn-secondary sp-hide" style="padding:5px 12px; font-size:12px;" onclick={()=>playFolder(curRoot.path, curRoot.name)}>➕ 追加</button>
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
