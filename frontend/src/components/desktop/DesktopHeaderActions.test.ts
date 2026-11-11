import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DesktopHeaderActions from './DesktopHeaderActions.svelte';
import * as uiStore from '../../lib/ui.svelte';

describe('DesktopHeaderActions', () => {
  it('renders theme and settings buttons and triggers interactions', async () => {
    const toggleSpy = vi.spyOn(uiStore, 'toggleTheme');
    const openSettingsSpy = vi.spyOn(uiStore, 'openSettings');

    const { getByTestId } = render(DesktopHeaderActions);

    const btnTheme = getByTestId('btn-toggle-theme');
    const btnSettings = getByTestId('btn-open-settings');

    expect(btnTheme).toBeTruthy();
    expect(btnSettings).toBeTruthy();

    await fireEvent.click(btnTheme);
    expect(toggleSpy).toHaveBeenCalledTimes(1);

    await fireEvent.click(btnSettings);
    expect(openSettingsSpy).toHaveBeenCalledTimes(1);
  });

  it('displays red update badge on desktop settings button when hasPwaUpdate is true', () => {
    uiStore.globalUiState.hasPwaUpdate = true;
    const { getByTestId } = render(DesktopHeaderActions);
    expect(getByTestId('badge-desktop-update')).toBeTruthy();
    uiStore.globalUiState.hasPwaUpdate = false;
  });
});
