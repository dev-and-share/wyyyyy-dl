import { DEFAULT_PALETTE, type CoverPalette, type SkinId, SKINS, SKIN_THEME_COLORS } from '../components/skins/skinTypes';
import { extractCoverPalette } from './colorExtractor';

const STORAGE_KEY = 'player_skin';

function isValidSkinId(val: any): val is SkinId {
  return typeof val === 'string' && val in SKINS;
}

function syncRootSkinAttribute(id: SkinId) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-skin', id);
  }
}

/**
 * 动态同步 <meta name="theme-color">
 * 保证 macOS PWA (Safari 添加到程序坞 / Chrome 顶栏) 与移动端标题栏实时感知皮肤与深浅色切换
 */
export function syncMetaThemeColor(skinId?: SkinId) {
  if (typeof document === 'undefined') return;
  const currentSkin: SkinId = skinId || (skin?.current ? skin.current : 'vinyl');
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const color = isLight
    ? (SKIN_THEME_COLORS[currentSkin]?.light || '#ffffff')
    : (SKIN_THEME_COLORS[currentSkin]?.dark || '#0a0e1a');

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

function loadInitialSkin(): SkinId {
  let initialSkin: SkinId = 'vinyl';
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isValidSkinId(saved)) initialSkin = saved;
    } catch {}
    syncRootSkinAttribute(initialSkin);
    syncMetaThemeColor(initialSkin);
  }
  return initialSkin;
}

export class SkinStore {
  current = $state<SkinId>(loadInitialSkin());
  palette = $state<CoverPalette>({ ...DEFAULT_PALETTE });

  private paletteCache = new Map<string, CoverPalette>();
  private lastRequestedUrl = '';

  cssVars = $derived(
    `--skin-dominant: ${this.palette.dominant}; --skin-accent: ${this.palette.accent}; --skin-muted: ${this.palette.muted}; --skin-glow: ${this.palette.glow};`
  );

  set(id: SkinId) {
    if (!isValidSkinId(id)) return;
    this.current = id;
    syncRootSkinAttribute(id);
    syncMetaThemeColor(id);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {}
    }
  }

  async updatePalette(coverUrl?: string | null, isDarkTheme = true) {
    if (!coverUrl) {
      this.palette = { ...DEFAULT_PALETTE };
      this.lastRequestedUrl = '';
      return;
    }

    if (this.paletteCache.has(coverUrl)) {
      this.palette = this.paletteCache.get(coverUrl)!;
      this.lastRequestedUrl = coverUrl;
      return;
    }

    this.lastRequestedUrl = coverUrl;
    try {
      const result = await extractCoverPalette(coverUrl, isDarkTheme);
      // 竞态保护：仅当仍是最后请求的 URL 时采纳
      if (this.lastRequestedUrl === coverUrl) {
        this.palette = result;
        this.paletteCache.set(coverUrl, result);
      }
    } catch {
      if (this.lastRequestedUrl === coverUrl) {
        this.palette = { ...DEFAULT_PALETTE };
      }
    }
  }

  /** 测试辅助：清空缓存与重置状态 */
  _reset() {
    this.current = 'vinyl';
    syncRootSkinAttribute('vinyl');
    syncMetaThemeColor('vinyl');
    this.palette = { ...DEFAULT_PALETTE };
    this.paletteCache.clear();
    this.lastRequestedUrl = '';
  }
}

export const skin = new SkinStore();
