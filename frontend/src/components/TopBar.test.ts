import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import TopBar from './TopBar.svelte';

describe('TopBar Component', () => {
  it('renders mobile top bar when isDesktopLayout is false', () => {
    const { container, getByTestId } = render(TopBar, {
      tab: 'playlist',
      themeMode: 'dark',
      isDesktopLayout: false,
      onSwitchTab: vi.fn(),
      onToggleTheme: vi.fn(),
      onOpenSettings: vi.fn()
    });

    const topBarEl = container.querySelector('.mobile-top-bar') as HTMLElement;
    expect(topBarEl).toBeTruthy();
    const styleAttr = topBarEl.getAttribute('style') || '';
    // 确保没有 margin-top 导致的空白下沉
    expect(styleAttr).not.toContain('margin-top');
    // 确保使用 padding-top 进行沉浸式安全区避让
    expect(styleAttr).toContain('safe-area-inset-top');
    expect(getByTestId('btn-toggle-theme')).toBeTruthy();
    expect(getByTestId('btn-open-settings')).toBeTruthy();
  });

  it('does not render mobile top bar when isDesktopLayout is true', () => {
    const { container } = render(TopBar, {
      tab: 'playlist',
      themeMode: 'dark',
      isDesktopLayout: true,
      onSwitchTab: vi.fn(),
      onToggleTheme: vi.fn()
    });

    const topBarEl = container.querySelector('.mobile-top-bar');
    expect(topBarEl).toBeNull();
  });

  it('triggers onToggleTheme when theme button is clicked', async () => {
    const onToggleTheme = vi.fn();
    const { getByTestId } = render(TopBar, {
      tab: 'playlist',
      themeMode: 'dark',
      isDesktopLayout: false,
      onSwitchTab: vi.fn(),
      onToggleTheme
    });

    const themeBtn = getByTestId('btn-toggle-theme');
    await fireEvent.click(themeBtn);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('triggers onOpenSettings when settings button is clicked', async () => {
    const onOpenSettings = vi.fn();
    const { getByTestId } = render(TopBar, {
      tab: 'playlist',
      themeMode: 'dark',
      isDesktopLayout: false,
      onSwitchTab: vi.fn(),
      onToggleTheme: vi.fn(),
      onOpenSettings
    });

    const settingsBtn = getByTestId('btn-open-settings');
    await fireEvent.click(settingsBtn);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('triggers onSwitchTab when tab buttons are clicked', async () => {
    const onSwitchTab = vi.fn();
    const { getByTestId } = render(TopBar, {
      tab: 'playlist',
      themeMode: 'dark',
      isDesktopLayout: false,
      onSwitchTab,
      onToggleTheme: vi.fn()
    });

    const searchTab = getByTestId('tab-search');
    await fireEvent.click(searchTab);
    expect(onSwitchTab).toHaveBeenCalledWith('search');

    const localTab = getByTestId('tab-download-mgr');
    await fireEvent.click(localTab);
    expect(onSwitchTab).toHaveBeenCalledWith('download-mgr');
  });
});
