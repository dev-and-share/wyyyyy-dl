import type { Track } from '../types';
import { AudioSourceType } from '../types';
import { getTrackSourceStatus } from './trackStatus.svelte';
import { downloadExternalTrack } from '../musicfree/downloadHelper';

/**
 * 🎯 记录当前会话中已经静默提交服务器归档的曲目唯一标识 (防重复提交)
 */
const autoArchivedKeys = new Set<string>();

/**
 * 🧩 判断是否为第三方 / MusicFree 音源曲目
 */
export function isMusicFreeTrack(track: any): boolean {
  if (!track) return false;
  const strId = String(track.id || '');
  return (
    strId.startsWith('mf_') ||
    track._isMusicFree === true ||
    track.raw?._isMusicFree === true ||
    Boolean(track._pluginHash) ||
    Boolean(track.raw?._pluginId)
  );
}

/**
 * 🏷️ 智能从曲目元数据中解析出精准的 AudioSourceType 枚举/字符串
 */
export function resolveAudioSourceType(track: any): AudioSourceType | string {
  if (!track) return AudioSourceType.NETEASE;
  const strId = String(track.id || '');
  const raw = track.raw || {};
  const rawPlatform = String(track._pluginPlatform || raw._pluginPlatform || track.pluginName || raw.pluginName || '').toLowerCase();
  const pluginId = String(track._pluginId || raw._pluginId || track.pluginHash || '').toLowerCase();
  const fullText = `${strId} ${rawPlatform} ${pluginId}`.toLowerCase();

  const isMf = isMusicFreeTrack(track);
  if (!isMf) return AudioSourceType.NETEASE;

  if (fullText.includes('qq') || fullText.includes('tx') || fullText.includes('tencent')) {
    return AudioSourceType.MUSICFREE_QQ;
  }
  if (fullText.includes('kugou') || fullText.includes('酷狗') || fullText.includes('kg')) {
    return AudioSourceType.MUSICFREE_KUGOU;
  }
  if (fullText.includes('kuwo') || fullText.includes('酷我') || fullText.includes('kw')) {
    return AudioSourceType.MUSICFREE_KUWO;
  }
  if (fullText.includes('migu') || fullText.includes('咪咕') || fullText.includes('mg')) {
    return AudioSourceType.MUSICFREE_MIGU;
  }
  if (fullText.includes('bili') || fullText.includes('b站') || fullText.includes('哔哩')) {
    return AudioSourceType.MUSICFREE_BILIBILI;
  }
  if (fullText.includes('maoer') || fullText.includes('猫耳')) {
    return AudioSourceType.MUSICFREE_MAOERFM;
  }

  const cleanPlatform = rawPlatform.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (cleanPlatform && cleanPlatform !== 'musicfree') {
    return `musicfree-${cleanPlatform}`;
  }

  return AudioSourceType.MUSICFREE;
}

/**
 * 🔄 重置自动归档防重集合（主要用于单元测试与状态重置）
 */
export function resetAutoArchiveHistory(): void {
  autoArchivedKeys.clear();
}

/**
 * 🚀 监听播放进度，满足「播放过半 + 超过15s」且「尚未在服务器落盘」时，静默触发服务端下载入库
 * @param track 当前正在播放的曲目
 * @param curTime 当前播放时间 (秒)
 * @param duration 音频总时长 (秒)
 */
export function checkAndTriggerAutoArchive(
  track: Track | null,
  curTime: number,
  duration: number
): boolean {
  if (!track || !isMusicFreeTrack(track)) return false;
  if (!duration || isNaN(duration) || duration < 30) return false;
  if (curTime < 15 || curTime < duration / 2) return false;

  const trackKey = track.name && track.artist
    ? `${track.name.trim()}___${track.artist.trim()}`
    : String(track.id);

  if (autoArchivedKeys.has(trackKey)) {
    return false;
  }

  // 校验当前曲目是否已经在服务器磁盘
  const status = getTrackSourceStatus(
    track.id,
    track.isLocal,
    track,
    true,
    track.name,
    track.artist
  );
  if (status.isServer) {
    autoArchivedKeys.add(trackKey);
    return false;
  }

  autoArchivedKeys.add(trackKey);

  const targetSource = resolveAudioSourceType(track);

  // 🌟 静默投递后台下载任务至服务器，source 标记为具体枚举/字串 (如 musicfree-kugou)
  downloadExternalTrack(track, track.raw, undefined, {
    silent: true,
    source: targetSource
  }).catch((err) => {
    console.warn('[AutoArchive] 静默提交 MusicFree 自动落盘任务异常:', err);
  });

  return true;
}
