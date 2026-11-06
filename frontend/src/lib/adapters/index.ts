/**
 * ☁️ 平台 Adapter 模块 (Platform Adapter Module)
 * 对外统一音源标准契约，支持网易云、QQ音乐、本地文件、Subsonic 等多数据源解耦插拔
 */

import type { MusicPlatformAdapter } from './types';
import { NeteaseAdapter } from './neteaseAdapter';

export * from './types';
export * from './neteaseAdapter';
export * from './musicFreeAdapter';

let activeAdapter: MusicPlatformAdapter = new NeteaseAdapter();

/**
 * 获取当前全局生效的音乐平台适配器
 */
export function getPlatformAdapter(): MusicPlatformAdapter {
  return activeAdapter;
}

/**
 * 切换全局音乐平台适配器（支持多平台动态插拔）
 */
export function setPlatformAdapter(adapter: MusicPlatformAdapter): void {
  activeAdapter = adapter;
}

/**
 * 默认平台适配器快捷单例
 */
export const platformAdapter: MusicPlatformAdapter = {
  get id() {
    return activeAdapter.id;
  },
  get name() {
    return activeAdapter.name;
  },
  get capabilities() {
    return activeAdapter.capabilities;
  },
  normalizeTrack(item, overrides) {
    return activeAdapter.normalizeTrack(item, overrides);
  },
  resolveTrack(id, options) {
    return activeAdapter.resolveTrack(id, options);
  },
  getPlaylist(id) {
    return activeAdapter.getPlaylist ? activeAdapter.getPlaylist(id) : Promise.resolve(null);
  },
  getMyPlaylists() {
    return activeAdapter.getMyPlaylists ? activeAdapter.getMyPlaylists() : Promise.resolve([]);
  },
  getRecommendSongs() {
    return activeAdapter.getRecommendSongs ? activeAdapter.getRecommendSongs() : Promise.resolve([]);
  },
  search(keyword, type, limit) {
    return activeAdapter.search ? activeAdapter.search(keyword, type, limit) : Promise.resolve([]);
  },
  getAlbum(id) {
    return activeAdapter.getAlbum ? activeAdapter.getAlbum(id) : Promise.resolve(null);
  },
  getArtist(id) {
    return activeAdapter.getArtist ? activeAdapter.getArtist(id) : Promise.resolve(null);
  },
  getSongStats(id) {
    return activeAdapter.getSongStats ? activeAdapter.getSongStats(id) : Promise.resolve(null);
  },
  getSongComments(id, offset, limit) {
    return activeAdapter.getSongComments ? activeAdapter.getSongComments(id, offset, limit) : Promise.resolve(null);
  },
  like(id, likeVal, name, artist) {
    return activeAdapter.like ? activeAdapter.like(id, likeVal, name, artist) : Promise.resolve(null);
  },
  getLikeList() {
    return activeAdapter.getLikeList ? activeAdapter.getLikeList() : Promise.resolve([]);
  }
};
