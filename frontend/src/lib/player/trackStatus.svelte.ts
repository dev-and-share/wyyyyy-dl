import { taskState } from '../taskStore.svelte';
import { cachedSongIdSet } from '../library/pwaCache.svelte';
import type { Track } from '../types';
import { t } from '../i18n';

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

/**
 * 🗑️ 将歌曲 ID 从服务器已下载集合中移除（触发全站所有曲目列表响应式更新）
 */
export function unmarkSongDownloaded(songId: number | string | undefined | null): void {
  if (!songId) return;
  const numId = Number(songId);
  if (isNaN(numId) || numId <= 0) return;
  if (taskState.downloadedSet.has(numId)) {
    const nextSet = new Set(taskState.downloadedSet);
    nextSet.delete(numId);
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
 * @param trackIsPhysicalServer 是否明确已物理落盘在服务器磁盘
 * @param curTrack 当前播放器正在播放的曲目（用于实时联动正在播出的曲目）
 */
export function getTrackSourceStatus(
  trackId: number | string | undefined | null,
  trackIsPhysicalServer?: boolean,
  curTrack?: Track | null,
  isExternal?: boolean,
  trackName?: string,
  trackArtist?: string
): TrackSourceStatus {
  const strId = trackId != null ? String(trackId).trim() : '';
  const isExt = isExternal === true || strId.startsWith('mf_') || strId.startsWith('ext_');
  const numId = Number(trackId);
  const validNum = !isExt && !isNaN(numId) && numId > 0;
  const safeName = (trackName || '').trim();
  const safeArtist = (trackArtist || '').trim();
  const comboKey = safeName && safeArtist ? `${safeName}___${safeArtist}` : '';

  // 1. 手机本地 / 浏览器离线缓存检测
  const isPhone =
    (validNum && cachedSongIdSet.has(numId as any)) ||
    (strId !== '' && cachedSongIdSet.has(strId as any)) ||
    (comboKey !== '' && cachedSongIdSet.has(comboKey as any));

  // 2. 当前播放歌曲的实时状态联动：若正在播放该曲目且已落盘在服务器
  const isCurPlayingServer = !!(
    curTrack &&
    curTrack.isLocal === true &&
    curTrack.filePath &&
    !curTrack.filePath.startsWith('/v3/stream/online') &&
    (
      (validNum && Number(curTrack.id) === numId) ||
      (strId !== '' && String(curTrack.id) === strId) ||
      (comboKey !== '' && isSameTrack(curTrack, { name: safeName, artist: safeArtist }))
    )
  );

  // 3. 服务器磁盘检测：严格基于服务端落盘记录（避免客户端离线缓存污染）
  const isServer =
    Boolean(trackIsPhysicalServer) ||
    isCurPlayingServer ||
    (validNum && taskState.downloadedSet.has(numId)) ||
    (strId !== '' && taskState.downloadedCustomSet.has(strId)) ||
    (comboKey !== '' && taskState.downloadedCustomSet.has(comboKey));

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
    return variant === 'desktop' ? t('track.actionPauseDesktop') : t('track.actionPlaying');
  }
  if (variant === 'desktop') {
    return isLocal ? t('track.actionLocalDesktop') : t('track.actionTrialDesktop');
  }
  if (variant === 'short') {
    return isLocal ? t('track.actionPlayShort') : t('track.actionTrialShort');
  }
  // full mode
  return isLocal ? t('track.actionPlayLocalFull') : t('track.actionTrialOnlineFull');
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
      curTrack.name !== '未知曲目' && // i18n-ignore
      curTrack.name !== '未知' && // i18n-ignore
      curTrack.name.trim() === targetName.trim()
    ) {
      const targetArtist = typeof target.artist === 'string' ? target.artist : '';
      if (
        curTrack.artist &&
        targetArtist &&
        curTrack.artist !== '未知歌手' && // i18n-ignore
        curTrack.artist !== '未知' && // i18n-ignore
        curTrack.artist.trim() === targetArtist.trim()
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 👑 判定曲目是否为版权付费/VIP受限歌曲 (优先遵循音源插件自身判断，兼顾多层 raw 容错解析)
 */
export function isVipOrPaidTrack(track: any): boolean {
  if (!track) return false;
  // 1. 首选：插件本身已经标准化输出的 isVip / vip 标识
  if (track.isVip === true || track.vip === true) return true;

  // 2. 解包多层 raw 结构 (防止外部包装或多重嵌套丢弃 isVip)
  let raw = track.raw || track;
  while (raw && typeof raw === 'object') {
    if (raw.isVip === true || raw.vip === true) return true;
    if (raw.raw && raw.raw !== raw) {
      raw = raw.raw;
    } else {
      break;
    }
  }

  // 3. 兜底各音源私有字段容错 (Kugou)
  if (
    (typeof raw.privilege === 'number' && raw.privilege >= 8) ||
    (typeof raw.sqprivilege === 'number' && raw.sqprivilege >= 8) ||
    (typeof raw['320privilege'] === 'number' && raw['320privilege'] >= 8) ||
    (typeof raw.highprivilege === 'number' && raw.highprivilege >= 8) ||
    (typeof raw['128privilege'] === 'number' && raw['128privilege'] >= 8) ||
    (typeof raw.pay_type === 'number' && raw.pay_type > 0) ||
    (typeof raw.pay_type_sq === 'number' && raw.pay_type_sq > 0) ||
    (typeof raw.pay_type_320 === 'number' && raw.pay_type_320 > 0) ||
    raw.fail_process === 4 ||
    raw.fail_process === 12 ||
    raw.fail_process_320 === 4 ||
    raw.fail_process_sq === 4 ||
    (typeof raw.pkg_price === 'number' && raw.pkg_price > 0) ||
    (typeof raw.pkg_price_sq === 'number' && raw.pkg_price_sq > 0) ||
    (typeof raw.pkg_price_320 === 'number' && raw.pkg_price_320 > 0) ||
    (typeof raw.price === 'number' && raw.price > 0) ||
    (typeof raw.price_sq === 'number' && raw.price_sq > 0) ||
    (typeof raw.price_320 === 'number' && raw.price_320 > 0) ||
    raw.old_cpy === 1 ||
    raw.feetype > 0 ||
    raw.error === '需要付费'
  ) {
    return true;
  }
  // QQ Music
  if (
    raw.pay?.payplay === 1 ||
    raw.pay?.paydownload === 1 ||
    raw.pay?.payinfo === 1 ||
    raw.pay?.paytrackmouth === 1 ||
    raw.action?.payplay === 1 ||
    raw.action?.pay_play === 1 ||
    raw.alertid === 2 ||
    raw.result === 104003 ||
    raw.isvip === 1
  ) {
    return true;
  }
  // Generic / NetEase / MusicFree plugins
  if (
    raw.freeTrial === true ||
    raw.fee === 1 ||
    raw.fee === 4 ||
    raw.fee === 8
  ) {
    return true;
  }
  return false;
}



