import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isInteractiveTarget, triggerToggleImmersive, setupImmersiveDblClick, _resetToggleTimeForTesting } from './immersiveDblClick';
import { playerStore } from './playerStore.svelte';
import * as toastModule from '../toast.svelte';

describe('immersiveDblClick & Double Click to Toggle Immersive Mode', () => {
  beforeEach(() => {
    _resetToggleTimeForTesting();
    playerStore.clearQueue();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    it('toggles immersive on dblclick over blank element, but ignores clicks on buttons', () => {
      const cleanup = setupImmersiveDblClick(window);
      playerStore.setQueue([{ id: 1, name: '测试曲', artist: '歌手', url: '/v3/stream?id=1', isLocal: true }], 0);

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      // 1. Button dblclick -> ignored
      const btn = document.createElement('button');
      document.body.appendChild(btn);
      btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      expect(dispatchSpy).not.toHaveBeenCalled();
      document.body.removeChild(btn);

      // 2. Blank area dblclick -> triggers toggle
      const blankDiv = document.createElement('div');
      document.body.appendChild(blankDiv);
      blankDiv.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'wyy:toggle-lyric-modal' }));
      document.body.removeChild(blankDiv);

      cleanup();
    });

    it('detects mobile double-tap within time threshold and toggles immersive', async () => {
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
  });
});
