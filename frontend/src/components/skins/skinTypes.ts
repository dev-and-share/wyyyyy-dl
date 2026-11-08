import { DEFAULT_PALETTE, type CoverPalette } from 'pwa-audio-player';

export { DEFAULT_PALETTE, type CoverPalette };
export type SkinId =
  | 'vinyl'
  | 'aurora'
  | 'cassette'
  | 'winamp'
  | 'spring'
  | 'sakura'
  | 'summer'
  | 'autumn'
  | 'winter';

export interface SkinMeta {
  id: SkinId;
  name: string;
  emoji: string;
  desc: string;
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

export const SKINS: Record<SkinId, SkinMeta> = {
  vinyl: {
    id: 'vinyl',
    name: 'Classic Vinyl',
    emoji: '💿',
    desc: 'Turntable and simulated needle drop'
  },
  aurora: {
    id: 'aurora',
    name: 'Dynamic Aurora',
    emoji: '🌌',
    desc: 'Modern fluid and diffuse neon'
  },
  cassette: {
    id: 'cassette',
    name: 'Retro Cassette',
    emoji: '📼',
    desc: 'Dual spools and vintage tape player feel'
  },
  winamp: {
    id: 'winamp',
    name: 'Winamp',
    emoji: '⚡',
    desc: 'Y2K metal chassis and matrix spectrum'
  },
  spring: {
    id: 'spring',
    name: 'Spring Greenery',
    emoji: '🌱',
    desc: 'Fresh greenery and jade bamboo'
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura Drift',
    emoji: '🌸',
    desc: 'Dancing cherry blossoms and gentle spring wind'
  },
  summer: {
    id: 'summer',
    name: 'Summer Meadow',
    emoji: '🌻',
    desc: 'Golden sunflowers and fluttering butterflies'
  },
  autumn: {
    id: 'autumn',
    name: 'Autumn Breeze',
    emoji: '🍁',
    desc: 'Whirling maple leaves and warm wooden hearth'
  },
  winter: {
    id: 'winter',
    name: 'Winter Snowfall',
    emoji: '❄️',
    desc: 'Pure falling snowflakes and crystal ice glass'
  }
};

export const SKIN_LIST: SkinMeta[] = Object.values(SKINS);

/**
 * 🎨 PWA title bar and theme colors for skins (dark/light)
 */
export const SKIN_THEME_COLORS: Record<SkinId, { dark: string; light: string }> = {
  spring: { dark: '#06140f', light: '#f0fdf4' },
  sakura: { dark: '#240d1e', light: '#fff0f5' },
  summer: { dark: '#072b4a', light: '#e0f2fe' },
  autumn: { dark: '#1a1305', light: '#fffdf0' },
  winter: { dark: '#0b121e', light: '#f8fafc' },
  winamp: { dark: '#11141b', light: '#f1f5f9' },
  cassette: { dark: '#121316', light: '#fefce8' },
  aurora: { dark: '#0c0a1a', light: '#faf5ff' },
  vinyl: { dark: '#0a0e1a', light: '#ffffff' }
};

/**
 * 🎬 全屏沉浸播放 (Immersive Player) 四角电影聚焦深度锚点色
 * 白天 (light) 使用皮肤同色系深色调（如夏日深海蓝、秋日浓郁琥珀栗褐），彻底告别死黑；
 * 夜晚 (dark) 使用静夜沉邃色调。
 */
export const SKIN_IMMERSIVE_ANCHORS: Record<SkinId, { dark: string; light: string }> = {
  summer: { dark: '#072b4a', light: '#064272' }, // 白天中心 #0284c7 -> 角落 #064272 (深海蓝)
  autumn: { dark: '#1a1305', light: '#6b2d08' }, // 白天中心 #d97706 -> 角落 #6b2d08 (浓郁琥珀栗褐)
  spring: { dark: '#06140f', light: '#064e3b' }, // 白天中心 #059669 -> 角落 #064e3b (苍翠林海深绿)
  sakura: { dark: '#240d1e', light: '#701445' }, // 白天中心 #be185d -> 角落 #701445 (深梅嫣红)
  winter: { dark: '#0b121e', light: '#1e3a8a' }, // 白天中心 #2563eb -> 角落 #1e3a8a (深曜宝石蓝)
  aurora: { dark: '#0c0a1a', light: '#3b137a' }, // 白天中心 #6d28d9 -> 角落 #3b137a (暗夜紫霓)
  cassette: { dark: '#121316', light: '#3a1d0a' }, // 白天中心 #573319 -> 角落 #3a1d0a (浓郁深胡桃木)
  winamp: { dark: '#11141b', light: '#033f2e' }, // 白天中心 #065f46 -> 角落 #033f2e (复古深碧松)
  vinyl: { dark: '#0a0e1a', light: '#1e293b' }   // 白天中心 #334155 -> 角落 #1e293b (沙龙板岩深蓝)
};
