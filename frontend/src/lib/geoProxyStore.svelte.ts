import { api } from './api';
import { t } from './i18n';
import { showToast as defaultShowToast } from './toast.svelte';

export interface GeoProxyState {
  enabled: boolean;
  mode: 'pool' | 'custom';
  customProxyUrl: string;
  subscriptionUrl: string;
  scope: string;
  poolSize: number;
  lastRefreshedAt: number;
  activeProxy: string;
  activeLocation: string;
  activeLatencyMs: number | null;
  fallbackDirect: boolean;
  loaded: boolean;
  isRefreshing: boolean;
}

export const geoProxyState = $state<GeoProxyState>({
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

let isFetching = false;

export async function fetchGeoProxyConfig(): Promise<void> {
  if (isFetching) return;
  isFetching = true;
  try {
    const res = await api.getGeoProxyConfig();
    if (res?.code === '000000' && res.data) {
      updateGeoProxyState(res.data);
    }
  } catch (e) {
    console.warn('[geoProxyStore] Failed to fetch proxy config:', e);
  } finally {
    isFetching = false;
    geoProxyState.loaded = true;
  }
}

export function updateGeoProxyState(data: Partial<GeoProxyState>): void {
  if (data.enabled !== undefined) geoProxyState.enabled = Boolean(data.enabled);
  if (data.mode !== undefined) geoProxyState.mode = data.mode === 'custom' ? 'custom' : 'pool';
  if (data.customProxyUrl !== undefined) geoProxyState.customProxyUrl = data.customProxyUrl || '';
  if (data.subscriptionUrl !== undefined) geoProxyState.subscriptionUrl = data.subscriptionUrl || '';
  if (data.scope !== undefined) geoProxyState.scope = data.scope || 'resolve_only';
  if (data.poolSize !== undefined) geoProxyState.poolSize = Number(data.poolSize) || 0;
  if (data.lastRefreshedAt !== undefined) geoProxyState.lastRefreshedAt = Number(data.lastRefreshedAt) || 0;
  if (data.activeProxy !== undefined) geoProxyState.activeProxy = data.activeProxy || '';
  if (data.activeLocation !== undefined) geoProxyState.activeLocation = data.activeLocation || '';
  if (data.activeLatencyMs !== undefined) geoProxyState.activeLatencyMs = data.activeLatencyMs ?? null;
  if (data.fallbackDirect !== undefined) geoProxyState.fallbackDirect = Boolean(data.fallbackDirect);
  if (data.isRefreshing !== undefined) geoProxyState.isRefreshing = Boolean(data.isRefreshing);
  geoProxyState.loaded = true;
}

/**
 * ⚡ 一键测速并刷新切换最优国内网络代理
 */
export async function refreshGeoProxy(
  customShowToast?: (msg: string, type?: string, dur?: number) => void
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (geoProxyState.isRefreshing) {
    return { success: false, error: 'already_refreshing' };
  }

  const toast = customShowToast || defaultShowToast;
  geoProxyState.isRefreshing = true;

  try {
    toast(t('settings.geoProxy.refreshingPool'), 'info', 2000);

    const targetUrl = geoProxyState.mode === 'custom' ? geoProxyState.customProxyUrl.trim() : '';
    const res = await api.testGeoProxy(targetUrl);

    if (res?.code === '000000' && res.data) {
      const testResult = res.data;
      if (testResult.success) {
        const activeProxy = testResult.ip || testResult.proxy || '';
        const activeLocation = testResult.location || '';
        const activeLatencyMs = testResult.latencyMs ?? null;

        updateGeoProxyState({
          activeProxy,
          activeLocation,
          activeLatencyMs,
          fallbackDirect: false
        });

        const winnerMsg = testResult.isFastestWinner
          ? t('settings.geoProxy.winnerMsgFastest', { latency: testResult.latencyMs })
          : t('settings.geoProxy.winnerMsgConnected', { latency: testResult.latencyMs });

        toast(t('settings.geoProxy.winnerToast', { winnerMsg, location: testResult.location || '' }), 'success');
        return { success: true, data: testResult };
      } else {
        updateGeoProxyState({
          fallbackDirect: true
        });

        if (geoProxyState.mode === 'pool') {
          try {
            await api.refreshGeoProxyPool();
          } catch (_) {}
        }

        toast(t('settings.geoProxy.testFailToast', { error: testResult.error || '无响应' }), 'warning');
        return { success: false, error: testResult.error };
      }
    } else {
      const errMsg = res?.msg || t('settings.geoProxy.testFailedToast');
      toast(errMsg, 'error');
      return { success: false, error: errMsg };
    }
  } catch (e: any) {
    const errMsg = t('settings.geoProxy.saveExceptionToast', { error: e.message || e });
    toast(errMsg, 'error');
    return { success: false, error: e.message || String(e) };
  } finally {
    geoProxyState.isRefreshing = false;
    try {
      await fetchGeoProxyConfig();
    } catch (_) {}
  }
}
