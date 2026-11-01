/**
 * LRC 歌词解析引擎
 * 依托 pwa-audio-player core 提供的高性能歌词解析与二分检索实现。
 */

import { parseLrc as pwaParseLrc, getActiveLyric as pwaGetActiveLyric, type LyricLine } from 'pwa-audio-player';

export type LrcLine = LyricLine;

/**
 * 解析标准 LRC 歌词文本为带时间戳的歌词行数组
 */
export function parseLrc(text?: string | null): LrcLine[] {
  return pwaParseLrc(text || '');
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
