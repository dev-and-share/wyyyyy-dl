import type { Track } from './types';

export interface PlayerPersistedState {
  queue: Track[];
  qIndex: number;
  playMode: 'list' | 'single' | 'shuffle';
  curTime: number;
  autoSkipTrial: boolean;
  offlineOnly: boolean;
}

export function savePlayerStateToStorage(state: {
  queue: Track[];
  qIndex: number;
  playMode: 'list' | 'single' | 'shuffle';
  curTime: number;
  autoSkipTrial: boolean;
  offlineOnly: boolean;
}) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('wyyyy_player_queue', JSON.stringify(state.queue));
    localStorage.setItem('wyyyy_player_index', String(state.qIndex));
    localStorage.setItem(
      'wyyyy_player_mode',
      state.playMode === 'list' ? 'loop' : state.playMode === 'shuffle' ? 'random' : 'single'
    );
    if (state.curTime > 0) {
      localStorage.setItem('wyyyy_player_time', String(state.curTime));
    }
    localStorage.setItem('wyyyy_player_auto_skip_trial', String(state.autoSkipTrial));
    localStorage.setItem('wyyyy_player_offline_only', String(state.offlineOnly));
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
    const offlineStr = localStorage.getItem('wyyyy_player_offline_only');

    const result: Partial<PlayerPersistedState> = {};
    if (qStr) {
      const parsedQueue = JSON.parse(qStr);
      if (Array.isArray(parsedQueue) && parsedQueue.length > 0) {
        result.queue = parsedQueue;
        let idx = parseInt(idxStr || '0', 10);
        if (isNaN(idx) || idx < 0 || idx >= parsedQueue.length) idx = 0;
        result.qIndex = idx;
      }
    }
    if (modeStr === 'single') result.playMode = 'single';
    else if (modeStr === 'random') result.playMode = 'shuffle';
    else if (modeStr) result.playMode = 'list';

    if (skipTrialStr !== null) result.autoSkipTrial = skipTrialStr === 'true';
    if (offlineStr !== null) result.offlineOnly = offlineStr === 'true';

    const seekTime = parseFloat(timeStr || '0') || 0;
    if (seekTime > 0) result.curTime = seekTime;

    return result;
  } catch (e) {
    return {};
  }
}
