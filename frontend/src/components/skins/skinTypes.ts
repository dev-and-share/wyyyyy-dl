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
