/**
 * 🎬 2D Cinema Corner & Titlebar Harmony Engine (顶栏色彩和谐与电影级柔焦晕染引擎)
 * 
 * 解决 Chrome PWA / macOS WCO 独立窗口模式下，操作系统非客户区（交通灯与插件控制栏）
 * 与 Web DOM 遮罩层/不同皮肤背景之间的物理断层与“大门牙/死黑斑块”问题。
 */

export interface CinemaCornerOptions {
  /** 顶角锚点基色，支持 CSS 变量（如 'var(--wco-titlebar-bg)'）或具体 hex（如 '#fffdf0'） */
  color?: string;
  /** 椭圆横向扩散半轴 (px) */
  radiusX?: number;
  /** 椭圆纵向衰减半轴 (px) */
  radiusY?: number;
  /** 整体不透明度 (0.0 ~ 1.0) */
  opacity?: number;
}

export interface TitlebarHarmonyParams {
  skinColor: string;
  isLight: boolean;
  isModalOpen: boolean;
  isImmersive?: boolean;
}

export interface TitlebarHarmonyResult {
  /** 协调后的最和谐顶栏背景色 (用于 <meta name="theme-color"> 与 --wco-titlebar-bg) */
  harmonizedColor: string;
  /** 是否检测到底层与浮层之间存在不和谐色差 */
  isDisharmonious: boolean;
  /** 相对亮度差异 (0.0 ~ 1.0) */
  contrastDelta: number;
}

/**
 * 解析 Hex 颜色值为 RGB 分量
 */
