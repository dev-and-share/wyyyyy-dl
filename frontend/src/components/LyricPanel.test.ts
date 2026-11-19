import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LyricPanel from './LyricPanel.svelte';

describe('LyricPanel Component', () => {
  beforeEach(() => {
    // 为 jsdom 补全 scrollTo 模拟
    window.HTMLElement.prototype.scrollTo = vi.fn();
  });

  const mockTrack = {
    id: '123',
    name: '晴天',
    artist: '周杰伦',
    lyric: '[00:00.00] 故事的小黄花\n[00:05.00] 从出生那年就飘着\n[00:10.00] 童年的荡秋千\n[00:15.00] 随记忆一直晃到现在'
  };

  it('renders all lyric lines and highlights the active line', () => {
    const { getByText } = render(LyricPanel, {
      props: {
        track: mockTrack,
        currentTime: 7, // 对应第 1 行 (从出生那年就飘着)
        onSeekTime: vi.fn(),
        skinId: 'vinyl'
      }
    });

    expect(getByText('故事的小黄花')).toBeInTheDocument();
    const activeLine = getByText('从出生那年就飘着');
    expect(activeLine).toBeInTheDocument();
    expect(activeLine.className).toContain('text-red-500'); // vinyl skin active highlight
  });

  it('uses container.scrollTo instead of scrollIntoView, ensuring parent and stage never scroll', async () => {
    const scrollIntoViewSpy = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;

    const { container, rerender } = render(LyricPanel, {
      props: {
        track: mockTrack,
        currentTime: 0,
        onSeekTime: vi.fn(),
        skinId: 'vinyl'
      }
    });

    const scrollContainer = container.querySelector('#lyricModalContent') as HTMLElement;
    expect(scrollContainer).not.toBeNull();

    const scrollToSpy = vi.fn();
    scrollContainer.scrollTo = scrollToSpy;

    // 更新时间到第 2 行 (00:10.00)
    await rerender({
      track: mockTrack,
      currentTime: 12,
      onSeekTime: vi.fn(),
      skinId: 'vinyl'
    });

    await waitFor(() => {
      // 确认绝对没有触发 scrollIntoView
      expect(scrollIntoViewSpy).not.toHaveBeenCalled();
      // 确认使用的是容器自身的 scrollTo
      expect(scrollToSpy).toHaveBeenCalled();
    });
  });

  it('supports mouse drag to scroll and refocuses after 3s delay', async () => {
    vi.useFakeTimers();
    const { container, rerender } = render(LyricPanel, {
      props: {
        track: mockTrack,
        currentTime: 0,
        onSeekTime: vi.fn(),
        skinId: 'vinyl'
      }
    });

    const scrollContainer = container.querySelector('#lyricModalContent') as HTMLElement;
    const scrollToSpy = vi.fn();
    scrollContainer.scrollTo = scrollToSpy;

    // 鼠标在歌词区按住拖拽 (mousedown -> mousemove -> mouseup)
    await fireEvent.mouseDown(scrollContainer, { clientY: 300, button: 0 });
    await fireEvent.mouseMove(window, { clientY: 200 }); // 向上拖动 100px
    scrollToSpy.mockClear();

    // 此时正在拖动中，播放推进也不应强行拉回
    await rerender({
      track: mockTrack,
      currentTime: 6,
      onSeekTime: vi.fn(),
      skinId: 'vinyl'
    });
    expect(scrollToSpy).not.toHaveBeenCalled();

    // 松开鼠标 (mouseup)，启动 3s 倒计时
    await fireEvent.mouseUp(window);
    expect(scrollToSpy).not.toHaveBeenCalled();

    // 推进 3000ms 后重新聚焦回当前行
    vi.advanceTimersByTime(3000);
    expect(scrollToSpy).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('triggers onSeekTime and immediately centers line on click', async () => {
    const onSeekTime = vi.fn();
    const { getByText, container } = render(LyricPanel, {
      props: {
        track: mockTrack,
        currentTime: 0,
        onSeekTime,
        skinId: 'vinyl'
      }
    });

    const scrollContainer = container.querySelector('#lyricModalContent') as HTMLElement;
    const scrollToSpy = vi.fn();
    scrollContainer.scrollTo = scrollToSpy;

    const targetLine = getByText('随记忆一直晃到现在');
    await fireEvent.click(targetLine);

    expect(onSeekTime).toHaveBeenCalledWith(15);
    expect(scrollToSpy).toHaveBeenCalled();
  });
});
