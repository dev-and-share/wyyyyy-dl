import type { IMusicFreePlugin, IMusicFreeMediaSource } from '../types';
import { qqPlugin } from './qq';
import { kugouPlugin } from './kugou';

export { qqPlugin } from './qq';
export { kugouPlugin } from './kugou';

/**
 * 📦 官方原生内置插件列表
 * 拥有 100% 直连大厂 CDN 与官方接口能力，无任何第三方倒闭风险
 */
export const builtinPlugins: IMusicFreePlugin[] = [
  qqPlugin,
  kugouPlugin
];

function extractSafeString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') return item.trim();
        return (item.name || item.singerName || item.title || item.author_name || '').trim();
      })
      .filter(Boolean)
      .join(' / ')
      .trim();
  }
  if (typeof val === 'object') {
    return (val.name || val.title || val.singerName || val.author_name || '').trim();
  }
  return String(val).trim();
}

const UNKNOWN_ARTISTS = new Set(['未知歌手', '未知', '群星', 'various artists', 'unknown', 'unknown artist']);

function stripTitleDecorations(s: string): string {
  return s
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/（[^）]*）/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparable(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\-_·.'’"“”`~!@#$%^&*+=|<>?？，,。、:：;；/\\]/g, '')
    .trim();
}

function isKnownArtistName(artist: string): boolean {
  const clean = artist.trim().toLowerCase();
  return Boolean(clean) && !UNKNOWN_ARTISTS.has(clean);
}

function splitArtistTokens(artistStr: string): string[] {
  return artistStr
    .split(/[/、,;；&+]|(?:\s+(?:feat\.?|ft\.?|vs\.?|x)\s+)/i)
    .map((s) => normalizeComparable(stripTitleDecorations(s)))
    .filter(Boolean);
}

function isArtistTokenMatch(targetToken: string, candToken: string): boolean {
  if (!targetToken || !candToken) return false;
  if (targetToken === candToken) return true;
  if (targetToken.length >= 2 && candToken.length >= 2) {
    return targetToken.includes(candToken) || candToken.includes(targetToken);
  }
  return false;
}

function isCandidateArtistMatch(targetArtist: string, candArtist: string): boolean {
  const targetTokens = splitArtistTokens(targetArtist);
  const candTokens = splitArtistTokens(candArtist);
  if (targetTokens.length === 0) return true;
  if (candTokens.length === 0) return false;
  return targetTokens.some((t) => candTokens.some((c) => isArtistTokenMatch(t, c)));
}

function isDisallowedDerivative(candTitle: string, candArtist: string, targetTitle: string): boolean {
  const targetLower = targetTitle.toLowerCase();
  const combined = `${candTitle} ${candArtist}`.toLowerCase();
  const cnMarkers = ['翻唱', '伴奏', '铃声', '卡拉ok', '消音', '变速', '升调', '降调', 'dj版', '纯音乐'];
  for (const m of cnMarkers) {
    if (combined.includes(m) && !targetLower.includes(m)) return true;
  }
  const bracketed = `${candTitle} ${candArtist}`.match(/[(\[（【]([^)\]）】]+)[)\]）】]/g) || [];
  const enTagRe = /\b(cover|dj|remix|instrumental|karaoke|accompaniment|ringtone)\b/i;
  for (const b of bracketed) {
    if (enTagRe.test(b) && !enTagRe.test(targetLower)) return true;
  }
  if (/\bcover\s*(?:by|:|：)/i.test(combined) && !/\bcover\b/i.test(targetLower)) return true;
  if (/(?:^|\s)dj(?:\s|$)/i.test(candTitle) && !/\bdj\b/i.test(targetLower)) return true;
  return false;
}

function extractCandidateTitleVariants(candTitle: string): string[] {
  const variants = [candTitle, stripTitleDecorations(candTitle)];
  const dashIdx = candTitle.indexOf(' - ');
  if (dashIdx > 0) {
    const afterDash = candTitle.slice(dashIdx + 3).trim();
    if (afterDash) {
      variants.push(afterDash, stripTitleDecorations(afterDash));
    }
  }
  return variants.map(normalizeComparable).filter(Boolean);
}

function getDurationMs(track: any): number {
  const raw = track?.raw || track;
  const val = Number(track?.duration ?? track?.dt ?? raw?.duration ?? raw?.dt ?? 0);
  if (!val || isNaN(val) || val <= 0) return 0;
  return val < 10000 ? val * 1000 : val;
}

