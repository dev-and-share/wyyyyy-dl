import { describe, it, expect, vi } from 'vitest';
import { extractPaletteFromPixels, extractCoverPalette } from './colorExtractor';
import { DEFAULT_PALETTE } from '../components/skins/skinTypes';

describe('colorExtractor', () => {
  it('returns default palette on empty or invalid pixel data', () => {
    const emptyResult = extractPaletteFromPixels(new Uint8ClampedArray(0));
    expect(emptyResult).toEqual(DEFAULT_PALETTE);

    const transparentResult = extractPaletteFromPixels(new Uint8ClampedArray([0, 0, 0, 0]));
    expect(transparentResult).toEqual(DEFAULT_PALETTE);
  });

  it('correctly extracts dominant and accent from uniform red pixels', () => {
    // 32x32 pixels = 1024 pixels, each [220, 38, 38, 255]
    const pixels = new Uint8ClampedArray(1024 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 220;
      pixels[i + 1] = 38;
      pixels[i + 2] = 38;
      pixels[i + 3] = 255;
    }

    const palette = extractPaletteFromPixels(pixels);
    expect(palette.dominant).toBe('rgb(220, 38, 38)');
    expect(palette.accent).toContain('rgb(');
    expect(palette.glow).toContain('rgba(');
  });

  it('identifies vibrant accent from dual-tone image with dark background', () => {
    // 70% dark gray background [30, 30, 30, 255], 30% vibrant cyan [6, 182, 212, 255]
    const pixels = new Uint8ClampedArray(1000 * 4);
    for (let i = 0; i < 700 * 4; i += 4) {
      pixels[i] = 30;
      pixels[i + 1] = 30;
      pixels[i + 2] = 30;
      pixels[i + 3] = 255;
    }
    for (let i = 700 * 4; i < 1000 * 4; i += 4) {
      pixels[i] = 6;
      pixels[i + 1] = 182;
      pixels[i + 2] = 212;
      pixels[i + 3] = 255;
    }

    const palette = extractPaletteFromPixels(pixels, true);
    expect(palette.dominant).toBe('rgb(30, 30, 30)');
    // Accent should pick the vibrant cyan rather than dark gray
    expect(palette.accent).not.toBe('rgb(30, 30, 30)');
  });

  it('safely falls back to default palette when image url is empty or fails', async () => {
    const resEmpty = await extractCoverPalette('');
    expect(resEmpty).toEqual(DEFAULT_PALETTE);

    const resNull = await extractCoverPalette(null);
    expect(resNull).toEqual(DEFAULT_PALETTE);
  });
});
