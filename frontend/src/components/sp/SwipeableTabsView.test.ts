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
});
