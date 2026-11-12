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

  it('triggers onReveal and wyy:reveal event on PC double click', async () => {
    markSongDownloaded(12345);
    const onReveal = vi.fn();
    const globalRevealListener = vi.fn();
    window.addEventListener('wyy:reveal', globalRevealListener);

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

    window.removeEventListener('wyy:reveal', globalRevealListener);
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

  it('renders tile variant for player quick actions and triggers onReveal on click', async () => {
    markSongDownloaded(99999);
    const onReveal = vi.fn();

    const { getByTitle } = render(TrackSourceBadge, {
      props: {
        id: 99999,
        name: '夜曲',
        artist: '周杰伦',
        variant: 'tile',
        onReveal
      }
    });

    const tile = getByTitle(/已下载到本地服务器磁盘/);
    expect(tile).toBeDefined();
    expect(tile.className).toContain('w-[42px]');
    expect(tile.className).toContain('h-[42px]');
    expect(tile.className).toContain('rounded-2xl');

    // tile 变体在手机模式下支持直接单触点击呼出文件路径模态框
    await fireEvent.click(tile);
    expect(onReveal).toHaveBeenCalledWith({
      id: 99999,
      name: '夜曲',
      artist: '周杰伦',
      path: ''
    });
  });

  it('falls back to curTrack metadata when props name/artist/path are omitted', async () => {
    const onReveal = vi.fn();
    const curTrackMock = {
      id: 108242,
      name: '她说',
      artist: '林俊杰',
      filePath: '/media/external/下载音乐/80后经典流行歌曲.com/林俊杰 - 她说.mp3',
      isLocal: true
    };

    const { getByTitle } = render(TrackSourceBadge, {
      props: {
        id: 108242,
        isLocal: true,
        curTrack: curTrackMock,
        onReveal
      }
    });

    const badge = getByTitle(/已下载到本地服务器磁盘/);
    expect(badge).toBeDefined();

    await fireEvent.dblClick(badge);

    expect(onReveal).toHaveBeenCalledWith({
      id: 108242,
      name: '她说',
      artist: '林俊杰',
      path: '/media/external/下载音乐/80后经典流行歌曲.com/林俊杰 - 她说.mp3'
    });
  });
});
