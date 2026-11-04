/**
 * LRC 歌词解析引擎
 * 依托 pwa-audio-player core 提供的高性能歌词解析与二分检索实现。
 */

import { parseLrc as pwaParseLrc, getActiveLyric as pwaGetActiveLyric, type LyricLine } from 'pwa-audio-player';

export type LrcLine = LyricLine;

const WIN1252_REVERSE_MAP = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f]
]);

/**
 * 智能修复被误以 Latin-1/Windows-1252 解码的 UTF-8 中文乱码 (如 å¤šå°‘ -> 多少)
 */
export function fixLatin1Utf8Garbled(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';
  if (!/[äåæçèé]/.test(text)) return text;

  // 1. 尝试 Windows-1252 宽字符反向映射
  try {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      bytes[i] = WIN1252_REVERSE_MAP.get(code) ?? (code & 0xff);
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded;
    }
  } catch {}

  // 2. 尝试纯 ISO-8859-1 (Latin-1) 还原
  try {
    const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded;
    }
  } catch {}

  return text;
}

/**
 * 解析标准 LRC 歌词文本为带时间戳的歌词行数组
 */
export function parseLrc(text?: string | null): LrcLine[] {
  const cleaned = fixLatin1Utf8Garbled(text);
  return pwaParseLrc(cleaned || '');
}

/**
 * 根据当前播放时间检索当前正在唱的高亮行以及下一行预告
 */
export function getActiveLyric(
  lines: LrcLine[],
  currentTime: number
): { currentText: string; nextText: string; index: number } {
  const res = pwaGetActiveLyric(lines, currentTime);
  return {
    index: res.index,
    currentText: res.currentText || res.currentLine || '',
    nextText: res.nextText || res.nextLine || ''
  };
}
