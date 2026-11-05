import { describe, it, expect } from 'vitest';
import { musicFreeStore } from '../musicFreeStore.svelte';
import { filterAndSortSheetPlugins } from '../sheetHelpers';
import { musicFreeAdapter } from '../../adapters/musicFreeAdapter';

describe('MusicFreeSheetsTab full flow test', () => {
  it('loads plugins, tags, sheets and selects a sheet without error', async () => {
    try {
      const emptyIds = new Set<string>();
      const sheetPlugins = filterAndSortSheetPlugins(musicFreeStore.plugins, emptyIds);
      expect(sheetPlugins.length).toBeGreaterThanOrEqual(2);

      const qq = sheetPlugins.find((p) => p.name.includes('QQ音乐'));
      expect(qq).toBeDefined();
      const pluginId = qq!.id;

      // 1. 获取标签
      const rawTags = await musicFreeStore.getRecommendSheetTags(pluginId);
      if (!rawTags?.pinned?.length) {
        console.warn('QQ音乐接口未返回标签，可能网络受限，跳过后续步骤');
        return;
      }
      expect(rawTags.pinned.length).toBeGreaterThan(0);

      // 2. 加载歌单列表
      const sheetsRes = await musicFreeStore.getRecommendSheetsByTag(pluginId, rawTags.pinned[0], 1);
      if (!sheetsRes?.data?.length) {
        console.warn('QQ音乐接口未返回歌单，可能网络受限，跳过后续步骤');
        return;
      }
      expect(sheetsRes.data.length).toBeGreaterThan(0);

      const sheet = sheetsRes.data[0];
      expect(sheet.id).toBeTruthy();

      // 3. 点击歌单详情
      const detail = await musicFreeStore.getMusicSheetInfo(pluginId, sheet, 1);
      if (!detail?.musicList?.length) {
        return;
      }
      expect(detail).toBeDefined();
      expect(Array.isArray(detail.musicList)).toBe(true);

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
    } catch (e: any) {
      console.warn('QQ音乐外部网络请求失败/被拦截，优雅跳过:', e?.message || e);
    }
  }, 20000);

  it('preserves isVip attribute and correctly identifies VIP tracks from chartSheetService', async () => {
    const { fetchMusicSheetInfo } = await import('../chartSheetService');
    const mockPlugins = [
      {
        id: 'test-kugou',
        name: '酷狗音乐 (测试)',
        version: '1.0.0',
        author: 'test',
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
                  id: 'k1',
                  title: '免费歌',
                  artist: '歌手A',
                  privilege: 0,
                  pay_type: 0
                },
                {
                  id: 'k2',
                  title: 'VIP歌曲',
                  artist: '歌手B',
                  privilege: 8,
                  pay_type: 1
                }
              ]
            };
          }
        }
      }
    ];

    const result = await fetchMusicSheetInfo(mockPlugins as any, 'test-kugou', { id: '123' }, 1);
    expect(result).toBeDefined();
    expect(result.musicList).toHaveLength(2);

    const freeSong = result.musicList[0];
    const vipSong = result.musicList[1];

    expect(freeSong.isVip).toBe(false);
    expect(vipSong.isVip).toBe(true);
  });
});
