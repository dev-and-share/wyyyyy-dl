import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PlayerDiagnosticsHud from './PlayerDiagnosticsHud.svelte';
import { playbackTelemetry } from '../lib/player/playbackTelemetry.svelte';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    submitPlaybackDebugReport: vi.fn(),
    listPlaybackDebugReports: vi.fn(),
    clearPlaybackDebugReports: vi.fn()
  }
}));

describe('PlayerDiagnosticsHud Component', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await playbackTelemetry.clearLocalLogs();
    playbackTelemetry.setHudVisible(true);
    playbackTelemetry.recordEvent('audio_play', 'info', 'unit_test_event');
    (api.submitPlaybackDebugReport as any).mockResolvedValue({ code: '000000', data: { id: 10 } });
  });

  it('renders HUD cards, event timeline, and closes on close button click', async () => {
    render(PlayerDiagnosticsHud, { showToast: vi.fn() });

    expect(screen.getByTestId('player-diagnostics-hud')).toBeInTheDocument();
    expect(screen.getByText('audio_play')).toBeInTheDocument();

    await fireEvent.click(screen.getByTestId('btn-diag-hud-close'));
    expect(playbackTelemetry.hudVisible).toBe(false);
  });

  it('copies sanitized snapshot JSON to clipboard and submits manual report with note', async () => {
    const showToast = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });

    render(PlayerDiagnosticsHud, { showToast });

    await fireEvent.click(screen.getByTestId('btn-diag-hud-copy'));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('audioSnapshot');

    const noteInput = screen.getByRole('textbox');
    await fireEvent.input(noteInput, { target: { value: 'iphone lockscreen silence' } });
    await fireEvent.click(screen.getByTestId('btn-diag-hud-send'));

    expect(api.submitPlaybackDebugReport).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerType: 'manual',
        note: 'iphone lockscreen silence'
      })
    );
  });

  it('clears local events log on clear button click', async () => {
    render(PlayerDiagnosticsHud, { showToast: vi.fn() });
    expect(screen.getByText('audio_play')).toBeInTheDocument();

    await fireEvent.click(screen.getByTestId('btn-diag-hud-clear'));
    await vi.waitFor(() => {
      expect(playbackTelemetry.events.length).toBe(0);
    });
  });
});
