import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isScrobbleEnabled,
  setScrobbleEnabled,
  isNeteaseTrack,
  handleTrackEndedScrobble,
  SCROBBLE_STORAGE_KEY
} from './scrobble';
import { api } from '../api';
import type { Track } from '../types';
import * as toastModule from '../toast.svelte';

vi.mock('../api', () => ({
  api: {
    scrobble: vi.fn()
  }
}));

vi.mock('../toast.svelte', () => ({
  showToast: vi.fn()
}));

describe('🎧 NetEase Scrobble Playback Sync Module', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('isScrobbleEnabled & setScrobbleEnabled', () => {
    it('defaults to true when localStorage is unset', () => {
      expect(isScrobbleEnabled()).toBe(true);
    });

    it('can be toggled and persisted correctly', () => {
      setScrobbleEnabled(false);
      expect(localStorage.getItem(SCROBBLE_STORAGE_KEY)).toBe('false');
      expect(isScrobbleEnabled()).toBe(false);

      setScrobbleEnabled(true);
      expect(localStorage.getItem(SCROBBLE_STORAGE_KEY)).toBe('true');
      expect(isScrobbleEnabled()).toBe(true);
    });
  });

  describe('isNeteaseTrack', () => {
    it('returns true for genuine NetEase positive integer IDs', () => {
      const track1: Track = { id: 1393659632, name: '外婆桥', artist: '任然' };
      const track2: Track = { id: '277111', name: '如果没有你', artist: '莫文蔚' };
      expect(isNeteaseTrack(track1)).toBe(true);
      expect(isNeteaseTrack(track2)).toBe(true);
    });

    it('returns false for MusicFree tracks with mf_ prefix or plugin metadata', () => {
      const mfTrack1: Track = { id: 'mf_qq_123456', name: 'QQ音乐曲目', artist: '周杰伦' };
      const mfTrack2: Track = {
        id: 12345,
        name: '插件曲目',
        artist: '歌手',
        raw: { _pluginId: 'qq', _pluginPlatform: 'qq' }
      };
      expect(isNeteaseTrack(mfTrack1)).toBe(false);
      expect(isNeteaseTrack(mfTrack2)).toBe(false);
    });

    it('returns false for local imported files or invalid IDs', () => {
      expect(isNeteaseTrack(null)).toBe(false);
      expect(isNeteaseTrack(undefined)).toBe(false);
      expect(isNeteaseTrack({ id: 0, name: '本地无ID', artist: '未知' })).toBe(false);
      expect(isNeteaseTrack({ id: -1, name: '负数ID', artist: '未知' })).toBe(false);
      expect(isNeteaseTrack({ id: '/media/music/abc.mp3', name: '路径ID', artist: '未知' })).toBe(false);
      expect(isNeteaseTrack({ id: 'local_99', name: '本地ID', artist: '未知' })).toBe(false);
      expect(isNeteaseTrack({ id: 'abc123xyz', name: '非数字ID', artist: '未知' })).toBe(false);
    });
  });

  describe('handleTrackEndedScrobble', () => {
    it('does not send scrobble when disabled', async () => {
      setScrobbleEnabled(false);
      const track: Track = { id: 1393659632, name: '外婆桥', artist: '任然' };

      const res = await handleTrackEndedScrobble(track, 240);
      expect(res).toBe(false);
      expect(api.scrobble).not.toHaveBeenCalled();
      expect(toastModule.showToast).not.toHaveBeenCalled();
    });

    it('does not send scrobble for non-NetEase tracks', async () => {
      setScrobbleEnabled(true);
      const track: Track = { id: 'mf_bilibili_999', name: 'B站音频', artist: 'UP主' };

      const res = await handleTrackEndedScrobble(track, 240);
      expect(res).toBe(false);
      expect(api.scrobble).not.toHaveBeenCalled();
      expect(toastModule.showToast).not.toHaveBeenCalled();
    });

    it('does not send scrobble when duration is too short (< 5s)', async () => {
      setScrobbleEnabled(true);
      const track: Track = { id: 1393659632, name: '外婆桥', artist: '任然' };

      const res = await handleTrackEndedScrobble(track, 3);
      expect(res).toBe(false);
      expect(api.scrobble).not.toHaveBeenCalled();
      expect(toastModule.showToast).not.toHaveBeenCalled();
    });

    it('successfully sends scrobble for valid NetEase track with correct parameters and shows toast', async () => {
      setScrobbleEnabled(true);
      (api.scrobble as any).mockResolvedValue({ code: '000000', data: true });

      const track: Track = { id: 167799, name: '怎么说我不爱你', artist: '萧敬腾' };
      const res = await handleTrackEndedScrobble(track, 275.4, 999888);

      expect(res).toBe(true);
      expect(api.scrobble).toHaveBeenCalledWith(167799, 999888, 275);
      expect(toastModule.showToast).toHaveBeenCalledWith(
        expect.stringContaining('怎么说我不爱你'),
        'info',
        2500
      );
    });

    it('deduplicates rapid repeated scrobble calls for the same song', async () => {
      setScrobbleEnabled(true);
      (api.scrobble as any).mockResolvedValue({ code: '000000', data: true });

      const track: Track = { id: 277111, name: '如果没有你', artist: '莫文蔚' };

      // First call succeeds
      const r1 = await handleTrackEndedScrobble(track, 289);
      expect(r1).toBe(true);
      expect(api.scrobble).toHaveBeenCalledTimes(1);
      expect(toastModule.showToast).toHaveBeenCalledTimes(1);

      // Immediate second call is suppressed
      const r2 = await handleTrackEndedScrobble(track, 289);
      expect(r2).toBe(false);
      expect(api.scrobble).toHaveBeenCalledTimes(1);
      expect(toastModule.showToast).toHaveBeenCalledTimes(1);
    });

    it('handles api errors gracefully without crashing and shows warning toast', async () => {
      setScrobbleEnabled(true);
      (api.scrobble as any).mockRejectedValue(new Error('Network offline'));

      const track: Track = { id: 888888, name: '测试曲目', artist: '歌手' };
      const res = await handleTrackEndedScrobble(track, 180);

      expect(res).toBe(false);
      expect(toastModule.showToast).toHaveBeenCalledWith(
        expect.any(String),
        'warning',
        2500
      );
    });
  });
});
