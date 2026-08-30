// Svelte 5 Runes 播放器核心状态，复用原 player-core.js 状态机
export type Track = { id:number|string, name:string, artist:string, cover:string, url?:string, lyric?:string };

export let queue = $state<Track[]>([]);
export let qIndex = $state(0);
export let playMode = $state<'list'|'single'|'shuffle'>('list');
export let volume = $state(0.8);
export const curTrack = $derived(queue[qIndex] ?? null);

export function setQueue(tracks:Track[], idx=0){ queue=tracks; qIndex=idx; }
export function next(){ if(!queue.length) return; if(playMode==='shuffle') qIndex=Math.floor(Math.random()*queue.length); else qIndex=(qIndex+1)%queue.length; }
export function prev(){ if(!queue.length) return; qIndex=(qIndex-1+queue.length)%queue.length; }

// 持久化
if(typeof localStorage!=='undefined'){
  try{
    const raw=localStorage.getItem('svelte_queue');
    if(raw){ const p=JSON.parse(raw); if(p?.queue?.length){ queue=p.queue; qIndex=p.qIndex||0; playMode=p.playMode||'list'; }}
  }catch{}
  $effect(()=>{ try{ localStorage.setItem('svelte_queue', JSON.stringify({queue,qIndex,playMode})) }catch{} });
}
