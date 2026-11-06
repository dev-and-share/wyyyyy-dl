import { api } from './api';

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
  loaded: false
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
  geoProxyState.loaded = true;
}
