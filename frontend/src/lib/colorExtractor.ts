/**
 * 🎨 封面调色板提取与颜色计算引擎
 * 底层计算算法已抽象沉淀至跨端音频引擎 pwa-audio-player
 */
export {
  type CoverPalette,
  DEFAULT_PALETTE,
  rgbToHsl,
  hslToRgb,
  extractPaletteFromPixels,
  extractCoverPalette
} from 'pwa-audio-player';
