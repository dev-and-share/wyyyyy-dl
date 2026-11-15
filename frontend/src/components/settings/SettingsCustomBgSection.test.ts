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

    const scaleSlider = getByTestId('range-custom-bg-scale') as HTMLInputElement;
    expect(parseFloat(scaleSlider.value)).toBe(1);

    const posXSlider = getByTestId('range-custom-bg-pos-x') as HTMLInputElement;
    expect(parseInt(posXSlider.value, 10)).toBe(50);

    const posYSlider = getByTestId('range-custom-bg-pos-y') as HTMLInputElement;
    expect(parseInt(posYSlider.value, 10)).toBe(50);
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

  it('handles range adjustments for scale, position X and Y, and fit mode', async () => {
    customBgStore.url = 'blob:test-image';
    customBgStore.type = 'image';

    const { getByTestId } = render(SettingsCustomBgSection);

    const scaleSlider = getByTestId('range-custom-bg-scale');
    await fireEvent.input(scaleSlider, { target: { value: '1.4' } });
    expect(customBgStore.scale).toBe(1.4);

    const posXSlider = getByTestId('range-custom-bg-pos-x');
    await fireEvent.input(posXSlider, { target: { value: '25' } });
    expect(customBgStore.positionX).toBe(25);

    const posYSlider = getByTestId('range-custom-bg-pos-y');
    await fireEvent.input(posYSlider, { target: { value: '75' } });
    expect(customBgStore.positionY).toBe(75);

    const fitContainBtn = getByTestId('select-custom-bg-fit-contain');
    await fireEvent.click(fitContainBtn);
    expect(customBgStore.fit).toBe('contain');

    const fitCoverBtn = getByTestId('select-custom-bg-fit-cover');
    await fireEvent.click(fitCoverBtn);
    expect(customBgStore.fit).toBe('cover');

    const topBtn = getByTestId('btn-custom-bg-pos-top');
    await fireEvent.click(topBtn);
    expect(customBgStore.positionY).toBe(10);

    const centerBtn = getByTestId('btn-custom-bg-pos-center');
    await fireEvent.click(centerBtn);
    expect(customBgStore.positionX).toBe(50);
    expect(customBgStore.positionY).toBe(50);

    const bottomBtn = getByTestId('btn-custom-bg-pos-bottom');
    await fireEvent.click(bottomBtn);
    expect(customBgStore.positionY).toBe(90);

    const resetBtn = getByTestId('btn-custom-bg-reset-pos');
    await fireEvent.click(resetBtn);
    expect(customBgStore.scale).toBe(1);
    expect(customBgStore.positionX).toBe(50);
    expect(customBgStore.positionY).toBe(50);
    expect(customBgStore.fit).toBe('cover');
  });

  it('supports drag-to-reposition on the preview card', async () => {
    customBgStore.url = 'blob:test-image';
    customBgStore.type = 'image';
    customBgStore.positionX = 50;
    customBgStore.positionY = 50;

    const { getByTestId } = render(SettingsCustomBgSection);
    const card = getByTestId('preview-custom-bg-card');

    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 100,
      top: 0,
      left: 0,
      bottom: 100,
      right: 200,
      x: 0,
      y: 0,
      toJSON: () => {}
    });
    if (!card.setPointerCapture) card.setPointerCapture = vi.fn();
    if (!card.releasePointerCapture) card.releasePointerCapture = vi.fn();

    await fireEvent.pointerDown(card, { button: 0, clientX: 100, clientY: 50, pointerId: 1 });
    await fireEvent.pointerMove(card, { clientX: 120, clientY: 60, pointerId: 1 });
    expect(customBgStore.positionX).toBe(40);
    expect(customBgStore.positionY).toBe(40);

    await fireEvent.pointerUp(card, { pointerId: 1 });
  });

  it('toggles custom background enabled state and hides controls when unchecked', async () => {
    customBgStore.url = 'blob:test-image';
    customBgStore.type = 'image';
    customBgStore.enabled = true;

    const { getByTestId, queryByTestId } = render(SettingsCustomBgSection);

    const toggle = getByTestId('toggle-custom-bg');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(queryByTestId('preview-custom-bg-image')).toBeInTheDocument();
    expect(queryByTestId('btn-change-custom-bg')).toBeInTheDocument();
    expect(queryByTestId('range-custom-bg-scale')).toBeInTheDocument();
    expect(queryByTestId('range-custom-bg-dim')).toBeInTheDocument();

    // 点击取消打勾
    await fireEvent.click(toggle);
    expect(customBgStore.enabled).toBe(false);

    // 取消打勾后：仅保留图片预览，其余所有调节功能全部隐藏不占空间
    expect(queryByTestId('preview-custom-bg-image')).toBeInTheDocument();
    expect(queryByTestId('btn-change-custom-bg')).toBeNull();
    expect(queryByTestId('btn-clear-custom-bg')).toBeNull();
    expect(queryByTestId('range-custom-bg-scale')).toBeNull();
    expect(queryByTestId('range-custom-bg-pos-x')).toBeNull();
    expect(queryByTestId('range-custom-bg-pos-y')).toBeNull();
    expect(queryByTestId('range-custom-bg-dim')).toBeNull();
    expect(queryByTestId('range-custom-bg-blur')).toBeNull();
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
