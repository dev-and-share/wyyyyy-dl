<script lang="ts">
  let { onClose } = $props<{onClose:()=>void}>();
  type Band = { freq: number, gain: number, q: number, label: string, desc: string };
  let enabled = $state(true);
  let bands = $state<Band[]>([
    { freq: 60, gain: 0, q: 1.4, label: '低频下潜', desc: '60Hz' },
    { freq: 230, gain: 0, q: 1.4, label: '去箱声/闷', desc: '230Hz' },
    { freq: 910, gain: 0, q: 2.0, label: '人声主体', desc: '910Hz' },
    { freq: 3600, gain: 0, q: 2.5, label: '细节提亮', desc: '3.6kHz' },
    { freq: 14000, gain: 0, q: 0.7, label: '空气感', desc: '14kHz' },
  ]);
  let preset = $state('flat');

  const BUILTIN_PRESETS: Record<string, { name: string, desc: string, bands: { freq: number, gain: number, q: number }[] }> = {
    flat: {
      name: '平直原音 (Flat)',
      desc: '原汁原味无调色',
      bands: [
        { freq: 60, gain: 0, q: 1.4 },
        { freq: 230, gain: 0, q: 1.4 },
        { freq: 910, gain: 0, q: 2.0 },
        { freq: 3600, gain: 0, q: 2.5 },
        { freq: 14000, gain: 0, q: 0.7 }
      ]
    },
    macbook: {
      name: 'MacBook 外放校正 (去箱鸣)',
      desc: '削弱 130Hz 浑浊共振，补偿 60Hz 与 14kHz 空气感',
      bands: [
        { freq: 60, gain: 2.5, q: 1.4 },
        { freq: 230, gain: -3.5, q: 2.0 },
        { freq: 910, gain: 0, q: 2.0 },
        { freq: 3600, gain: 1.5, q: 2.2 },
        { freq: 14000, gain: 2.0, q: 0.7 }
      ]
    },
    vocal: {
      name: '人声毒药 (清澈温暖)',
      desc: '清理 230Hz 箱鸣，提亮 3.6kHz 人声细节并平抑齿音',
      bands: [
        { freq: 60, gain: -0.5, q: 1.4 },
        { freq: 230, gain: -2.0, q: 1.8 },
        { freq: 910, gain: 1.5, q: 1.8 },
        { freq: 3600, gain: 2.5, q: 2.2 },
        { freq: 14000, gain: -1.5, q: 1.2 }
      ]
    },
    bass: {
      name: '澎湃重低音 (Bass Boost)',
      desc: '强劲极低频下潜，适度收敛中低频防浑浊',
      bands: [
        { freq: 60, gain: 5.0, q: 1.2 },
        { freq: 230, gain: -1.0, q: 1.4 },
        { freq: 910, gain: 0, q: 2.0 },
        { freq: 3600, gain: 1.0, q: 2.0 },
        { freq: 14000, gain: 1.0, q: 0.7 }
      ]
    },
    air: {
      name: '通透耳机 (Headphone Air)',
      desc: '提升 14kHz 极高频空气感与开阔声场',
      bands: [
        { freq: 60, gain: 1.5, q: 1.4 },
        { freq: 230, gain: -1.0, q: 1.4 },
        { freq: 910, gain: 0.5, q: 2.0 },
        { freq: 3600, gain: 2.0, q: 2.5 },
        { freq: 14000, gain: 3.5, q: 0.7 }
      ]
    }
  };

  function applyPreset(v: string) {
    preset = v;
    const target = BUILTIN_PRESETS[v];
    if (target && target.bands) {
      bands = bands.map((b, i) => ({
        ...b,
        gain: target.bands[i]?.gain ?? 0,
        q: target.bands[i]?.q ?? b.q
      }));
    }
  }

  function reset() {
    applyPreset('flat');
  }
  // Web Audio graph (simplified, no actual connection for MVP, but UI ready)
  let canvas:HTMLCanvasElement;
  $effect(()=>{
    if(!canvas) return;
    const ctx=canvas.getContext('2d'); if(!ctx) return;
    const w=canvas.width=canvas.clientWidth*2, h=canvas.height=120*2;
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle='rgba(74,222,128,0.3)'; ctx.lineWidth=1;
    // grid
    for(let i=0;i<=4;i++){ const y=h/4*i; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    // curve
    ctx.strokeStyle='#4ade80'; ctx.lineWidth=3; ctx.beginPath();
    const step=w/40;
    for(let i=0;i<=40;i++){
      const x=i*step;
      // simple sum of gains
      let y=h/2;
      bands.forEach(b=>{ const idx=Math.log2(b.freq/60)/Math.log2(14000/60)*40; const dist=Math.abs(i-idx); const gain=b.gain*10; y -= gain*Math.exp(-dist*dist/20); });
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  });
</script>

<div style="position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:10002; display:flex; align-items:flex-end; justify-content:center;" onclick={onClose}>
  <div onclick={(e)=>e.stopPropagation()} style="background:rgba(15,23,42,0.98); border:1px solid rgba(255,255,255,0.12); border-radius:16px 16px 0 0; width:100%; max-width:720px; max-height:85vh; overflow:auto; padding:16px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <h3 style="margin:0; color:#fff;">🎛️ 5 段参量均衡器 (PEQ)</h3>
      <button onclick={onClose} style="background:none; border:none; color:#fff; font-size:18px; cursor:pointer;">✕</button>
    </div>
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap;">
      <label style="display:flex; align-items:center; gap:6px; color:#cbd5e1; font-size:13px;"><input type="checkbox" checked={enabled} onchange={(e)=>enabled=(e.target as HTMLInputElement).checked} /> ⚡ 启用</label>
      <select value={preset} onchange={(e)=>applyPreset((e.target as HTMLSelectElement).value)} style="padding:6px 10px; border-radius:8px; background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.12);">
        {#each Object.entries(BUILTIN_PRESETS) as [k, item]}
          <option value={k}>{item.name}</option>
        {/each}
      </select>
      {#if BUILTIN_PRESETS[preset]}
        <span style="font-size:11px; color:#94a3b8; margin-left:4px;">💡 {BUILTIN_PRESETS[preset].desc}</span>
      {/if}
      <span style="margin-left:auto; font-size:11px; color:#64748b;">5段频率/增益/Q 全可调</span>
    </div>
    <div style="background:rgba(0,0,0,0.3); border-radius:12px; padding:8px; margin-bottom:12px;">
      <canvas bind:this={canvas} style="width:100%; height:120px; display:block; border-radius:8px;"></canvas>
    </div>
    <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:8px;">
      {#each bands as b,i}
        <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px 8px; text-align:center;">
          <div style="font-size:11px; color:#94a3b8; margin-bottom:4px;">{b.label}</div>
          <div style="font-size:10px; color:#64748b;">{b.freq}Hz</div>
          <input type="range" min="-12" max="12" step="0.5" value={b.gain} oninput={(e)=>{ bands[i].gain=parseFloat((e.target as HTMLInputElement).value); bands=bands; }} style="width:100%; margin:6px 0;" />
          <div style="font-size:11px; color:{b.gain>0?'#4ade80':b.gain<0?'#f87171':'#94a3b8'};">{b.gain>0?'+':''}{b.gain}dB</div>
          <div style="margin-top:6px;">
            <div style="font-size:10px; color:#64748b;">Q {b.q.toFixed(1)}</div>
            <input type="range" min="0.5" max="3" step="0.1" value={b.q} oninput={(e)=>{ bands[i].q=parseFloat((e.target as HTMLInputElement).value); bands=bands; }} style="width:100%;" />
          </div>
          <div style="font-size:10px; color:#64748b; margin-top:4px;">{b.freq}Hz</div>
        </div>
      {/each}
    </div>
    <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
      <button onclick={reset} style="padding:7px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.06); color:#fff; font-size:12px; cursor:pointer;">🔄 重置</button>
      <button onclick={onClose} style="margin-left:auto; padding:7px 12px; border-radius:8px; border:none; background:#ef4444; color:#fff; font-size:12px; cursor:pointer;">✕ 完成关闭</button>
    </div>
  </div>
</div>
