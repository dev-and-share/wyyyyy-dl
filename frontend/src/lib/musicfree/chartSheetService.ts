import type { InstalledPluginRecord } from './types';

/**
 * 跨插件获取各音源官方排行榜数据
 */
export async function fetchTopListsAcrossPlugins(
  plugins: InstalledPluginRecord[],
  pluginId?: string
): Promise<Array<{
  pluginId: string;
  pluginName: string;
  subGroups: Array<{ groupTitle: string; charts: any[] }>;
}>> {
  const targets = pluginId
    ? plugins.filter((p) => p.id === pluginId && p.enabled)
    : plugins.filter((p) => p.enabled);

  const results: Array<{
    pluginId: string;
    pluginName: string;
    subGroups: Array<{ groupTitle: string; charts: any[] }>;
  }> = [];

  for (const pluginRec of targets) {
    const inst = pluginRec.instance;
    if (inst && typeof inst.getTopLists === 'function') {
      try {
        const list = await inst.getTopLists();
        if (Array.isArray(list) && list.length > 0) {
          const subGroups: Array<{ groupTitle: string; charts: any[] }> = [];

          for (const item of list) {
            if (item && Array.isArray(item.data)) {
              const validCharts = item.data.filter((c: any) => c && (c.id != null || c.topId != null));
              if (validCharts.length > 0) {
                subGroups.push({
                  groupTitle: item.title || '精选榜单',
                  charts: validCharts
                });
              }
            } else if (item && (item.id != null || item.topId != null)) {
              let defaultGroup = subGroups.find((g) => g.groupTitle === '官方排行榜');
              if (!defaultGroup) {
                defaultGroup = { groupTitle: '官方排行榜', charts: [] };
                subGroups.push(defaultGroup);
              }
              defaultGroup.charts.push(item);
            }
          }

          if (subGroups.length > 0) {
            results.push({
              pluginId: pluginRec.id,
              pluginName: pluginRec.name,
              subGroups
            });
          }
        }
      } catch (e) {
        console.warn(`[MusicFree] 获取 ${pluginRec.name} 排行榜失败:`, e);
      }
    }
  }
  return results;
}

/**
 * 获取排行榜详情（曲目列表）- 深度容错安全包装
 */
export async function fetchTopListDetail(
  plugins: InstalledPluginRecord[],
  pluginId: string,
  topListItem: any
): Promise<any> {
  const record = plugins.find((p) => p.id === pluginId);
  if (!record || !record.instance || typeof record.instance.getTopListDetail !== 'function') {
    return { isEnd: true, musicList: [] };
  }
  if (!topListItem || (topListItem.id == null && !topListItem.topId)) {
    return { isEnd: true, musicList: [] };
  }
  try {
    const res = await record.instance.getTopListDetail(topListItem);
    const musicList = Array.isArray(res?.musicList) ? res.musicList : (Array.isArray(res) ? res : []);
    return {
      isEnd: typeof res?.isEnd === 'boolean' ? res.isEnd : false,
      musicList: musicList.filter((m: any) => m && (m.title || m.name))
    };
  } catch (e: any) {
    console.warn(`[MusicFree] 获取榜单详情异常: ${record.name}`, e?.message || e);
    return { isEnd: true, musicList: [] };
  }
}

/**
 * 获取歌单广场标签 - 深度容错安全包装
 */
export async function fetchRecommendSheetTags(
  plugins: InstalledPluginRecord[],
  pluginId: string
): Promise<any> {
  const record = plugins.find((p) => p.id === pluginId);
  if (!record || !record.instance || typeof record.instance.getRecommendSheetTags !== 'function') {
    return null;
  }
  try {
    return await record.instance.getRecommendSheetTags();
  } catch (e: any) {
    console.warn(`[MusicFree] 获取歌单标签异常: ${record.name}`, e?.message || e);
    return null;
  }
}

/**
 * 根据标签获取推荐歌单 - 深度容错安全包装
 */
export async function fetchRecommendSheetsByTag(
  plugins: InstalledPluginRecord[],
  pluginId: string,
  tag: any,
  page = 1
): Promise<any> {
  const record = plugins.find((p) => p.id === pluginId);
  if (!record || !record.instance || typeof record.instance.getRecommendSheetsByTag !== 'function') {
    return { isEnd: true, data: [] };
  }
  try {
    const res = await record.instance.getRecommendSheetsByTag(tag, page);
    const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    return {
      isEnd: typeof res?.isEnd === 'boolean' ? res.isEnd : data.length === 0,
      data: data.filter((item: any) => item && (item.title || item.name))
    };
  } catch (e: any) {
    console.warn(`[MusicFree] 获取推荐歌单异常: ${record.name}`, e?.message || e);
    return { isEnd: true, data: [], error: e?.message || String(e) };
  }
}

/**
 * 获取歌单详情与歌曲 - 深度容错安全包装
 */
export async function fetchMusicSheetInfo(
  plugins: InstalledPluginRecord[],
  pluginId: string,
  sheetItem: any,
  page = 1
): Promise<any> {
  const record = plugins.find((p) => p.id === pluginId);
  if (!record || !record.instance || typeof record.instance.getMusicSheetInfo !== 'function') {
    return { isEnd: true, musicList: [] };
  }
  try {
    const res = await record.instance.getMusicSheetInfo(sheetItem, page);
    const musicList = Array.isArray(res?.musicList) ? res.musicList : (Array.isArray(res) ? res : []);
    return {
      isEnd: typeof res?.isEnd === 'boolean' ? res.isEnd : false,
      musicList: musicList.filter((m: any) => m && (m.title || m.name))
    };
  } catch (e: any) {
    console.warn(`[MusicFree] 获取歌单曲目异常: ${record.name}`, e?.message || e);
    return { isEnd: true, musicList: [] };
  }
}
