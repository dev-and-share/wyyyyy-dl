import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authStore } from './authStore.svelte';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    userProfile: vi.fn(),
  },
}));

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly sets guest profile when auth is enabled', async () => {
    vi.mocked(api.userProfile).mockResolvedValue({
      code: '000000',
      data: {
        authEnabled: true,
        email: 'fxapache@gmail.com',
        role: 'user',
        isAdmin: false,
      },
    } as any);

    await authStore.fetchProfile();

    expect(authStore.authEnabled).toBe(true);
    expect(authStore.email).toBe('fxapache@gmail.com');
    expect(authStore.role).toBe('user');
    expect(authStore.isAdmin).toBe(false);
    expect(authStore.loaded).toBe(true);
  });

  it('correctly sets admin profile when user is admin', async () => {
    vi.mocked(api.userProfile).mockResolvedValue({
      code: '000000',
      data: {
        authEnabled: true,
        email: 'javaeecoding@gmail.com',
        role: 'admin',
        isAdmin: true,
      },
    } as any);

    await authStore.fetchProfile();

    expect(authStore.authEnabled).toBe(true);
    expect(authStore.email).toBe('javaeecoding@gmail.com');
    expect(authStore.role).toBe('admin');
    expect(authStore.isAdmin).toBe(true);
  });
});
