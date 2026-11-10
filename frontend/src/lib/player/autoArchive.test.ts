import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isMusicFreeTrack, resolveAudioSourceType, checkAndTriggerAutoArchive, resetAutoArchiveHistory } from './autoArchive';
import { AudioSourceType } from '../types';
import * as downloadHelper from '../musicfree/downloadHelper';
import * as trackStatus from './trackStatus.svelte';
import type { Track } from '../types';

describe('autoArchive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAutoArchiveHistory();
  });

  it('correctly identifies musicfree tracks', () => {
    expect(isMusicFreeTrack(null)).toBe(false);
    expect(isMusicFreeTrack({ id: 12345, name: 'Normal Song' } as Track)).toBe(false);
    expect(isMusicFreeTrack({ id: 'mf_qq_123', name: 'QQ Song' } as any)).toBe(true);
    expect(isMusicFreeTrack({ id: 999, name: 'Ext Song', _isMusicFree: true } as any)).toBe(true);
    expect(isMusicFreeTrack({ id: 888, name: 'Raw Song', raw: { _isMusicFree: true } } as any)).toBe(true);
    expect(isMusicFreeTrack({ id: 777, name: 'Plugin Song', _pluginHash: 'abc' } as any)).toBe(true);
  });

  it('resolves specific sub-source types into AudioSourceType enum values', () => {
    expect(resolveAudioSourceType(null)).toBe(AudioSourceType.NETEASE);
    expect(resolveAudioSourceType({ id: 12345, name: 'NetEase Song' })).toBe(AudioSourceType.NETEASE);

    expect(resolveAudioSourceType({ id: 'mf_qq_123', name: 'QQ' })).toBe(AudioSourceType.MUSICFREE_QQ);
    expect(resolveAudioSourceType({ id: 'mf_kugou_456', name: 'Kugou' })).toBe(AudioSourceType.MUSICFREE_KUGOU);
    expect(resolveAudioSourceType({ id: 'mf_kuwo_789', name: 'Kuwo' })).toBe(AudioSourceType.MUSICFREE_KUWO);
    expect(resolveAudioSourceType({ id: 'mf_migu_999', name: 'Migu' })).toBe(AudioSourceType.MUSICFREE_MIGU);
    expect(resolveAudioSourceType({ id: 'mf_bili_111', name: 'Bilibili' })).toBe(AudioSourceType.MUSICFREE_BILIBILI);
    expect(resolveAudioSourceType({ id: 'mf_custom_222', _isMusicFree: true })).toBe(AudioSourceType.MUSICFREE);
  });

  it('does not trigger if duration is less than 30s (e.g. trial / anti-leech audio)', () => {
    const spyDownload = vi.spyOn(downloadHelper, 'downloadExternalTrack').mockResolvedValue(true);
    const track: Track = { id: 'mf_kugou_1', name: '短音频', artist: '歌手' };

    const triggered = checkAndTriggerAutoArchive(track, 15, 20);
    expect(triggered).toBe(false);
    expect(spyDownload).not.toHaveBeenCalled();
  });

  it('does not trigger if track is played less than half duration', () => {
    const spyDownload = vi.spyOn(downloadHelper, 'downloadExternalTrack').mockResolvedValue(true);
    const track: Track = { id: 'mf_kugou_2', name: '测试歌曲', artist: '歌手' };

    // 100s 的曲目，当前播放 40s (未过半)
    const triggered = checkAndTriggerAutoArchive(track, 40, 100);
    expect(triggered).toBe(false);
    expect(spyDownload).not.toHaveBeenCalled();
  });

  it('triggers silent download when played over half duration and >= 15s', () => {
    const spyDownload = vi.spyOn(downloadHelper, 'downloadExternalTrack').mockResolvedValue(true);
    vi.spyOn(trackStatus, 'getTrackSourceStatus').mockReturnValue({
      isServer: false,
      isPhone: true,
      isLocal: true
    });

    const track: Track = { id: 'mf_kugou_3', name: '给尘埃里的我们', artist: '陈文非' };

    // 60s 的曲目，当前播放 31s (过半且 >= 15s)
    const triggered = checkAndTriggerAutoArchive(track, 31, 60);
    expect(triggered).toBe(true);
    expect(spyDownload).toHaveBeenCalledWith(
      track,
      track.raw,
      undefined,
      expect.objectContaining({
        silent: true,
        source: AudioSourceType.MUSICFREE_KUGOU
      })
    );

    // 再次调用同一首，防重复机制阻止二次提交
    const secondCall = checkAndTriggerAutoArchive(track, 32, 60);
    expect(secondCall).toBe(false);
    expect(spyDownload).toHaveBeenCalledTimes(1);
  });

  it('does not trigger if track is already downloaded on server', () => {
    const spyDownload = vi.spyOn(downloadHelper, 'downloadExternalTrack').mockResolvedValue(true);
    vi.spyOn(trackStatus, 'getTrackSourceStatus').mockReturnValue({
      isServer: true,
      isPhone: true,
      isLocal: true
    });

    const track: Track = { id: 'mf_qq_4', name: '已落盘歌曲', artist: '歌手' };
    const triggered = checkAndTriggerAutoArchive(track, 50, 80);
    expect(triggered).toBe(false);
    expect(spyDownload).not.toHaveBeenCalled();
  });
});
