import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ImmersiveMiniPlayer from './ImmersiveMiniPlayer.svelte';

describe('ImmersiveMiniPlayer Component', () => {
  it('renders progress bar, times, and playback controls correctly', () => {
    const { getByTestId, getByText } = render(ImmersiveMiniPlayer, {
      props: {
        playing: false,
        curTime: 65,
        duration: 200,
        playMode: 'list',
        onTogglePlay: vi.fn(),
        onPrev: vi.fn(),
        onNext: vi.fn(),
        onToggleMode: vi.fn()
      }
    });

    expect(getByTestId('immersive-mini-player')).toBeInTheDocument();
    expect(getByText('01:05')).toBeInTheDocument();
    expect(getByText('03:20')).toBeInTheDocument();
    expect(getByTestId('mini-btn-play')).toBeInTheDocument();
    expect(getByTestId('mini-btn-prev')).toBeInTheDocument();
    expect(getByTestId('mini-btn-next')).toBeInTheDocument();
    expect(getByTestId('mini-btn-mode')).toBeInTheDocument();
    expect(getByTestId('mini-btn-drawer')).toBeInTheDocument();
  });

  it('triggers onTogglePlay, onPrev, onNext, onToggleMode, onToggleDrawer on click', async () => {
    const onTogglePlay = vi.fn();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onToggleMode = vi.fn();
    const onToggleDrawer = vi.fn();

    const { getByTestId } = render(ImmersiveMiniPlayer, {
      props: {
        playing: true,
        curTime: 30,
        duration: 100,
        playMode: 'single',
        onTogglePlay,
        onPrev,
        onNext,
        onToggleMode,
        onToggleDrawer
      }
    });

    await fireEvent.click(getByTestId('mini-btn-play'));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);

    await fireEvent.click(getByTestId('mini-btn-prev'));
    expect(onPrev).toHaveBeenCalledTimes(1);

    await fireEvent.click(getByTestId('mini-btn-next'));
    expect(onNext).toHaveBeenCalledTimes(1);

    await fireEvent.click(getByTestId('mini-btn-mode'));
    expect(onToggleMode).toHaveBeenCalledTimes(1);

    await fireEvent.click(getByTestId('mini-btn-drawer'));
    expect(onToggleDrawer).toHaveBeenCalledTimes(1);
  });

  it('triggers onSeekTime when clicking the progress bar', async () => {
    const onSeekTime = vi.fn();
    const { getByTestId } = render(ImmersiveMiniPlayer, {
      props: {
        playing: true,
        curTime: 0,
        duration: 200,
        playMode: 'list',
        onTogglePlay: vi.fn(),
        onPrev: vi.fn(),
        onNext: vi.fn(),
        onToggleMode: vi.fn(),
        onSeekTime
      }
    });

    const progressEl = getByTestId('mini-player-progressbar');
    // 模拟 getBoundingClientRect
    vi.spyOn(progressEl, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      width: 200,
      top: 0,
      bottom: 0,
      right: 300,
      height: 12,
      x: 100,
      y: 0,
      toJSON: () => {}
    });

    // 点击进度条中间（clientX = 200，对应 50% 进度 = 100s）
    await fireEvent.click(progressEl, { clientX: 200 });
    expect(onSeekTime).toHaveBeenCalledWith(100);
  });
});
