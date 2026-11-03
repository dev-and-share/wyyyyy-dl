import type { Track } from '../types';
import type {
  MusicPlatformAdapter,
  PlatformCapabilities,
  ResolveTrackOptions,
  ResolvedTrackData
} from './types';
import { api } from '../api';
import { formatArtist, DEFAULT_VINYL_COVER, isLocalStreamUrl } from '../utils';
import { getTrackSourceStatus } from '../player/trackStatus.svelte';
import { t } from '../i18n';

/**
 * ☁️ 网易云音乐平台适配器 (NeteasePlatformAdapter)
 * 将网易云专有数据结构（ar, al, songId, 专属码率等）清洗归一化为通用 Track 实体
 */
export class NeteaseAdapter implements MusicPlatformAdapter {
  readonly id = 'netease';
  readonly name = 'NetEase Cloud Music';

  readonly capabilities: PlatformCapabilities = {
    hasDailyRecommend: true,
    hasLike: true,
    hasComments: true,
    hasStats: true,
    hasPlaylists: true
  };

  normalizeTrack(item: any, overrides?: Partial<Track>): Track {
    if (!item) {
      return {
        id: 0,
        name: t('common.unknownTrack'),
        artist: t('common.unknownArtist'),
        cover: DEFAULT_VINYL_COVER,
        ...overrides
      };
    }

    const id = item.id || item.songId || 0;
    const name = item.name || item.songName || t('common.unknownTrack');
    const artist = formatArtist(item) || item.artist || item.ar_name || '';
    const cover = item.pic || item.picUrl || item.al?.picUrl || item.cover || DEFAULT_VINYL_COVER;
    const isLocal = Boolean(
      item.isLocal ||
      (item.url && isLocalStreamUrl(item.url)) ||
      getTrackSourceStatus(id, item.isLocal).isLocal
    );
    const freeTrial = Boolean(item.freeTrial);

    return {
      id,
      name,
      artist,
      cover,
      url: item.url,
      lyric: item.lyric,
      isLocal,
      freeTrial,
      freeTrialDuration: item.freeTrialDuration,
      ...overrides
    };
  }

  async resolveTrack(
    id: string | number,
    options?: ResolveTrackOptions
  ): Promise<ResolvedTrackData> {
    const level = options?.level || 'lossless';
    const j = await api.songV1(String(id), level, options?.name, options?.artist);
    const song = j?.data;

    if (!song) {
      return {
        unplayable: true,
        unplayableReason: t('player.getInfoFailed'),
        raw: j
      };
    }

    const isServerLocal = Boolean(song.isLocal === true || (song.url && isLocalStreamUrl(song.url)));
    const isUnplayable = !song.url;
    const unplayableReason = isUnplayable
      ? song.unplayableReason ||
        (song.status === 404 ? t('player.regionOrCopyrightRestricted') : t('player.noPlayableSource'))
      : undefined;

    return {
      url: song.url || '',
      cover: song.pic || song.picUrl || song.al?.picUrl || song.cover,
      lyric: song.lyric,
      isLocal: isServerLocal,
      freeTrial: isServerLocal ? false : song.freeTrial === true,
      freeTrialDuration: song.freeTrialDuration,
      unplayable: isUnplayable,
      unplayableReason,
      raw: song
    };
  }

  async getPlaylist(id: string | number): Promise<any> {
    return api.playlist(String(id));
  }

  async getMyPlaylists(): Promise<any> {
    return api.myPlaylist();
  }

  async getRecommendSongs(): Promise<any> {
    return api.recommendSongs();
  }

  async search(keyword: string, type = '1', limit: string | number = '30'): Promise<any> {
    return api.search(keyword, String(type), String(limit));
  }

  async getAlbum(id: string | number): Promise<any> {
    return api.album(String(id));
  }

  async getArtist(id: string | number): Promise<any> {
    return api.artist(String(id));
  }

  async getSongStats(id: string | number): Promise<any> {
    return api.songStats(id);
  }

  async getSongComments(id: string | number, offset = 0, limit = 20): Promise<any> {
    return api.songComments(id, offset, limit);
  }

  async like(id: number | string, like: boolean, name?: string, artist?: string): Promise<any> {
    return api.like(Number(id), like, name, artist);
  }

  async getLikeList(): Promise<any> {
    return api.likeList();
  }
}
