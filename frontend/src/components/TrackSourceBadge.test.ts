import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TrackSourceBadge from './TrackSourceBadge.svelte';
import { markSongDownloaded } from '../lib/trackStatus.svelte';
import { taskState } from '../lib/taskStore.svelte';

describe('TrackSourceBadge Component', () => {
  beforeEach(() => {
    taskState.downloadedSet = new Set();
  });

  it('renders server badge when track is downloaded on server', () => {
    markSongDownloaded(12345);

    const { getByTitle } = render(TrackSourceBadge, {
      props: {
        id: 12345
      }
    });

    const badge = getByTitle(/已下载到本地服务器磁盘/);
    expect(badge).toBeDefined();
    expect(badge.textContent?.trim()).toBe('🖥️');
  });

  it('triggers onReveal and wyyyy:reveal event on PC double click', async () => {
    markSongDownloaded(12345);
    const onReveal = vi.fn();
    const globalRevealListener = vi.fn();
    window.addEventListener('wyyyy:reveal', globalRevealListener);

    const { getByTitle } = render(TrackSourceBadge, {
      props: {
        id: 12345,
        name: '晴天',
        artist: '周杰伦',
        onReveal
      }
    });

    const badge = getByTitle(/已下载到本地服务器磁盘/);
    await fireEvent.dblClick(badge);

    expect(onReveal).toHaveBeenCalledWith({
      id: 12345,
      name: '晴天',
      artist: '周杰伦',
      path: ''
    });
    expect(globalRevealListener).toHaveBeenCalled();

    window.removeEventListener('wyyyy:reveal', globalRevealListener);
  });

  it('triggers onReveal on mobile touch long press', async () => {
    vi.useFakeTimers();
    markSongDownloaded(88888);
    const onReveal = vi.fn();

    const { getByTitle } = render(TrackSourceBadge, {
      props: {
        id: 88888,
        name: '七里香',
        onReveal
      }
    });

    const badge = getByTitle(/已下载到本地服务器磁盘/);

    // 模拟 touchstart
    await fireEvent.touchStart(badge, {
      touches: [{ clientX: 100, clientY: 100 }]
    });

    // 快进 550ms 触发长按
    vi.advanceTimersByTime(550);

    expect(onReveal).toHaveBeenCalledWith({
      id: 88888,
      name: '七里香',
      artist: '',
      path: ''
    });

    vi.useRealTimers();
  });
});
