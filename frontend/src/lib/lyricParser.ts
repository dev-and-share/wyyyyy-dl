export interface LrcLine {
  time: number;
  text: string;
}

/**
 * 解析标准 LRC 歌词文本为带时间戳的歌词行数组
 */
export function parseLrc(text?: string | null): LrcLine[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const out: LrcLine[] = [];
  const timeTagRe = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const line of lines) {
    timeTagRe.lastIndex = 0;
    const matches = Array.from(line.matchAll(timeTagRe));
    if (matches.length === 0) continue;

    const content = line.replace(timeTagRe, '').trim();
    if (!content) continue;

    for (const m of matches) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const fraction = m[3] ? parseFloat('0.' + m[3]) : 0;
      const time = min * 60 + sec + fraction;
      out.push({ time, text: content });
    }
  }

  // 严格按时间升序排序，防止时间戳乱序
  return out.sort((a, b) => a.time - b.time);
}

/**
 * 根据当前播放时间检索当前正在唱的高亮行以及下一行预告
 */
export function getActiveLyric(
  lines: LrcLine[],
  currentTime: number
): { currentText: string; nextText: string; index: number } {
  if (!lines || lines.length === 0) {
    return { currentText: '', nextText: '', index: -1 };
  }

  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    if (currentTime >= lines[i].time) {
      index = i;
    } else {
      break;
    }
  }

  const currentText = index >= 0 ? lines[index].text : '';
  const nextText = index + 1 < lines.length ? lines[index + 1].text : '';

  return { currentText, nextText, index };
}
