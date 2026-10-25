export type SkinId = 'vinyl' | 'aurora' | 'cassette' | 'winamp' | 'spring';

export interface SkinMeta {
  id: SkinId;
  name: string;
  emoji: string;
  desc: string;
}

export interface CoverPalette {
  dominant: string; // rgb(r, g, b)
  accent: string;   // rgb(r, g, b)
  muted: string;    // rgb(r, g, b)
  glow: string;     // rgba(r, g, b, a)
}

export interface SkinStageProps {
  track: any;
  playing: boolean;
  currentTime: number;
  duration: number;
  palette: CoverPalette;
  isLiked?: boolean;
  onToggleLike?: () => void;
  onOpenComments?: () => void;
  onAddToPlaylist?: () => void;
}

export const DEFAULT_PALETTE: CoverPalette = {
  dominant: 'rgb(30, 41, 59)',
  accent: 'rgb(239, 68, 68)',
  muted: 'rgb(148, 163, 184)',
  glow: 'rgba(239, 68, 68, 0.45)'
};

export const SKINS: Record<SkinId, SkinMeta> = {
  vinyl: {
    id: 'vinyl',
    name: '经典黑胶',
    emoji: '💿',
    desc: '黑胶唱机与模拟落针'
  },
  aurora: {
    id: 'aurora',
    name: '灵动极光',
    emoji: '🌌',
    desc: '现代流体与弥散霓虹'
  },
  cassette: {
    id: 'cassette',
    name: '复古磁带',
    emoji: '📼',
    desc: '机械双轴与随身听质感'
  },
  winamp: {
    id: 'winamp',
    name: 'Winamp 经典',
    emoji: '⚡',
    desc: '千禧金属面板与绿色点阵频谱'
  },
  spring: {
    id: 'spring',
    name: '春日青绿',
    emoji: '🌱',
    desc: '草木生机与翡翠竹韵'
  }
};

export const SKIN_LIST: SkinMeta[] = Object.values(SKINS);

/**
 * 🎨 5 套皮肤对应的 PWA 标题栏 / 系统主题色 (深色/浅色)
 * 适配 macOS PWA (Safari 添加到程序坞 / Chrome WCO) 与移动端状态栏
 */
export const SKIN_THEME_COLORS: Record<SkinId, { dark: string; light: string }> = {
  spring: { dark: '#06140f', light: '#f0fdf4' }, // 翡翠幽绿 / 萌芽嫩白
  winamp: { dark: '#11141b', light: '#f1f5f9' }, // 钛金冷灰 / 明亮银白
  cassette: { dark: '#121316', light: '#fefce8' }, // 随身听焦糖黑 / 暖阳纸黄
  aurora: { dark: '#0c0a1a', light: '#faf5ff' }, // 极光幽夜紫 / 丁香浅紫
  vinyl: { dark: '#0a0e1a', light: '#ffffff' }  // 黑曜深蓝 / 典雅高光白
};
