import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { layoutState, syncWcoCssVariables, initLayoutWatcher } from './layout.svelte';

describe('Layout and Window Controls Overlay (WCO) State', () => {
  let styleProperties: Record<string, string> = {};

  beforeEach(() => {
    styleProperties = {};
    vi.stubGlobal('document', {
      documentElement: {
        style: {
          setProperty: (key: string, val: string) => {
            styleProperties[key] = val;
          }
        }
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('defaults to 0px in standard browser tab mode (not standalone, not WCO)', () => {
    vi.stubGlobal('window', {
      innerWidth: 1200,
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    });
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel'
    });

    syncWcoCssVariables();

    expect(layoutState.isStandalone).toBe(false);
    expect(layoutState.wco.visible).toBe(false);
    expect(layoutState.wco.height).toBe(0);
    expect(styleProperties['--wco-height']).toBe('0px');
    expect(styleProperties['--wco-left']).toBe('0px');
    expect(styleProperties['--wco-right']).toBe('0px');
  });

  it('keeps 0px when running in standard standalone mode with native titlebar (WCO visible = false, chevron ^)', () => {
    vi.stubGlobal('window', {
      innerWidth: 1200,
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('display-mode: standalone'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    });
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
      windowControlsOverlay: {
        visible: false,
        getTitlebarAreaRect: vi.fn().mockReturnValue({ x: 0, y: 0, width: 0, height: 0 })
      }
    });

    syncWcoCssVariables();

    expect(layoutState.isStandalone).toBe(true);
    expect(layoutState.wco.visible).toBe(false);
    expect(layoutState.wco.height).toBe(0);
    expect(styleProperties['--wco-height']).toBe('0px');
    expect(styleProperties['--wco-left']).toBe('0px');
    expect(styleProperties['--wco-right']).toBe('0px');
  });

  it('sets accurate safe areas when WCO is actively visible (chevron v)', () => {
    vi.stubGlobal('window', {
      innerWidth: 1200,
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    });
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
      windowControlsOverlay: {
        visible: true,
        getTitlebarAreaRect: vi.fn().mockReturnValue({
          x: 82,
          y: 0,
          width: 1000,
          height: 38
        })
      }
    });

    syncWcoCssVariables();

    expect(layoutState.wco.visible).toBe(true);
    expect(layoutState.wco.height).toBe(38);
    expect(layoutState.wco.left).toBe(82);
    // 1200 - (82 + 1000) = 118
    expect(layoutState.wco.right).toBe(118);
    expect(styleProperties['--wco-height']).toBe('38px');
    expect(styleProperties['--wco-left']).toBe('82px');
    expect(styleProperties['--wco-right']).toBe('118px');
  });

  it('cleans up event listeners correctly in initLayoutWatcher', () => {
    const removeWindowListener = vi.fn();
    const addWindowListener = vi.fn();
    const removeWcoListener = vi.fn();
    const addWcoListener = vi.fn();
    const removeMediaListener = vi.fn();
    const addMediaListener = vi.fn();

    vi.stubGlobal('window', {
      innerWidth: 1200,
      addEventListener: addWindowListener,
      removeEventListener: removeWindowListener,
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        addEventListener: addMediaListener,
        removeEventListener: removeMediaListener
      }))
    });
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      windowControlsOverlay: {
        visible: false,
        addEventListener: addWcoListener,
        removeEventListener: removeWcoListener
      }
    });

    const cleanup = initLayoutWatcher();
    expect(addWindowListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(addWcoListener).toHaveBeenCalledWith('geometrychange', expect.any(Function));
    expect(addMediaListener).toHaveBeenCalledWith('change', expect.any(Function));

    cleanup();
    expect(removeWindowListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeWcoListener).toHaveBeenCalledWith('geometrychange', expect.any(Function));
    expect(removeMediaListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