export function parseHex(hex: string, fallback = { r: 255, g: 255, b: 255 }): { r: number; g: number; b: number } {
  if (!hex || typeof hex !== 'string') return fallback;
  let clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) {
    return fallback;
  }
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) {
    return fallback;
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * 将 RGB 转换为 Hex
 */
export function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toPadded = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toPadded(r)}${toPadded(g)}${toPadded(b)}`;
}

/**
 * 计算标准 WCAG 相对亮度 (0.0 ~ 1.0)
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const sRGB = [r, g, b].map(v => {
    const val = v / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

/**
 * 物理级 Alpha 混色计算: Base + Overlay * Alpha
 */
export function blendColors(baseHex: string, overlayHex: string, alpha: number): string {
  const base = parseHex(baseHex);
  const overlay = parseHex(overlayHex);
  const a = Math.max(0, Math.min(1, alpha));
  const r = base.r * (1 - a) + overlay.r * a;
  const g = base.g * (1 - a) + overlay.g * a;
  const b = base.b * (1 - a) + overlay.b * a;
  return toHex(r, g, b);
}

/**
 * 🎨 色彩和谐度感知与检测引擎
 * 针对当前深浅色主题、皮肤底色与活动浮层，计算出与视口最和谐的系统顶栏色
 */
export function detectTitlebarHarmony(params: TitlebarHarmonyParams): TitlebarHarmonyResult {
  const { skinColor, isLight, isModalOpen, isImmersive = false } = params;

  if (isImmersive) {
    // 全屏沉浸模式由各自沉浸锚点掌管
    return {
      harmonizedColor: isLight ? skinColor : (blendColors(skinColor, '#0a0e1a', 0.7) || '#0a0e1a'),
      isDisharmonious: false,
      contrastDelta: 0
    };
  }

  if (!isModalOpen) {
    // 无浮层常态: 直接采用皮肤原色，100% 浑然一体
    return {
      harmonizedColor: skinColor,
      isDisharmonious: false,
      contrastDelta: 0
    };
  }

  // 🛡️ 浮层 (Modal / Menu / Drawer) 打开时的和谐度算法:
  if (!isLight) {
    // 深色模式下: 遮罩为暗色，顶栏自然收敛至沉浸深色 #121212
    return {
      harmonizedColor: '#121212',
      isDisharmonious: false,
      contrastDelta: Math.abs(getRelativeLuminance(skinColor) - getRelativeLuminance('#121212'))
    };
  }

  // 白天浅色模式下浮层打开:
  // 全屏有深色遮罩 (bg-black/50 + backdrop-blur)，为保证两端非客户区与中间遮罩处于完全相同的深邃光学频段，
  // 采用皮肤同色系深邃暗场混色 (类似沉浸模式锚点，约 80% 压暗)，杜绝两端比中间遮罩亮形成“大门牙”
  const blendedColor = blendColors(skinColor, '#0a0e1a', 0.82);
  const skinLuminance = getRelativeLuminance(skinColor);
  const blendedLuminance = getRelativeLuminance(blendedColor);
  const contrastDelta = Math.abs(skinLuminance - blendedLuminance);

  return {
    harmonizedColor: blendedColor,
    isDisharmonious: contrastDelta > 0.3,
    contrastDelta
  };
}

/**
 * 🎬 生成 2D Cinema Corner 双顶角电影级柔焦径向渐变背景 CSS
 * 左上角 (0% 0%) 交通灯与右上角 (100% 0%) 控件向内、向下平滑漫反射扩散，彻底消灭物理矩形硬切边
 */
export function buildCinemaCornerGradient(options?: CinemaCornerOptions): string {
  const color = options?.color || 'var(--wco-titlebar-bg)';
  const rx = options?.radiusX ?? 480;
  const ry = options?.radiusY ?? 280;

  if (color.startsWith('#')) {
    const { r, g, b } = parseHex(color);
    const stop100 = `rgba(${r}, ${g}, ${b}, 1)`;
    const stop82 = `rgba(${r}, ${g}, ${b}, 0.82)`;
    const stop48 = `rgba(${r}, ${g}, ${b}, 0.48)`;
    const stop18 = `rgba(${r}, ${g}, ${b}, 0.18)`;
    const stop0 = `rgba(${r}, ${g}, ${b}, 0)`;

    return [
      `radial-gradient(ellipse ${rx}px ${ry}px at 0% 0%, ${stop100} 0%, ${stop100} 55px, ${stop82} 110px, ${stop48} 190px, ${stop18} 280px, ${stop0} 100%)`,
      `radial-gradient(ellipse ${rx}px ${ry}px at 100% 0%, ${stop100} 0%, ${stop100} 55px, ${stop82} 110px, ${stop48} 190px, ${stop18} 280px, ${stop0} 100%)`
    ].join(', ');
  }

  return [
    `radial-gradient(ellipse ${rx}px ${ry}px at 0% 0%, ${color} 0%, ${color} 55px, color-mix(in srgb, ${color} 82%, transparent) 110px, color-mix(in srgb, ${color} 48%, transparent) 190px, color-mix(in srgb, ${color} 18%, transparent) 280px, transparent 100%)`,
    `radial-gradient(ellipse ${rx}px ${ry}px at 100% 0%, ${color} 0%, ${color} 55px, color-mix(in srgb, ${color} 82%, transparent) 110px, color-mix(in srgb, ${color} 48%, transparent) 190px, color-mix(in srgb, ${color} 18%, transparent) 280px, transparent 100%)`
  ].join(', ');
}

/**
 * 快捷生成内联 style 属性字符串
 */
export function resolveCinemaCornerStyle(options?: CinemaCornerOptions): string {
  const gradient = buildCinemaCornerGradient(options);
  const opacity = options?.opacity !== undefined ? `opacity: ${options.opacity};` : '';
  return `background: ${gradient}; ${opacity}`.trim();
}

/**
 * 一键将色彩和谐与 Cinema Corner 变量应用至 DOM 节点（默认 document.documentElement）
 */
export function applyCinemaCornerCssVars(color: string, root?: HTMLElement): void {
  if (typeof document === 'undefined') return;
  const target = root || document.documentElement;
  target.style.setProperty('--wco-titlebar-bg', color);
  target.style.setProperty('--cinema-corner-bg', buildCinemaCornerGradient({ color }));
}

