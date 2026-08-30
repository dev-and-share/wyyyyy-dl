<script lang="ts">
  import { api } from '../lib/api';
  let { onClose, onSuccess } = $props<{onClose:()=>void, onSuccess:(id?:string)=>void}>();
  let name=$state('');
  let isPrivate=$state(false);
  let loading=$state(false);
  async function submit(){
    if(!name.trim()) return;
    loading=true;
    try{
      const j=await api.playlistCreate(name.trim(), isPrivate);
      if(j.code==='000000'){
        onSuccess(j.data?.id);
        onClose();
      } else {
        alert(j.msg);
      }
    }catch(e){ alert('创建失败:'+e); }
    loading=false;
  }
</script>

<div style="position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); z-index:10002; display:flex; align-items:center; justify-content:center; padding:16px;" onclick={onClose}>
  <div onclick={(e)=>e.stopPropagation()} style="background:rgba(15,23,42,0.98); border:1px solid rgba(255,255,255,0.12); border-radius:16px; width:100%; max-width:520px; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.6);">
    <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="display:flex; align-items:center; gap:8px; font-weight:700; color:#fff; font-size:15px;"><span>➕</span> 新建自建歌单</div>
      <button onclick={onClose} style="background:none; border:none; color:#94a3b8; font-size:18px; cursor:pointer;">✕</button>
    </div>
    <div style="padding:18px;">
      <div style="margin-bottom:14px;">
        <div style="font-size:13px; color:#94a3b8; margin-bottom:6px;">歌单名称：</div>
        <input type="text" placeholder="输入歌单名称" bind:value={name} onkeydown={(e)=> e.key==='Enter' && submit()}
          style="width:100%; padding:10px 12px; border-radius:10px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; font-size:14px; outline:none;" />
      </div>
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; color:#cbd5e1;">
        <input type="checkbox" checked={isPrivate} onchange={(e)=>isPrivate=(e.target as HTMLInputElement).checked} style="width:16px; height:16px; accent-color:#3b82f6;" />
        设置为隐私歌单（仅自己可见）
      </label>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px; padding:12px 18px; border-top:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02);">
      <button onclick={onClose} style="padding:8px 16px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.06); color:#fff; font-size:13px; cursor:pointer;">取消</button>
      <button onclick={submit} disabled={loading || !name.trim()} style="padding:8px 18px; border-radius:8px; border:none; background:{loading||!name.trim()?'#334155':'#3b82f6'}; color:#fff; font-size:13px; font-weight:600; cursor:pointer; opacity:{loading||!name.trim()?0.6:1};">{loading?'创建中...':'立即创建'}</button>
    </div>
  </div>
</div>
