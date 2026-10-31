/**
 * ⏱️ 睡眠定时器 (定时关机) 全局状态机
 *
 * 核心特性：
 * 1. 支持指定时长 (15/30/45/60/90分钟) 或「播完当前歌曲后停止」
 * 2. 熄屏后台防御：基于绝对时间戳 targetTimestamp，即使在 iOS 锁屏或后台定时器节流下，
 *    通过 ontimeupdate 周期校准与 setInterval 双重守护，确保准时停止。
 * 3. 关机触发时执行完全真暂停，释放硬件资源并重置 Mode F3，杜绝整夜静音空转放电。
 */

export type SleepTimerOption = 0 | 15 | 30 | 45 | 60 | 90 | 'endOfTrack';

export class SleepTimerStore {
  option = $state<SleepTimerOption>(0);
  targetTimestamp = $state<number | null>(null);
  remainingSeconds = $state<number>(0);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private triggerCallback: (() => void) | null = null;

  isActive = $derived(this.option !== 0);

  formattedRemaining = $derived.by(() => {
    if (this.option === 'endOfTrack') return '';
    if (this.remainingSeconds <= 0) return '0:00';
    const m = Math.floor(this.remainingSeconds / 60);
    const s = this.remainingSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  });

  /**
   * 设定睡眠定时器
   */
  setTimer(opt: SleepTimerOption, onTrigger?: () => void) {
    this.cancelTimer();
    this.option = opt;
    this.triggerCallback = onTrigger || null;

    if (opt === 0) return;

    if (typeof opt === 'number' && opt > 0) {
      this.targetTimestamp = Date.now() + opt * 60 * 1000;
      this.remainingSeconds = opt * 60;

      this.intervalId = setInterval(() => {
        this.updateRemaining();
      }, 1000);
    } else if (opt === 'endOfTrack') {
      this.targetTimestamp = null;
      this.remainingSeconds = 0;
    }
  }

  /**
   * 取消睡眠定时器
   */
  cancelTimer() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.option = 0;
    this.targetTimestamp = null;
    this.remainingSeconds = 0;
    this.triggerCallback = null;
  }

  /**
   * 检查是否处于「播完当前曲目后停止」模式
   */
  isEndOfTrack(): boolean {
    return this.option === 'endOfTrack';
  }

  /**
   * 周期检查或音频帧更新时的被动校准（用于应对锁屏 setInterval 节流）
   */
  checkTick(onTrigger?: () => void): boolean {
    if (!this.targetTimestamp || typeof this.option !== 'number' || this.option <= 0) {
      return false;
    }

    const now = Date.now();
    if (now >= this.targetTimestamp) {
      this.executeTrigger(onTrigger || this.triggerCallback);
      return true;
    }

    this.remainingSeconds = Math.max(0, Math.ceil((this.targetTimestamp - now) / 1000));
    return false;
  }

  private updateRemaining() {
    if (!this.targetTimestamp) return;
    const now = Date.now();
    if (now >= this.targetTimestamp) {
      this.executeTrigger(this.triggerCallback);
    } else {
      this.remainingSeconds = Math.max(0, Math.ceil((this.targetTimestamp - now) / 1000));
    }
  }

  private executeTrigger(cb?: (() => void) | null) {
    this.cancelTimer();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wyyyy:sleep-timer-trigger'));
    }
    if (cb) {
      try {
        cb();
      } catch (e) {
        console.warn('[SleepTimer] 回调执行异常:', e);
      }
    }
  }
}

export const sleepTimer = new SleepTimerStore();
