import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SleepTimerStore } from './sleepTimer.svelte';

describe('SleepTimerStore', () => {
  let timer: SleepTimerStore;

  beforeEach(() => {
    vi.useFakeTimers();
    timer = new SleepTimerStore();
  });

  afterEach(() => {
    timer.cancelTimer();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes in inactive state', () => {
    expect(timer.option).toBe(0);
    expect(timer.isActive).toBe(false);
    expect(timer.targetTimestamp).toBeNull();
    expect(timer.remainingSeconds).toBe(0);
    expect(timer.isEndOfTrack()).toBe(false);
    expect(timer.formattedRemaining).toBe('0:00');
  });

  it('sets minute timer correctly and formats remaining time', () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    timer.setTimer(15);
    expect(timer.option).toBe(15);
    expect(timer.isActive).toBe(true);
    expect(timer.targetTimestamp).toBe(startTime + 15 * 60 * 1000);
    expect(timer.remainingSeconds).toBe(15 * 60);
    expect(timer.formattedRemaining).toBe('15:00');

    // Advance 65 seconds
    vi.advanceTimersByTime(65 * 1000);
    expect(timer.remainingSeconds).toBe(15 * 60 - 65);
    expect(timer.formattedRemaining).toBe('13:55');
  });

  it('fires trigger and dispatches custom event upon timer expiration via setInterval', () => {
    const callback = vi.fn();
    const eventHandler = vi.fn();
    window.addEventListener('wyyyy:sleep-timer-trigger', eventHandler);

    timer.setTimer(15, callback);
    expect(timer.isActive).toBe(true);

    // Fast-forward 15 minutes
    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(eventHandler).toHaveBeenCalledTimes(1);
    expect(timer.isActive).toBe(false);
    expect(timer.option).toBe(0);

    window.removeEventListener('wyyyy:sleep-timer-trigger', eventHandler);
  });

  it('calibrates accurately via checkTick (iOS lockscreen background defense)', () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);
    const callback = vi.fn();

    timer.setTimer(30, callback);

    // Simulate background clock advancing 10 minutes without interval firing
    vi.setSystemTime(startTime + 10 * 60 * 1000);
    const triggeredEarly = timer.checkTick();
    expect(triggeredEarly).toBe(false);
    expect(timer.remainingSeconds).toBe(20 * 60);
    expect(callback).not.toHaveBeenCalled();

    // Advance beyond target timestamp
    vi.setSystemTime(startTime + 30 * 60 * 1000 + 100);
    const triggered = timer.checkTick();
    expect(triggered).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(timer.isActive).toBe(false);
  });

  it('supports endOfTrack mode', () => {
    timer.setTimer('endOfTrack');
    expect(timer.option).toBe('endOfTrack');
    expect(timer.isActive).toBe(true);
    expect(timer.isEndOfTrack()).toBe(true);
    expect(timer.targetTimestamp).toBeNull();
    expect(timer.formattedRemaining).toBe('');

    // checkTick should do nothing in endOfTrack mode
    expect(timer.checkTick()).toBe(false);
  });

  it('cancels active timer cleanly', () => {
    const callback = vi.fn();
    timer.setTimer(45, callback);
    expect(timer.isActive).toBe(true);

    timer.cancelTimer();
    expect(timer.option).toBe(0);
    expect(timer.isActive).toBe(false);
    expect(timer.targetTimestamp).toBeNull();
    expect(timer.remainingSeconds).toBe(0);

    // Advancing timers should not trigger callback
    vi.advanceTimersByTime(50 * 60 * 1000);
    expect(callback).not.toHaveBeenCalled();
  });
});
