import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsDiagnosticsSection from './SettingsDiagnosticsSection.svelte';
import { playbackTelemetry } from '../../lib/player/playbackTelemetry.svelte';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    submitPlaybackDebugReport: vi.fn(),
    listPlaybackDebugReports: vi.fn(),
    clearPlaybackDebugReports: vi.fn()
  }
}));

describe('SettingsDiagnosticsSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playbackTelemetry.setHudVisible(false);
    playbackTelemetry.setAutoUpload(false);
    (api.submitPlaybackDebugReport as any).mockResolvedValue({ code: '000000', data: { id: 1 } });
    (api.listPlaybackDebugReports as any).mockResolvedValue({
      code: '000000',
      data: {
        total: 1,
        items: [
          {
            id: 7,
            createdAt: Date.now(),
            triggerType: 'watchdog_timeout',
            trackSummary: JSON.stringify({ name: 'Sample Track', artist: 'Artist' }),
            audioSnapshot: JSON.stringify({ readyState: 1 }),
            statsJson: JSON.stringify({ watchdogTimeouts: 1 }),
            precacheSnapshot: JSON.stringify({ silentHoldActive: false }),
            deviceInfo: JSON.stringify({ isIOS: true }),
            eventsJson: '[]',
            note: ''
          }
        ]
      }
    });
    (api.clearPlaybackDebugReports as any).mockResolvedValue({ code: '000000', data: { deleted: 1 } });
  });

  it('toggles HUD and auto-upload switches', async () => {
    render(SettingsDiagnosticsSection, { showToast: vi.fn() });

    const hudSwitch = screen.getByTestId('toggle-diag-hud');
    const autoSwitch = screen.getByTestId('toggle-diag-autoupload');
    expect(hudSwitch.getAttribute('aria-checked')).toBe('false');
    expect(autoSwitch.getAttribute('aria-checked')).toBe('false');

    await fireEvent.click(hudSwitch);
    await fireEvent.click(autoSwitch);

    expect(playbackTelemetry.hudVisible).toBe(true);
    expect(playbackTelemetry.autoUploadEnabled).toBe(true);
  });

  it('uploads manual snapshot and fetches / clears server reports', async () => {
    const showToast = vi.fn();
    render(SettingsDiagnosticsSection, { showToast });

    await fireEvent.click(screen.getByTestId('btn-diag-upload-now'));
    expect(api.submitPlaybackDebugReport).toHaveBeenCalledTimes(1);

    await fireEvent.click(screen.getByTestId('btn-diag-toggle-server-reports'));
    expect(api.listPlaybackDebugReports).toHaveBeenCalledWith(30);
    expect(await screen.findByText(/#7 watchdog_timeout/)).toBeInTheDocument();

    await fireEvent.click(screen.getByTestId('btn-diag-clear-server-reports'));
    expect(api.clearPlaybackDebugReports).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalled();
  });
});
