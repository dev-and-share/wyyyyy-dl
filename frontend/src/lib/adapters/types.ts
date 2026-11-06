import type { Track } from '../types';

export interface ResolveTrackOptions {
  level?: 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires' | 'jyeffect' | 'sky' | 'jymaster' | string;
  name?: string;
  artist?: string;
  raw?: any;
}

export interface ResolvedTrackData {
  url?: string;
  cover?: string;
  lyric?: string;
  isLocal?: boolean;
  freeTrial?: boolean;
  freeTrialDuration?: number;
  unplayable?: boolean;
  unplayableReason?: string;
  raw?: any;
}

export interface PlatformCapabilities {
  hasDailyRecommend?: boolean;
  hasLike?: boolean;
  hasComments?: boolean;
  hasStats?: boolean;
  hasPlaylists?: boolean;
}

/**
 * ☁️ 跨平台音源适配器抽象端口 (Port Interface)
 * 屏蔽各云端音乐平台（网易云、QQ、Subsonic、本地等）的数据模型与 API 差异，向播放器输出纯净统一的标准数据。
 */
export interface MusicPlatformAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: PlatformCapabilities;

  /**
   * 将平台特定/非标准的原始曲目对象清洗归一化为标准的 Track 实体
   */
  normalizeTrack(rawItem: any, overrides?: Partial<Track>): Track;

  /**
   * 解析曲目的播放流地址、高清封面、歌词与试听状态
   */
  resolveTrack(id: string | number, options?: ResolveTrackOptions): Promise<ResolvedTrackData>;

  /**
   * 获取指定歌单详情与曲目列表
   */
  getPlaylist?(id: string | number): Promise<any>;

  /**
   * 获取用户歌单列表
   */
  getMyPlaylists?(): Promise<any>;

  /**
   * 获取每日推荐曲目
   */
  getRecommendSongs?(): Promise<any>;

  /**
   * 搜索接口
   */
  search?(keyword: string, type?: string, limit?: string | number): Promise<any>;

  /**
   * 专辑详情
   */
  getAlbum?(id: string | number): Promise<any>;

  /**
   * 歌手详情
   */
  getArtist?(id: string | number): Promise<any>;

  /**
   * 歌曲点赞/评论数统计
   */
  getSongStats?(id: string | number): Promise<any>;

  /**
   * 歌曲评论列表
   */
  getSongComments?(id: string | number, offset?: number, limit?: number): Promise<any>;

  /**
   * 红心喜欢/取消喜欢
   */
  like?(id: number | string, like: boolean, name?: string, artist?: string): Promise<any>;

  /**
   * 用户红心歌曲 ID 列表
   */
  getLikeList?(): Promise<any>;
}
