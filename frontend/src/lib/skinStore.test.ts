import { describe, it, expect, beforeEach, vi } from 'vitest';
import { skin, SkinStore } from './skinStore.svelte';
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
