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

/**
 * 全局弹出浮动 Toast 消息通知（带相同内容防抖和最大堆叠数量限制，支持可选动作按钮）
 */
export function showToast(
  msg: string,
  type: 'info' | 'success' | 'warning' | 'error' | string = 'info',
  dur = 3000,
  action?: ToastAction
): void {
  if (!msg) return;
  // 🛡️ 防刷屏：若已有相同内容的 Toast 正在展示，不重复堆叠
  if (toastState.toasts.some((t) => t.msg === msg)) return;

  const id = ++toastSeed;
  // 限制屏幕上最多同时展示 3 条 Toast，超出自动移除最早的
  const current = toastState.toasts.length >= 3 ? toastState.toasts.slice(toastState.toasts.length - 2) : toastState.toasts;
  toastState.toasts = [...current, { id, msg, type, action }];

  setTimeout(() => {
    toastState.toasts = toastState.toasts.filter((t) => t.id !== id);
  }, dur);
}
