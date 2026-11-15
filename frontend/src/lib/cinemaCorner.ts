/**
 * 2D 阴影防穿帮 / 影院级顶角漫反射羽化引擎 (2D Cinema Corner Diffusion Engine)
 * 底层几何探测、主色采样与径向羽化算法已抽象沉淀至跨端引擎 pwa-audio-player
 */
import {
  parseColorRgb,
  toHex,
  getRelativeLuminance,
  blendColors,
  computeTitlebarHarmony,
  buildWcoCornerGradient,
  sampleTopColorFromPixels,
  sampleElementTopColor,
  isWcoActive,
  getWcoGeometry,
  syncWcoGeometryCssVars,
  type WcoCornerGradientOptions,
  type TitlebarHarmonyOutput,
  type WcoGeometry,
  type RgbColor
} from 'pwa-audio-player';

export interface CinemaCornerOptions extends WcoCornerGradientOptions {
  opacity?: number;
}

export interface TitlebarHarmonyParams {
  /** 当前皮肤或背景期望的基础主色 */
  skinColor: string;
  /** 是否处于浅色模式 */
  isLight: boolean;
  /** 是否有弹窗/歌词页遮罩正在覆盖 */
  isModalOpen: boolean;
  /** 是否处于大屏沉浸式背景模式（如 Vinyl/CoverFlow） */
  isImmersive?: boolean;
  /** 用户自定义图片/视频背景顶角采样主色（已叠加 dimOpacity 压暗） */
  customBgColor?: string | null;
}

export type TitlebarHarmonyResult = TitlebarHarmonyOutput;
export type { WcoGeometry, RgbColor };

export {
  parseColorRgb as parseHex,
  toHex,
  getRelativeLuminance,
  blendColors,
  sampleTopColorFromPixels,
  sampleElementTopColor,
  isWcoActive,
  getWcoGeometry,
  syncWcoGeometryCssVars
};

/**
 * 视觉调和检测与自适应算法 (Titlebar Harmony Detector)
 * 委托 pwa-audio-player 的 computeTitlebarHarmony，保持本应用浅色/深色遮罩色彩契约。
 */
export function detectTitlebarHarmony(params: TitlebarHarmonyParams): TitlebarHarmonyResult {
  if (params.isImmersive) {
    const immersiveBase =
      typeof params.customBgColor === 'string' && params.customBgColor.trim().length > 0
        ? params.customBgColor.trim()
        : params.skinColor;
    return computeTitlebarHarmony({
      baseColor: immersiveBase,
      isLight: params.isLight,
      isModalOpen: false,
      isImmersive: false
    });
  }

  return computeTitlebarHarmony({
    baseColor: params.skinColor,
    isLight: params.isLight,
    isModalOpen: params.isModalOpen,
    isImmersive: false,
    customBgColor: params.customBgColor,
    modalOverlayColor: '#0a0e1a',
    modalOverlayAlpha: 0.82,
    darkModalColor: '#121212'
  });
}

/**
 * 生成贴合 macOS/Windows WCO 窗口控制区的双角径向漫反射渐晕 CSS background。
 * 委托 pwa-audio-player 的 buildWcoCornerGradient 动态对齐 WCO 真实尺寸。
 */
export function buildCinemaCornerGradient(options: CinemaCornerOptions = {}): string {
  return buildWcoCornerGradient(options);
}

/**
 * 生成可直接挂载到遮罩组件或自定义头部的内联 style 字符串
 */
export function resolveCinemaCornerStyle(options: CinemaCornerOptions = {}): string {
  const { opacity = 1, ...gradientOptions } = options;
  const gradient = buildCinemaCornerGradient(gradientOptions);
  return `background: ${gradient}; opacity: ${opacity};`;
}

/**
 * 在根节点或指定容器写入 WCO 阴影渐变与纯色 CSS 变量，供样式表零开销消费
 */
export function applyCinemaCornerCssVars(
  color: string,
  root?: HTMLElement,
  geometry?: Partial<Pick<WcoGeometry, 'left' | 'right' | 'height'>>
): void {
  const target = root ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!target) return;

  target.style.setProperty('--wco-titlebar-bg', color);
  target.style.setProperty('--cinema-corner-bg', buildCinemaCornerGradient({ color, ...geometry }));
}
