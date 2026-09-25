import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyTheme, getInitialTheme, _resetThemeListenerForTest } from './theme';

describe('theme system & OS listener contracts', () => {
  let listeners: ((e: any) => void)[] = [];
  let isDarkMatch = false;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    _resetThemeListenerForTest();
    listeners = [];
    isDarkMatch = false;

    // 模拟 matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      return {
        matches: isDarkMatch,
        media: query,
        onchange: null,
        addEventListener: vi.fn((event: string, handler: (e: any) => void) => {
          if (event === 'change') listeners.push(handler);
        }),
        removeEventListener: vi.fn(),
        addListener: vi.fn((handler: (e: any) => void) => {
          listeners.push(handler);
        }),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });
  });

  it('applies dark theme explicitly', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    expect(localStorage.getItem('theme_mode')).toBe('dark');
    expect(getInitialTheme()).toBe('dark');
  });

  it('applies light theme explicitly', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('theme_mode')).toBe('light');
    expect(getInitialTheme()).toBe('light');
  });

  it('applies auto theme and follows system match', () => {
    isDarkMatch = true;
    applyTheme('auto');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    expect(localStorage.getItem('theme_mode')).toBe('auto');

    isDarkMatch = false;
    applyTheme('auto');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('reacts dynamically to OS system change events when in auto mode', () => {
    isDarkMatch = true;
    applyTheme('auto');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();

    // 操作系统日出切换为浅色
    isDarkMatch = false;
    for (const listener of listeners) {
      listener({ matches: false });
    }
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // 操作系统日落切换为深色
    isDarkMatch = true;
    for (const listener of listeners) {
      listener({ matches: true });
    }
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('does not alter explicit theme when OS fires change event', () => {
    // 用户手动指定了 light
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // 系统深色变化触发
    isDarkMatch = true;
    for (const listener of listeners) {
      listener({ matches: true });
    }
    // 依然维持用户选择的 light
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
