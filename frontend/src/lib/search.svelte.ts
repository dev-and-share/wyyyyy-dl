import { api } from './api';
export let kw=$state('');
export let sType=$state('1');
export let sLimit=$state('10');
export let sResults=$state<any[]>([]);
export async function doSearch(){
  if(!kw.trim()) throw new Error('请输入关键词');
  const j=await api.search(kw, sType, sLimit);
  if(j?.code && j.code!=='000000') throw new Error(j.msg || '搜索失败');
  const d=j?.data;
  if(Array.isArray(d)) sResults=d;
  else sResults = (d as any)?.songs||(d as any)?.albums||(d as any)?.playlists||(d as any)?.artists||(d as any)?.result||[];
  if(!sResults.length) throw new Error('无结果');
  return sResults;
}
