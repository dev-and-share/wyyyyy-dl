import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import SettingsDrawer from './SettingsDrawer.svelte';
import TopBar from './TopBar.svelte';

vi.mock('../lib/api', () => ({
  api: {
    loginStatus: vi.fn().mockResolvedValue({ code: '000000', data: true }),
    setCookie: vi.fn().mockResolvedValue({ code: '000000', data: 'ok' }),
    historyScan: vi.fn().mockResolvedValue({ code: '000000', data: {} }),
    historyScanExternal: vi.fn().mockResolvedValue({ code: '000000', data: {} }),
    historyImportUntracked: vi.fn().mockResolvedValue({ code: '000000', data: 5 }),
    historyCleanMissing: vi.fn().mockResolvedValue({ code: '000000', data: 3 })
  }
}));

vi.mock('../lib/browserCacheHelper', () => ({
  scanBrowserCache: vi.fn().mockResolvedValue({ list: [], totalBytes: 0 }),
  clearLowPlayCountCacheEntries: vi.fn().mockResolvedValue(0),
  clearAllBrowserAudioCache: vi.fn().mockResolvedValue(undefined)
}));

describe('TopBar & SettingsDrawer Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TopBar renders settings button and triggers onOpenSettings', async () => {
    const onOpenSettings = vi.fn();
    const onToggleTheme = vi.fn();
    const onSwitchTab = vi.fn();

    render(TopBar, {
      tab: 'playlist',
      themeMode: 'dark',
      onSwitchTab,
      onToggleTheme,
      onOpenSettings
    });

    const btnSettings = screen.getByTestId('btn-open-settings');
    expect(btnSettings).toBeTruthy();
    await fireEvent.click(btnSettings);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('SettingsDrawer renders sections and toggles repeat', async () => {
    const onToggleRepeat = vi.fn();
    const onSelectTheme = vi.fn();
    const onOpenPeq = vi.fn();
    const onClose = vi.fn();

    render(SettingsDrawer, {
      repeat: false,
      themeMode: 'dark',
      onToggleRepeat,
      onSelectTheme,
      onOpenPeq,
      onClose
    });

    expect(screen.getByText('系统偏好设置')).toBeTruthy();
    expect(screen.getByText('允许重复下载')).toBeTruthy();

    const switchBtn = screen.getByTestId('switch-repeat');
    await fireEvent.click(switchBtn);
    expect(onToggleRepeat).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByTestId('btn-close-settings');
    await fireEvent.click(closeBtn);
    await new Promise((r) => setTimeout(r, 250));
    expect(onClose).toHaveBeenCalled();
  });

  it('SettingsDrawer allows selecting theme mode', async () => {
    const onToggleRepeat = vi.fn();
    const onSelectTheme = vi.fn();
    const onOpenPeq = vi.fn();
    const onClose = vi.fn();

    render(SettingsDrawer, {
      repeat: false,
      themeMode: 'dark',
      onToggleRepeat,
      onSelectTheme,
      onOpenPeq,
      onClose
    });

    const lightBtn = screen.getByText('浅色');
    await fireEvent.click(lightBtn);
    expect(onSelectTheme).toHaveBeenCalledWith('light');

    const autoBtn = screen.getByText('自动');
    await fireEvent.click(autoBtn);
    expect(onSelectTheme).toHaveBeenCalledWith('auto');
  });
});