function scoreFallbackCandidate(
  cand: any,
  targetTitle: string,
  cleanTitle: string,
  targetArtist: string,
  hasKnownArtist: boolean,
  targetDurationMs: number
): number | null {
  if (!cand || cand.isVip === true) return null;
  const candTitle = extractSafeString(cand.title || cand.name || '');
  const candArtist = extractSafeString(cand.artist || cand.singer || '');
  if (!candTitle) return null;

  if (isDisallowedDerivative(candTitle, candArtist, targetTitle)) return null;

  if (hasKnownArtist && !isCandidateArtistMatch(targetArtist, candArtist)) {
    return null;
  }

  const targetExact = normalizeComparable(targetTitle);
  const targetClean = normalizeComparable(cleanTitle);
  const candVariants = extractCandidateTitleVariants(candTitle);
  const exactTitleMatch = candVariants.includes(targetExact);
  const cleanTitleMatch = targetClean ? candVariants.includes(targetClean) : false;
  if (!exactTitleMatch && !cleanTitleMatch) return null;

  const candDur = Number(cand.duration || 0);
  if (candDur > 0 && candDur < 30000) return null;
  if (targetDurationMs > 30000 && candDur > 0) {
    const diff = Math.abs(candDur - targetDurationMs);
    if (diff > Math.max(30000, targetDurationMs * 0.25)) {
      return null;
    }
  }

  let score = exactTitleMatch ? 100 : 80;
  const isLiveTarget = /\blive\b|现场/i.test(targetTitle);
  const isLiveCand = /\blive\b|现场/i.test(candTitle);
  if (!isLiveTarget && !isLiveCand) score += 50;
  if (targetDurationMs > 30000 && candDur > 0) {
    score -= Math.min(40, Math.floor(Math.abs(candDur - targetDurationMs) / 1000));
  }
  return score;
}

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

  // 3. 全网官方跨平台检索 (提取歌名与歌手，严格校验歌名与歌手一致，严防同名异曲串台)
  const rawTitle = raw.name || raw.title || raw.songName || track.name || track.title || '';
  const rawArtist = raw.artist || raw.singer || raw.author || track.artist || '';
  const title = extractSafeString(rawTitle);
  const artist = extractSafeString(rawArtist);
  if (!title) return null;

  const cleanTitle = stripTitleDecorations(title) || title;
  const hasKnownArtist = isKnownArtistName(artist);
  const primaryArtist = hasKnownArtist ? artist.split(/[/、,;；&+]/)[0].trim() : '';
  const targetDurationMs = getDurationMs(track);

  const candidateQueries = hasKnownArtist
    ? Array.from(new Set([
        `${cleanTitle} ${artist}`.trim(),
        `${cleanTitle} ${primaryArtist}`.trim(),
        `${title} ${artist}`.trim()
      ])).filter(Boolean)
    : Array.from(new Set([cleanTitle, title])).filter(Boolean);

  // 优先在酷狗与 QQ 音乐开放官方源中进行检索匹配
  const fallbackSources = [kugouPlugin, qqPlugin];
  for (const plugin of fallbackSources) {
    for (const q of candidateQueries) {
      try {
        const searchRes = await plugin.search?.(q, 1, 'music');
        const list = searchRes?.data || [];
        const scoredCandidates = list
          .map((it: any) => ({
            item: it,
            score: scoreFallbackCandidate(it, title, cleanTitle, artist, hasKnownArtist, targetDurationMs)
          }))
          .filter((entry): entry is { item: any; score: number } => entry.score !== null)
          .sort((a, b) => b.score - a.score);

        for (const { item: matched } of scoredCandidates) {
          try {
            const media = await plugin.getMediaSource?.(matched, 'standard');
            if (media?.url) {
              console.info(
                `[BuiltinPlugins] 跨源智能官方兜底成功: "${title}" (${artist || '未知'}) -> ${plugin.platform} [${matched.title} - ${matched.artist}] (关键词: "${q}")`
              );
              return media;
            }
          } catch {
            // 当前候选曲目获取直链失败（如版权付费），继续尝试下一条合规候选
          }
        }
      } catch {
        // 单个关键词尝试失败继续
      }
    }
  }

  return null;
}
