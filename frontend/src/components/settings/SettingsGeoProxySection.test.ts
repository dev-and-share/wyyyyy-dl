import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsGeoProxySection from './SettingsGeoProxySection.svelte';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    getGeoProxyConfig: vi.fn(),
    updateGeoProxyConfig: vi.fn(),
    testGeoProxy: vi.fn(),
    refreshGeoProxyPool: vi.fn()
  }
}));

describe('SettingsGeoProxySection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getGeoProxyConfig as any).mockResolvedValue({
      code: '000000',
      data: {
        enabled: false,
        mode: 'pool',
        customProxyUrl: '',
        subscriptionUrl: 'https://api.proxyscrape.com/...',
        scope: 'resolve_only',
        poolSize: 12
      }
    });
    (api.updateGeoProxyConfig as any).mockResolvedValue({
      code: '000000',
      data: {
        enabled: true,
        mode: 'pool',
        poolSize: 12
      }
    });
  });

  it('renders correctly with default off switch', async () => {
    render(SettingsGeoProxySection, { showToast: vi.fn() });
    const switchBtn = await screen.findByTestId('switch-geoproxy');
    expect(switchBtn).toBeInTheDocument();
    expect(switchBtn.getAttribute('aria-checked')).toBe('false');
  });

  it('toggles proxy on click and calls api', async () => {
    const showToast = vi.fn();
    render(SettingsGeoProxySection, { showToast });
    const switchBtn = await screen.findByTestId('switch-geoproxy');
    await fireEvent.click(switchBtn);

    expect(api.updateGeoProxyConfig).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true })
    );
  });
});
