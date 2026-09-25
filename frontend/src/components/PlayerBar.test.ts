import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import PlayerBar from './PlayerBar.svelte';

describe('PlayerBar smoke & binding test', () => {
  it('renders without ReferenceError when curTrack and queue are provided', () => {
    const dummyTrack = {
      id: '123',
      name: '测试歌曲',
      artist: '测试歌手',
      cover: '',
      isLocal: false
    };

    const { container } = render(PlayerBar, {
      curTrack: dummyTrack,
      queue: [dummyTrack],
      playing: false,
      curTime: 10,
      duration: 100,
      playMode: 'list',
      vol: 0.8,
      likedSet: new Set([123]),
      onTogglePlay: vi.fn(),
      onPrev: vi.fn(),
      onNext: vi.fn(),
      onToggleMode: vi.fn(),
      onSeek: vi.fn(),
      onLyric: vi.fn(),
      onPeq: vi.fn(),
      onQueue: vi.fn(),
      onClearQueue: vi.fn(),
      onToggleLike: vi.fn()
    });

    expect(container).toBeTruthy();
  });
});
