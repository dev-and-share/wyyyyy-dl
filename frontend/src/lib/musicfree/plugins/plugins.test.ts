import { describe, it, expect } from 'vitest';
import { builtinPlugins, qqPlugin, kugouPlugin, resolveFallbackFromBuiltins } from './index';

describe('Official Builtin MusicFree Plugins', () => {
  it('exports official builtin plugins with valid metadata', () => {
    expect(builtinPlugins).toHaveLength(2);

    const platforms = builtinPlugins.map((p) => p.platform);
    expect(platforms).toContain('QQ音乐 (官方)');
    expect(platforms).toContain('酷狗音乐 (官方)');

    for (const plugin of builtinPlugins) {
      expect(plugin.author).toBe('wyyyyy-dl 官方');
      expect(plugin.version).toBe('1.0.0');
      expect(typeof plugin.search).toBe('function');
      expect(typeof plugin.getMediaSource).toBe('function');
      expect(typeof plugin.getTopLists).toBe('function');
    }
  });

  it('provides top list charts for each plugin', async () => {
    const qqLists = await qqPlugin.getTopLists!();
    expect(qqLists).toHaveLength(1);
    expect(qqLists[0].data.length).toBeGreaterThan(0);

    const kugouLists = await kugouPlugin.getTopLists!();
    expect(kugouLists).toHaveLength(1);
  });

  it('safely handles resolveFallbackFromBuiltins with empty or invalid track', async () => {
    const result = await resolveFallbackFromBuiltins({});
    expect(result).toBeNull();
  });
});
