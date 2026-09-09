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

  it('supports single-digit decimal timestamps like [00:31.0] (bugfix for 爱到这样)', () => {
    const lrc = `
[00:00.00] 作词 : 十一郎
[00:01.00] 作曲 : 张宇
[00:02.00] 编曲 : 涂惠源/徐德昌
[00:31.0]看着飞机降落飞起
[00:35.0]感觉心也在来回地死去
[01:35.0]
[01:58.0]看着飞机降落飞起
    `.trim();

    const parsed = parseLrc(lrc);
    // 空行 [01:35.0] 应被安全忽略，其余 5 行被正确解析
    expect(parsed.length).toBe(6);
    expect(parsed[0]).toEqual({ time: 0, text: '作词 : 十一郎' });
    expect(parsed[2]).toEqual({ time: 2, text: '编曲 : 涂惠源/徐德昌' });
    expect(parsed[3]).toEqual({ time: 31, text: '看着飞机降落飞起' });
    expect(parsed[4]).toEqual({ time: 35, text: '感觉心也在来回地死去' });
    expect(parsed[5]).toEqual({ time: 118, text: '看着飞机降落飞起' });
  });

  it('supports multiple timestamps per line and variable decimal precision', () => {
    const lrc = `
[01:00]整数秒歌词
[01:10.5]一位小数
[01:20.25]两位小数
[01:30.125]三位小数
[01:40:50]冒号分隔毫秒
[02:00.00][02:30.00]副歌重复两遍
    `.trim();

    const parsed = parseLrc(lrc);
    expect(parsed.length).toBe(7);
    expect(parsed.find((l) => l.text === '整数秒歌词')?.time).toBe(60);
    expect(parsed.find((l) => l.text === '一位小数')?.time).toBe(70.5);
    expect(parsed.find((l) => l.text === '两位小数')?.time).toBe(80.25);
    expect(parsed.find((l) => l.text === '三位小数')?.time).toBe(90.125);
    expect(parsed.find((l) => l.text === '冒号分隔毫秒')?.time).toBe(100.5);

    // 重复副歌应生成两个独立时间戳
    const chorusLines = parsed.filter((l) => l.text === '副歌重复两遍');
    expect(chorusLines.length).toBe(2);
    expect(chorusLines[0].time).toBe(120);
    expect(chorusLines[1].time).toBe(150);
  });
});
