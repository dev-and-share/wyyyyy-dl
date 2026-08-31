// Svelte 5 Runes 播放器核心状态，复用原 player-core.js 状态机
export type Track = { id:number|string, name:string, artist:string, cover:string, url?:string, lyric?:string };

export const queue = $state<Track[]>([]);
export const playerState = $state({ qIndex:0, playMode:'list' as 'list'|'single'|'shuffle', volume:0.8 });
const _curTrack = $derived(queue[playerState.qIndex] ?? null);
export function getCurTrack(){ return _curTrack; }

export function setQueue(tracks:Track[], idx=0){ queue.length=0; queue.push(...tracks); playerState.qIndex=idx; }
export function next(){ if(!queue.length) return; if(playerState.playMode==='shuffle') playerState.qIndex=Math.floor(Math.random()*queue.length); else playerState.qIndex=(playerState.qIndex+1)%queue.length; }
export function prev(){ if(!queue.length) return; playerState.qIndex=(playerState.qIndex-1+queue.length)%queue.length; }

// 持久化由 App.svelte onMount/$effect 统一处理，避免 effect_orphan
export function hydrateQueue(){
  if(typeof localStorage==='undefined') return;
  try{
    const raw=localStorage.getItem('svelte_queue');
    if(raw){ const p=JSON.parse(raw); if(p?.queue?.length){ queue.length=0; queue.push(...p.queue); playerState.qIndex=p.qIndex||0; playerState.playMode=p.playMode||'list'; }}
  }catch{}
}
export function persistQueue(){
  if(typeof localStorage==='undefined') return;
  try{ localStorage.setItem('svelte_queue', JSON.stringify({queue, qIndex:playerState.qIndex, playMode:playerState.playMode})) }catch{}
}
