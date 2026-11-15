import { describe, it, expect } from 'vitest';
import {
  parseHex,
  toHex,
  getRelativeLuminance,
  blendColors,
  detectTitlebarHarmony,
  buildCinemaCornerGradient,
  resolveCinemaCornerStyle,
  applyCinemaCornerCssVars
} from './cinemaCorner';

describe('cinemaCorner engine', () => {
  describe('color utilities', () => {
    it('parses 3-digit and 6-digit hex values accurately', () => {
      expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseHex('#000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseHex('#123456')).toEqual({ r: 18, g: 52, b: 86 });
      expect(parseHex('invalid')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('formats RGB to 6-digit hex with zero-padding', () => {
      expect(toHex(255, 255, 255)).toBe('#ffffff');
      expect(toHex(0, 0, 0)).toBe('#000000');
      expect(toHex(18, 52, 86)).toBe('#123456');
      expect(toHex(300, -10, 15)).toBe('#ff000f'); // clamp check
    });

    it('calculates WCAG relative luminance correctly', () => {
      expect(getRelativeLuminance('#000000')).toBe(0);
      expect(getRelativeLuminance('#ffffff')).toBe(1);
      // 中间亮度
      const mid = getRelativeLuminance('#808080');
      expect(mid).toBeGreaterThan(0.2);
      expect(mid).toBeLessThan(0.3);
    });

    it('physically blends base color with overlay alpha', () => {
      // 纯白 + 50% 纯黑 = #808080 (127.5 ≈ 128 = 0x80)
      const halfBlack = blendColors('#ffffff', '#000000', 0.5);
      expect(halfBlack).toBe('#808080');

      // 纯白 + 0% 纯黑 = 纯白
      expect(blendColors('#ffffff', '#000000', 0)).toBe('#ffffff');

      // 纯白 + 100% 纯黑 = 纯黑
      expect(blendColors('#ffffff', '#000000', 1)).toBe('#000000');
    });
  });

  describe('detectTitlebarHarmony', () => {
    it('returns original skin color when no modal/menu is open', () => {
      const res = detectTitlebarHarmony({
        skinColor: '#fffdf0',
        isLight: true,
        isModalOpen: false
      });
      expect(res.harmonizedColor).toBe('#fffdf0');
      expect(res.isDisharmonious).toBe(false);
      expect(res.contrastDelta).toBe(0);
    });

    it('returns deep black for dark mode when modal is open', () => {
      const res = detectTitlebarHarmony({
        skinColor: '#0a0e1a',
        isLight: false,
        isModalOpen: true
      });
      expect(res.harmonizedColor).toBe('#121212');
      expect(res.isDisharmonious).toBe(false);
    });

    it('returns smooth blended deep atmospheric color for light mode when modal is open', () => {
      const res = detectTitlebarHarmony({
        skinColor: '#fff0f5', // 樱花浅粉
        isLight: true,
        isModalOpen: true
      });
      // 绝非原浅色 #fff0f5，而是同色系深沉暗场
      expect(res.harmonizedColor).not.toBe('#fff0f5');
      // 深度与遮罩对齐 (约 0.02 ~ 0.2)，杜绝浅色大门牙
      const lum = getRelativeLuminance(res.harmonizedColor);
      expect(lum).toBeGreaterThan(0.01);
      expect(lum).toBeLessThan(0.2);
      expect(res.isDisharmonious).toBe(true);
    });

    it('handles immersive mode cleanly', () => {
      const res = detectTitlebarHarmony({
        skinColor: '#3b137a',
        isLight: true,
        isModalOpen: true,
        isImmersive: true
      });
      expect(res.harmonizedColor).toBe('#3b137a');
      expect(res.isDisharmonious).toBe(false);
    });

    it('preserves customBgColor directly in immersive mode for both dark and light themes', () => {
      const warmTopColor = '#8c7258';
      const darkRes = detectTitlebarHarmony({
        skinColor: '#0a0e1a',
        isLight: false,
        isModalOpen: false,
        isImmersive: true,
        customBgColor: warmTopColor
      });
      expect(darkRes.harmonizedColor).toBe(warmTopColor);
      expect(darkRes.isDisharmonious).toBe(false);

      const lightRes = detectTitlebarHarmony({
        skinColor: '#1e293b',
        isLight: true,
        isModalOpen: true,
        isImmersive: true,
        customBgColor: warmTopColor
      });
      expect(lightRes.harmonizedColor).toBe(warmTopColor);
      expect(lightRes.isDisharmonious).toBe(false);
    });
  });

  describe('2D Cinema Corner gradient generation', () => {
    it('builds dual-corner radial gradient CSS aligned to WCO bounds with color-mix steps for CSS vars', () => {
      const css = buildCinemaCornerGradient({ color: 'var(--wco-titlebar-bg)', radiusX: 360, radiusY: 120 });
      expect(css).toContain('at 24px 14px');
      expect(css).toContain('at calc(100% - 57px) 14px');
      expect(css).toContain('ellipse 360px 120px');
      expect(css).toContain('color-mix(in srgb');

      const defaultCss = buildCinemaCornerGradient();
      expect(defaultCss).toContain('ellipse 380px 181px at 24px 14px');
      expect(defaultCss).toContain('var(--wco-titlebar-bg) 84px');
      expect(defaultCss).toContain('ellipse 460px 190px at calc(100% - 57px) 14px');
      expect(defaultCss).toContain('var(--wco-titlebar-bg) 109px');

      const expandedCss = buildCinemaCornerGradient({ left: 96, right: 200, height: 42 });
      expect(expandedCss).not.toContain('var(--wco-titlebar-bg) 109px');
      expect(expandedCss).toContain('at calc(100% - 82px) 16px');
    });

    it('builds pure rgba radial gradient CSS when concrete hex color is provided', () => {
      const css = buildCinemaCornerGradient({ color: '#fffdf0', radiusX: 360, radiusY: 120 });
      expect(css).toContain('rgba(255, 253, 240, 1) 104px');
      expect(css).toContain('rgba(255, 253, 240, 1) 120px');
      expect(css).toContain('rgba(255, 253, 240, 0.85)');
      expect(css).toContain('rgba(255, 253, 240, 0.45)');
      expect(css).toContain('rgba(255, 253, 240, 0.15)');
    });

    it('resolves style string with custom opacity', () => {
      const style = resolveCinemaCornerStyle({ opacity: 0.85 });
      expect(style).toContain('background:');
      expect(style).toContain('opacity: 0.85;');
    });

    it('applies cinema corner CSS variables to target element', () => {
      const div = document.createElement('div');
      applyCinemaCornerCssVars('#fffdf0', div);
      expect(div.style.getPropertyValue('--wco-titlebar-bg')).toBe('#fffdf0');
      expect(div.style.getPropertyValue('--cinema-corner-bg')).toContain('radial-gradient');
    });
  });
});
