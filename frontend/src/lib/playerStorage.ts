import type { Track } from './types';

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

/**
 * 🛡️ 清洗曲目对象中的易失性临时 URL (如 blob: URL 仅单次页面会话有效，跨天或刷新即失效，严禁持久化)
 */
export function sanitizeTrackForStorage(track: Track): Track {
  if (!track) return track;
  if (track.url && track.url.startsWith('blob:')) {
    return {
      ...track,
      url: track.id ? `/v3/stream?id=${track.id}` : ''
    };
  }
  return track;
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
  if (typeof localStorage === 'undefined') return;
  try {
    const cleanQueue = (state.queue || []).map(sanitizeTrackForStorage);
    localStorage.setItem('wyyyy_player_queue', JSON.stringify(cleanQueue));
    localStorage.setItem('wyyyy_player_index', String(state.qIndex));
    localStorage.setItem(
      'wyyyy_player_mode',
      state.playMode === 'list' ? 'loop' : state.playMode === 'shuffle' ? 'random' : 'single'
    );
    if (state.curTime > 0) {
      localStorage.setItem('wyyyy_player_time', String(state.curTime));
    }
    localStorage.setItem('wyyyy_player_auto_skip_trial', String(state.autoSkipTrial));
    localStorage.setItem('wyyyy_player_server_only', String(state.serverOnly));
    localStorage.setItem('wyyyy_player_offline_only', String(state.offlineOnly));
    if (state.playlistId !== undefined && state.playlistId !== null) {
      localStorage.setItem('wyyyy_player_playlist_id', String(state.playlistId));
    } else {
      localStorage.removeItem('wyyyy_player_playlist_id');
    }
  } catch (e) {}
}

export function loadPlayerStateFromStorage(): Partial<PlayerPersistedState> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const qStr = localStorage.getItem('wyyyy_player_queue');
    const idxStr = localStorage.getItem('wyyyy_player_index');
    const modeStr = localStorage.getItem('wyyyy_player_mode');
    const timeStr = localStorage.getItem('wyyyy_player_time');
    const skipTrialStr = localStorage.getItem('wyyyy_player_auto_skip_trial');
    const serverStr = localStorage.getItem('wyyyy_player_server_only');
    const offlineStr = localStorage.getItem('wyyyy_player_offline_only');

    const result: Partial<PlayerPersistedState> = {};
    if (qStr) {
      const parsedQueue = JSON.parse(qStr);
      if (Array.isArray(parsedQueue) && parsedQueue.length > 0) {
        result.queue = parsedQueue.map(sanitizeTrackForStorage);
        let idx = parseInt(idxStr || '0', 10);
        if (isNaN(idx) || idx < 0 || idx >= parsedQueue.length) idx = 0;
        result.qIndex = idx;
      }
    }
    if (modeStr === 'single') result.playMode = 'single';
    else if (modeStr === 'random') result.playMode = 'shuffle';
    else if (modeStr) result.playMode = 'list';

    // 默认跳过试听为 true
    result.autoSkipTrial = skipTrialStr !== null ? skipTrialStr === 'true' : true;
    if (serverStr !== null) result.serverOnly = serverStr === 'true';
    if (offlineStr !== null) result.offlineOnly = offlineStr === 'true';

    const seekTime = parseFloat(timeStr || '0') || 0;
    if (seekTime > 0) result.curTime = seekTime;

    const playlistId = localStorage.getItem('wyyyy_player_playlist_id');
    if (playlistId) result.playlistId = playlistId;

    return result;
  } catch (e) {
    return {};
  }
}
