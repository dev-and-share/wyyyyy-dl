import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import SeasonParticleCanvas from './SeasonParticleCanvas.svelte';

describe('SeasonParticleCanvas lifecycle & background throttling', () => {
  let rafSpy: ReturnType<typeof vi.spyOn>;
  let cafSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 123 as any);
    cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn()
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pauses requestAnimationFrame on document.hidden and resumes on visible', async () => {
    const { unmount } = render(SeasonParticleCanvas, {
      skinId: 'sakura',
      playing: true
    });

    expect(rafSpy).toHaveBeenCalled();

    // Switch to hidden (app in background)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // Should cancel existing RAF to avoid consuming CPU/GPU in background
    expect(cafSpy).toHaveBeenCalled();
    const cafCallCount = cafSpy.mock.calls.length;

    // Switch back to visible
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // Should re-queue requestAnimationFrame
    expect(rafSpy.mock.calls.length).toBeGreaterThan(1);

    unmount();
    expect(cafSpy.mock.calls.length).toBeGreaterThan(cafCallCount);
  });
});
