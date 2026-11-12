import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import SettingsCustomBgSection from './SettingsCustomBgSection.svelte';
import { customBgStore } from '../../lib/customBgStore.svelte';

describe('SettingsCustomBgSection', () => {
  beforeEach(() => {
    customBgStore._reset();
  });

  it('renders upload button when no background is configured', () => {
    const { getByTestId, queryByTestId } = render(SettingsCustomBgSection);

    expect(getByTestId('settings-custom-bg-section')).toBeInTheDocument();
    expect(getByTestId('btn-upload-custom-bg')).toBeInTheDocument();
    expect(queryByTestId('preview-custom-bg-image')).toBeNull();
    expect(queryByTestId('preview-custom-bg-video')).toBeNull();
  });

  it('renders preview and controls when image background is set', async () => {
    customBgStore.url = 'blob:test-image';
    customBgStore.type = 'image';
    customBgStore.name = 'family_trip.jpg';
    customBgStore.dimOpacity = 0.4;
    customBgStore.blur = 5;

    const { getByTestId, queryByTestId } = render(SettingsCustomBgSection);

    expect(getByTestId('preview-custom-bg-image')).toBeInTheDocument();
    expect(queryByTestId('preview-custom-bg-video')).toBeNull();
    expect(getByTestId('btn-change-custom-bg')).toBeInTheDocument();
    expect(getByTestId('btn-clear-custom-bg')).toBeInTheDocument();

    const dimSlider = getByTestId('range-custom-bg-dim') as HTMLInputElement;
    expect(parseFloat(dimSlider.value)).toBe(0.4);

    const blurSlider = getByTestId('range-custom-bg-blur') as HTMLInputElement;
    expect(parseInt(blurSlider.value, 10)).toBe(5);
  });

  it('renders muted video preview and muted notice when video background is set', async () => {
    customBgStore.url = 'blob:test-video';
    customBgStore.type = 'video';
    customBgStore.name = 'lofi_room.mp4';

    const { getByTestId } = render(SettingsCustomBgSection);

    const video = getByTestId('preview-custom-bg-video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.muted).toBe(true);
  });

  it('handles slider adjustments for dimOpacity and blur', async () => {
    customBgStore.url = 'blob:test-image';
    customBgStore.type = 'image';

    const { getByTestId } = render(SettingsCustomBgSection);

    const dimSlider = getByTestId('range-custom-bg-dim');
    await fireEvent.input(dimSlider, { target: { value: '0.6' } });
    expect(customBgStore.dimOpacity).toBe(0.6);

    const blurSlider = getByTestId('range-custom-bg-blur');
    await fireEvent.input(blurSlider, { target: { value: '14' } });
    expect(customBgStore.blur).toBe(14);
  });

  it('toggles custom background enabled state', async () => {
    customBgStore.url = 'blob:test-image';
    customBgStore.type = 'image';
    customBgStore.enabled = true;

    const { getByTestId } = render(SettingsCustomBgSection);

    const toggle = getByTestId('toggle-custom-bg') as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    await fireEvent.click(toggle);
    expect(customBgStore.enabled).toBe(false);
  });

  it('clears custom background when clicking clear button', async () => {
    customBgStore.url = 'blob:test-image';
    customBgStore.type = 'image';
    const showToastMock = vi.fn();

    const { getByTestId } = render(SettingsCustomBgSection, { showToast: showToastMock });

    const clearBtn = getByTestId('btn-clear-custom-bg');
    await fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(customBgStore.url).toBeNull();
      expect(customBgStore.type).toBeNull();
      expect(showToastMock).toHaveBeenCalled();
    });
  });
});
