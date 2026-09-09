import { taskState } from './taskStore.svelte';
import { cachedSongIdSet } from './pwaCache.svelte';
import type { Track } from './types';

/**
 * 🚀 将歌曲 ID 标记为服务器已下载（触发全站所有曲目列表响应式更新）
 */
export function markSongDownloaded(songId: number | string | undefined | null): void {
  if (!songId) return;
  const numId = Number(songId);
  if (isNaN(numId) || numId <= 0) return;
  if (!taskState.downloadedSet.has(numId)) {
    const nextSet = new Set(taskState.downloadedSet);
    nextSet.add(numId);
    taskState.downloadedSet = nextSet;
  }
}

export interface TrackSourceStatus {
  isServer: boolean;
  isPhone: boolean;
  isLocal: boolean;
}

/**
 * 🎯 统一判定歌曲的多端存储来源状态 (Single Source of Truth)
 * @param trackId 歌曲 ID
 * @param trackIsLocal 歌曲对象自带的 isLocal 属性
 * @param curTrack 当前播放器正在播放的曲目（用于实时联动正在播出的曲目）
 */
export function getTrackSourceStatus(
  trackId: number | string | undefined | null,
  trackIsLocal?: boolean,
  curTrack?: Track | null
): TrackSourceStatus {
  const numId = Number(trackId);
  const validId = !isNaN(numId) && numId > 0;

  // 1. 手机本地 / 浏览器离线缓存检测
  const isPhone = validId && cachedSongIdSet.has(numId);

  // 2. 当前播放歌曲的实时状态联动：若正在播放该曲目且已落盘
  const isCurPlayingLocal = !!(
    curTrack &&
    curTrack.isLocal === true &&
    validId &&
    Number(curTrack.id) === numId
  );

  // 3. 服务器磁盘检测：全局 downloadedSet、自身已标记、或当前播放已确认落盘
  const isServer =
    (validId && taskState.downloadedSet.has(numId)) ||
    trackIsLocal === true ||
    isCurPlayingLocal;

  return {
    isServer,
    isPhone,
    isLocal: isServer || isPhone
  };
}

export interface TrackPlayActionLabelOptions {
  isPlaying: boolean;
  isLocal: boolean;
  variant?: 'full' | 'short' | 'desktop';
}

/**
 * 🎯 统一获取曲目播放按钮的展示文案与语义 (DRY Single Source of Truth)
 */
export function getTrackPlayActionLabel(options: TrackPlayActionLabelOptions): string {
  const { isPlaying, isLocal, variant = 'full' } = options;
  if (isPlaying) {
    return variant === 'desktop' ? '⏸ 暂停' : '⏸ 播放中';
  }
  if (variant === 'desktop') {
    return isLocal ? '▶ 本地' : '▶ 试听';
  }
  if (variant === 'short') {
    return isLocal ? '▶️ 播放' : '▶️ 试听';
  }
  // full 模式（用于长按菜单或重要操作项）
  return isLocal ? '▶️ 播放本地音频' : '▶️ 试听在线歌曲';
}
