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
