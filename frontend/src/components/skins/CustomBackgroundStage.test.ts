import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import CustomBackgroundStage from './CustomBackgroundStage.svelte';
import ImmersiveBackgroundStage from './ImmersiveBackgroundStage.svelte';
import { customBgStore } from '../../lib/customBgStore.svelte';

describe('CustomBackgroundStage', () => {
  beforeEach(() => {
    if (!HTMLMediaElement.prototype.play) {
      HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    }
    if (!HTMLMediaElement.prototype.pause) {
      HTMLMediaElement.prototype.pause = vi.fn();
    }
    customBgStore._reset();
  });

  it('renders nothing when customBgStore has no media url', () => {
    const { queryByTestId } = render(CustomBackgroundStage, { playing: false });
    expect(queryByTestId('custom-background-stage')).toBeNull();
  });

  it('renders nothing when custom background is disabled', () => {
    customBgStore.url = 'blob:test-image';
    customBgStore.type = 'image';
    customBgStore.enabled = false;

    const { queryByTestId } = render(CustomBackgroundStage, { playing: false });
    expect(queryByTestId('custom-background-stage')).toBeNull();
  });

  it('renders custom photo background with blur, dim overlay, custom scale, and position', () => {
    customBgStore.url = 'blob:test-photo';
    customBgStore.type = 'image';
    customBgStore.enabled = true;
    customBgStore.blur = 6;
    customBgStore.dimOpacity = 0.45;
    customBgStore.scale = 1.2;
    customBgStore.positionX = 30;
    customBgStore.positionY = 80;
    customBgStore.fit = 'contain';

    const { getByTestId } = render(CustomBackgroundStage, { playing: false });
    const stage = getByTestId('custom-background-stage');
    expect(stage).toBeInTheDocument();

    const img = getByTestId('custom-bg-image') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('blob:test-photo');
    expect(img.style.filter).toContain('blur(6px)');
    expect(img.style.objectFit).toBe('contain');
    expect(img.style.objectPosition).toBe('30% 80%');
    expect(img.style.transform).toContain('scale(1.2)');

    const dim = getByTestId('custom-bg-dim-overlay');
    expect(dim).toBeInTheDocument();
    expect(dim.style.background).toContain('rgba(0, 0, 0, 0.45)');
  });

  it('renders video background strictly muted and soundless (playsinline, autoplay, loop)', () => {
    customBgStore.url = 'blob:test-video';
    customBgStore.type = 'video';
    customBgStore.enabled = true;
    customBgStore.blur = 0;
    customBgStore.dimOpacity = 0.3;

    const { getByTestId } = render(CustomBackgroundStage, { playing: true });
    const video = getByTestId('custom-bg-video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.getAttribute('src')).toBe('blob:test-video');

    // 关键契约：严格无声播放，杜绝噪音干扰
    expect(video.muted).toBe(true);
    expect(video.volume).toBe(0);
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAttribute('webkit-playsinline');
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('loop');
  });

  it('keeps immersive-titlebar-bg at opacity-100 with WCO-aligned gradient even when custom background is enabled', () => {
    customBgStore.url = 'blob:test-photo';
    customBgStore.type = 'image';
    customBgStore.enabled = true;

    const { getByTestId } = render(ImmersiveBackgroundStage, { skinId: 'vinyl', playing: true });
    const titlebarBg = getByTestId('immersive-titlebar-bg');
    expect(titlebarBg.className).toContain('opacity-100');
    expect(titlebarBg.className).not.toContain('opacity-30');

    const styleAttr = titlebarBg.getAttribute('style') || '';
    expect(styleAttr).toContain('at 24px 14px');
    expect(styleAttr).toContain('at calc(100% - 57px) 14px');
    expect(styleAttr).toContain('84px');
    expect(styleAttr).toContain('109px');
  });
});
