import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isInteractiveTarget,
  triggerToggleImmersive,
  setupImmersiveDblClick,
  isPCEnvironment,
  _resetToggleTimeForTesting
} from './immersiveDblClick';
import { playerStore } from './playerStore.svelte';
import * as toastModule from '../toast.svelte';

describe('immersiveDblClick & Double Click to Toggle Immersive Mode', () => {
  beforeEach(() => {
    _resetToggleTimeForTesting();
    playerStore.clearQueue();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('isPCEnvironment', () => {
    it('identifies desktop operating systems as PC', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        maxTouchPoints: 0
      });
      expect(isPCEnvironment()).toBe(true);

      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120.0.0.0',
        maxTouchPoints: 0
      });
      expect(isPCEnvironment()).toBe(true);

      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        maxTouchPoints: 0
      });
      expect(isPCEnvironment()).toBe(true);
    });

    it('identifies smartphones (SP) and mobile devices as non-PC', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        maxTouchPoints: 5
      });
      expect(isPCEnvironment()).toBe(false);

      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36',
        maxTouchPoints: 5
      });
      expect(isPCEnvironment()).toBe(false);

      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        maxTouchPoints: 5
      });
      expect(isPCEnvironment()).toBe(false);
    });

    it('falls back to screen width when user agent is non-standard', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'CustomBrowser/1.0',
        maxTouchPoints: 0
      });

      const mockWinWide = {
        navigator: { userAgent: 'CustomBrowser/1.0', maxTouchPoints: 0 },
        innerWidth: 1200
      } as unknown as Window;
      expect(isPCEnvironment(mockWinWide)).toBe(true);

      const mockWinNarrow = {
        navigator: { userAgent: 'CustomBrowser/1.0', maxTouchPoints: 0 },
        innerWidth: 390
      } as unknown as Window;
      expect(isPCEnvironment(mockWinNarrow)).toBe(false);
    });
  });

  describe('isInteractiveTarget', () => {
    it('returns false for null or neutral blank elements', () => {
      expect(isInteractiveTarget(null)).toBe(false);

      const blankDiv = document.createElement('div');
      blankDiv.className = 'w-full h-full bg-black/50';
      expect(isInteractiveTarget(blankDiv)).toBe(false);

      const stageBg = document.createElement('section');
      expect(isInteractiveTarget(stageBg)).toBe(false);
    });

    it('returns true for native buttons, inputs, textareas, and links', () => {
      const btn = document.createElement('button');
      expect(isInteractiveTarget(btn)).toBe(true);

      const spanInBtn = document.createElement('span');
      btn.appendChild(spanInBtn);
      expect(isInteractiveTarget(spanInBtn)).toBe(true);

      const input = document.createElement('input');
      expect(isInteractiveTarget(input)).toBe(true);

      const a = document.createElement('a');
      expect(isInteractiveTarget(a)).toBe(true);
    });

    it('returns true for ARIA roles and .interactive-el class', () => {
      const roleBtn = document.createElement('div');
      roleBtn.setAttribute('role', 'button');
      expect(isInteractiveTarget(roleBtn)).toBe(true);

      const interactiveDiv = document.createElement('div');
      interactiveDiv.className = 'interactive-el w-8 h-8';
      expect(isInteractiveTarget(interactiveDiv)).toBe(true);
    });

    it('returns true for track rows, drawers, and modal contents', () => {
      const row = document.createElement('div');
      row.className = 'track-row flex items-center';
      expect(isInteractiveTarget(row)).toBe(true);

      const drawer = document.createElement('div');
      drawer.setAttribute('data-testid', 'playlist-drawer');
      const inner = document.createElement('p');
      drawer.appendChild(inner);
      expect(isInteractiveTarget(inner)).toBe(true);
    });

    it('returns true for immersive internal controls and lyric lines', () => {
      const miniCtrl = document.createElement('div');
      miniCtrl.setAttribute('data-testid', 'immersive-mini-player-container');
      expect(isInteractiveTarget(miniCtrl)).toBe(true);

      const lyricLine = document.createElement('div');
      lyricLine.id = 'sv-lrc-5';
      expect(isInteractiveTarget(lyricLine)).toBe(true);
    });
  });

  describe('triggerToggleImmersive', () => {
    it('dispatches wyy:toggle-lyric-modal event when activeTrack exists', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      playerStore.setQueue([{ id: 1, name: '测试曲', artist: '歌手', url: '/v3/stream?id=1', isLocal: true }], 0);

      const res = triggerToggleImmersive();
      expect(res).toBe(true);
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'wyy:toggle-lyric-modal' }));
    });

    it('debounces rapid repeated triggers within 350ms', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      playerStore.setQueue([{ id: 1, name: '测试曲', artist: '歌手', url: '/v3/stream?id=1', isLocal: true }], 0);

      const first = triggerToggleImmersive();
      const second = triggerToggleImmersive();
      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });

    it('shows toast when neither activeTrack nor queue exists', () => {
      const toastSpy = vi.spyOn(toastModule, 'showToast').mockImplementation(() => {});
      const res = triggerToggleImmersive();
      expect(res).toBe(false);
      expect(toastSpy).toHaveBeenCalled();
    });
  });

  describe('setupImmersiveDblClick', () => {
    describe('PC / PWA desktop environment', () => {
      it('disables double click to toggle immersive mode on PC (preserves native window/selection actions)', () => {
        vi.stubGlobal('navigator', {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          maxTouchPoints: 0
        });

        const cleanup = setupImmersiveDblClick(window);
        playerStore.setQueue([{ id: 1, name: '测试曲', artist: '歌手', url: '/v3/stream?id=1', isLocal: true }], 0);

        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        const blankDiv = document.createElement('div');
        document.body.appendChild(blankDiv);

        const dblEvent = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
        blankDiv.dispatchEvent(dblEvent);

        // 桌面端 PC / PWA PC 双击空白区域绝不打开沉浸大屏
        expect(dispatchSpy).not.toHaveBeenCalled();
        // 原生事件未被 preventDefault，保留系统与选词能力
        expect(dblEvent.defaultPrevented).toBe(false);

        document.body.removeChild(blankDiv);
        cleanup();
      });

      it('disables touch double tap on PC environment', async () => {
        vi.stubGlobal('navigator', {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
          maxTouchPoints: 0
        });

        const cleanup = setupImmersiveDblClick(window);
        playerStore.setQueue([{ id: 1, name: '测试曲', artist: '歌手', url: '/v3/stream?id=1', isLocal: true }], 0);

        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        const blankDiv = document.createElement('div');
        document.body.appendChild(blankDiv);

        const createTouchEvent = (type: string, x: number, y: number) => {
          return new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            changedTouches: [{ clientX: x, clientY: y } as Touch]
          });
        };

        blankDiv.dispatchEvent(createTouchEvent('touchend', 100, 100));
        await new Promise((r) => setTimeout(r, 100));
        blankDiv.dispatchEvent(createTouchEvent('touchend', 102, 101));

        expect(dispatchSpy).not.toHaveBeenCalled();

        document.body.removeChild(blankDiv);
        cleanup();
      });
    });

    describe('SP / mobile smartphone environment', () => {
      beforeEach(() => {
        vi.stubGlobal('navigator', {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
          maxTouchPoints: 5
        });
      });

      it('preserves mobile SP double-tap within time threshold and toggles immersive', async () => {
        const cleanup = setupImmersiveDblClick(window);
        playerStore.setQueue([{ id: 1, name: '测试曲', artist: '歌手', url: '/v3/stream?id=1', isLocal: true }], 0);

        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        const blankDiv = document.createElement('div');
        document.body.appendChild(blankDiv);

        const createTouchEvent = (type: string, x: number, y: number) => {
          return new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            changedTouches: [{ clientX: x, clientY: y } as Touch]
          });
        };

        // Tap 1
        blankDiv.dispatchEvent(createTouchEvent('touchend', 100, 100));
        expect(dispatchSpy).not.toHaveBeenCalled();

        // Wait 100ms and Tap 2 at nearly same position
        await new Promise((r) => setTimeout(r, 100));
        blankDiv.dispatchEvent(createTouchEvent('touchend', 102, 101));
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'wyy:toggle-lyric-modal' }));

        document.body.removeChild(blankDiv);
        cleanup();
      });

      it('ignores mobile SP double-tap on interactive controls (buttons)', async () => {
        const cleanup = setupImmersiveDblClick(window);
        playerStore.setQueue([{ id: 1, name: '测试曲', artist: '歌手', url: '/v3/stream?id=1', isLocal: true }], 0);

        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        const btn = document.createElement('button');
        document.body.appendChild(btn);

        const createTouchEvent = (type: string, x: number, y: number) => {
          return new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            changedTouches: [{ clientX: x, clientY: y } as Touch]
          });
        };

        btn.dispatchEvent(createTouchEvent('touchend', 50, 50));
        await new Promise((r) => setTimeout(r, 100));
        btn.dispatchEvent(createTouchEvent('touchend', 51, 50));

        expect(dispatchSpy).not.toHaveBeenCalled();

        document.body.removeChild(btn);
        cleanup();
      });
    });
  });
});
