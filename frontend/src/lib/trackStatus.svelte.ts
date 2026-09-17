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

/**
 * 🎯 统一判定当前播放曲目与目标条目是否为同一首歌 (Single Source of Truth)
 * - 若两端均具备有效 ID (>0)，必须严格按 ID 比对，坚决杜绝同名不同曲目误判
 * - 若曲目有有效 ID，而目标条目也有不同有效 ID，绝不判定为同一首歌
 * - 仅当缺少有效 ID 时，才降级比对物理路径/URL 或 (歌名 + 歌手)
 */
export function isSameTrack(
  curTrack: Track | null | undefined,
  target: {
    id?: number | string;
    songId?: number | string;
    name?: string;
    songName?: string;
    title?: string;
    artist?: string;
    artists?: any;
    url?: string;
    filePath?: string;
    relativePath?: string;
    hostFilePath?: string;
    path?: string;
  } | null | undefined
): boolean {
  if (!curTrack || !target) return false;

  const curId = Number(curTrack.id);
  const curHasValidId = !isNaN(curId) && curId > 0;

  const targetSongId = Number(target.songId);
  const targetId = Number(target.id);
  const hasValidSongId = !isNaN(targetSongId) && targetSongId > 0;
  const hasValidId = !isNaN(targetId) && targetId > 0;

  // 1. 若当前播放曲目具有合法 ID：
  if (curHasValidId) {
    if (hasValidSongId && curId === targetSongId) return true;
    if (hasValidId && curId === targetId) return true;

    // 若 target 明确拥有不同合法 ID，则绝对不是同一首歌（杜绝搜索列表同名歌曲串联高亮）
    if (hasValidSongId || hasValidId) return false;
  }

  // 2. 物理文件路径比对（针对本地扫描或下载文件）
  const curPath = curTrack.filePath || curTrack.relativePath;
  const targetPath = target.filePath || target.relativePath || target.hostFilePath || target.path;
  if (curPath && targetPath) {
    return curPath === targetPath;
  }

  // 3. URL 严格比对
  if (curTrack.url && target.url) {
    return curTrack.url === target.url;
  }

  // 4. 仅当两端均无有效合法 ID 且缺少路径/URL 时，才允许在歌名与歌手非空非占位符且一致时兜底
  if (!curHasValidId && !hasValidSongId && !hasValidId) {
    const targetName = target.name || target.songName || target.title;
    if (
      curTrack.name &&
      targetName &&
      curTrack.name !== '未知曲目' &&
      curTrack.name !== '未知' &&
      curTrack.name.trim() === targetName.trim()
    ) {
      const targetArtist = typeof target.artist === 'string' ? target.artist : '';
      if (
        curTrack.artist &&
        targetArtist &&
        curTrack.artist !== '未知歌手' &&
        curTrack.artist !== '未知' &&
        curTrack.artist.trim() === targetArtist.trim()
      ) {
        return true;
      }
    }
  }

  return false;
}


