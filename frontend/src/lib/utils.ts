export function escapeHtml(s:string){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
export function formatTime(s:number){ if(isNaN(s)||s<0) return '00:00'; const m=Math.floor(s/60), sec=Math.floor(s%60); return `${m<10?'0'+m:m}:${sec<10?'0'+sec:sec}`}
export function formatBytes(b:number, d=2){ if(!b) return '0 B'; const k=1024, sizes=['B','KB','MB','GB']; const i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(d))+' '+sizes[i]}
export function getApiCache(key:string){ try{ const r=localStorage.getItem('pwa_api_cache_'+key); return r?JSON.parse(r):null }catch{return null}}
export function setApiCache(key:string, data:any){ try{ localStorage.setItem('pwa_api_cache_'+key, JSON.stringify({data, timestamp:Date.now()}))}catch{}}
export function deleteApiCache(key:string){ try{ localStorage.removeItem('pwa_api_cache_'+key)}catch{}}
