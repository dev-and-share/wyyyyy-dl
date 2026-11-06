/**
 * ⏱️ 睡眠定时器 (定时关机) 全局状态机
 *
 * 核心调度与绝对时间戳校准由底层跨端音频引擎 pwa-audio-player (SleepTimerController) 提供，
 * 本模块负责与 Svelte 5 响应式系统 (Runes) 及 wyyyy 全局事件总线无缝绑定。
 */

import { SleepTimerController } from 'pwa-audio-player';

export type SleepTimerOption = 0 | 15 | 30 | 45 | 60 | 90 | 'endOfTrack';

export class SleepTimerStore {
  private controller: SleepTimerController;

  option = $state<SleepTimerOption>(0);
  targetTimestamp = $state<number | null>(null);
  remainingSeconds = $state<number>(0);

  isActive = $derived(this.option !== 0);

  formattedRemaining = $derived.by(() => {
    if (this.option === 'endOfTrack') return '';
    if (this.remainingSeconds <= 0) return '0:00';
    const m = Math.floor(this.remainingSeconds / 60);
    const s = this.remainingSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  });

  constructor() {
    this.controller = new SleepTimerController();
    this.controller.subscribe((state) => {
      this.option = state.option as SleepTimerOption;
      this.targetTimestamp = state.targetTimestamp;
      this.remainingSeconds = state.remainingSeconds;
    });
  }

  /**
   * 设定睡眠定时器
   */
  setTimer(opt: SleepTimerOption, onTrigger?: () => void) {
    this.controller.setTimer(opt, () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wyy:sleep-timer-trigger'));
      }
      if (onTrigger) {
        try {
          onTrigger();
        } catch (e) {
          console.warn('[SleepTimer] 回调执行异常:', e);
        }
      }
    });
  }

  /**
   * 取消睡眠定时器
   */
  cancelTimer() {
    this.controller.cancelTimer();
  }

  /**
   * 检查是否处于「播完当前曲目后停止」模式
   */
  isEndOfTrack(): boolean {
    return this.controller.isEndOfTrack();
  }

  /**
   * 周期检查或音频帧更新时的被动校准（用于应对锁屏 setInterval 节流）
   */
  checkTick(onTrigger?: () => void): boolean {
    const cb = onTrigger
      ? () => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('wyy:sleep-timer-trigger'));
          }
          try {
            onTrigger();
          } catch (e) {
            console.warn('[SleepTimer] 回调执行异常:', e);
          }
        }
      : undefined;

    return this.controller.checkTick(cb);
  }
}

export const sleepTimer = new SleepTimerStore();
