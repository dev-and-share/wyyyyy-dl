import { describe, it, expect, beforeEach } from 'vitest';
import { savePlayerStateToStorage, loadPlayerStateFromStorage } from './playerStorage';
import type { Track } from './types';

describe('playerStorage persistence contracts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and restores full player state including curTime breakpoint', () => {
    const mockQueue: Track[] = [
      { id: 1, name: '晴天', artist: '周杰伦' },
      { id: 2, name: '稻香', artist: '周杰伦' }
    ];

    savePlayerStateToStorage({
      queue: mockQueue,
      qIndex: 1,
      playMode: 'shuffle',
      curTime: 92.5,
      autoSkipTrial: true,
      offlineOnly: false
    });

    const state = loadPlayerStateFromStorage();

    expect(state.queue).toHaveLength(2);
    expect(state.queue?.[1].name).toBe('稻香');
    expect(state.qIndex).toBe(1);
    expect(state.playMode).toBe('shuffle');
    // 关键断点验证：必须能够无损还原 92.5 秒供冷启动续播
    expect(state.curTime).toBe(92.5);
    expect(state.autoSkipTrial).toBe(true);
    expect(state.offlineOnly).toBe(false);
  });

  it('handles invalid or corrupted storage data gracefully', () => {
    localStorage.setItem('wyyyy_player_queue', 'invalid json format');
    localStorage.setItem('wyyyy_player_index', '999'); // 越界
    localStorage.setItem('wyyyy_player_time', 'NaN');

    const state = loadPlayerStateFromStorage();

    expect(state.queue).toBeUndefined();
    expect(state.curTime).toBeUndefined();
  });

  it('resets index to 0 if out of bounds', () => {
    const mockQueue: Track[] = [{ id: 1, name: '青花瓷', artist: '周杰伦' }];
    localStorage.setItem('wyyyy_player_queue', JSON.stringify(mockQueue));
    localStorage.setItem('wyyyy_player_index', '10'); // 超过队列长度

    const state = loadPlayerStateFromStorage();
    expect(state.qIndex).toBe(0);
  });
});
