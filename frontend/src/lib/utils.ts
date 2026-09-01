export function escapeHtml(s:string){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
export function formatTime(s:number){ if(isNaN(s)||s<0) return '00:00'; const m=Math.floor(s/60), sec=Math.floor(s%60); return `${m<10?'0'+m:m}:${sec<10?'0'+sec:sec}`}
export function formatBytes(b:number, d=2){ if(!b) return '0 B'; const k=1024, sizes=['B','KB','MB','GB']; const i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(d))+' '+sizes[i]}
export function getApiCache(key:string){ try{ const r=localStorage.getItem('pwa_api_cache_'+key); return r?JSON.parse(r):null }catch{return null}}
export function setApiCache(key:string, data:any){ try{ localStorage.setItem('pwa_api_cache_'+key, JSON.stringify({data, timestamp:Date.now()}))}catch{}}
export function deleteApiCache(key:string){ try{ localStorage.removeItem('pwa_api_cache_'+key)}catch{}}

export function formatArtist(trackOrArtist: any): string {
  if (!trackOrArtist) return '';
  if (typeof trackOrArtist === 'string') {
    const s = trackOrArtist.trim();
    if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';
    return s;
  }
  if (Array.isArray(trackOrArtist)) {
    return trackOrArtist
      .map((a: any) => (typeof a === 'string' ? a.trim() : (a?.name ? String(a.name).trim() : '')))
      .filter((n: string) => n && n.toLowerCase() !== 'null' && n.toLowerCase() !== 'undefined')
      .join('/');
  }
  if (typeof trackOrArtist === 'object') {
    const arList = trackOrArtist.ar || trackOrArtist.artists;
    if (Array.isArray(arList)) {
      const formatted = formatArtist(arList);
      if (formatted) return formatted;
    } else if (typeof arList === 'string') {
      const formatted = formatArtist(arList);
      if (formatted) return formatted;
    }
    const single = trackOrArtist.artist || trackOrArtist.ar_name;
    if (typeof single === 'string') {
      const formatted = formatArtist(single);
      if (formatted) return formatted;
    } else if (typeof single === 'object' && single?.name) {
      const formatted = formatArtist(single.name);
      if (formatted) return formatted;
    }
  }
  return '';
}
