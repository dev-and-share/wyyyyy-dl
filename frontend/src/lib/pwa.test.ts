import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerServiceWorker,
  checkForPwaUpdate,
  notifyPlaybackStateToSw,
  applyPendingPwaUpdate,
  hasPendingPwaUpdate
} from './pwa';

describe('PWA Service Worker lifecycle & auto-reload contracts', () => {
  let mockRegister: ReturnType<typeof vi.fn>;
  let mockGetRegistration: ReturnType<typeof vi.fn>;
  let mockControllerPostMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRegister = vi.fn();
    mockGetRegistration = vi.fn();
    mockControllerPostMessage = vi.fn();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        getRegistration: mockGetRegistration,
        addEventListener: vi.fn(),
        controller: {
          postMessage: mockControllerPostMessage
        }
      },
      writable: true,
      configurable: true
    });
  });

  it('registerServiceWorker passes updateViaCache: none to prevent browser HTTP caching', () => {
    mockRegister.mockResolvedValueOnce({
      scope: '/',
      waiting: null,
      onupdatefound: null
    });

    registerServiceWorker();

    // 触发 window.load 事件
    window.dispatchEvent(new Event('load'));

    // 关键契约验证：注册必须附带 updateViaCache: 'none'
    expect(mockRegister).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' });
  });

  it('checkForPwaUpdate sends SKIP_WAITING to waiting worker if update is found and not playing', async () => {
    const mockPostMessage = vi.fn();
    const mockWorker = { postMessage: mockPostMessage };

    mockGetRegistration.mockResolvedValueOnce({
      waiting: mockWorker,
      update: vi.fn().mockResolvedValue(undefined)
    });

    const hasUpdate = await checkForPwaUpdate({ isAudioPlaying: () => false });

    expect(hasUpdate).toBe(true);
    // 关键契约验证：未播放时必须向 waiting 状态的 Service Worker 派发 SKIP_WAITING 指令
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('checkForPwaUpdate returns false and SUPPRESSES SKIP_WAITING if audio is currently playing', async () => {
    const mockPostMessage = vi.fn();
    const mockWorker = { postMessage: mockPostMessage };

    mockGetRegistration.mockResolvedValueOnce({
      waiting: mockWorker,
      update: vi.fn().mockResolvedValue(undefined)
    });

    // 🛡️ 契约验证：正在播放时绝对不更新新版本
    const hasUpdate = await checkForPwaUpdate({ isAudioPlaying: () => true });

    expect(hasUpdate).toBe(false);
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('checkForPwaUpdate returns false if no waiting worker exists', async () => {
    mockGetRegistration.mockResolvedValueOnce({
      waiting: null,
      update: vi.fn().mockResolvedValue(undefined)
    });

    const hasUpdate = await checkForPwaUpdate({ isAudioPlaying: () => false });

    expect(hasUpdate).toBe(false);
  });

  it('registerServiceWorker with autoReloadOnControllerChange: false does not attach controllerchange listener', () => {
    mockRegister.mockResolvedValueOnce({
      scope: '/',
      waiting: null,
      onupdatefound: null
    });

    const addEventListenerSpy = vi.spyOn(navigator.serviceWorker, 'addEventListener');
    registerServiceWorker(undefined, { autoReloadOnControllerChange: false, isAudioPlaying: () => false });

    window.dispatchEvent(new Event('load'));

    expect(addEventListenerSpy).not.toHaveBeenCalledWith('controllerchange', expect.any(Function));
  });

  it('registerServiceWorker suppresses SKIP_WAITING while playing and applies when playback stops', async () => {
    const mockPostMessage = vi.fn();
    const mockWorker = { postMessage: mockPostMessage };

    let isPlayingState = true;

    mockRegister.mockResolvedValueOnce({
      scope: '/',
      waiting: mockWorker,
      onupdatefound: null
    });

    registerServiceWorker(undefined, {
      isAudioPlaying: () => isPlayingState
    });

    window.dispatchEvent(new Event('load'));
    // 等待微任务完成
    await new Promise((r) => setTimeout(r, 10));

    // 🛡️ 正在播放中，绝对不能发送 SKIP_WAITING，但应该暂存
    expect(mockPostMessage).not.toHaveBeenCalled();
    expect(hasPendingPwaUpdate()).toBe(true);

    // 尝试在播放中激活，依然被阻断
    expect(applyPendingPwaUpdate()).toBe(false);
    expect(mockPostMessage).not.toHaveBeenCalled();

    // 🎵 音频停止播放，安全执行激活
    isPlayingState = false;
    const applied = applyPendingPwaUpdate();
    expect(applied).toBe(true);
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(hasPendingPwaUpdate()).toBe(false);
  });

  it('notifyPlaybackStateToSw dispatches AUDIO_PLAYBACK_STATE to controller', () => {
    notifyPlaybackStateToSw(true);
    expect(mockControllerPostMessage).toHaveBeenCalledWith({
      type: 'AUDIO_PLAYBACK_STATE',
      isPlaying: true
    });

    notifyPlaybackStateToSw(false);
    expect(mockControllerPostMessage).toHaveBeenCalledWith({
      type: 'AUDIO_PLAYBACK_STATE',
      isPlaying: false
    });
  });
});
