export type SkinId = 'vinyl' | 'aurora' | 'cassette';

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
    desc: '黑胶唱机与动态唱臂'
  },
  aurora: {
    id: 'aurora',
    name: '灵动极光',
    emoji: '🌌',
    desc: '流体色彩与光晕弥散'
  },
  cassette: {
    id: 'cassette',
    name: '复古磁带',
    emoji: '📼',
    desc: '机械双轴与磁带轮转'
  }
};

export const SKIN_LIST: SkinMeta[] = Object.values(SKINS);
