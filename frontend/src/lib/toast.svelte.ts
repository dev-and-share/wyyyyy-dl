export interface ToastItem {
  id: number;
  msg: string;
  type: string;
}

export const toastState = $state<{ toasts: ToastItem[] }>({ toasts: [] });

let toastSeed = 0;

/**
 * 全局弹出浮动 Toast 消息通知
 */
export function showToast(msg: string, type: 'info' | 'success' | 'warning' | 'error' | string = 'info', dur = 3000): void {
  const id = ++toastSeed;
  toastState.toasts = [...toastState.toasts, { id, msg, type }];
  setTimeout(() => {
    toastState.toasts = toastState.toasts.filter((t) => t.id !== id);
  }, dur);
}
