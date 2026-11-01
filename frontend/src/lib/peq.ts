/**
 * 🎛️ 5 段参量均衡器 (PEQ) 预设与数据契约
 * 底层参数定义与曲线插值算法已抽象沉淀至跨端音频引擎 pwa-audio-player
 */
export {
  type Band,
  type PeqPreset,
  type PeqCurvePoint,
  INITIAL_BANDS,
  BUILTIN_PRESETS,
  calculatePeqCurve
} from 'pwa-audio-player';
