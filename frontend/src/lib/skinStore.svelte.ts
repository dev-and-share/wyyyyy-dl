import { DEFAULT_PALETTE, type CoverPalette, type SkinId, SKINS, SKIN_THEME_COLORS, SKIN_IMMERSIVE_ANCHORS } from '../components/skins/skinTypes';
import { extractCoverPalette } from './colorExtractor';
import { detectTitlebarHarmony, buildCinemaCornerGradient, type TitlebarHarmonyResult } from './cinemaCorner';

const STORAGE_KEY = 'player_skin';

let isImmersiveActive = false;
let modalBackdropCount = $state(0);
let lastHarmonyResult: TitlebarHarmonyResult | null = null;

/**
 * 设置全屏沉浸模式状态
 * 激活沉浸模式时强制将顶栏与 WCO 原生窗口控件区域压暗为深色，退出时自动恢复常规主题色
 */
export function setImmersiveThemeColor(active: boolean) {
  isImmersiveActive = active;
  syncMetaThemeColor();
}

export function getIsImmersiveActive(): boolean {
  return isImmersiveActive;
}

/**
 * 注册一个活动的弹窗/抽屉/操作菜单全屏遮罩引用
 * 保证在浮层打开时，macOS WCO 左右两侧原生窗口控件底色同步暗化为遮罩深色，彻底杜绝天花板浅色漏光断层
 * 返回清理函数（在组件销毁或关闭时执行）
 */
export function pushModalBackdrop(): () => void {
  modalBackdropCount++;
  syncMetaThemeColor();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    modalBackdropCount = Math.max(0, modalBackdropCount - 1);
    syncMetaThemeColor();
  };
}

export function getModalBackdropCount(): number {
  return modalBackdropCount;
}

export function isModalBackdropActive(): boolean {
  return modalBackdropCount > 0;
}

function isValidSkinId(val: any): val is SkinId {
  return typeof val === 'string' && val in SKINS;
}

function syncRootSkinAttribute(id: SkinId) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-skin', id);
  }
}

export function getTitlebarHarmony(): TitlebarHarmonyResult | null {
  return lastHarmonyResult;
}

/**
 * 动态同步 <meta name="theme-color">、--wco-titlebar-bg 与 --cinema-corner-bg
 * 保证 macOS PWA / Chrome WCO 顶栏原生区域与 Web 内容、皮肤底色及全屏沉浸播放模式无缝融合
 */
export function syncMetaThemeColor(skinId?: SkinId) {
  if (typeof document === 'undefined') return;
  const currentSkin: SkinId = skinId || (skin?.current ? skin.current : 'vinyl');
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  const baseSkinColor = isImmersiveActive
    ? (isLight
        ? (SKIN_IMMERSIVE_ANCHORS[currentSkin]?.light || '#064272')
        : (SKIN_IMMERSIVE_ANCHORS[currentSkin]?.dark || '#0a0e1a'))
    : (isLight
        ? (SKIN_THEME_COLORS[currentSkin]?.light || '#ffffff')
        : (SKIN_THEME_COLORS[currentSkin]?.dark || '#0a0e1a'));

  lastHarmonyResult = detectTitlebarHarmony({
    skinColor: baseSkinColor,
    isLight,
    isModalOpen: modalBackdropCount > 0,
    isImmersive: isImmersiveActive
  });

  const color = lastHarmonyResult.harmonizedColor;

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
  document.documentElement.style.setProperty('--wco-titlebar-bg', color);
  document.documentElement.style.setProperty('--cinema-corner-bg', buildCinemaCornerGradient({ color }));
}

function loadInitialSkin(): SkinId {
  let initialSkin: SkinId = 'vinyl';
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const previewSkin = urlParams.get('preview_skin');
      if (isValidSkinId(previewSkin)) {
        initialSkin = previewSkin;
      } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (isValidSkinId(saved)) initialSkin = saved;
      }
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
    isImmersiveActive = false;
    modalBackdropCount = 0;
    lastHarmonyResult = null;
    this.current = 'vinyl';
    syncRootSkinAttribute('vinyl');
    syncMetaThemeColor('vinyl');
    this.palette = { ...DEFAULT_PALETTE };
    this.paletteCache.clear();
    this.lastRequestedUrl = '';
  }
}

export const skin = new SkinStore();
