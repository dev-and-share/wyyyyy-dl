export interface Track {
  id: number | string;
  name: string;
  artist: string;
  cover?: string;
  url?: string;
  resolvedUrl?: string;
  lyric?: string;
  isLocal?: boolean;
  filePath?: string;
  relativePath?: string;
  streamUrl?: string;
  level?: string;
  quality?: string;
  size?: string;
  br?: number;
  al?: {
    picUrl?: string;
    name?: string;
  };
  ar?: Array<{
    name: string;
  }>;
  freeTrial?: boolean;
  freeTrialDuration?: number;
  unplayable?: boolean;
  unplayableReason?: string;
  isVip?: boolean;
  vip?: boolean;
  raw?: any;
}

export interface DownloadTask {
  id?: number | string;
  songId?: number | string;
  name?: string;
  status: 'PENDING' | 'DOWNLOADING' | 'SUCCESS' | 'SKIP' | 'FAILED' | string;
  errorMsg?: string;
  filePath?: string;
  timestamp?: number;
}

/**
 * 🏷️ 音频存储来源枚举 (Audio Source Type)
 */
export enum AudioSourceType {
  NETEASE = 'netease',
  MUSICFREE = 'musicfree',
  MUSICFREE_QQ = 'musicfree-qq',
  MUSICFREE_KUGOU = 'musicfree-kugou',
  MUSICFREE_KUWO = 'musicfree-kuwo',
  MUSICFREE_MIGU = 'musicfree-migu',
  MUSICFREE_BILIBILI = 'musicfree-bilibili',
  MUSICFREE_MAOERFM = 'musicfree-maoerfm',
  MUSICFREE_CUSTOM = 'musicfree-custom'
}

export interface DownloadHistoryItem {
  id: number;
  songId?: number;
  songName: string;
  artist?: string;
  album?: string;
  filePath: string;
  relativePath?: string;
  hostFilePath?: string;
  fileSize: number;
  quality?: string;
  status: string;
  createdAt?: string;
  fileExists?: boolean;
  source?: AudioSourceType | string;
}

export interface PlaylistInfo {
  id: number | string;
  name: string;
  coverImgUrl?: string;
  creator?: string;
  trackCount?: number;
  cloudTrackCount?: number;
  subscribed?: boolean;
  tracks?: Track[];
}
