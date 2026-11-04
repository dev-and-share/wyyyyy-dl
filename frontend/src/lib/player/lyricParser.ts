/**
 * LRC 歌词解析引擎
 * 依托 pwa-audio-player core 提供的高性能歌词解析与二分检索实现。
 */

import { parseLrc as pwaParseLrc, getActiveLyric as pwaGetActiveLyric, type LyricLine } from 'pwa-audio-player';

export type LrcLine = LyricLine;

/**
 * 智能修复被误以 Latin-1/ISO-8859-1 解码的 UTF-8 中文乱码 (如 å¤šå°‘ -> 多少)
 */
export function fixLatin1Utf8Garbled(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';
  if (!/[äåæçèé]/.test(text)) return text;
  try {
    const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/[\u4e00-\u9fa5]/.test(decoded) && !/[\u4e00-\u9fa5]/.test(text)) {
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
