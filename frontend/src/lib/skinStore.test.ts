import { describe, it, expect, beforeEach, vi } from 'vitest';
import { skin, SkinStore, setImmersiveThemeColor, getIsImmersiveActive } from './skinStore.svelte';
import { DEFAULT_PALETTE } from '../components/skins/skinTypes';
import * as colorExt from './colorExtractor';

describe('skinStore', () => {
  beforeEach(() => {
    localStorage.clear();
    skin._reset();
    vi.restoreAllMocks();
  });

  it('defaults to vinyl skin with DEFAULT_PALETTE', () => {
    expect(skin.current).toBe('vinyl');
    expect(skin.palette).toEqual(DEFAULT_PALETTE);
    expect(skin.cssVars).toContain('--skin-dominant');
    expect(skin.cssVars).toContain('--skin-accent');
  });

  it('loads valid skin from localStorage on creation', () => {
    localStorage.setItem('player_skin', 'cassette');
    const customStore = new SkinStore();
    expect(customStore.current).toBe('cassette');
  });

  it('falls back to vinyl if localStorage has invalid skin', () => {
    localStorage.setItem('player_skin', 'cyberpunk_invalid');
    const customStore = new SkinStore();
    expect(customStore.current).toBe('vinyl');
  });

  it('sets and persists skin', () => {
    skin.set('aurora');
    expect(skin.current).toBe('aurora');
    expect(localStorage.getItem('player_skin')).toBe('aurora');

    skin.set('cassette');
    expect(skin.current).toBe('cassette');
    expect(localStorage.getItem('player_skin')).toBe('cassette');

    skin.set('winamp');
    expect(skin.current).toBe('winamp');
    expect(localStorage.getItem('player_skin')).toBe('winamp');
    expect(document.documentElement.getAttribute('data-skin')).toBe('winamp');

    skin.set('spring');
    expect(skin.current).toBe('spring');
    expect(localStorage.getItem('player_skin')).toBe('spring');
    expect(document.documentElement.getAttribute('data-skin')).toBe('spring');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#06140f');

    // 四季动态皮肤测试
    skin.set('sakura');
    expect(skin.current).toBe('sakura');
    expect(localStorage.getItem('player_skin')).toBe('sakura');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#240d1e');

    skin.set('summer');
    expect(skin.current).toBe('summer');
    expect(localStorage.getItem('player_skin')).toBe('summer');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#072b4a');

    skin.set('autumn');
    expect(skin.current).toBe('autumn');
    expect(localStorage.getItem('player_skin')).toBe('autumn');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#1a1305');

    skin.set('winter');
    expect(skin.current).toBe('winter');
    expect(localStorage.getItem('player_skin')).toBe('winter');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0b121e');

    // 浅色模式下切换皮肤测试
    document.documentElement.setAttribute('data-theme', 'light');
    skin.set('aurora');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#faf5ff');
    skin.set('sakura');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#fff0f5');
    document.documentElement.removeAttribute('data-theme');
  });

  it('supports dynamic dark synchronization for immersive playback mode', () => {
    // 1. 白天模式下普通浏览
    document.documentElement.setAttribute('data-theme', 'light');
    skin.set('aurora');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#faf5ff');
    expect(document.documentElement.style.getPropertyValue('--wco-titlebar-bg')).toBe('#faf5ff');
    expect(getIsImmersiveActive()).toBe(false);

    // 2. 进入全屏沉浸播放 (LyricModal 挂载)
    setImmersiveThemeColor(true);
    expect(getIsImmersiveActive()).toBe(true);
    // 浅色模式下切为皮肤同色系深色锚点（告别死黑），如 aurora 为 #3b137a
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#3b137a');
    expect(document.documentElement.style.getPropertyValue('--wco-titlebar-bg')).toBe('#3b137a');

    // 3. 在沉浸模式内切换皮肤为 spring (浅色锚点 #064e3b)
    skin.set('spring');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#064e3b');
    expect(document.documentElement.style.getPropertyValue('--wco-titlebar-bg')).toBe('#064e3b');

    // 4. 退出全屏沉浸播放 (LyricModal 销毁)
    setImmersiveThemeColor(false);
    expect(getIsImmersiveActive()).toBe(false);
    // 自动恢复当前皮肤在白天模式下的主题色
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f0fdf4');
    expect(document.documentElement.style.getPropertyValue('--wco-titlebar-bg')).toBe('#f0fdf4');

    document.documentElement.removeAttribute('data-theme');
  });

  it('ignores invalid skin in set()', () => {
    skin.set('invalid' as any);
    expect(skin.current).toBe('vinyl');
  });

  it('updates palette and caches subsequent requests for the same coverUrl', async () => {
    const mockPalette = {
      dominant: 'rgb(10, 20, 30)',
      accent: 'rgb(255, 100, 50)',
      muted: 'rgb(80, 80, 80)',
      glow: 'rgba(255, 100, 50, 0.45)'
    };
    const spy = vi.spyOn(colorExt, 'extractCoverPalette').mockResolvedValue(mockPalette);

    await skin.updatePalette('https://example.com/cover1.jpg');
    expect(skin.palette).toEqual(mockPalette);
    expect(spy).toHaveBeenCalledTimes(1);

    // 请求相同的 URL 应当命中缓存，不重复执行抽取
    await skin.updatePalette('https://example.com/cover1.jpg');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(skin.palette).toEqual(mockPalette);
  });

  it('handles race conditions by only adopting latest requested cover', async () => {
    let resolveFirst: (p: any) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    const secondPalette = {
      dominant: 'rgb(2, 2, 2)',
      accent: 'rgb(200, 200, 200)',
      muted: 'rgb(50, 50, 50)',
      glow: 'rgba(200, 200, 200, 0.45)'
    };

    vi.spyOn(colorExt, 'extractCoverPalette').mockImplementation((url) => {
      if (url === 'first.jpg') return firstPromise as any;
      return Promise.resolve(secondPalette);
    });

    const p1 = skin.updatePalette('first.jpg');
    const p2 = skin.updatePalette('second.jpg');

    await p2;
    expect(skin.palette).toEqual(secondPalette);

    // 第一条请求稍后迟到返回，不应覆盖第二条
    resolveFirst!({
      dominant: 'rgb(99, 99, 99)',
      accent: 'rgb(99, 99, 99)',
      muted: 'rgb(99, 99, 99)',
      glow: 'rgba(99, 99, 99, 0.45)'
    });
    await p1;

    expect(skin.palette).toEqual(secondPalette);
  });
});
