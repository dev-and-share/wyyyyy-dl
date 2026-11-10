import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DesktopTitlebarIsland from './DesktopTitlebarIsland.svelte';
import { playerStore } from '../../lib/player/playerStore.svelte';
import type { Track } from '../../lib/types';

describe('DesktopTitlebarIsland Component with Adaptive Dynamic Island States', () => {
  const mockTrackWithLyrics: Track = {
    id: 12345,
    name: '苦守护这个家',
    artist: '徐某某',
    al: { name: '测试专辑' },
    cover: 'https://example.com/cover.jpg',
    lyric: '[00:00.00]前奏\n[00:05.00]第一句走马灯歌词在这飞扬\n[00:10.00]第二句歌词'
  };

  const mockTrackWithoutLyrics: Track = {
    id: 67890,
    name: '纯音乐测试曲',
    artist: '房岳',
    al: { name: '小菜花' },
    cover: 'https://example.com/cover2.jpg'
  };

  beforeEach(() => {
    playerStore.curTime = 0;
    playerStore.playing = false;
  });

  it('renders ambient idle micro pill (96px) when curTrack is null', () => {
    const { getByTestId, queryByTestId, getByText } = render(DesktopTitlebarIsland, {
      curTrack: null,
      playing: false
    });

    expect(getByTestId('desktop-titlebar-island')).toBeInTheDocument();
    expect(getByTestId('titlebar-island-idle')).toBeInTheDocument();
    expect(queryByTestId('titlebar-island-active')).toBeNull();
    expect(queryByTestId('titlebar-island-paused')).toBeNull();
    expect(getByText('WYY')).toBeInTheDocument();
  });

  it('renders compact paused capsule (176px) when curTrack exists but is not playing', () => {
    const { getByTestId, queryByTestId, getByText } = render(DesktopTitlebarIsland, {
      curTrack: mockTrackWithLyrics,
      playing: false
    });

    expect(getByTestId('titlebar-island-paused')).toBeInTheDocument();
    expect(queryByTestId('titlebar-island-active')).toBeNull();
    expect(getByText('苦守护这个家')).toBeInTheDocument();
  });

  it('renders expanded active pill (320px) with track name and artist when playing without lyrics', () => {
    const { getByTestId, getByText } = render(DesktopTitlebarIsland, {
      curTrack: mockTrackWithoutLyrics,
      playing: true
    });

    expect(getByTestId('titlebar-island-active')).toBeInTheDocument();
    expect(getByText('纯音乐测试曲')).toBeInTheDocument();
    expect(getByText('房岳')).toBeInTheDocument();
  });

  it('renders live marquee lyric when playing and active lyric is available', () => {
    playerStore.curTime = 6; // Hit the 00:05 line: "第一句走马灯歌词在这飞扬"

    const { getByTestId, getByText } = render(DesktopTitlebarIsland, {
      curTrack: mockTrackWithLyrics,
      playing: true
    });

    expect(getByTestId('titlebar-island-active')).toBeInTheDocument();
    expect(getByText('第一句走马灯歌词在这飞扬')).toBeInTheDocument();
  });

  it('triggers onOpenLyric when clicking active or paused island pill', async () => {
    const onOpenLyric = vi.fn();
    const { getByTestId } = render(DesktopTitlebarIsland, {
      curTrack: mockTrackWithLyrics,
      playing: true,
      onOpenLyric
    });

    const islandPill = getByTestId('titlebar-island-active');
    await fireEvent.click(islandPill);
    expect(onOpenLyric).toHaveBeenCalledTimes(1);
  });

  it('triggers onTogglePlay and dispatches wyy:toggle-play cleanly once on play button click', async () => {
    const onTogglePlay = vi.fn();
    const onOpenLyric = vi.fn();
    const togglePlayListener = vi.fn();
    window.addEventListener('wyy:toggle-play', togglePlayListener);

    const { getByTestId } = render(DesktopTitlebarIsland, {
      curTrack: mockTrackWithLyrics,
      playing: false,
      onTogglePlay,
      onOpenLyric
    });

    const playBtn = getByTestId('btn-island-toggle-play');
    await fireEvent.click(playBtn);
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
    expect(togglePlayListener).not.toHaveBeenCalled(); // since onTogglePlay was provided, it does not double-dispatch!
    expect(onOpenLyric).not.toHaveBeenCalled();

    window.removeEventListener('wyy:toggle-play', togglePlayListener);
  });

  it('dispatches wyy:toggle-play if onTogglePlay callback is not provided', async () => {
    const togglePlayListener = vi.fn();
    window.addEventListener('wyy:toggle-play', togglePlayListener);

    const { getByTestId } = render(DesktopTitlebarIsland, {
      curTrack: mockTrackWithLyrics,
      playing: false
    });

    const playBtn = getByTestId('btn-island-toggle-play');
    await fireEvent.click(playBtn);
    expect(togglePlayListener).toHaveBeenCalledTimes(1);

    window.removeEventListener('wyy:toggle-play', togglePlayListener);
  });
});
