import { platform } from '../platform';

/**
 * 🎵 Web Audio API 真实物理音频分析与可视化驱动引擎
 * 提供 10 频段实时 FFT 频域能量、RMS 立体声电平与低音冲击能量，
 * 专为 Winamp 频谱仪、复古胆机 VU 表及拟人互动角色提供真实音画同步。
 */

export class AudioVisualizerEngine {
  // 10 根频段能量 (0 ~ 1)
  bands = $state<number[]>(new Array(10).fill(0));
  // 综合平滑电平 (0 ~ 1，带惯性阻尼，专供 VU 表指针)
  vuLevel = $state<number>(0);
  // 低频冲击能量 (0 ~ 1，专供机器人点头与散景呼吸)
  bassEnergy = $state<number>(0);

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private currentAudioEl: HTMLAudioElement | null = null;
  private animId: number = 0;
  private isRunning: boolean = false;
  private freqData: Uint8Array | null = null;

  /**
   * 绑定全局原生 <audio> 节点
   * ⚠️ 核心架构铁律（千万不要改回来）：
   * 1. 桌面端 (PC/Mac)：全量接通 Web Audio API 物理 FFT 采样分析 (AnalyserNode)；
   * 2. iOS 移动端：绝对禁止调用 createMediaElementSource 劫持 <audio> 节点！
   *    - 原理：iOS WebKit 将 Web Audio 视为前台交互音频，一旦手机熄屏/锁屏或切后台，系统会立即强制挂起 AudioContext；
   *    - 若将 <audio> 连入 AudioContext，AudioContext 挂起后扬声器输出将瞬间断流，且 WebKit 会强行触发 audioEl.pause()；
   *    - 此外，iOS 接入 Web Audio 要求音频必须符合严格 CORS，会导致非同源流媒体播放受阻；
   *    - 因此 iOS 端必须保持原生系统 mediaserverd 直通管道，频谱仪自动走 fallbackTick Mock 律动。
   */
  attach(audioEl: HTMLAudioElement | null) {
    if (!audioEl || typeof window === 'undefined') return;
    // 🛡️ iOS 及不支持设备彻底停用 Web Audio 采样，杜绝 WebKit 崩溃与后台断流
    if (platform.isIOS || !platform.canUseAudioProcessing) return;
    if (this.currentAudioEl === audioEl && this.sourceNode) return;

    this.currentAudioEl = audioEl;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtxClass();
      }

      if (!this.analyser) {
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 512; // 256 个频点，提供极致精细的低频分辨率与声学八度划分
        this.analyser.smoothingTimeConstant = 0.55; // 瞬态响应灵敏富有弹性，精准捕捉打击乐跳跃
        this.analyser.minDecibels = -85;
        this.analyser.maxDecibels = -25;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      }

