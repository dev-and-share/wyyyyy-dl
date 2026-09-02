export function escapeHtml(s:string){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
export function formatTime(s:number){ if(isNaN(s)||s<0) return '00:00'; const m=Math.floor(s/60), sec=Math.floor(s%60); return `${m<10?'0'+m:m}:${sec<10?'0'+sec:sec}`}
export function formatBytes(b:number, d=2){ if(!b) return '0 B'; const k=1024, sizes=['B','KB','MB','GB']; const i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(d))+' '+sizes[i]}
export function getApiCache(key:string){ try{ const r=localStorage.getItem('pwa_api_cache_'+key); return r?JSON.parse(r):null }catch{return null}}
export function setApiCache(key:string, data:any){ try{ localStorage.setItem('pwa_api_cache_'+key, JSON.stringify({data, timestamp:Date.now()}))}catch{}}
export function deleteApiCache(key:string){ try{ localStorage.removeItem('pwa_api_cache_'+key)}catch{}}

/**
 * 检测是否为 iOS / iPadOS 设备环境
 * 注意：iOS Safari/Webview 对 HTML5 <audio> 的 volume 属性强制只读，无法通过 JS 调节，需由物理硬件按键控制。
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined' || !window.navigator) return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

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

export const DEFAULT_VINYL_COVER = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="48" fill="#18181b" stroke="#3f3f46" stroke-width="2"/>
  <circle cx="50" cy="50" r="42" fill="none" stroke="#27272a" stroke-width="0.8" stroke-dasharray="4 2"/>
  <circle cx="50" cy="50" r="36" fill="none" stroke="#27272a" stroke-width="0.8"/>
  <circle cx="50" cy="50" r="30" fill="none" stroke="#27272a" stroke-width="0.8" stroke-dasharray="3 1.5"/>
  <circle cx="50" cy="50" r="24" fill="none" stroke="#27272a" stroke-width="0.8"/>
  <circle cx="50" cy="50" r="18" fill="#ef4444"/>
  <circle cx="50" cy="50" r="6" fill="#18181b"/>
  <circle cx="50" cy="50" r="2.5" fill="#ffffff"/>
</svg>
`)}`;
