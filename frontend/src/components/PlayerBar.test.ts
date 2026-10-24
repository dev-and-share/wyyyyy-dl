import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PlayerBar from './PlayerBar.svelte';
import { skin } from '../lib/skinStore.svelte';

describe('PlayerBar smoke & skin switching test', () => {
  beforeEach(() => {
    skin._reset();
  });

  const dummyTrack = {
    id: '123',
    name: '测试歌曲',
    artist: '测试歌手',
    cover: 'https://example.com/cover.jpg',
    isLocal: false
  };

  it('renders without ReferenceError and adapts to different player skins', async () => {
    const { container, rerender } = render(PlayerBar, {
      curTrack: dummyTrack,
      queue: [dummyTrack],
      playing: true,
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

    // 切换到 Winamp 皮肤，底栏应当渲染 Winamp 频谱示波器
    skin.set('winamp');
    expect(skin.current).toBe('winamp');

    // 切换到磁带皮肤
    skin.set('cassette');
    expect(skin.current).toBe('cassette');

    // 切换到极光皮肤
    skin.set('aurora');
    expect(skin.current).toBe('aurora');
  });

  it('supports minimized bubble in different skin modes', () => {
    skin.set('winamp');
    const { container } = render(PlayerBar, {
      curTrack: dummyTrack,
      queue: [dummyTrack],
      playing: true,
      curTime: 10,
      duration: 100,
      playMode: 'list',
      vol: 0.8,
      likedSet: new Set([123]),
      minimized: true,
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

    expect(container.querySelector('.player-minimized-bubble')).toBeTruthy();
  });
});
