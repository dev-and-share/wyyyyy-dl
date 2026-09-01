<script lang="ts">
  import { api } from '../lib/api';
  import { formatBytes } from '../lib/utils';
  let histKw=$state(''), histPage=$state(1), histList:any[]=$state([]), histStats:any=$state(null), histTotal=$state(0);
  let histTotalPages=$derived(Math.max(1, Math.ceil(histTotal/10)));
  async function loadHistory(p=1){
    histPage=p;
    const j=await api.historyList(histKw,p);
    histList=j?.data?.list||[]; histTotal=j?.data?.total||0;
    const s=await api.historyStats(); histStats=s?.data||null;
  }
  $effect(()=>{ loadHistory(1); });
  function copy(t:string){ navigator.clipboard?.writeText(t); }
</script>

<div class="accordion-card active">
  <div class="accordion-header"><h3 class="accordion-title">📥 2. 本地下载历史与文件管理</h3><span class="accordion-icon">▼</span></div>
  <div class="accordion-body">
    <div style="display:flex; flex-wrap:wrap; gap:8px; background:var(--stat-bar-bg); border:1px solid var(--border-subtle); padding:10px 12px; border-radius:8px; margin-bottom:10px; align-items:center; font-size:13px;">
      <span>已记录下载：<strong>{histStats?.totalCount ?? histTotal ?? 0}</strong> 首</span>
      <span>占用空间：<strong>{histStats?.totalSize ? formatBytes(histStats.totalSize) : '-'}</strong></span>
      {#if (histStats?.missingCount ?? 0) > 0}
        <span style="color:#ef4444;">⚠️ 文件缺失：{histStats.missingCount} 首</span>
      {/if}
      {#if (histStats?.nonMp3Count ?? 0) > 0}
        <span style="color:#f59e0b;">📁 非 MP3：{histStats.nonMp3Count} 首</span>
      {/if}
      <div style="margin-left:auto; display:flex; gap:6px;">
        <button class="btn-primary" onclick={()=>loadHistory(1)}>🔄 刷新</button>
        <button class="btn-primary" style="background:#6366f1;" onclick={()=>{ const v=prompt('搜索'); if(v!==null){ histKw=v; loadHistory(1); }}}>🔍 搜索</button>
      </div>
    </div>
    <div class="form-row" style="display:flex; gap:6px; margin-bottom:8px;">
      <input type="text" placeholder="🔍 搜索已下载歌曲 (按回车搜索)" style="flex:1;" bind:value={histKw} onkeydown={(e)=> e.key==='Enter' && loadHistory(1)} />
      <button class="btn-primary sp-hide-btn" onclick={()=>loadHistory(1)}>搜索</button>
    </div>
    <ul class="data-list scrollable-list">
      {#each histList as h}
        <li>
          <div style="flex:1; overflow:hidden;">
            <div style="font-weight:700; font-size:14px;">{h.songName||h.title}</div>
            <div style="font-size:12px; color:var(--text-secondary);">{h.artist||''} | {h.fileSize?formatBytes(h.fileSize):''} <span style="background:rgba(16,185,129,0.12); color:#4ade80; padding:1px 6px; border-radius:6px; font-size:11px;">{h.fileExists?'正常':'缺失'}</span></div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="tree-btn" style="background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); padding:5px 10px; border-radius:12px; font-size:11px;" onclick={()=>copy(h.hostFilePath||h.filePath)}>📂 定位</button>
            <button class="tree-btn" style="background:rgba(239,68,68,0.12); color:#f87171; border:1px solid rgba(239,68,68,0.25); padding:5px 10px; border-radius:12px; font-size:11px;">🗑️ 删除</button>
          </div>
        </li>
      {:else}
        <li style="justify-content:center; color:var(--text-muted);">暂无历史</li>
      {/each}
    </ul>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
      <button class="btn-primary" disabled={histPage<=1} onclick={()=>loadHistory(histPage-1)}>上一页</button>
      <span style="font-size:12px; color:var(--text-secondary);">第 {histPage} / 共 {histTotalPages} 页 (共 {histTotal} 条)</span>
      <button class="btn-primary" disabled={histPage>=histTotalPages} onclick={()=>loadHistory(histPage+1)}>下一页</button>
    </div>
  </div>
</div>
