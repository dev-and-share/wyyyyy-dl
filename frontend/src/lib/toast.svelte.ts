export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  msg: string;
  type: string;
  action?: ToastAction;
}

export const toastState = $state<{ toasts: ToastItem[] }>({ toasts: [] });

let toastSeed = 0;

interface ActiveToastTimer {
  timerId: ReturnType<typeof setTimeout> | null;
  startedAt: number;
  remaining: number;
}

const toastTimers = new Map<number, ActiveToastTimer>();

/**
 * 手动立即关闭/移除指定 Toast
 */
export function dismissToast(id: number): void {
  const timer = toastTimers.get(id);
  if (timer) {
    if (timer.timerId !== null) {
      clearTimeout(timer.timerId);
    }
    toastTimers.delete(id);
  }
  toastState.toasts = toastState.toasts.filter((t) => t.id !== id);
}

/**
 * 鼠标悬浮 (mouse on/hover) 时暂停指定 Toast 的倒计时
 */
export function pauseToast(id: number): void {
  const timer = toastTimers.get(id);
  if (!timer || timer.timerId === null) return;

  clearTimeout(timer.timerId);
  timer.timerId = null;
  const elapsed = Date.now() - timer.startedAt;
  timer.remaining = Math.max(timer.remaining - elapsed, 0);
}

/**
 * 鼠标移出 (mouse leave) 时恢复指定 Toast 的倒计时（自带最小缓冲时间，防止移出瞬间闪退）
 */
export function resumeToast(id: number, minDuration = 2000): void {
  const timer = toastTimers.get(id);
  if (!timer || timer.timerId !== null) return;

  const effectiveRemaining = Math.max(timer.remaining, minDuration);
  timer.startedAt = Date.now();
  timer.remaining = effectiveRemaining;
  timer.timerId = setTimeout(() => {
    dismissToast(id);
  }, effectiveRemaining);
}

/**
 * 清理所有活跃 Toast 及其定时器
 */
export function clearAllToasts(): void {
  for (const timer of toastTimers.values()) {
    if (timer.timerId !== null) clearTimeout(timer.timerId);
  }
  toastTimers.clear();
  toastState.toasts = [];
}

/**
 * 全局弹出浮动 Toast 消息通知（带相同内容防抖、最大堆叠数量限制、支持悬停防消失与可选动作按钮）
 */
export function showToast(
  msg: string,
  type: 'info' | 'success' | 'warning' | 'error' | string = 'info',
  dur = 3000,
  action?: ToastAction
): number | undefined {
  if (!msg) return;
  // 🛡️ 防刷屏：若已有相同内容的 Toast 正在展示，不重复堆叠
  if (toastState.toasts.some((t) => t.msg === msg)) return;

  const id = ++toastSeed;

  // 限制屏幕上最多同时展示 3 条 Toast，超出自动移除最早的并清理定时器
  if (toastState.toasts.length >= 3) {
    const toRemoveCount = toastState.toasts.length - 2;
    const removed = toastState.toasts.slice(0, toRemoveCount);
    for (const r of removed) {
      dismissToast(r.id);
    }
  }

  toastState.toasts = [...toastState.toasts, { id, msg, type, action }];

  const timerRecord: ActiveToastTimer = {
    timerId: null,
    startedAt: Date.now(),
    remaining: dur
  };

  timerRecord.timerId = setTimeout(() => {
    dismissToast(id);
  }, dur);

  toastTimers.set(id, timerRecord);
  return id;
}
