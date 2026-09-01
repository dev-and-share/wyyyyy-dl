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
  size?: string;
  al?: {
    picUrl?: string;
    name?: string;
  };
  ar?: Array<{
    name: string;
  }>;
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
