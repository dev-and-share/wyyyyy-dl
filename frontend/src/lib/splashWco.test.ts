import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SKIN_THEME_COLORS, type SkinId } from '../components/skins/skinTypes';
import { syncMetaThemeColor, skin } from './skinStore.svelte';

const indexHtmlPath = resolve(__dirname, '../../index.html');
const indexHtml = readFileSync(indexHtmlPath, 'utf-8');

function extractHeadInlineScript(html: string): string {
  const match = html.match(/<script>\s*([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('Failed to locate head inline script in frontend/index.html');
  }
  return match[1];
}

function setupSplashDom(osPrefersDark = true) {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-mode');
  document.documentElement.removeAttribute('data-skin');
  document.documentElement.style.cssText = '';

  const styleMatch = indexHtml.match(/<style>([\s\S]*?)<\/style>/);
  const styleCss = styleMatch ? styleMatch[1] : '';

  document.head.innerHTML = `
    <meta name="theme-color" id="pwa-theme-color" content="#0a0e1a" />
    <style>${styleCss}</style>
  `;
  document.body.innerHTML = `<div id="pwa-splash" class="wyy-splash-container" aria-hidden="true"></div>`;

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('dark') ? osPrefersDark : !osPrefersDark,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

describe('PWA splash WCO titlebar alignment', () => {
  beforeEach(() => {
    localStorage.clear();
    skin._reset();
    window.history.replaceState({}, '', '/');
  });

  it('keeps exactly one meta[name="theme-color"] tag and binds splash background to --wco-titlebar-bg', () => {
    const metaTags = indexHtml.match(/<meta\s+name="theme-color"[^>]*>/g) ?? [];
    expect(metaTags).toHaveLength(1);

    // Ensure splash container consumes --wco-titlebar-bg instead of hardcoding a mismatched color
    expect(indexHtml).toContain('background-color: var(--wco-titlebar-bg, #0a0e1a);');
    expect(indexHtml).toContain('background-color: var(--wco-titlebar-bg, #ffffff);');

    // Ensure index.html does not leak inline html.style.backgroundColor or html/body CSS overrides
    expect(indexHtml).not.toContain('document.documentElement.style.backgroundColor');
    expect(indexHtml).not.toMatch(/html,\s*body\s*\{[^}]*background-color/);
  });

  it('keeps manifest.json cold-start colors aligned with default dark theme (#0a0e1a)', () => {
    const publicManifest = JSON.parse(
      readFileSync(resolve(__dirname, '../../public/manifest.json'), 'utf-8')
    );
    const staticManifest = JSON.parse(
      readFileSync(resolve(__dirname, '../../../src/main/resources/static/manifest.json'), 'utf-8')
    );

    for (const manifest of [publicManifest, staticManifest]) {
      expect(manifest.background_color).toBe(SKIN_THEME_COLORS.vinyl.dark);
      expect(manifest.theme_color).toBe(SKIN_THEME_COLORS.vinyl.dark);
    }
  });

  it('aligns meta theme-color, --wco-titlebar-bg, and splash bg across all 13 skins in both dark and light modes', () => {
    const inlineScript = extractHeadInlineScript(indexHtml);
    const allSkins = Object.keys(SKIN_THEME_COLORS) as SkinId[];

    for (const skinId of allSkins) {
      for (const mode of ['dark', 'light'] as const) {
        setupSplashDom(mode === 'dark');
        localStorage.setItem('theme_mode', mode);
        localStorage.setItem('player_skin', skinId);

        new Function(inlineScript)();

        const expectedColor = SKIN_THEME_COLORS[skinId][mode];
        const metaColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
        const wcoVar = document.documentElement.style.getPropertyValue('--wco-titlebar-bg');
        const splashEl = document.getElementById('pwa-splash')!;
        const splashBg = getComputedStyle(splashEl).backgroundColor;

        expect(metaColor).toBe(expectedColor);
        expect(wcoVar).toBe(expectedColor);
        expect(splashBg).not.toBe('');

        // Verify skinStore.syncMetaThemeColor produces the exact same color without post-load jump
        syncMetaThemeColor(skinId);
        expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(expectedColor);
        expect(document.documentElement.style.getPropertyValue('--wco-titlebar-bg')).toBe(expectedColor);
      }
    }
  });

  it('respects auto theme mode and preview_skin query parameter during splash startup', () => {
    const inlineScript = extractHeadInlineScript(indexHtml);

    // Auto mode with OS light + preview_skin=summer
    setupSplashDom(false);
    localStorage.setItem('theme_mode', 'auto');
    localStorage.setItem('player_skin', 'vinyl');
    window.history.replaceState({}, '', '/?preview_skin=summer');

    new Function(inlineScript)();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-skin')).toBe('summer');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      SKIN_THEME_COLORS.summer.light
    );
    expect(document.documentElement.style.getPropertyValue('--wco-titlebar-bg')).toBe(
      SKIN_THEME_COLORS.summer.light
    );
  });
});
