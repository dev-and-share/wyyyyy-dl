import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import DesktopSidebar from './DesktopSidebar.svelte';

describe('DesktopSidebar bottom actions (theme & settings)', () => {
  it('triggers onToggleTheme and onOpenSettings from expanded sidebar bottom bar', async () => {
    const onToggleTheme = vi.fn();
    const onOpenSettings = vi.fn();

    const { getByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: false,
        onSwitchTab: vi.fn(),
        onToggleCollapse: vi.fn(),
        onToggleTheme,
        onOpenSettings,
        themeMode: 'light'
      }
    });

    const themeBtn = getByTestId('sidebar-btn-toggle-theme');
    expect(themeBtn.querySelector('svg')).not.toBeNull();
    await fireEvent.click(themeBtn);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);

    const settingsBtn = getByTestId('sidebar-btn-open-settings');
    expect(settingsBtn.querySelector('svg')).not.toBeNull();
    await fireEvent.click(settingsBtn);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('triggers onToggleTheme and onOpenSettings from collapsed sidebar bottom bar', async () => {
    const onToggleTheme = vi.fn();
    const onOpenSettings = vi.fn();

    const { getByTestId } = render(DesktopSidebar, {
      props: {
        tab: 'playlist',
        collapsed: true,
        onSwitchTab: vi.fn(),
        onToggleCollapse: vi.fn(),
        onToggleTheme,
        onOpenSettings,
        themeMode: 'dark'
      }
    });

    const themeBtn = getByTestId('sidebar-btn-toggle-theme-collapsed');
    expect(themeBtn.querySelector('svg')).not.toBeNull();
    await fireEvent.click(themeBtn);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);

    const settingsBtn = getByTestId('sidebar-btn-open-settings-collapsed');
    expect(settingsBtn.querySelector('svg')).not.toBeNull();
    await fireEvent.click(settingsBtn);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
