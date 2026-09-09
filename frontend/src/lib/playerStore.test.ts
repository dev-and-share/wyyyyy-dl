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
});
