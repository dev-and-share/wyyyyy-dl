import { api } from '../api';
import type { Track } from '../types';
import { showToast } from '../toast.svelte';
import { t } from '../i18n';

export const SCROBBLE_STORAGE_KEY = 'wyy_scrobble_enabled';

// 防抖与去重记忆：记录最近打卡的歌曲 ID 与时间戳，防止单曲循环或短时间重复打卡
let lastScrobbledTrackId: string | number | null = null;
let lastScrobbledTimestamp = 0;

/**
 * 获取是否开启“播放完毕自动同步打卡到网易云” (默认开启)
 */
export function isScrobbleEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(SCROBBLE_STORAGE_KEY) !== 'false';
}

/**
 * 设置是否开启“播放完毕自动同步打卡到网易云”
 */
export function setScrobbleEnabled(enabled: boolean): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SCROBBLE_STORAGE_KEY, enabled ? 'true' : 'false');
  }
}

/**
 * 严格校验歌曲是否来自网易云官方曲库
 * 排除条件：
 * 1. 外部扫描导入但无网易云数字 ID 的曲目 (id 为 null/0/本地路径)
 * 2. MusicFree 插件复合 ID (以 mf_ 开头或携带插件元数据)
 * 3. 非纯数字正整型 ID
 */
export function isNeteaseTrack(track: Track | null | undefined): boolean {
  if (!track || !track.id) return false;

  const idStr = String(track.id).trim();

  // 1. 排除 MusicFree 插件音源
  if (idStr.startsWith('mf_')) return false;
  if (track.raw?._pluginId || track.raw?._pluginPlatform) return false;

  // 2. 排除本地路径或带非数字前缀的自定义曲目
  if (idStr.startsWith('/') || idStr.startsWith('local_')) return false;

  // 3. 严格校验纯数字且为正整型
  if (!/^\d+$/.test(idStr)) return false;

  const num = Number(idStr);
  return Number.isSafeInteger(num) && num > 0;
}

/**
 * 音频自然播放结束 (onended) 时触发打卡
 * @param track 当前播放结束的曲目
 * @param duration 音频总时长 (秒)
 * @param playlistId 当前播放来源歌单 ID (可选)
 */
export async function handleTrackEndedScrobble(
  track: Track | null | undefined,
  duration: number,
  playlistId?: string | number | null
): Promise<boolean> {
  // 1. 校验总开关
  if (!isScrobbleEnabled()) {
    return false;
  }

  // 2. 严格校验来源是否为网易云曲库
  if (!isNeteaseTrack(track)) {
    return false;
  }

  // 3. 校验音频播放时长的合理性 (排除 0 秒或异常短的断流音频)
  if (!duration || isNaN(duration) || duration < 5) {
    return false;
  }

  const songId = Number(track!.id);
  const now = Date.now();

  // 4. 防抖去重：同一首歌在 30 秒内不重复上报
  if (lastScrobbledTrackId === songId && now - lastScrobbledTimestamp < 30000) {
    return false;
  }

  // 5. 提取来源歌单 ID (若来源为纯数字网易云歌单则附带，否则置空)
  let sourceId: number | undefined = undefined;
  if (playlistId != null) {
    const plStr = String(playlistId).trim();
    if (/^\d+$/.test(plStr) && Number(plStr) > 0) {
      sourceId = Number(plStr);
    }
  }

  const playSeconds = Math.max(10, Math.round(duration));

  try {
    lastScrobbledTrackId = songId;
    lastScrobbledTimestamp = now;

    const res = await api.scrobble(songId, sourceId, playSeconds);
    if (res?.code === '000000' && res?.data === true) {
      showToast(t('toast.scrobble.success', { name: track!.name || '未知曲目' }), 'info', 2500);
      return true;
    }
    showToast(t('toast.scrobble.failed'), 'warning', 2500);
    return false;
  } catch (e) {
    console.debug('[Scrobble] 同步播放记录异常 (已安全降级):', e);
    showToast(t('toast.scrobble.failed'), 'warning', 2500);
    return false;
  }
}
