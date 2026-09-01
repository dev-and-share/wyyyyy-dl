export type Band = { freq: number; gain: number; q: number; label: string; desc: string };

export interface PeqPreset {
  name: string;
  desc: string;
  bands: { freq: number; gain: number; q: number }[];
}

export const INITIAL_BANDS: Band[] = [
  { freq: 60, gain: 0, q: 1.4, label: '低频下潜', desc: '60Hz' },
  { freq: 230, gain: 0, q: 1.4, label: '去箱声/闷', desc: '230Hz' },
  { freq: 910, gain: 0, q: 2.0, label: '人声主体', desc: '910Hz' },
  { freq: 3600, gain: 0, q: 2.5, label: '细节提亮', desc: '3.6kHz' },
  { freq: 14000, gain: 0, q: 0.7, label: '空气感', desc: '14kHz' },
];

export const BUILTIN_PRESETS: Record<string, PeqPreset> = {
  flat: {
    name: '平直原音 (Flat)',
    desc: '原汁原味无调色',
    bands: [
      { freq: 60, gain: 0, q: 1.4 },
      { freq: 230, gain: 0, q: 1.4 },
      { freq: 910, gain: 0, q: 2.0 },
      { freq: 3600, gain: 0, q: 2.5 },
      { freq: 14000, gain: 0, q: 0.7 }
    ]
  },
  macbook: {
    name: 'MacBook 外放校正 (去箱鸣)',
    desc: '削弱 130Hz 浑浊共振，补偿 60Hz 与 14kHz 空气感',
    bands: [
      { freq: 60, gain: 2.5, q: 1.4 },
      { freq: 230, gain: -3.5, q: 2.0 },
      { freq: 910, gain: 0, q: 2.0 },
      { freq: 3600, gain: 1.5, q: 2.2 },
      { freq: 14000, gain: 2.0, q: 0.7 }
    ]
  },
  vocal: {
    name: '人声毒药 (清澈温暖)',
    desc: '清理 230Hz 箱鸣，提亮 3.6kHz 人声细节并平抑齿音',
    bands: [
      { freq: 60, gain: -0.5, q: 1.4 },
      { freq: 230, gain: -2.0, q: 1.8 },
      { freq: 910, gain: 1.5, q: 1.8 },
      { freq: 3600, gain: 2.5, q: 2.2 },
      { freq: 14000, gain: -1.5, q: 1.2 }
    ]
  },
  bass: {
    name: '澎湃重低音 (Bass Boost)',
    desc: '强劲极低频下潜，适度收敛中低频防浑浊',
    bands: [
      { freq: 60, gain: 5.0, q: 1.2 },
      { freq: 230, gain: -1.0, q: 1.4 },
      { freq: 910, gain: 0, q: 2.0 },
      { freq: 3600, gain: 1.0, q: 2.0 },
      { freq: 14000, gain: 1.0, q: 0.7 }
    ]
  },
  air: {
    name: '通透耳机 (Headphone Air)',
    desc: '微降极低频，大幅提亮极高频泛音与空气感',
    bands: [
      { freq: 60, gain: -1.0, q: 1.4 },
      { freq: 230, gain: 0, q: 1.4 },
      { freq: 910, gain: 0.5, q: 2.0 },
      { freq: 3600, gain: 2.0, q: 2.5 },
      { freq: 14000, gain: 3.5, q: 0.7 }
    ]
  }
};
