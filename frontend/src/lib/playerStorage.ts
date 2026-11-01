import type { Track } from './types';
import { sanitizeTrackForStorage as coreSanitizeTrack, PlayerStorageAdapter } from 'pwa-audio-player';

export interface PlayerPersistedState {
  queue: Track[];
  qIndex: number;
  playMode: 'list' | 'single' | 'shuffle';
  curTime: number;
  autoSkipTrial: boolean;
  serverOnly: boolean;
  offlineOnly: boolean;
  playlistId?: string | null;
}

const storageAdapter = new PlayerStorageAdapter<Track>({
  prefix: 'wyyyy_player_',
  fallbackUrl: (id) => `/v3/stream?id=${id}`
});

/**
 * 🛡️ 清洗曲目对象中的易失性临时 URL (如 blob: URL 仅单次页面会话有效，跨天或刷新即失效，严禁持久化)
 */
export function sanitizeTrackForStorage(track: Track): Track {
  return coreSanitizeTrack(track, {
    fallbackUrl: (id) => `/v3/stream?id=${id}`
  });
}

export function savePlayerStateToStorage(state: {
  queue: Track[];
  qIndex: number;
  playMode: 'list' | 'single' | 'shuffle';
  curTime: number;
  autoSkipTrial: boolean;
  serverOnly: boolean;
  offlineOnly: boolean;
  playlistId?: string | number | null;
}) {
  const modeMap = { list: 'loop', shuffle: 'random', single: 'single' } as const;
  storageAdapter.save({
    queue: state.queue,
    queueIndex: state.qIndex,
    playMode: modeMap[state.playMode] || 'loop',
    currentTime: state.curTime,
    auto_skip_trial: state.autoSkipTrial,
    server_only: state.serverOnly,
    offline_only: state.offlineOnly,
    playlist_id: state.playlistId !== undefined && state.playlistId !== null ? String(state.playlistId) : null
  });
}

export function loadPlayerStateFromStorage(): Partial<PlayerPersistedState> {
  const raw = storageAdapter.load();
  const result: Partial<PlayerPersistedState> = {};

  if (raw.queue && Array.isArray(raw.queue) && raw.queue.length > 0) {
    result.queue = raw.queue as Track[];
    result.qIndex = raw.queueIndex ?? 0;
  }

  if (raw.playMode === 'single') result.playMode = 'single';
  else if (raw.playMode === 'random') result.playMode = 'shuffle';
  else if (raw.playMode) result.playMode = 'list';

  // 默认跳过试听为 true
  result.autoSkipTrial = raw.auto_skip_trial !== undefined ? Boolean(raw.auto_skip_trial) : true;
  if (raw.server_only !== undefined) result.serverOnly = Boolean(raw.server_only);
  if (raw.offline_only !== undefined) result.offlineOnly = Boolean(raw.offline_only);

  if (raw.currentTime && raw.currentTime > 0) {
    result.curTime = raw.currentTime;
  }

  if (raw.playlist_id) {
    result.playlistId = String(raw.playlist_id);
  }

  return result;
}
