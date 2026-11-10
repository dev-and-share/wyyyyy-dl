import { api } from './api';

export interface UserProfile {
  authEnabled: boolean;
  email: string | null;
  role: 'admin' | 'user';
  isAdmin: boolean;
}

class AuthStore {
  authEnabled = $state<boolean>(false);
  email = $state<string | null>(null);
  role = $state<'admin' | 'user'>('admin');
  isAdmin = $state<boolean>(true);
  loaded = $state<boolean>(false);

  async fetchProfile() {
    try {
      const res = await api.userProfile();
      if (res?.code === '000000' && res?.data) {
        this.authEnabled = !!res.data.authEnabled;
        this.email = res.data.email || null;
        this.role = res.data.role === 'user' ? 'user' : 'admin';
        this.isAdmin = res.data.isAdmin ?? (!this.authEnabled || this.role === 'admin');
      }
    } catch (e) {
      console.warn('获取当前用户信息失败，默认按全权管理员模式:', e);
    } finally {
      this.loaded = true;
    }
  }
}

export const authStore = new AuthStore();
