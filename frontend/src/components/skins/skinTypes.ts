import { DEFAULT_PALETTE, type CoverPalette } from 'pwa-audio-player';

export { DEFAULT_PALETTE, type CoverPalette };
export type SkinId =
  | 'vinyl'
  | 'cassette'
  | 'cd'
  | 'tube'
  | 'winamp'
  | 'cyber'
  | 'aurora'
  | 'rain'
  | 'sakura'
  | 'summer'
  | 'autumn'
  | 'winter'
  | 'spring'; // 保留 spring 兼容原有代码与历史配置

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
  // 🎧 1. 硬件设备组 (6款)
  vinyl: {
    id: 'vinyl',
    name: 'Classic Vinyl',
    emoji: '💿',
    desc: 'Turntable and simulated needle drop'
  },
  cassette: {
    id: 'cassette',
    name: 'Retro Cassette',
    emoji: '📼',
    desc: 'Dual spools and vintage tape player feel'
  },
  cd: {
    id: 'cd',
    name: 'Retro CD Walkman',
    emoji: '💽',
    desc: 'Holographic laser disc & millennium Discman'
  },
  tube: {
    id: 'tube',
    name: 'Vacuum Tube Amp',
    emoji: '📻',
    desc: 'Warm glowing tubes, dancing dual VU meters & cozy Minuet cat'
  },
  winamp: {
    id: 'winamp',
    name: 'Winamp',
    emoji: '⚡',
    desc: 'Y2K metal chassis and real-time spectrum analyzer'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Synthwave',
    emoji: '🌆',
    desc: '80s neon highway, retro sunset & headbanging Rust-E robot'
  },

  // 🌿 2. 自然氛围组 (6款)
  aurora: {
    id: 'aurora',
    name: 'Dynamic Aurora',
    emoji: '🌌',
    desc: 'Modern fluid and diffuse neon'
  },
  rain: {
    id: 'rain',
    name: 'Rainy Window',
    emoji: '🌧️',
    desc: 'Raindrops running down glass & window-sketching Lofi girl'
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
  },

  // 🌱 3. 保留代码与样式备用（不在 12 款活跃选单中）
  spring: {
    id: 'spring',
    name: 'Spring Greenery',
    emoji: '🌱',
    desc: 'Fresh greenery and jade bamboo'
  }
};

/**
 * 🎨 活跃的 12 款皮肤矩阵：SP (3×4=12) ✕ PC (6×2=12)
 */
export const ACTIVE_SKIN_IDS: SkinId[] = [
  'vinyl',
  'cassette',
  'cd',
  'tube',
  'winamp',
  'cyber',
  'aurora',
  'rain',
  'sakura',
  'summer',
  'autumn',
  'winter'
];

export const SKIN_LIST: SkinMeta[] = ACTIVE_SKIN_IDS.map((id) => SKINS[id]);

/**
 * 🎨 PWA title bar and theme colors for skins (dark/light)
 */
export const SKIN_THEME_COLORS: Record<SkinId, { dark: string; light: string }> = {
  vinyl: { dark: '#0a0e1a', light: '#ffffff' },
  cassette: { dark: '#121316', light: '#fefce8' },
  cd: { dark: '#0c192c', light: '#f0f9ff' },
  tube: { dark: '#170b04', light: '#fffbeb' },
  winamp: { dark: '#11141b', light: '#f1f5f9' },
  cyber: { dark: '#1a052e', light: '#faf5ff' },
  aurora: { dark: '#0c0a1a', light: '#faf5ff' },
  rain: { dark: '#08101e', light: '#f0f7ff' },
  sakura: { dark: '#240d1e', light: '#fff0f5' },
  summer: { dark: '#072b4a', light: '#e0f2fe' },
  autumn: { dark: '#1a1305', light: '#fffdf0' },
  winter: { dark: '#0b121e', light: '#f8fafc' },
  spring: { dark: '#06140f', light: '#f0fdf4' }
};

/**
 * 🎬 全屏沉浸播放 (Immersive Player) 四角电影聚焦深度锚点色
 * 白天 (light) 使用皮肤同色系深色调（如夏日深海蓝、秋日浓郁琥珀栗褐、胆机暗木琥珀棕），彻底告别死黑；
 * 夜晚 (dark) 使用静夜沉邃色调。
 */
export const SKIN_IMMERSIVE_ANCHORS: Record<SkinId, { dark: string; light: string }> = {
  vinyl: { dark: '#0a0e1a', light: '#1e293b' },   // 白天中心 #334155 -> 角落 #1e293b (沙龙板岩深蓝)
  cassette: { dark: '#121316', light: '#3a1d0a' }, // 白天中心 #573319 -> 角落 #3a1d0a (浓郁深胡桃木)
  cd: { dark: '#0c192c', light: '#0f2e59' },       // 白天中心 #0ea5e9 -> 角落 #0f2e59 (深曜太空靛青)
  tube: { dark: '#170b04', light: '#451a03' },     // 白天中心 #92400e -> 角落 #451a03 (浓郁暗木琥珀棕)
  winamp: { dark: '#11141b', light: '#033f2e' },   // 白天中心 #065f46 -> 角落 #033f2e (复古深碧松)
  cyber: { dark: '#1a052e', light: '#3b0764' },    // 白天中心 #9333ea -> 角落 #3b0764 (深邃霓虹夜紫)
  aurora: { dark: '#0c0a1a', light: '#3b137a' },   // 白天中心 #6d28d9 -> 角落 #3b137a (暗夜紫霓)
  rain: { dark: '#08101e', light: '#0f1f3d' },     // 白天中心 #2563eb -> 角落 #0f1f3d (幽深墨雨夜青)
  sakura: { dark: '#240d1e', light: '#701445' },   // 白天中心 #be185d -> 角落 #701445 (深梅嫣红)
  summer: { dark: '#072b4a', light: '#064272' },   // 白天中心 #0284c7 -> 角落 #064272 (深海蓝)
  autumn: { dark: '#1a1305', light: '#6b2d08' },   // 白天中心 #d97706 -> 角落 #6b2d08 (浓郁琥珀栗褐)
  winter: { dark: '#0b121e', light: '#1e3a8a' },   // 白天中心 #2563eb -> 角落 #1e3a8a (深曜宝石蓝)
  spring: { dark: '#06140f', light: '#064e3b' }    // 保留 spring 备用
};
