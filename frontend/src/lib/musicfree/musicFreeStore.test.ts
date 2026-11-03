import { describe, it, expect, vi, beforeEach } from 'vitest';
import { musicFreeStore } from './musicFreeStore.svelte';
import { musicFreeAdapter } from '../adapters/musicFreeAdapter';

describe('MusicFree Store & Adapter', () => {
  beforeEach(() => {
    localStorage.clear();
    musicFreeStore.plugins = [];
    musicFreeStore.subscriptions = [];
  });

  it('normalizes a track correctly and sets composite id', () => {
    const rawTrack = {
      id: '123456',
      title: '海阔天空',
      artist: 'Beyond',
      album: '乐与怒',
      artwork: 'https://example.com/cover.jpg',
      _pluginId: 'plug_1',
      _pluginPlatform: '小蜗音乐'
    };

    const track = musicFreeAdapter.normalizeTrack(rawTrack);
    expect(track.id).toContain('mf_');
    expect(decodeURIComponent(String(track.id))).toContain('小蜗音乐');
    expect(track.name).toBe('海阔天空');
    expect(track.artist).toBe('Beyond');
    expect(track.cover).toBe('https://example.com/cover.jpg');
    expect(track.raw).toBe(rawTrack);
  });

  it('manages plugin enable/disable state', () => {
    const mockPlugin: any = {
      id: 'test_plugin_1',
      name: '测试音源',
      version: '1.0.0',
      author: 'Author',
      url: 'https://test.com/plugin.js',
      code: 'module.exports = { platform: "测试音源" };',
      enabled: true,
      supportedSearchType: ['music']
    };

    musicFreeStore.plugins = [mockPlugin];
    expect(musicFreeStore.plugins[0].enabled).toBe(true);

    musicFreeStore.togglePlugin('test_plugin_1');
    expect(musicFreeStore.plugins[0].enabled).toBe(false);

    musicFreeStore.togglePlugin('test_plugin_1');
    expect(musicFreeStore.plugins[0].enabled).toBe(true);

    musicFreeStore.removePlugin('test_plugin_1');
    expect(musicFreeStore.plugins.length).toBe(0);
  });

  it('cleans up junk and invalid plugins automatically', () => {
    musicFreeStore.plugins = [
      { id: '1', name: '歌曲宝', version: '1.0', author: 'a', url: '', code: '', enabled: true, supportedSearchType: [] },
      { id: '2', name: '书音FM', version: '1.0', author: 'b', url: '', code: '', enabled: true, supportedSearchType: [] },
      { id: '3', name: '小秋音乐', version: '1.0', author: 'c', url: '', code: '', enabled: true, supportedSearchType: [] },
      { id: '4', name: '爱听音乐', version: '1.0', author: 'd', url: '', code: '', enabled: true, supportedSearchType: [] }
    ];

    const cleanedCount = musicFreeStore.cleanupJunkPlugins();
    expect(cleanedCount).toBe(3);
    expect(musicFreeStore.plugins.length).toBe(1);
    expect(musicFreeStore.plugins[0].name).toBe('小秋音乐');
  });

  it('safely handles plugin exception in recommend sheets without crashing UI', async () => {
    musicFreeStore.plugins = [
      {
        id: 'bad_plug',
        name: '畸形插件',
        version: '1.0',
        author: 'x',
        url: '',
        code: '',
        enabled: true,
        supportedSearchType: [],
        instance: {
          platform: '畸形插件',
          getRecommendSheetsByTag: () => {
            throw new Error('undefined is not an object (evaluating res.total)');
          }
        } as any
      }
    ];

    const result = await musicFreeStore.getRecommendSheetsByTag('bad_plug', { title: '全部' }, 1);
    expect(result.data).toEqual([]);
    expect(result.isEnd).toBe(true);
    expect(result.error).toContain('res.total');
  });
});
