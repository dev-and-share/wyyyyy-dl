import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomBgStore, detectMediaType } from './customBgStore.svelte';

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
          blur: 8
        })
      );

      const newStore = new CustomBgStore();
      expect(newStore.enabled).toBe(false);
      expect(newStore.type).toBe('video');
      expect(newStore.name).toBe('saved_video.mp4');
      expect(newStore.dimOpacity).toBe(0.6);
      expect(newStore.blur).toBe(8);
    });
  });
});
