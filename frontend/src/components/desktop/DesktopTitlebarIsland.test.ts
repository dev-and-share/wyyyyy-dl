import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DesktopTitlebarIsland from './DesktopTitlebarIsland.svelte';
import type { Track } from '../../lib/types';

describe('DesktopTitlebarIsland Component', () => {
  const mockTrack: Track = {
    id: 12345,
    name: '苦守护这个家',
    artist: '徐某某',
    al: { name: '测试专辑' },
    cover: 'https://example.com/cover.jpg'
  };

  it('renders ambient idle mode when curTrack is null', () => {
    const { getByTestId, queryByTestId, getByText } = render(DesktopTitlebarIsland, {
      curTrack: null,
      playing: false
    });

    expect(getByTestId('desktop-titlebar-island')).toBeInTheDocument();
    expect(getByTestId('titlebar-island-idle')).toBeInTheDocument();
    expect(queryByTestId('titlebar-island-active')).toBeNull();
    expect(getByText(/WYY · Whatever You Yearn/i)).toBeInTheDocument();
  });

  it('renders active dynamic island when curTrack is present', () => {
    const { getByTestId, getByText, queryByTestId } = render(DesktopTitlebarIsland, {
      curTrack: mockTrack,
      playing: true
    });

    expect(getByTestId('titlebar-island-active')).toBeInTheDocument();
    expect(queryByTestId('titlebar-island-idle')).toBeNull();
    expect(getByText('苦守护这个家')).toBeInTheDocument();
    expect(getByText('徐某某')).toBeInTheDocument();
  });

  it('triggers onOpenLyric when clicking active island pill', async () => {
    const onOpenLyric = vi.fn();
    const { getByTestId } = render(DesktopTitlebarIsland, {
      curTrack: mockTrack,
      playing: true,
      onOpenLyric
    });

    const islandPill = getByTestId('titlebar-island-active');
    await fireEvent.click(islandPill);
    expect(onOpenLyric).toHaveBeenCalledTimes(1);
  });

  it('triggers onTogglePlay when clicking play/pause micro button inside island', async () => {
    const onTogglePlay = vi.fn();
    const onOpenLyric = vi.fn();
    const { getByTestId } = render(DesktopTitlebarIsland, {
      curTrack: mockTrack,
      playing: true,
      onTogglePlay,
      onOpenLyric
    });

    const playBtn = getByTestId('btn-island-toggle-play');
    await fireEvent.click(playBtn);
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
    // Clicking the play button should stop propagation and not trigger onOpenLyric
    expect(onOpenLyric).not.toHaveBeenCalled();
  });
});
