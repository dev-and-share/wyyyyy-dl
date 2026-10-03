import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerStore, shuffleArray } from './playerStore.svelte';
import type { Track } from './types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value.toString(); }),
    clear: vi.fn(() => { store = {}; })
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('PlayerStore WYSIWYG shuffle & deterministic queue navigation', () => {
  let store: PlayerStore;

  const sampleTracks: Track[] = [
    { id: 1, name: '晴天', artist: '周杰伦' },
    { id: 2, name: '七里香', artist: '周杰伦' },
    { id: 3, name: '夜曲', artist: '周杰伦' },
    { id: 4, name: '枫', artist: '周杰伦' },
    { id: 5, name: '借口', artist: '周杰伦' }
  ];

  beforeEach(() => {
    localStorageMock.clear();
    store = new PlayerStore();
    store.setQueue([...sampleTracks], 2); // 正在播放第 3 首「夜曲」(id: 3, index: 2)
  });

  it('shuffleArray preserves length and items', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(arr);
    expect(shuffled).toHaveLength(5);
    expect(new Set(shuffled)).toEqual(new Set(arr));
  });

  it('WYSIWYG shuffleQueue fixes current playing track at index 0 and shuffles the rest', () => {
    expect(store.qIndex).toBe(2);
    expect(store.activeTrack?.name).toBe('夜曲');

    const result = store.shuffleQueue();

    // 1. 当前正在播放的曲目必须固定置顶在 index 0
    expect(store.qIndex).toBe(0);
    expect(result[0].id).toBe(3);
    expect(result[0].name).toBe('夜曲');
    expect(store.activeTrack?.name).toBe('夜曲');

    // 2. 队列长度与所有曲目集合必须严格保持一致
    expect(result).toHaveLength(sampleTracks.length);
    const idSet = new Set(result.map(t => t.id));
    expect(idSet).toEqual(new Set(sampleTracks.map(t => t.id)));
  });

  it('determines next and previous track indices sequentially in list mode', () => {
    store.playMode = 'list';
    store.qIndex = 2; // 当前 index 2

    // 下一首必须是 index 3
    expect(store.getNextTrackIndex()).toBe(3);
    expect(store.getNextTrack()?.name).toBe('枫');

    // 上一首必须是 index 1
    expect(store.getPrevTrackIndex()).toBe(1);
    expect(store.getPrevTrack()?.name).toBe('七里香');
  });

  it('wraps around queue boundaries correctly', () => {
    store.playMode = 'list';

    // 队列末尾切下一首，循环回第 0 项
    store.qIndex = 4;
    expect(store.getNextTrackIndex()).toBe(0);

    // 队列首部切上一首，循环到末尾最后一项
    store.qIndex = 0;
    expect(store.getPrevTrackIndex()).toBe(4);
  });

  it('single mode keeps index fixed on next and prev', () => {
    store.playMode = 'single';
    store.qIndex = 2;

    expect(store.getNextTrackIndex()).toBe(2);
    expect(store.getPrevTrackIndex()).toBe(2);
  });

  it('stepNext and stepPrev advance and rewind index deterministically', () => {
    store.playMode = 'list';
    store.qIndex = 1;
    store.curTime = 120;

    store.stepNext();
    expect(store.qIndex).toBe(2);
    expect(store.curTime).toBe(0); // 进度归零

    store.stepPrev();
    expect(store.qIndex).toBe(1);
    expect(store.curTime).toBe(0);
  });

  it('togglePlayMode cycles list -> single -> shuffle (with instant shuffle) -> list', () => {
    store.playMode = 'list';
    store.qIndex = 2;

    const m1 = store.togglePlayMode();
    expect(m1).toBe('single');
    expect(store.playMode).toBe('single');

    const m2 = store.togglePlayMode();
    expect(m2).toBe('shuffle');
    // 进入 shuffle 模式瞬间，应当已执行 shuffleQueue()，当前曲目置顶且 qIndex 归零
    expect(store.qIndex).toBe(0);
    expect(store.queue[0].name).toBe('夜曲');

    const m3 = store.togglePlayMode();
    expect(m3).toBe('list');
    expect(store.playMode).toBe('list');
  });

  it('safely handles empty or 1-item queue shuffle', () => {
    const emptyStore = new PlayerStore();
    expect(emptyStore.shuffleQueue()).toEqual([]);

    const singleStore = new PlayerStore();
    singleStore.setQueue([{ id: 99, name: '单曲', artist: '一人' }], 0);
    expect(singleStore.shuffleQueue()).toHaveLength(1);
    expect(singleStore.qIndex).toBe(0);
  });

  it('returns -1 when all tracks in queue are trial tracks and autoSkipTrial is enabled', () => {
    const trialStore = new PlayerStore();
    trialStore.autoSkipTrial = true;
    trialStore.setQueue([
      { id: 101, name: '试听1', artist: '歌手', freeTrial: true },
      { id: 102, name: '试听2', artist: '歌手', freeTrial: true }
    ], 0);

    expect(trialStore.getNextTrackIndex()).toBe(-1);
    expect(trialStore.getPrevTrackIndex()).toBe(-1);
    expect(trialStore.getNextTrack()).toBeNull();
    expect(trialStore.getPrevTrack()).toBeNull();
  });

  it('setQueue in shuffle mode shuffles entire queue and starts at index 0 for whole playlist', () => {
    store.playMode = 'shuffle';
    store.playlistId = null;

    store.setQueue([...sampleTracks], {
      startIndex: 0,
      playlistId: '12345',
      isExplicitTrack: false
    });

    expect(store.playlistId).toBe('12345');
    expect(store.qIndex).toBe(0);
    expect(store.queue).toHaveLength(5);
    // 集合保持一致
    expect(new Set(store.queue.map(t => t.id))).toEqual(new Set(sampleTracks.map(t => t.id)));
  });

  it('setQueue in shuffle mode with explicit track fixes selected track at index 0 and shuffles others', () => {
    store.playMode = 'shuffle';

    // 用户在歌单中点了第 4 首「枫」(id: 4, index: 3)
    store.setQueue([...sampleTracks], {
      startIndex: 3,
      playlistId: '12345',
      isExplicitTrack: true
    });

    expect(store.playlistId).toBe('12345');
    expect(store.qIndex).toBe(0);
    expect(store.queue[0].id).toBe(4);
    expect(store.queue[0].name).toBe('枫');
    expect(store.activeTrack?.name).toBe('枫');
    expect(store.queue).toHaveLength(5);
    expect(new Set(store.queue.map(t => t.id))).toEqual(new Set(sampleTracks.map(t => t.id)));
  });

  it('setQueue in list mode preserves exact array order and startIndex', () => {
    store.playMode = 'list';

    store.setQueue([...sampleTracks], 2, '54321');

    expect(store.playlistId).toBe('54321');
    expect(store.qIndex).toBe(2);
    expect(store.activeTrack?.name).toBe('夜曲');
    expect(store.queue[0].name).toBe('晴天');
  });

  it('clearQueue resets playlistId and clears state', () => {
    store.setQueue([...sampleTracks], 0, '999');
    expect(store.playlistId).toBe('999');

    store.clearQueue();
    expect(store.playlistId).toBeNull();
    expect(store.queue).toHaveLength(0);
    expect(store.qIndex).toBe(0);
  });

  it('automatically skips unplayable tracks to next valid track', () => {
    const tracksWithUnplayable: Track[] = [
      { id: 1, name: '晴天', artist: '周杰伦' },
      { id: 2, name: '晚风', artist: '浪哥', unplayable: true },
      { id: 3, name: '夜曲', artist: '周杰伦' }
    ];
    store.setQueue(tracksWithUnplayable, 0);

    expect(store.isValidTrack(tracksWithUnplayable[1])).toBe(false);
    expect(store.getNextTrackIndex()).toBe(2); // 跳过不可播的第 1 项，直接返回第 2 项

    store.stepNext();
    expect(store.qIndex).toBe(2);
    expect(store.activeTrack?.name).toBe('夜曲');
  });

  it('returns -1 when all subsequent tracks are unplayable', () => {
    const allUnplayable: Track[] = [
      { id: 1, name: '晚风1', artist: '浪哥', unplayable: true },
      { id: 2, name: '晚风2', artist: '浪哥', unplayable: true }
    ];
    store.setQueue(allUnplayable, 0);

    expect(store.getNextTrackIndex()).toBe(-1);
  });
});
