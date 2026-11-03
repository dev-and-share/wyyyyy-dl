import type { Track } from '../types';
import type { MusicPlatformAdapter, PlatformCapabilities, ResolveTrackOptions, ResolvedTrackData } from './types';
import { musicFreeStore } from '../musicfree/musicFreeStore.svelte';
import { DEFAULT_VINYL_COVER } from '../utils';

export class MusicFreeAdapter implements MusicPlatformAdapter {
  readonly id = 'musicfree';
  readonly name = 'MusicFree Hub';

  readonly capabilities: PlatformCapabilities = {
    hasDailyRecommend: false,
    hasLike: false,
    hasComments: false,
    hasStats: false,
    hasPlaylists: false
  };

  // 内存中缓存近期检索出的曲目，以便在 resolveTrack 时能无损提取原始插件对象
  private trackCache = new Map<string, any>();

  normalizeTrack(item: any, overrides?: Partial<Track>): Track {
    if (!item) {
      return {
        id: 0,
        name: '未知曲目',
        artist: '未知歌手',
        cover: DEFAULT_VINYL_COVER,
        ...overrides
      };
    }

    const pluginId = item._pluginId || overrides?.raw?._pluginId || '';
    const pluginPlatform = item._pluginPlatform || overrides?.raw?._pluginPlatform || '';
    const rawId = item.id || item.cid || item.songId || Math.random().toString(36).substring(2, 9);
    // 构造唯一复合 ID，避免不同插件间的数字 ID 冲突
    const compoundId = `mf_${encodeURIComponent(pluginPlatform)}_${rawId}`;

    const track: Track = {
      id: compoundId as any,
      name: item.title || item.name || '未知歌曲',
      artist: item.artist || item.author || '未知歌手',
      al: {
        name: item.album || item.albumName || pluginPlatform,
        picUrl: item.artwork || item.pic || item.cover || DEFAULT_VINYL_COVER
      },
      cover: item.artwork || item.pic || item.cover || DEFAULT_VINYL_COVER,
      url: item.url,
      raw: item,
      isLocal: false,
      ...overrides
    };

    this.trackCache.set(String(compoundId), item);
    return track;
  }

  async resolveTrack(id: string | number, options?: ResolveTrackOptions): Promise<ResolvedTrackData> {
    const compoundId = String(id);
    const rawItem = options?.raw || this.trackCache.get(compoundId);

    if (!rawItem) {
      return {
        unplayable: true,
        unplayableReason: '无法定位该曲目的 MusicFree 插件源'
      };
    }

    // 智能获取插件 ID：优先从 rawItem._pluginId，若缺失则从复合 ID 或启用插件反查
    let pluginId = rawItem._pluginId || (options as any)?.raw?._pluginId || (options as any)?._pluginHash;
    if (!pluginId) {
      const active = musicFreeStore.getActivePlugins();
      for (const p of active) {
        if (compoundId.includes(encodeURIComponent(p.name)) || compoundId.includes(p.name)) {
          pluginId = p.id;
          break;
        }
      }
      if (!pluginId) {
        const anyMatch = musicFreeStore.plugins.find(
          (p) => compoundId.includes(encodeURIComponent(p.name)) || compoundId.includes(p.name)
        );
        if (anyMatch) pluginId = anyMatch.id;
      }
    }

    if (!pluginId) {
      return {
        unplayable: true,
        unplayableReason: '曲目缺失音源插件标示'
      };
    }

    try {
      const media = await musicFreeStore.resolveMediaSource(pluginId, rawItem, options?.level || 'standard');
      const lyricData = await musicFreeStore.resolveLyric(pluginId, rawItem);

      return {
        url: media.url,
        cover: rawItem.artwork || rawItem.pic,
        lyric: lyricData?.rawLrc || '',
        isLocal: false,
        freeTrial: false
      };
    } catch (err: any) {
      return {
        unplayable: true,
        unplayableReason: err.message || 'MusicFree 插件音源解析失败'
      };
    }
  }

  async search(keyword: string, type?: string, limit?: string | number): Promise<any> {
    const { results } = await musicFreeStore.searchAll(keyword, 1);
    const songs = results.map((item) => this.normalizeTrack(item));
    return {
      songs,
      songCount: songs.length
    };
  }
}

export const musicFreeAdapter = new MusicFreeAdapter();
