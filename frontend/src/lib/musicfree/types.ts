export interface IMusicFreeTrack {
  id: string | number;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  duration?: number;
  raw?: any;
  [key: string]: any;
}

export interface IMusicFreeMediaSource {
  url: string;
  headers?: Record<string, string>;
  quality?: string;
}

export interface IMusicFreeLyric {
  rawLrc?: string;
  translation?: string;
}

export interface IMusicFreePlugin {
  platform: string;
  author?: string;
  version?: string;
  appVersion?: string;
  description?: string;
  hints?: string[];
  supportedSearchType?: string[];
  search?: (query: string, page: number, type: 'music' | 'album' | 'artist') => Promise<{ isEnd?: boolean; data: any[] }>;
  getMediaSource?: (musicItem: any, quality: string) => Promise<IMusicFreeMediaSource>;
  getLyric?: (musicItem: any) => Promise<IMusicFreeLyric>;
  getAlbumInfo?: (albumItem: any) => Promise<any>;
  getArtistWorks?: (artistItem: any, page: number, type: string) => Promise<any>;
  getTopLists?: () => Promise<any[]>;
  getTopListDetail?: (topListItem: any) => Promise<any>;
  getRecommendSheetTags?: () => Promise<{ pinned?: any[]; data?: any[] } | any[]>;
  getRecommendSheetsByTag?: (tag: any, page?: number) => Promise<{ isEnd?: boolean; data: any[] }>;
  getMusicSheetInfo?: (sheet: any, page?: number) => Promise<any>;
  importMusicSheet?: (urlLike: string) => Promise<any[]>;
  [key: string]: any;
}

export type MusicFreePlugin = IMusicFreePlugin;

export interface InstalledPluginRecord {
  id: string;
  name: string;
  version: string;
  author: string;
  url: string;
  code: string;
  enabled: boolean;
  supportedSearchType: string[];
  instance?: IMusicFreePlugin;
  error?: string;
}

export interface SubscriptionMeta {
  url: string;
  name?: string;
  pluginsCount: number;
  addedAt: number;
}
