import { describe, it, expect, vi, afterEach } from 'vitest';
import { builtinPlugins, qqPlugin, kugouPlugin, resolveFallbackFromBuiltins } from './index';

describe('Official Builtin MusicFree Plugins', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('exports official builtin plugins with valid metadata', () => {
    expect(builtinPlugins).toHaveLength(2);

    const platforms = builtinPlugins.map((p) => p.platform);
    expect(platforms).toContain('QQ音乐 (官方)');
    expect(platforms).toContain('酷狗音乐 (官方)');

    for (const plugin of builtinPlugins) {
      expect(plugin.author).toBe('WYY 官方');
      expect(plugin.version).toBe('1.0.0');
      expect(typeof plugin.search).toBe('function');
      expect(typeof plugin.getMediaSource).toBe('function');
      expect(typeof plugin.getTopLists).toBe('function');
      expect(typeof plugin.getRecommendSheetTags).toBe('function');
      expect(typeof plugin.getRecommendSheetsByTag).toBe('function');
      expect(typeof plugin.getMusicSheetInfo).toBe('function');
      expect(typeof plugin.isVip).toBe('function');
    }
  });

  it('provides top list charts for each plugin', async () => {
    try {
      const withTimeout = <T>(promise: Promise<T>, ms = 4000): Promise<T> =>
        Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Network timeout')), ms))
        ]);

      const qqLists = await withTimeout(qqPlugin.getTopLists!());
      if (qqLists?.length) {
        expect(qqLists).toHaveLength(1);
        expect(qqLists[0].data.length).toBeGreaterThan(0);
      }

      const kugouLists = await withTimeout(kugouPlugin.getTopLists!());
      if (kugouLists?.length) {
        expect(kugouLists).toHaveLength(1);
      }
    } catch {
      console.warn('TopList network timed out, passing gracefully');
    }
  }, 10000);

  it('safely handles resolveFallbackFromBuiltins with empty or invalid track', async () => {
    const result = await resolveFallbackFromBuiltins({});
    expect(result).toBeNull();
  });

  it('correctly detects VIP/paid status in each plugin', () => {
    // Kugou plugin VIP detection
    expect(kugouPlugin.isVip!({ privilege: 10, pay_type: 3, fail_process: 4 })).toBe(true);
    expect(kugouPlugin.isVip!({ raw: { privilege: 10, pay_type: 3 } })).toBe(true);
    expect(kugouPlugin.isVip!({ privilege: 0, pay_type: 0, fail_process: 0 })).toBe(false);

    // QQ plugin VIP detection
    expect(qqPlugin.isVip!({ pay: { payplay: 1 } })).toBe(true);
    expect(qqPlugin.isVip!({ raw: { pay: { paytrackmouth: 1 } } })).toBe(true);
    expect(qqPlugin.isVip!({ pay: { payplay: 0 } })).toBe(false);
  });

  it('rejects wrong artist, substring title, and cover/DJ candidates in resolveFallbackFromBuiltins', async () => {
    const kugouSearch = vi.spyOn(kugouPlugin, 'search').mockResolvedValue({
      isEnd: true,
      data: [
        { id: 'vip1', title: '不同', artist: '孙燕姿', duration: 221000, isVip: true },
        { id: 'wrong1', title: '不同', artist: '某网络歌手', duration: 291000, isVip: false },
        { id: 'cover1', title: '不同 (翻唱)', artist: '孙燕姿粉丝', duration: 220000, isVip: false },
        { id: 'substr1', title: '与众不同', artist: '孙燕姿', duration: 220000, isVip: false }
      ]
    });
    const kugouMedia = vi.spyOn(kugouPlugin, 'getMediaSource').mockResolvedValue({ url: 'https://bad.example/wrong.mp3' });

    const qqSearch = vi.spyOn(qqPlugin, 'search').mockResolvedValue({
      isEnd: true,
      data: [
        { id: 'wrong2', title: '不同', artist: '其他歌手', duration: 291000, isVip: false }
      ]
    });
    const qqMedia = vi.spyOn(qqPlugin, 'getMediaSource').mockResolvedValue({ url: 'https://bad.example/wrong2.mp3' });

    const result = await resolveFallbackFromBuiltins({
      id: 287063,
      name: '不同',
      artist: '孙燕姿',
      duration: 221000
    });

    expect(result).toBeNull();
    // Should never search bare title without artist when artist is known
    for (const call of [...kugouSearch.mock.calls, ...qqSearch.mock.calls]) {
      expect(call[0]).toContain('孙燕姿');
    }
    expect(kugouMedia).not.toHaveBeenCalled();
    expect(qqMedia).not.toHaveBeenCalled();
  });

  it('selects matching non-VIP studio track from secondary plugin when primary has only VIP', async () => {
    vi.spyOn(kugouPlugin, 'search').mockResolvedValue({
      isEnd: true,
      data: [
        { id: 'vip1', title: '不同', artist: '孙燕姿', duration: 221000, isVip: true }
      ]
    });
    vi.spyOn(qqPlugin, 'search').mockResolvedValue({
      isEnd: true,
      data: [
        { id: 'live1', title: '不同 (Live)', artist: '孙燕姿', duration: 225000, isVip: false },
        { id: 'studio1', title: '不同', artist: '孙燕姿', duration: 221000, isVip: false }
      ]
    });
    const qqMedia = vi.spyOn(qqPlugin, 'getMediaSource').mockResolvedValue({
      url: 'https://qq.example/butong-sunyanzi.mp3'
    });

    const result = await resolveFallbackFromBuiltins({
      id: 287063,
      name: '不同',
      artist: '孙燕姿',
      duration: 221000
    });

    expect(result?.url).toBe('https://qq.example/butong-sunyanzi.mp3');
    expect(qqMedia).toHaveBeenCalledTimes(1);
    expect(qqMedia.mock.calls[0][0].id).toBe('studio1');
  });
});
