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
});
