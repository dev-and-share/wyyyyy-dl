import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerServiceWorker, checkForPwaUpdate } from './pwa';

describe('PWA Service Worker lifecycle & auto-reload contracts', () => {
  let mockRegister: ReturnType<typeof vi.fn>;
  let mockGetRegistration: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRegister = vi.fn();
    mockGetRegistration = vi.fn();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        getRegistration: mockGetRegistration,
        addEventListener: vi.fn()
      },
      writable: true,
      configurable: true
    });
  });

  it('registerServiceWorker passes updateViaCache: none to prevent browser HTTP caching', () => {
    mockRegister.mockResolvedValueOnce({
      scope: '/',
      waiting: null,
      onupdatefound: null
    });

    registerServiceWorker();

    // 触发 window.load 事件
    window.dispatchEvent(new Event('load'));

    // 关键契约验证：注册必须附带 updateViaCache: 'none'
    expect(mockRegister).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' });
  });

  it('checkForPwaUpdate sends SKIP_WAITING to waiting worker if update is found', async () => {
    const mockPostMessage = vi.fn();
    const mockWorker = { postMessage: mockPostMessage };

    mockGetRegistration.mockResolvedValueOnce({
      waiting: mockWorker,
      update: vi.fn().mockResolvedValue(undefined)
    });

    const hasUpdate = await checkForPwaUpdate();

    expect(hasUpdate).toBe(true);
    // 关键契约验证：必须向 waiting 状态的 Service Worker 派发 SKIP_WAITING 指令
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('checkForPwaUpdate returns false if no waiting worker exists', async () => {
    mockGetRegistration.mockResolvedValueOnce({
      waiting: null,
      update: vi.fn().mockResolvedValue(undefined)
    });

    const hasUpdate = await checkForPwaUpdate();

    expect(hasUpdate).toBe(false);
  });
});
