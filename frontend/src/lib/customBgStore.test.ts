import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomBgStore, detectMediaType, sampleTopColorFromPixels } from './customBgStore.svelte';

describe('customBgStore', () => {
  let store: CustomBgStore;

  beforeEach(() => {
    localStorage.clear();
    store = new CustomBgStore();
    store._reset();
  });

  describe('detectMediaType', () => {
    it('detects video mime types', () => {
      expect(detectMediaType({ type: 'video/mp4' })).toBe('video');
      expect(detectMediaType({ type: 'video/webm' })).toBe('video');
      expect(detectMediaType({ type: 'video/quicktime' })).toBe('video');
    });

    it('detects video file extensions when mime is generic or empty', () => {
      expect(detectMediaType({ name: 'background.mp4' })).toBe('video');
      expect(detectMediaType({ name: 'clip.WEBM' })).toBe('video');
      expect(detectMediaType({ name: 'movie.mov' })).toBe('video');
      expect(detectMediaType({ name: 'animation.mkv' })).toBe('video');
    });

    it('detects image mime types and extensions', () => {
      expect(detectMediaType({ type: 'image/jpeg' })).toBe('image');
      expect(detectMediaType({ type: 'image/png' })).toBe('image');
      expect(detectMediaType({ type: 'image/webp' })).toBe('image');
      expect(detectMediaType({ name: 'photo.jpg' })).toBe('image');
      expect(detectMediaType({ name: 'picture.png' })).toBe('image');
    });
  });

  describe('media management contracts', () => {
    it('initializes with default values', () => {
      expect(store.url).toBeNull();
      expect(store.type).toBeNull();
      expect(store.name).toBe('');
      expect(store.dimOpacity).toBe(0.35);
      expect(store.blur).toBe(0);
      expect(store.scale).toBe(1);
      expect(store.positionX).toBe(50);
      expect(store.positionY).toBe(50);
      expect(store.fit).toBe('cover');
      expect(store.enabled).toBe(true);
    });

    it('sets image media correctly', async () => {
      const mockBlob = new Blob(['mock-image-data'], { type: 'image/png' });
      await store.setMedia(mockBlob, 'image', 'my_photo.png');

      expect(store.url).toBeTruthy();
      expect(store.type).toBe('image');
      expect(store.name).toBe('my_photo.png');
      expect(store.enabled).toBe(true);

      const saved = JSON.parse(localStorage.getItem('wyy_custom_bg_config') || '{}');
      expect(saved.type).toBe('image');
      expect(saved.name).toBe('my_photo.png');
      expect(saved.enabled).toBe(true);
    });

    it('sets video media correctly and marks type as video', async () => {
      const mockBlob = new Blob(['mock-video-data'], { type: 'video/mp4' });
      await store.setMedia(mockBlob, 'video', 'cinematic_bg.mp4');

      expect(store.url).toBeTruthy();
      expect(store.type).toBe('video');
      expect(store.name).toBe('cinematic_bg.mp4');
      expect(store.enabled).toBe(true);

      const saved = JSON.parse(localStorage.getItem('wyy_custom_bg_config') || '{}');
      expect(saved.type).toBe('video');
    });

    it('clears media and resets url, type, and name', async () => {
      const mockBlob = new Blob(['mock-data'], { type: 'image/jpeg' });
      await store.setMedia(mockBlob, 'image', 'photo.jpg');
      expect(store.url).not.toBeNull();

      await store.clear();
      expect(store.url).toBeNull();
      expect(store.type).toBeNull();
      expect(store.name).toBe('');
    });

    it('clamps dimOpacity within [0.0, 0.9]', () => {
      store.setDimOpacity(0.5);
      expect(store.dimOpacity).toBe(0.5);

      store.setDimOpacity(-0.2);
      expect(store.dimOpacity).toBe(0);

      store.setDimOpacity(1.5);
      expect(store.dimOpacity).toBe(0.9);
    });

    it('clamps blur within [0, 30]', () => {
      store.setBlur(12);
      expect(store.blur).toBe(12);

      store.setBlur(-5);
      expect(store.blur).toBe(0);

      store.setBlur(50);
      expect(store.blur).toBe(30);
    });

    it('clamps scale within [0.5, 2.5]', () => {
      store.setScale(1.25);
      expect(store.scale).toBe(1.25);

      store.setScale(0.1);
      expect(store.scale).toBe(0.5);

      store.setScale(5.0);
      expect(store.scale).toBe(2.5);
    });

    it('clamps positionX and positionY within [0, 100]', () => {
      store.setPosition(30, 70);
      expect(store.positionX).toBe(30);
      expect(store.positionY).toBe(70);

      store.setPositionX(-20);
      expect(store.positionX).toBe(0);

      store.setPositionY(150);
      expect(store.positionY).toBe(100);
    });

    it('sets fit mode correctly', () => {
      store.setFit('contain');
      expect(store.fit).toBe('contain');
      store.setFit('cover');
      expect(store.fit).toBe('cover');
    });

    it('resets position and scale to defaults', () => {
      store.setScale(1.8);
      store.setPosition(10, 20);
      store.setFit('contain');

      store.resetPositionAndScale();
      expect(store.scale).toBe(1);
      expect(store.positionX).toBe(50);
      expect(store.positionY).toBe(50);
      expect(store.fit).toBe('cover');
    });

    it('updates enabled state correctly', () => {
      store.setEnabled(false);
      expect(store.enabled).toBe(false);
      store.setEnabled(true);
      expect(store.enabled).toBe(true);
    });

    it('restores config from localStorage on construction', () => {
      localStorage.setItem(
        'wyy_custom_bg_config',
        JSON.stringify({
          enabled: false,
          type: 'video',
          name: 'saved_video.mp4',
          dimOpacity: 0.6,
          blur: 8,
          scale: 1.35,
          positionX: 40,
          positionY: 60,
          fit: 'contain'
        })
      );

      const newStore = new CustomBgStore();
      expect(newStore.enabled).toBe(false);
      expect(newStore.type).toBe('video');
      expect(newStore.name).toBe('saved_video.mp4');
      expect(newStore.dimOpacity).toBe(0.6);
      expect(newStore.blur).toBe(8);
      expect(newStore.scale).toBe(1.35);
      expect(newStore.positionX).toBe(40);
      expect(newStore.positionY).toBe(60);
      expect(newStore.fit).toBe('contain');
    });

    it('samples weighted top-edge color from pixel buffers and ignores transparent pixels', () => {
      // 10x5 image: top row has corner pixels weighted x2 (r=200,g=160,b=120) and center pixels (r=100,g=80,b=60)
      const width = 10;
      const height = 5;
      const data = new Uint8ClampedArray(width * height * 4);
      for (let x = 0; x < width; x++) {
        const idx = x * 4;
        const isCorner = x < 3 || x >= 7; // 6 corner pixels (weight 2 => 12), 4 center pixels (weight 1 => 4)
        data[idx] = isCorner ? 200 : 100;
        data[idx + 1] = isCorner ? 160 : 80;
        data[idx + 2] = isCorner ? 120 : 60;
        data[idx + 3] = 255;
      }
      // Weighted avg: (12*200 + 4*100)/16 = 175, (12*160 + 4*80)/16 = 140, (12*120 + 4*60)/16 = 105 -> #af8c69
      expect(sampleTopColorFromPixels(data, width, height)).toBe('#af8c69');

      // All transparent pixels return null
      const transparent = new Uint8ClampedArray(width * height * 4);
      expect(sampleTopColorFromPixels(transparent, width, height)).toBeNull();
    });

    it('computes effective top color blended with dimOpacity and respects enabled state', async () => {
      expect(store.getEffectiveTopColor()).toBeNull();

      const mockBlob = new Blob(['mock-image-data'], { type: 'image/png' });
      await store.setMedia(mockBlob, 'image', 'warm.png');
      expect(store.topColor).toBeNull();

      store.setTopColor('#c8aa8c'); // (200, 170, 140)
      store.setDimOpacity(0.5);
      // Blended with #000000 at 0.5 => (100, 85, 70) => #645546
      expect(store.getEffectiveTopColor()).toBe('#645546');

      store.setEnabled(false);
      expect(store.getEffectiveTopColor()).toBeNull();

      store.setEnabled(true);
      expect(store.getEffectiveTopColor()).toBe('#645546');

      await store.clear();
      expect(store.topColor).toBeNull();
      expect(store.getEffectiveTopColor()).toBeNull();
    });
  });
});
