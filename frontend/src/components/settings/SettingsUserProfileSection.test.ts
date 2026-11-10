import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SettingsUserProfileSection from './SettingsUserProfileSection.svelte';
import { authStore } from '../../lib/authStore.svelte';

describe('SettingsUserProfileSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.authEnabled = false;
    authStore.email = null;
    authStore.role = 'admin';
    authStore.isAdmin = true;
  });

  it('renders open mode when auth is disabled', () => {
    const { getByText, getByTestId } = render(SettingsUserProfileSection);
    expect(getByTestId('settings-user-profile-section')).toBeInTheDocument();
    expect(getByText(/完全開放|全员管理员/)).toBeInTheDocument();
  });

  it('renders guest badge and email when auth is enabled and user is guest', () => {
    authStore.authEnabled = true;
    authStore.email = 'fxapache@gmail.com';
    authStore.role = 'user';
    authStore.isAdmin = false;

    const { getByText } = render(SettingsUserProfileSection);
    expect(getByText('fxapache@gmail.com')).toBeInTheDocument();
    expect(getByText(/ゲスト|访客/)).toBeInTheDocument();
  });

  it('renders admin badge and email when auth is enabled and user is admin', () => {
    authStore.authEnabled = true;
    authStore.email = 'javaeecoding@gmail.com';
    authStore.role = 'admin';
    authStore.isAdmin = true;

    const { getByText } = render(SettingsUserProfileSection);
    expect(getByText('javaeecoding@gmail.com')).toBeInTheDocument();
    expect(getByText(/超級管理者|超级管理员/)).toBeInTheDocument();
  });

  it('calls fetchProfile on refresh button click', async () => {
    const fetchSpy = vi.spyOn(authStore, 'fetchProfile').mockResolvedValue();
    const { getByRole } = render(SettingsUserProfileSection);

    const refreshBtn = getByRole('button');
    await fireEvent.click(refreshBtn);

    expect(fetchSpy).toHaveBeenCalled();
  });
});