      // 注意：同一个 HTMLAudioElement 只能创建一次 MediaElementSourceNode
      if (!this.sourceNode) {
        this.sourceNode = this.audioCtx.createMediaElementSource(audioEl);
        this.sourceNode.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
      }
    } catch (err) {
      // 在极少数不支持或特殊环境下静默降级
      console.warn('[AudioVisualizer] Web Audio connection fallback:', err);
    }
  }

  /**
   * 启动帧率监听
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // iOS 环境绝不初始化或唤醒 AudioContext，全走轻量级算法律动
    if (!platform.isIOS && this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    this.updateFrame();

    const tick = () => {
      if (!this.isRunning) return;
      this.updateFrame();
      this.animId = requestAnimationFrame(tick);
    };
    this.animId = requestAnimationFrame(tick);
  }

  /**
   * 停止监听并平滑归零
   */
  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = 0;
    }
    // 归零阻尼动画
    this.decayToZero();
  }

  private decayToZero() {
    let hasEnergy = false;
    const nextBands = [...this.bands];
    for (let i = 0; i < 10; i++) {
      if (nextBands[i] > 0.01) {
        nextBands[i] *= 0.8;
        hasEnergy = true;
      } else {
        nextBands[i] = 0;
      }
    }
    this.bands = nextBands;
    this.vuLevel = Math.max(0, this.vuLevel * 0.75);
    this.bassEnergy = Math.max(0, this.bassEnergy * 0.75);

    if (hasEnergy && !this.isRunning) {
      requestAnimationFrame(() => this.decayToZero());
    }
  }

  private updateFrame() {
    if (platform.isIOS || !this.analyser || !this.freqData) {
      // iOS 或未接通 Web Audio 时的智能优雅律动兜底
      this.fallbackTick();
      return;
    }

    (this.analyser as any).getByteFrequencyData(this.freqData);

    let sum = 0;
    for (let i = 0; i < this.freqData.length; i++) {
      sum += this.freqData[i];
    }

    // 如果因为 CORS 或静音全是 0，采用微幅智能节拍
    if (sum === 0) {
      this.fallbackTick();
      return;
    }

    // 🎯 精准对齐 Winamp 经典 10 频段 EQ 物理中心频点 (基于 256 Bin 的对数八度划分)
    // 覆盖: 60Hz(重低音/底鼓), 170Hz(贝斯基音), 310Hz(箱体共鸣/军鼓饱满度), 600Hz(中低音),
    // 1kHz(人声主体), 2.5kHz(乐器穿透力), 5kHz(军鼓清脆度), 8kHz(镲片泛音), 11kHz(高频空气感), 14kHz(极高频细节)
    const binIndices = [
      [0, 1],       // 60Hz: Bin 0~1 (~0 - 170Hz)
      [1, 2],       // 170Hz: Bin 1~2 (~86 - 258Hz)
      [2, 4],       // 310Hz: Bin 2~4 (~172 - 430Hz)
      [4, 8],       // 600Hz: Bin 4~8 (~344 - 775Hz)
      [8, 16],      // 1kHz: Bin 8~16 (~689 - 1464Hz)
      [16, 31],     // 2.5kHz: Bin 16~31 (~1378 - 2750Hz)
      [32, 59],     // 5kHz: Bin 32~59 (~2756 - 5160Hz)
      [60, 99],     // 8kHz: Bin 60~99 (~5160 - 8613Hz)
      [100, 149],   // 11kHz: Bin 100~149 (~8613 - 12900Hz)
      [150, 195]    // 14kHz: Bin 150~195 (~12900 - 16800Hz)
    ];

    // 🎵 真实声学校准的频段增益（均衡补偿粉红噪声自然滚降，适度强化低音冲击动态）
    const BAND_WEIGHTS = [1.38, 1.32, 1.25, 1.28, 1.40, 1.62, 1.95, 2.35, 2.85, 3.45];

    const newBands = new Array(10);
    for (let i = 0; i < 10; i++) {
      const [start, end] = binIndices[i];
      let valSum = 0;
      let count = 0;
      for (let j = start; j <= Math.min(end, this.freqData.length - 1); j++) {
        valSum += this.freqData[j];
        count++;
      }
      const rawAvg = count > 0 ? valSum / (count * 255) : 0;
      // 过滤微弱环境底噪 (-75dB 以下不激发)，保留强劲有力的动态回弹空间
      const normalized = Math.max(0, (rawAvg - 0.04) / 0.88);
      const val = Math.pow(normalized, 0.92) * BAND_WEIGHTS[i];
      newBands[i] = Math.max(0, Math.min(1.0, val));
    }

    // 🌟 高频泛音智能耦合 (Harmonic Coupling)：
    // 解决部分 MP3/AAC 有损编码在 12k~15kHz 强行切断导致右侧柱体死寂的问题。
    // 当 Band 7 (镲片/高频) 有活跃律动时，让 Band 8、9 呈现真实自然的频响衰减曲线，杜绝“右侧空缺”
    const b7 = newBands[7];
    const b8 = newBands[8];
    newBands[8] = Math.min(1.0, Math.max(b8, b7 * 0.48 + b8 * 0.52));
    newBands[9] = Math.min(1.0, Math.max(newBands[9], newBands[8] * 0.55 + b7 * 0.22));

    this.bands = newBands;

    // 低频能量 (取前 3 根平均，提升瞬态打击响应灵敏度)
    const instantBass = (newBands[0] * 0.45 + newBands[1] * 0.35 + newBands[2] * 0.20);
    this.bassEnergy = this.bassEnergy * 0.55 + instantBass * 0.45;

    // RMS 电平 (全体平均，带物理弹簧过冲感)
    const instantVu = Math.min(1, (sum / (this.freqData.length * 255)) * 1.35);
    // 指针具有惯性：快速弹起，柔和回落
    if (instantVu > this.vuLevel) {
      this.vuLevel = this.vuLevel * 0.3 + instantVu * 0.7;
    } else {
      this.vuLevel = this.vuLevel * 0.85 + instantVu * 0.15;
    }
  }

  /**
   * 优雅节拍算法兜底 (Procedural Mock Rhythm)
   * ⚠️ 说明：本方法是基于三角时间函数（Math.sin/cos）的 Mock 律动，非真实音频频谱分析。
   * 专供 iOS（因系统锁屏冻结限制无法开启 Web Audio 真实采样）以及音频源无 CORS 无法采样时的动效降级，
   * 确保 Winamp 频谱仪和复古胆机表头在不能真采样的平台上依然富有生机，且绝对不消耗多余电量与劫持音频流。
   */
  private fallbackTick() {
    const t = performance.now() / 1000;
    const newBands = new Array(10);
    // 模拟富有活力的全频段动态音乐律动 (动感低音鼓点 + 旋律起伏 + 灵动镲片颤动)
    // 节奏分明的 4/4 拍底鼓冲击
    const bassBeat = Math.pow(Math.max(0, Math.sin(t * 4.2)), 5) * 0.75 + 0.12;
    // 旋律中频呼吸波动
    const midMelody = Math.sin(t * 5.5) * 0.2 + Math.cos(t * 3.2) * 0.2 + 0.35;
    // 高频 16 分音符镲片瞬变跳动
    const hihatTick = Math.pow(Math.max(0, Math.sin(t * 8.4 + 0.4)), 3) * 0.6 + Math.abs(Math.cos(t * 12.0)) * 0.2 + 0.1;

    newBands[0] = Math.max(0, Math.min(0.92, bassBeat * 1.1));
    newBands[1] = Math.max(0, Math.min(0.88, bassBeat * 0.95 + 0.08));
    newBands[2] = Math.max(0, Math.min(0.82, bassBeat * 0.55 + midMelody * 0.4));
    newBands[3] = Math.max(0, Math.min(0.78, midMelody * 1.1));
    newBands[4] = Math.max(0, Math.min(0.82, midMelody * 1.15 + (Math.sin(t * 7.1) * 0.1)));
    newBands[5] = Math.max(0, Math.min(0.76, midMelody * 0.8 + hihatTick * 0.35));
    newBands[6] = Math.max(0, Math.min(0.78, hihatTick * 0.85 + midMelody * 0.2));
    newBands[7] = Math.max(0, Math.min(0.82, hihatTick * 1.05));
    newBands[8] = Math.max(0, Math.min(0.75, hihatTick * 0.95 + 0.05));
    newBands[9] = Math.max(0, Math.min(0.68, hihatTick * 0.85 + 0.08));

    this.bands = newBands;
    this.bassEnergy = (newBands[0] + newBands[1]) / 2;
    this.vuLevel = this.vuLevel * 0.8 + this.bassEnergy * 0.2;
  }
}

export const audioVisualizer = new AudioVisualizerEngine();
