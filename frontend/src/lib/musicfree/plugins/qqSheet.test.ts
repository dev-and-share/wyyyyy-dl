import { describe, it, expect } from 'vitest';
import { musicFreeStore } from '../musicFreeStore.svelte';
import { filterAndSortSheetPlugins } from '../sheetHelpers';
import { musicFreeAdapter } from '../../adapters/musicFreeAdapter';

describe('MusicFreeSheetsTab full flow test', () => {
  it('loads plugins, tags, sheets and selects a sheet without error', async () => {
    const emptyIds = new Set<string>();
    const sheetPlugins = filterAndSortSheetPlugins(musicFreeStore.plugins, emptyIds);
    expect(sheetPlugins.length).toBeGreaterThanOrEqual(2);

    const qq = sheetPlugins.find((p) => p.name.includes('QQ音乐'));
    expect(qq).toBeDefined();
    const pluginId = qq!.id;

    // 1. 获取标签
    const rawTags = await musicFreeStore.getRecommendSheetTags(pluginId);
    expect(rawTags.pinned.length).toBeGreaterThan(0);

    // 2. 加载歌单列表
    const sheetsRes = await musicFreeStore.getRecommendSheetsByTag(pluginId, rawTags.pinned[0], 1);
    expect(sheetsRes.data.length).toBeGreaterThan(0);

    const sheet = sheetsRes.data[0];
    expect(sheet.id).toBeTruthy();

    // 3. 点击歌单详情
    const detail = await musicFreeStore.getMusicSheetInfo(pluginId, sheet, 1);
    expect(detail).toBeDefined();
    expect(Array.isArray(detail.musicList)).toBe(true);
    expect(detail.musicList.length).toBeGreaterThan(0);

    // 4. 转换 tracks
    const rawTracks = detail.musicList;
    const sheetTracks = rawTracks.map((t: any) => ({
      ...t,
      _pluginId: pluginId,
      _pluginPlatform: qq!.name
    }));
    expect(sheetTracks.length).toBe(rawTracks.length);

    // 5. 测试 buildTrack
    const sampleTrack = sheetTracks[0];
    const rawId = sampleTrack.id || Math.random().toString(36).substring(2, 9);
    const compoundId = `mf_${encodeURIComponent(qq!.name)}_${rawId}`;
    const normalized = musicFreeAdapter.normalizeTrack(sampleTrack, {
      id: compoundId,
      name: sampleTrack.title || sampleTrack.name,
      artist: sampleTrack.artist,
      cover: sampleTrack.artwork || '',
      raw: sampleTrack,
      _isMusicFree: true,
      _pluginHash: pluginId
    } as any);

    expect(normalized.id).toContain('mf_');
    expect(normalized.name).toBeTruthy();
  }, 20000);

  it('preserves isVip attribute and correctly identifies VIP tracks from chartSheetService', async () => {
    const { fetchMusicSheetInfo } = await import('../chartSheetService');
    const mockPlugins = [
      {
        id: 'test-kugou',
        name: '酷狗音乐 (测试)',
        enabled: true,
        version: '1.0.0',
        author: 'test',
        url: '',
        code: '',
        supportedSearchType: ['music'],
        instance: {
          platform: '酷狗音乐 (测试)',
          isVip(item: any) {
            return item.privilege >= 8 || item.pay_type > 0;
          },
          async getMusicSheetInfo() {
            return {
              id: '123',
              title: '测试歌单',
              musicList: [
                {
                  id: 'h1',
                  title: 'VIP 歌曲',
                  artist: '歌手 A',
                  privilege: 10,
                  pay_type: 3,
                  isVip: true,
                  raw: { privilege: 10, pay_type: 3 }
                },
                {
                  id: 'h2',
                  title: '普通歌曲',
                  artist: '歌手 B',
                  privilege: 0,
                  pay_type: 0,
                  isVip: false,
                  raw: { privilege: 0, pay_type: 0 }
                }
              ]
            };
          }
        }
      }
    ];

    const result = await fetchMusicSheetInfo(mockPlugins as any, 'test-kugou', { id: '123' });
    expect(result.musicList).toHaveLength(2);
    expect(result.musicList[0].isVip).toBe(true);
    expect(result.musicList[1].isVip).toBe(false);

    const { isVipOrPaidTrack } = await import('../../player/trackStatus.svelte');
    expect(isVipOrPaidTrack(result.musicList[0])).toBe(true);
    expect(isVipOrPaidTrack(result.musicList[1])).toBe(false);
  });
});
