import { describe, it, expect } from 'vitest';
import { parseLrc, getActiveLyric } from './lyricParser';

describe('lyricParser', () => {
  const sampleLrc = `
[00:00.00]作曲 : 周杰伦
[00:01.50]作词 : 方文山
[00:10.00]雨下整夜 我的爱溢出就像雨水
[00:15.50]院子落叶 跟我的思念厚厚一叠
[00:22.00]几句是非 也无法将我的热情冷却
  `.trim();

  it('parses lrc format into sorted timestamp array', () => {
    const lines = parseLrc(sampleLrc);
    expect(lines.length).toBe(5);
    expect(lines[0]).toEqual({ time: 0, text: '作曲 : 周杰伦' });
    expect(lines[2]).toEqual({ time: 10, text: '雨下整夜 我的爱溢出就像雨水' });
    expect(lines[3]).toEqual({ time: 15.5, text: '院子落叶 跟我的思念厚厚一叠' });
  });

  it('handles empty and malformed input safely', () => {
    expect(parseLrc('')).toEqual([]);
    expect(parseLrc(null)).toEqual([]);
    expect(parseLrc('纯文本没有任何时间戳\n第二行')).toEqual([]);
  });

  it('resolves active and next lyric text based on current playback time', () => {
    const lines = parseLrc(sampleLrc);

    // 前奏（在第一句之前）
    const intro = getActiveLyric(lines, -1);
    expect(intro.index).toBe(-1);
    expect(intro.currentText).toBe('');
    expect(intro.nextText).toBe('作曲 : 周杰伦');

    // 播到 12 秒（应匹配第 3 句，时间为 10.00）
    const active = getActiveLyric(lines, 12);
    expect(active.index).toBe(2);
    expect(active.currentText).toBe('雨下整夜 我的爱溢出就像雨水');
    expect(active.nextText).toBe('院子落叶 跟我的思念厚厚一叠');

    // 播到最后一句
    const last = getActiveLyric(lines, 30);
    expect(last.index).toBe(4);
    expect(last.currentText).toBe('几句是非 也无法将我的热情冷却');
    expect(last.nextText).toBe('');
  });
});
