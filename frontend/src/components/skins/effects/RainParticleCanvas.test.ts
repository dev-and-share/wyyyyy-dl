import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import RainParticleCanvas from './RainParticleCanvas.svelte';

describe('RainParticleCanvas lifecycle & rendering', () => {
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
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn()
      })
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts canvas element and starts animation loop', () => {
    const { getByTestId, unmount } = render(RainParticleCanvas, {
      playing: true
    });

    const canvas = getByTestId('rain-particle-canvas');
    expect(canvas).toBeDefined();
    expect(rafSpy).toHaveBeenCalled();

    unmount();
    expect(cafSpy).toHaveBeenCalled();
  });

  it('pauses loop on visibilitychange hidden and resumes on visible', () => {
    render(RainParticleCanvas, {
      playing: false
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(cafSpy).toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafSpy).toHaveBeenCalled();
  });
});
