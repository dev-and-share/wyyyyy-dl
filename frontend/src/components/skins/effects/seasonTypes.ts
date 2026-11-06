import type { SkinId } from '../skinTypes';

// 空中飘落粒子
export interface AirParticle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  angle: number;
  vAngle: number;
  flip: number;
  vFlip: number;
  color: string;
  subColor: string;
  alpha: number;
  type?: number;
  oscillation: number;
  oscSpeed: number;
}

// 地面积累粒子 (花瓣/金黄银杏/冰晶)
export interface LandedPetal {
  x: number;
  relY: number;
  size: number;
  angle: number;
  flip: number;
  color: string;
  alpha: number;
  maxAlpha: number;
  type?: number;
}

// 极度缓慢从容的夏日飞蝶
export interface Butterfly {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  wingAngle: number;
  wingSpeed: number;
  size: number;
  color: string;
  accentColor: string;
  isResting: boolean;
  restTimer: number;
  restTargetIndex: number;
}

// 向日葵植株参数
export interface SunflowerPlant {
  xPercent: number;
  heightPx: number;
  headSize: number;
  petalCount: number;
  swayPhase: number;
  leafSide: number;
}

// ❄️ 落地雪晶
export interface LandedSnowCrystal {
  x: number;
  relY: number;
  size: number;
  type: number;
  alpha: number;
  angle: number;
}

export const sakuraTints = ['#fff5f8', '#ffffff', '#fce7f3', '#fff0f5'];
export const goldColors = ['#fde047', '#facc15', '#eab308'];
export const mapleRedColors = ['#ef4444', '#dc2626', '#b91c1c'];

export const DEFAULT_SUNFLOWERS: SunflowerPlant[] = [
  { xPercent: 0.12, heightPx: 42, headSize: 9, petalCount: 16, swayPhase: 0, leafSide: 1 },
  { xPercent: 0.28, heightPx: 52, headSize: 11, petalCount: 16, swayPhase: 1.2, leafSide: -1 },
  { xPercent: 0.50, heightPx: 38, headSize: 8, petalCount: 14, swayPhase: 2.5, leafSide: 1 },
  { xPercent: 0.72, heightPx: 48, headSize: 10, petalCount: 16, swayPhase: 3.8, leafSide: -1 },
  { xPercent: 0.88, heightPx: 40, headSize: 9, petalCount: 15, swayPhase: 5.1, leafSide: 1 }
];
