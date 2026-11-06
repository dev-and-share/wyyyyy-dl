import type { InstalledPluginRecord } from './types';

export const INVALID_KEYWORD_BLACKLIST = [
  '歌曲宝', '书音', '6yueting', '好听轻音乐', '爱听', '种子', 'audiomack', '有声', '评书',
  'bilibili', '哔哩', 'b站', 'youtube', '快手', '视频'
];

export const PRIORITY_WEIGHTS: Record<string, number> = {
  'QQ音乐 (官方)': 101,
  '酷狗音乐 (官方)': 100,
  '小秋音乐': 99,
  'QQ音乐': 98,
  '小蜗音乐': 95,
  '酷我音乐': 94,
  '小狗音乐': 90,
  '酷狗音乐': 89,
  '网易音乐': 85,
  '小云音乐': 84,
  '猫耳FM': 80,
  '小蜜音乐': 75,
  '咪咕音乐': 74
};

function getWeight(name: string): number {
  const trimmed = (name || '').trim();
  if (PRIORITY_WEIGHTS[trimmed] !== undefined) return PRIORITY_WEIGHTS[trimmed];
  for (const [k, w] of Object.entries(PRIORITY_WEIGHTS)) {
    if (trimmed.includes(k)) return w;
  }
  return 0;
}

/**
 * 筛选并按照优先级排序可用于歌单广场的 MusicFree 插件
 */
export function filterAndSortSheetPlugins(
  plugins: InstalledPluginRecord[],
  emptyPluginIds: Set<string>
): InstalledPluginRecord[] {
  const seen = new Set<string>();
  const list = plugins.filter((p) => {
    if (!p.enabled || !p.instance || typeof p.instance.getRecommendSheetsByTag !== 'function') return false;
    const n = (p.name || '').trim();
    if (!n || seen.has(n) || emptyPluginIds.has(p.id)) return false;
    const lower = n.toLowerCase();
    if (INVALID_KEYWORD_BLACKLIST.some((kw) => lower.includes(kw.toLowerCase()))) {
      return false;
    }
    seen.add(n);
    return true;
  });

  return list.sort((a, b) => getWeight(b.name) - getWeight(a.name));
}

/**
 * 清洗分类标签标题中的 HTML 实体
 */
export function cleanTagTitle(raw: any): string {
  if (!raw) return '';
  return String(raw)
    .replace(/&#38;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .trim();
}

/**
 * 规范化歌单广场分类标签
 */
export function normalizeTags(rawTags: any): any[] {
  if (!rawTags) return [{ id: undefined, title: '全部' }];
  const list: any[] = [];
  const add = (item: any) => {
    if (item && (item.id != null || item.title || item.name)) {
      list.push({ id: item.id, title: cleanTagTitle(item.title || item.name) });
    }
  };
  if (Array.isArray(rawTags?.pinned)) rawTags.pinned.forEach(add);
  const container = Array.isArray(rawTags) ? rawTags : (Array.isArray(rawTags?.data) ? rawTags.data : []);
  for (const item of container) {
    if (item && Array.isArray(item.data)) item.data.forEach(add);
    else add(item);
  }
  const seen = new Set<string>();
  const unique = list.filter(t => !seen.has(`${t.id}_${t.title}`) && seen.add(`${t.id}_${t.title}`));
  if (!unique.some(t => t.title === '全部')) unique.unshift({ id: undefined, title: '全部' });
  return unique;
}

/**
 * 构建歌单广场标准曲目对象
 */
export function buildSheetTrack(
  t: any,
  selectedSheet: any,
  selectedPluginId: string,
  currentPluginName: string,
  adapter: any,
  defaultCover: string
) {
  const pluginId = selectedSheet?._pluginId || t?._pluginId || selectedPluginId;
  const rawId = t.id || t.rawId || Math.random().toString(36).substring(2, 9);
  const compoundId = `mf_${encodeURIComponent(currentPluginName || pluginId || 'sheet')}_${rawId}`;
  const rawTrack = { ...t, _pluginId: pluginId, _pluginPlatform: currentPluginName, _isMusicFree: true };
  return adapter.normalizeTrack(rawTrack, {
    id: compoundId,
    name: t.title || t.name,
    artist: t.artist,
    al: { name: t.album || '', picUrl: t.artwork || t.cover || defaultCover },
    cover: t.artwork || t.cover || defaultCover,
    raw: rawTrack,
    _isMusicFree: true,
    _pluginHash: pluginId
  });
}

/**
 * 提取并规范化推荐歌单列表
 */
export function extractSheets(res: any, pluginId: string): any[] {
  const rawData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
  return rawData
    .filter((item: any) => item && (item.title || item.name))
    .map((item: any) => ({ ...item, _pluginId: pluginId }));
}

/**
 * 提取并规范化歌单内歌曲列表
 */
export function extractSheetTracks(detail: any, pluginId: string, platformName: string): any[] {
  const rawTracks = Array.isArray(detail?.musicList) ? detail.musicList : (Array.isArray(detail) ? detail : []);
  return rawTracks.map((t: any) => ({
    ...t,
    _pluginId: pluginId,
    _pluginPlatform: platformName
  }));
}

