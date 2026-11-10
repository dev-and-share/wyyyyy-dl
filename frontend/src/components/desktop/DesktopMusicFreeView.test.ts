import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DesktopMusicFreeView from './DesktopMusicFreeView.svelte';

describe('DesktopMusicFreeView', () => {
  it('renders segmented tabs and swipeable tab view', () => {
    const { getByRole } = render(DesktopMusicFreeView, {
      showToast: vi.fn()
    });

    const swipeRegion = getByRole('region', { name: 'Swipeable tab view' });
    expect(swipeRegion).not.toBeNull();
  });

  it('switches tabs when tab buttons are clicked', async () => {
    const { getAllByRole } = render(DesktopMusicFreeView, {
      showToast: vi.fn()
    });

    const tabs = getAllByRole('tab');
    expect(tabs.length).toBe(3);

    // Click second tab (Playlists / sheets)
    await fireEvent.click(tabs[1]);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');

    // Click third tab (Manage plugins)
    await fireEvent.click(tabs[2]);
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
  });

  it('updates active tab when swipe gesture occurs', async () => {
    vi.useFakeTimers();
    const { getByRole, getAllByRole } = render(DesktopMusicFreeView, {
      showToast: vi.fn()
    });

    await vi.advanceTimersByTimeAsync(500);

    const region = getByRole('region', { name: 'Swipeable tab view' });
    Object.defineProperty(region, 'clientWidth', { value: 375, configurable: true });
    Object.defineProperty(region, 'scrollLeft', { value: 375, configurable: true });

    await fireEvent.scroll(region);
    await vi.advanceTimersByTimeAsync(200);

    const tabs = getAllByRole('tab');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    vi.useRealTimers();
  });
});
