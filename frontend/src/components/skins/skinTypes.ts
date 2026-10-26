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
  }
};

export const SKIN_LIST: SkinMeta[] = Object.values(SKINS);

/**
 * 🎨 PWA title bar and theme colors for 5 skins (dark/light)
 */
export const SKIN_THEME_COLORS: Record<SkinId, { dark: string; light: string }> = {
  spring: { dark: '#06140f', light: '#f0fdf4' },
  winamp: { dark: '#11141b', light: '#f1f5f9' },
  cassette: { dark: '#121316', light: '#fefce8' },
  aurora: { dark: '#0c0a1a', light: '#faf5ff' },
  vinyl: { dark: '#0a0e1a', light: '#ffffff' }
};
