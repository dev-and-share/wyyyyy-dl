import type { SkinId } from '../skinTypes';
import {
  sakuraTints,
  goldColors,
  mapleRedColors,
  type AirParticle,
  type LandedPetal,
  type Butterfly
} from './seasonTypes';

export function initSeasonParticles(
  skinId: SkinId,
  width: number,
  height: number,
  currentGroundY: number
) {
  const airParticles: AirParticle[] = [];
  const landedPetals: LandedPetal[] = [];
  const butterflies: Butterfly[] = [];

  if (skinId === 'sakura') {
    // 🌸 适量飘逸的纯白透粉吉野落樱 (实景照片级优雅)
    const count = Math.min(20, Math.max(14, Math.floor(width / 60)));
    for (let i = 0; i < count; i++) {
      airParticles.push({
        x: Math.random() * width,
        y: Math.random() * height - height * 0.2,
        size: 9 + Math.random() * 8,
        vx: 0.25 + Math.random() * 0.65,
        vy: 0.35 + Math.random() * 0.55,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 0.016,
        flip: Math.random() * Math.PI,
        vFlip: 0.012 + Math.random() * 0.016,
        color: sakuraTints[Math.floor(Math.random() * sakuraTints.length)],
        subColor: '#e11d48',
        alpha: 0.85 + Math.random() * 0.15,
        oscillation: Math.random() * Math.PI * 2,
        oscSpeed: 0.014 + Math.random() * 0.014
      });
    }
    for (let i = 0; i < 16; i++) {
      landedPetals.push({
        x: Math.random() * width,
        relY: -4 - Math.random() * 20,
        size: 8 + Math.random() * 7,
        angle: Math.random() * Math.PI * 2,
        flip: (Math.random() - 0.5) * 0.6,
        color: sakuraTints[Math.floor(Math.random() * sakuraTints.length)],
        alpha: 0.82 + Math.random() * 0.18,
        maxAlpha: 0.95
      });
    }
  } else if (skinId === 'summer') {
    // 🌻 盛夏晴空蔚蓝微光尘与暖阳金尘
    const count = Math.min(26, Math.floor(width / 45));
    for (let i = 0; i < count; i++) {
      const isAzure = Math.random() > 0.4;
      airParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 2.5 + Math.random() * 4.5,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.25 - Math.random() * 0.5,
        angle: 0,
        vAngle: 0,
        flip: Math.random() * Math.PI * 2,
        vFlip: 0.02,
        color: isAzure ? '#38bdf8' : '#fef08a',
        subColor: isAzure ? '#0284c7' : '#facc15',
        alpha: 0.4 + Math.random() * 0.5,
        oscillation: Math.random() * Math.PI * 2,
        oscSpeed: 0.014
      });
    }
    // 蝴蝶：小巧精致灵动，大部分时间停歇在小向日葵花瓣上轻轻扇翅
    butterflies.push({
      x: width * 0.28,
      y: currentGroundY - 52,
      targetX: width * 0.28,
      targetY: currentGroundY - 52,
      vx: 0,
      vy: 0,
      wingAngle: 0,
      wingSpeed: 0.045, // 极慢扇翅
      size: 9,          // 小巧可爱
      color: '#fef08a',
      accentColor: '#38bdf8',
      isResting: true,
      restTimer: 400,
      restTargetIndex: 1
    });
    butterflies.push({
      x: width * 0.72,
      y: currentGroundY - 48,
      targetX: width * 0.72,
      targetY: currentGroundY - 48,
      vx: 0,
      vy: 0,
      wingAngle: 1.2,
      wingSpeed: 0.04,
      size: 8.5,        // 小巧可爱
      color: '#7dd3fc',
      accentColor: '#0284c7',
      isResting: true,
      restTimer: 550,
      restTargetIndex: 3
    });
  } else if (skinId === 'autumn') {
    // 🍂 璀璨纯金银杏 + 纯正鲜红枫叶 1:1 混合 (极缓优雅飘落，宛如暖阳金秋微风)
    const count = Math.min(18, Math.max(12, Math.floor(width / 60)));
    for (let i = 0; i < count; i++) {
      const isGinkgo = Math.random() > 0.5;
      airParticles.push({
        x: Math.random() * width,
        y: Math.random() * height - height * 0.2,
        size: 11 + Math.random() * 8,
        vx: 0.12 + Math.random() * 0.25,      // 大幅降低冲力，舒缓如轻风
        vy: 0.15 + Math.random() * 0.20,      // 极缓轻柔下落，解决飘落太快问题
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 0.01, // 从容悠闲旋转
        flip: Math.random() * Math.PI,
        vFlip: 0.007 + Math.random() * 0.01,  // 极其舒缓的空气翻卷
        color: isGinkgo
          ? goldColors[Math.floor(Math.random() * goldColors.length)]
          : mapleRedColors[Math.floor(Math.random() * mapleRedColors.length)],
        subColor: isGinkgo ? '#ca8a04' : '#7f1d1d',
        alpha: 0.85 + Math.random() * 0.15,
        type: isGinkgo ? 0 : 1,               // 银杏叶与鲜艳红枫叶 1:1 自然混合
        oscillation: Math.random() * Math.PI * 2,
        oscSpeed: 0.009 + Math.random() * 0.009 // 宽广优雅的荡漾周期
      });
    }
    for (let i = 0; i < 16; i++) {
      const isGinkgo = i % 2 === 0;
      landedPetals.push({
        x: Math.random() * width,
        relY: -4 - Math.random() * 22,
        size: 10 + Math.random() * 7,
        angle: Math.random() * Math.PI * 2,
        flip: (Math.random() - 0.5) * 0.6,
        color: isGinkgo
          ? goldColors[Math.floor(Math.random() * goldColors.length)]
          : mapleRedColors[Math.floor(Math.random() * mapleRedColors.length)],
        alpha: 0.82 + Math.random() * 0.18,
        maxAlpha: 0.95,
        type: isGinkgo ? 0 : 1
      });
    }
  } else if (skinId === 'winter') {
    // ❄️ 纯白飞雪 (数量充沛漫天白雪)
    const count = Math.min(55, Math.floor(width / 20));
    for (let i = 0; i < count; i++) {
      airParticles.push({
        x: Math.random() * width,
        y: Math.random() * height - height * 0.1,
        size: 2.8 + Math.random() * 5.2,
        vx: (Math.random() - 0.5) * 0.4,
        vy: 0.7 + Math.random() * 1.3,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 0.015,
        flip: 0,
        vFlip: 0,
        color: '#ffffff', // 纯白雪花
        subColor: '#f8fafc',
        alpha: 0.6 + Math.random() * 0.4,
        type: Math.random() > 0.55 ? 1 : 0,
        oscillation: Math.random() * Math.PI * 2,
        oscSpeed: 0.015
      });
    }
  }

  return { airParticles, landedPetals, butterflies };
}
