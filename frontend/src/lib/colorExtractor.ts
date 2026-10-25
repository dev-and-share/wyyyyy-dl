import { DEFAULT_PALETTE, type CoverPalette } from '../components/skins/skinTypes';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

interface ColorBucket {
  count: number;
  totalR: number;
  totalG: number;
  totalB: number;
}

/**
 * 从 32×32 像素数据中统计直方图并提取主题调色板（纯函数，方便单元测试）
 */
export function extractPaletteFromPixels(
  pixels: Uint8ClampedArray | number[] | Uint8Array,
  isDarkTheme = true
): CoverPalette {
  if (!pixels || pixels.length < 4) {
    return { ...DEFAULT_PALETTE };
  }

  const buckets = new Map<number, ColorBucket>();
  const totalPixels = Math.floor(pixels.length / 4);

  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 128) continue; // 忽略高透明度像素

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // 4-bit 量化 (0..15)
    const r4 = r >> 4;
    const g4 = g >> 4;
    const b4 = b >> 4;
    const key = (r4 << 8) | (g4 << 4) | b4;

    const bkt = buckets.get(key);
    if (bkt) {
      bkt.count++;
      bkt.totalR += r;
      bkt.totalG += g;
      bkt.totalB += b;
    } else {
      buckets.set(key, { count: 1, totalR: r, totalG: g, totalB: b });
    }
  }

  if (buckets.size === 0) {
    return { ...DEFAULT_PALETTE };
  }

  // 整理所有桶的平均颜色和 HSL
  interface AnalyzedBucket {
    r: number;
    g: number;
    b: number;
    h: number;
    s: number;
    l: number;
    count: number;
  }

  const analyzed: AnalyzedBucket[] = [];
  for (const bkt of buckets.values()) {
    const r = Math.round(bkt.totalR / bkt.count);
    const g = Math.round(bkt.totalG / bkt.count);
    const b = Math.round(bkt.totalB / bkt.count);
    const [h, s, l] = rgbToHsl(r, g, b);
    analyzed.push({ r, g, b, h, s, l, count: bkt.count });
  }

  // 1. Dominant: 频次最高桶
  analyzed.sort((a, b) => b.count - a.count);
  const domBkt = analyzed[0];

  // 2. Accent: 饱和度与鲜艳度加权最高桶，避免纯黑白纯灰
  let bestAccentBkt = domBkt;
  let bestAccentScore = -1;

  for (const bkt of analyzed) {
    // 过滤极致黑或极致白
    if (bkt.l < 0.1 || bkt.l > 0.95) continue;
    // 鼓励较高饱和度
    const vibrancy = bkt.s;
    const countWeight = Math.sqrt(bkt.count / totalPixels);
    const score = (vibrancy * 2 + (1 - Math.abs(bkt.l - 0.5))) * countWeight;
    if (score > bestAccentScore) {
      bestAccentScore = score;
      bestAccentBkt = bkt;
    }
  }

  // 3. Muted: 柔和、中等明度低饱和度
  let bestMutedBkt = domBkt;
  let bestMutedScore = -1;
  for (const bkt of analyzed) {
    if (bkt === bestAccentBkt) continue;
    const isMediumLight = 1 - Math.abs(bkt.l - 0.55);
    const isSoft = 1 - Math.abs(bkt.s - 0.3);
    const score = isMediumLight * 1.5 + isSoft;
    if (score > bestMutedScore) {
      bestMutedScore = score;
      bestMutedBkt = bkt;
    }
  }

  // 对比度保护与明度步进
  let accentHsl = [bestAccentBkt.h, bestAccentBkt.s, bestAccentBkt.l];
  if (isDarkTheme) {
    // 深色模式下，若 accent 过暗（< 0.45），提亮以保证在深色舞台下清晰
    if (accentHsl[2] < 0.45) accentHsl[2] = 0.55;
    // 若饱和度过低，稍微提升一点点
    if (accentHsl[1] < 0.25) accentHsl[1] = 0.4;
  } else {
    // 浅色模式下，若 accent 过亮（> 0.65），适当调低
    if (accentHsl[2] > 0.65) accentHsl[2] = 0.45;
  }

  const [accR, accG, accB] = hslToRgb(accentHsl[0], accentHsl[1], accentHsl[2]);

  return {
    dominant: `rgb(${domBkt.r}, ${domBkt.g}, ${domBkt.b})`,
    accent: `rgb(${accR}, ${accG}, ${accB})`,
    muted: `rgb(${bestMutedBkt.r}, ${bestMutedBkt.g}, ${bestMutedBkt.b})`,
    glow: `rgba(${accR}, ${accG}, ${accB}, 0.45)`
  };
}

/**
 * 异步从封面图片 URL 提取调色板
 * 支持 CORS anonymous、缩放到 32x32，异常安全回退 DEFAULT_PALETTE
 */
export async function extractCoverPalette(
  coverUrl?: string | null,
  isDarkTheme = true
): Promise<CoverPalette> {
  if (!coverUrl || typeof window === 'undefined') {
    return { ...DEFAULT_PALETTE };
  }

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ ...DEFAULT_PALETTE });
      }
    }, 1500);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    img.onload = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve({ ...DEFAULT_PALETTE });
          return;
        }
        ctx.drawImage(img, 0, 0, 32, 32);
        const imgData = ctx.getImageData(0, 0, 32, 32);
        const palette = extractPaletteFromPixels(imgData.data, isDarkTheme);
        resolve(palette);
      } catch {
        resolve({ ...DEFAULT_PALETTE });
      }
    };

    img.onerror = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve({ ...DEFAULT_PALETTE });
    };

    img.src = coverUrl;
  });
}
