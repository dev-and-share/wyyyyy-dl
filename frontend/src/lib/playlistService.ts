import { api } from './api';
import { isLocalPlaylist } from './localPlaylistStore.svelte';

export interface UnifiedPlaylist {
  id: string;
  name: string;
  coverImgUrl?: string;
  trackCount: number;
  tracks?: any[];
  isLocal: boolean;
  subscribed?: boolean;
  creator?: any;
  isCreator?: boolean;
  [key: string]: any;
}

export interface PlaylistProvider {
  readonly type: 'netease' | 'local';
  canHandle(id: string | number): boolean;
  getDetail(id: string | number): Promise<any>;
  getTracks(id: string | number): Promise<any[]>;
  delete(id: string | number): Promise<boolean>;
}

export class LocalPlaylistProvider implements PlaylistProvider {
  readonly type = 'local' as const;
  private inFlight = new Map<string, Promise<any>>();

  canHandle(id: string | number): boolean {
    return isLocalPlaylist(id);
  }

  async getDetail(id: string | number): Promise<any> {
    const key = String(id);
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }
    const promise = (async () => {
      try {
        const res = await api.localPlaylistDetail(key);
        if (res?.code && res.code !== '000000') {
          throw new Error(res.msg || '获取本地歌单失败');
        }
        return res?.data;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, promise);
    return promise;
  }

  async getTracks(id: string | number): Promise<any[]> {
    const detail = await this.getDetail(id);
    return detail?.tracks || [];
  }

  async delete(id: string | number): Promise<boolean> {
    const res = await api.localPlaylistDelete(String(id));
    return res?.code === '000000';
  }
}

export class NeteasePlaylistProvider implements PlaylistProvider {
  readonly type = 'netease' as const;

  canHandle(id: string | number): boolean {
    return !isLocalPlaylist(id);
  }

  async getDetail(id: string | number): Promise<any> {
    const res = await api.playlist(String(id));
    return res?.data?.playlist || res?.data;
  }

  async getTracks(id: string | number): Promise<any[]> {
    const detail = await this.getDetail(id);
    return detail?.tracks || [];
  }

  async delete(id: string | number): Promise<boolean> {
    const res = await api.playlistDelete(String(id));
    return res?.code === '000000';
  }
}

export class PlaylistService {
  private providers: PlaylistProvider[] = [
    new LocalPlaylistProvider(),
    new NeteasePlaylistProvider()
  ];

  getProvider(id: string | number): PlaylistProvider {
    const provider = this.providers.find((p) => p.canHandle(id));
    return provider || this.providers[1];
  }

  async getDetail(id: string | number): Promise<any> {
    return this.getProvider(id).getDetail(id);
  }

  async getTracks(id: string | number): Promise<any[]> {
    return this.getProvider(id).getTracks(id);
  }

  async deletePlaylist(id: string | number): Promise<boolean> {
    return this.getProvider(id).delete(id);
  }
}

export const playlistService = new PlaylistService();
