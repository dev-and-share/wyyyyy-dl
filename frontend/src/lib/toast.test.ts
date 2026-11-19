import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showToast, dismissToast, pauseToast, resumeToast, clearAllToasts, toastState } from './toast.svelte';

describe('Toast Controller & Lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllToasts();
  });

  afterEach(() => {
    clearAllToasts();
    vi.useRealTimers();
  });

  it('automatically dismisses toast after default duration', () => {
    showToast('Auto dismiss test', 'info', 3000);
    expect(toastState.toasts).toHaveLength(1);

    vi.advanceTimersByTime(2999);
    expect(toastState.toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(toastState.toasts).toHaveLength(0);
  });

  it('pauses countdown when pauseToast is called (mouse hover)', () => {
    const id = showToast('Hover test', 'warning', 4000);
    expect(id).toBeDefined();
    expect(toastState.toasts).toHaveLength(1);

    // 经过 2 秒，鼠标移入悬停
    vi.advanceTimersByTime(2000);
    pauseToast(id!);

    // 再快进 10 秒，Toast 依然存在（悬停不消失）
    vi.advanceTimersByTime(10000);
    expect(toastState.toasts).toHaveLength(1);
    expect(toastState.toasts[0].id).toBe(id);
  });

  it('resumes countdown with safety buffer when resumeToast is called (mouse leave)', () => {
    const id = showToast('Resume test', 'warning', 4000);
    expect(id).toBeDefined();

    // 经过 3.5 秒后悬停（剩余 0.5s）
    vi.advanceTimersByTime(3500);
    pauseToast(id!);

    // 悬停 5 秒
    vi.advanceTimersByTime(5000);
    expect(toastState.toasts).toHaveLength(1);

    // 鼠标移出，默认保底缓冲 2000ms
    resumeToast(id!, 2000);

    // 移出后 1.9 秒，Toast 仍在
    vi.advanceTimersByTime(1999);
    expect(toastState.toasts).toHaveLength(1);

    // 达到 2 秒，平滑关闭
    vi.advanceTimersByTime(1);
    expect(toastState.toasts).toHaveLength(0);
  });

  it('dismisses toast immediately via dismissToast', () => {
    const id = showToast('Manual dismiss test', 'error', 5000);
    expect(toastState.toasts).toHaveLength(1);

    dismissToast(id!);
    expect(toastState.toasts).toHaveLength(0);

    // 确保后续 timer 触发不会报错
    vi.advanceTimersByTime(6000);
    expect(toastState.toasts).toHaveLength(0);
  });

  it('supports action callback payload', () => {
    const actionSpy = vi.fn();
    const id = showToast('With action', 'warning', 7000, {
      label: '🧩 聚合搜',
      onClick: actionSpy
    });

    expect(toastState.toasts).toHaveLength(1);
    const toast = toastState.toasts[0];
    expect(toast.action?.label).toBe('🧩 聚合搜');

    toast.action?.onClick();
    expect(actionSpy).toHaveBeenCalledTimes(1);

    dismissToast(id!);
    expect(toastState.toasts).toHaveLength(0);
  });
});
