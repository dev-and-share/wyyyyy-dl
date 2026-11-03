import type { IMusicFreePlugin, IMusicFreeMediaSource } from '../types';
import { qqPlugin } from './qq';
import { kuwoPlugin } from './kuwo';
import { kugouPlugin } from './kugou';

export { qqPlugin } from './qq';
export { kuwoPlugin } from './kuwo';
export { kugouPlugin } from './kugou';

/**
 * 📦 官方原生内置插件列表
 * 拥有 100% 直连大厂 CDN 与官方接口能力，无任何第三方倒闭风险
 */
export const builtinPlugins: IMusicFreePlugin[] = [
  qqPlugin,
  kuwoPlugin,
  kugouPlugin
];

/**
 * 🛡️ 跨源智能官方直链兜底
 * 当任意第三方插件因外部接口 502/503 或 VIP 限制失败时，自动利用官方内置插件池进行秒级无感补位
 */
export async function resolveFallbackFromBuiltins(track: any): Promise<IMusicFreeMediaSource | null> {
  const raw = track.raw || track;

  // 1. 若本身含有酷狗 Hash，直接用官方酷狗插件直取
  const rawHash = raw.hash || raw['320hash'] || raw.sqhash;
  if (typeof rawHash === 'string' && /^[0-9a-fA-F]{32}$/.test(rawHash)) {
    try {
      const res = await kugouPlugin.getMediaSource?.({ id: rawHash, raw }, 'standard');
      if (res?.url) return res;
    } catch {}
  }

  // 2. 若含有 QQ 音乐 songmid，直接用官方 QQ 插件直取 (当前若正是 QQ 抛出的兜底则跳过避免重复)
  const isFromQQ = (track._pluginHash && String(track._pluginHash).includes('qq')) ||
    (raw._pluginPlatform && String(raw._pluginPlatform).includes('QQ'));
  if (!isFromQQ) {
    const songmid = raw.songmid || (typeof raw.id === 'string' && raw.id.startsWith('00') && raw.id.length === 14 ? raw.id : null);
    if (songmid) {
      try {
        const res = await qqPlugin.getMediaSource?.({ id: songmid, raw }, 'standard');
        if (res?.url) return res;
      } catch {}
    }
  }

  // 3. 全网官方跨平台检索 (提取歌名与歌手)
  const title = (raw.name || raw.title || raw.songName || track.name || track.title || '').trim();
  const artist = (raw.artist || raw.singer || raw.author || track.artist || '').trim();
  if (!title) return null;

  const cleanTitle = title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/（[^）]*）/g, '').trim();
  const candidateQueries = Array.from(new Set([
    `${cleanTitle} ${artist}`.trim(),
    cleanTitle,
    `${title} ${artist}`.trim(),
    title
  ])).filter(Boolean);

  // 优先在酷狗与酷我两大开放官方源中进行检索匹配
  const fallbackSources = [kugouPlugin, kuwoPlugin];
  for (const plugin of fallbackSources) {
    for (const q of candidateQueries) {
      try {
        const searchRes = await plugin.search?.(q, 1, 'music');
        const list = searchRes?.data || [];
        if (list.length > 0) {
          const matched = list.find((it: any) => {
            const sName = (it.title || '').toLowerCase();
            return sName.includes(cleanTitle.toLowerCase());
          }) || list[0];

          if (matched) {
            const media = await plugin.getMediaSource?.(matched, 'standard');
            if (media?.url) {
              console.info(`[BuiltinPlugins] 跨源智能官方兜底成功: "${title}" -> ${plugin.platform} (关键词: "${q}")`);
              return media;
            }
          }
        }
      } catch (err) {
        // 单个关键词尝试失败继续
      }
    }
  }

  return null;
}
