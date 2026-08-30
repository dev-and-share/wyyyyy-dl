<script lang="ts">
  let { track, currentTime, playing, onClose } = $props<{track:any, currentTime:number, playing:boolean, onClose:()=>void}>();
  type Lrc={time:number,text:string};
  function parseLrc(t:string):Lrc[]{
    if(!t) return [];
    const lines=t.split(/\r?\n/);
    const out:Lrc[]=[];
    const re=/\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    for(const line of lines){
      const m=re.exec(line);
      if(m){
        const min=parseInt(m[1]), sec=parseInt(m[2]), ms=parseInt(m[3]);
        const time=min*60+sec+(ms>99?ms/1000:ms/100);
        const text=line.replace(re,'').trim();
        if(text) out.push({time,text});
      }
    }
    return out;
  }
  let lrcs=$derived(parseLrc(track?.lyric||''));
  let activeIdx=$derived.by(()=>{
    let idx=-1;
    for(let i=0;i<lrcs.length;i++){ if(currentTime>=lrcs[i].time) idx=i; else break; }
    return idx;
  });
  $effect(()=>{ // auto scroll to active
    if(activeIdx>=0){
      setTimeout(()=>{
        document.getElementById(`lrc-${activeIdx}`)?.scrollIntoView({behavior:'smooth', block:'center'});
      },50);
    }
  });
</script>

<div class="lyric-modal-overlay" style="display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.65); backdrop-filter:blur(8px); z-index:10001; align-items:center; justify-content:center; padding:16px;" onclick={onClose}>
  <div class="lyric-modal-card" onclick={(e)=>e.stopPropagation()} style="background:rgba(15,23,42,0.96); border:1px solid rgba(255,255,255,0.12); border-radius:16px; width:100%; max-width:860px; max-height:85vh; overflow:hidden; display:flex; flex-direction:column;">
    <div class="lyric-modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.08);">
      <button onclick={onClose} style="background:none; border:none; color:#fff; font-size:18px; cursor:pointer;">🔽</button>
      <h3 style="margin:0; color:#fff; font-size:15px;">🎵 全屏沉浸播放</h3>
      <button onclick={onClose} style="background:none; border:none; color:#fff; font-size:18px; cursor:pointer;">✕</button>
    </div>
    <div style="display:flex; flex:1; overflow:hidden; flex-wrap:wrap;">
      <div style="flex:1; min-width:260px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; gap:12px; border-right:1px solid rgba(255,255,255,0.06);">
        <div style="width:200px; height:200px; border-radius:50%; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.5); border:3px solid rgba(255,255,255,0.12);">
          <img src={track?.cover||'/favicon.png'} alt="" style="width:100%; height:100%; object-fit:cover; animation:{playing?'spin 16s linear infinite':'none'};" />
        </div>
        <div style="text-align:center;">
          <div style="font-weight:700; color:#fff; font-size:16px; margin-bottom:4px;">{track?.name||'未在播放'}</div>
          <div style="color:#94a3b8; font-size:13px;">{track?.artist||'未知歌手'}</div>
        </div>
      </div>
      <div style="flex:1; min-width:300px; overflow:auto; padding:16px; max-height:60vh;" id="lyricModalContent">
        {#if lrcs.length}
          {#each lrcs as l,i}
            <div id="lrc-{i}" class="lrc-line" class:active={i===activeIdx} style="padding:6px 8px; border-radius:6px; margin:4px 0; cursor:pointer; color:{i===activeIdx?'#4ade80':'#cbd5e1'}; background:{i===activeIdx?'rgba(74,222,128,0.08)':'transparent'}; font-weight:{i===activeIdx?'600':'400'}; transition:all 0.2s;"
              onclick={()=> { const a=document.getElementById('globalAudioPlayer') as HTMLAudioElement; if(a) a.currentTime=l.time; }}>
              {l.text}
            </div>
          {/each}
        {:else}
          <pre style="white-space:pre-wrap; color:#94a3b8; font-size:13px; line-height:1.6;">{track?.lyric||'暂无歌词'}</pre>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  @keyframes spin{ from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
  .lrc-line.active{ background:rgba(74,222,128,0.12) !important; }
</style>
