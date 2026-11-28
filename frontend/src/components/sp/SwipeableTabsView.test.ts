import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SwipeableTabsView from './SwipeableTabsView.svelte';

describe('SwipeableTabsView Component', () => {
  it('renders track and child content container with scroll-snap', () => {
    const { container, getByRole } = render(SwipeableTabsView, {
      props: {
        activeIndex: 0,
        count: 3,
        onChange: () => {}
      }
    });

    const region = getByRole('region', { name: 'Swipeable tab view' });
    expect(region).toBeDefined();
    expect(region.className).toContain('swipeable-tabs-viewport');
    const track = container.querySelector('.swipeable-tabs-track');
    expect(track).not.toBeNull();
  });

  it('detects page snap on scroll event and triggers onChange', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { getByRole } = render(SwipeableTabsView, {
      props: {
        activeIndex: 0,
        count: 3,
        onChange
      }
    });

    const region = getByRole('region', { name: 'Swipeable tab view' });
    Object.defineProperty(region, 'clientWidth', { value: 375, configurable: true });
    Object.defineProperty(region, 'scrollLeft', { value: 375, configurable: true });

    await fireEvent.scroll(region);
    vi.advanceTimersByTime(100);

    expect(onChange).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });

  it('handles active tab auto-height updates cleanly without throwing', () => {
    const { getByRole } = render(SwipeableTabsView, {
      props: {
        activeIndex: 1,
        count: 3,
        onChange: () => {}
      }
    });

    const region = getByRole('region', { name: 'Swipeable tab view' });
    expect(region).toBeDefined();
    expect(region.className).toContain('swipeable-tabs-viewport');
  });

  it('respects default and custom minHeight props on viewport and track', () => {
    const { getByRole } = render(SwipeableTabsView, {
      props: {
        activeIndex: 0,
        count: 3,
        minHeight: '520px',
        onChange: () => {}
      }
    });

    const region = getByRole('region', { name: 'Swipeable tab view' });
    expect(region.style.minHeight).toBe('520px');
  });

  it('streams real-time progress during drag and does not commit if dragged back before release', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const onProgress = vi.fn();
    const { getByRole } = render(SwipeableTabsView, {
      props: {
        activeIndex: 0,
        count: 3,
        onChange,
        onProgress
      }
    });

    const region = getByRole('region', { name: 'Swipeable tab view' });
    let currentLeft = 0;
    Object.defineProperty(region, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(region, 'scrollLeft', {
      get: () => currentLeft,
      set: (v: number) => { currentLeft = v; },
      configurable: true
    });

    await fireEvent.touchStart(region);
    currentLeft = 240; // dragged past 50% (0.6)
    await fireEvent.scroll(region);
    expect(onProgress).toHaveBeenLastCalledWith(0.6);

    // Pause while still holding finger -> must NOT commit onChange
    vi.advanceTimersByTime(150);
    expect(onChange).not.toHaveBeenCalled();

    // Drag back below 50% and release
    currentLeft = 80;
    await fireEvent.scroll(region);
    expect(onProgress).toHaveBeenLastCalledWith(0.2);

    currentLeft = 0;
    await fireEvent.scroll(region);
    await fireEvent.touchEnd(region);
    vi.advanceTimersByTime(100);

    expect(onChange).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenLastCalledWith(null);
    vi.useRealTimers();
  });

  it('recovers via snap guard if scroll stops halfway after touchcancel/touchend', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const onProgress = vi.fn();
    const { getByRole } = render(SwipeableTabsView, {
      props: {
        activeIndex: 0,
        count: 3,
        onChange,
        onProgress
      }
    });

    const region = getByRole('region', { name: 'Swipeable tab view' });
    let currentLeft = 0;
    Object.defineProperty(region, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(region, 'scrollLeft', {
      get: () => currentLeft,
      set: (v: number) => { currentLeft = v; },
      configurable: true
    });
    const scrollToSpy = vi.fn(({ left }: { left?: number }) => {
      if (typeof left === 'number') currentLeft = left;
    });
    region.scrollTo = scrollToSpy as any;

    await fireEvent.touchStart(region);
    currentLeft = 180; // stuck at 45%
    await fireEvent.scroll(region);
    await fireEvent.touchCancel(region);

    vi.advanceTimersByTime(100);
    expect(onProgress).toHaveBeenLastCalledWith(null);
    expect(onChange).not.toHaveBeenCalled();
    expect(scrollToSpy).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });
    expect(currentLeft).toBe(0);
    vi.useRealTimers();
  });
});
