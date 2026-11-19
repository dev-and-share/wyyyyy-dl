import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geoProxyState, fetchGeoProxyConfig, updateGeoProxyState, refreshGeoProxy } from './geoProxyStore.svelte';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    getGeoProxyConfig: vi.fn(),
    testGeoProxy: vi.fn(),
    refreshGeoProxyPool: vi.fn()
  }
}));

describe('geoProxyStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateGeoProxyState({
      enabled: false,
      mode: 'pool',
      customProxyUrl: '',
      subscriptionUrl: '',
      scope: 'resolve_only',
      poolSize: 0,
      lastRefreshedAt: 0,
      activeProxy: '',
      activeLocation: '',
      activeLatencyMs: null,
      fallbackDirect: false,
      loaded: false,
      isRefreshing: false
    });
  });

  it('updates state via updateGeoProxyState', () => {
    updateGeoProxyState({
      enabled: true,
      activeProxy: '1.2.3.4:8080',
      activeLocation: '中国 广东',
      activeLatencyMs: 120,
      mode: 'custom'
    });

    expect(geoProxyState.enabled).toBe(true);
    expect(geoProxyState.activeProxy).toBe('1.2.3.4:8080');
    expect(geoProxyState.activeLocation).toBe('中国 广东');
    expect(geoProxyState.activeLatencyMs).toBe(120);
    expect(geoProxyState.mode).toBe('custom');
    expect(geoProxyState.loaded).toBe(true);
  });

  it('fetches config from api and updates state', async () => {
    (api.getGeoProxyConfig as any).mockResolvedValue({
      code: '000000',
      data: {
        enabled: true,
        mode: 'pool',
        activeProxy: '120.232.115.57:3128',
        activeLocation: '中国 广东 佛山',
        activeLatencyMs: 274,
        fallbackDirect: false
      }
    });

    await fetchGeoProxyConfig();

    expect(geoProxyState.enabled).toBe(true);
    expect(geoProxyState.activeProxy).toBe('120.232.115.57:3128');
    expect(geoProxyState.activeLocation).toBe('中国 广东 佛山');
    expect(geoProxyState.activeLatencyMs).toBe(274);
    expect(geoProxyState.fallbackDirect).toBe(false);
    expect(geoProxyState.loaded).toBe(true);
  });

  it('refreshGeoProxy selects fastest node and shows toast on success', async () => {
    (api.testGeoProxy as any).mockResolvedValue({
      code: '000000',
      data: {
        success: true,
        proxy: '118.123.45.67:8080',
        location: '中国 浙江 杭州',
        latencyMs: 95,
        isFastestWinner: true
      }
    });
    (api.getGeoProxyConfig as any).mockResolvedValue({
      code: '000000',
      data: {}
    });

    const mockToast = vi.fn();
    const result = await refreshGeoProxy(mockToast);

    expect(result.success).toBe(true);
    expect(geoProxyState.activeProxy).toBe('118.123.45.67:8080');
    expect(geoProxyState.activeLocation).toBe('中国 浙江 杭州');
    expect(geoProxyState.activeLatencyMs).toBe(95);
    expect(geoProxyState.fallbackDirect).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('95'), 'success');
  });

  it('refreshGeoProxy triggers fallbackDirect and pool refresh when test fails', async () => {
    (api.testGeoProxy as any).mockResolvedValue({
      code: '000000',
      data: {
        success: false,
        error: '所有代理超时'
      }
    });
    (api.refreshGeoProxyPool as any).mockResolvedValue({
      code: '000000'
    });
    (api.getGeoProxyConfig as any).mockResolvedValue({
      code: '000000',
      data: {}
    });

    const mockToast = vi.fn();
    const result = await refreshGeoProxy(mockToast);

    expect(result.success).toBe(false);
    expect(geoProxyState.fallbackDirect).toBe(true);
    expect(api.refreshGeoProxyPool).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('所有代理超时'), 'warning');
  });
});
