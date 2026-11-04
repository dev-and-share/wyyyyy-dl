import { describe, it, expect, vi, beforeEach } from 'vitest';
import { likeState, isTrackLiked, toggleLike, initLikeList } from './likeStore.svelte';
import { api } from './api';

describe('likeStore contracts', () => {
  beforeEach(() => {
    likeState.likedSet.clear();
    likeState.likedExtSet.clear();
    vi.clearAllMocks();
  });

  it('correctly checks isTrackLiked for both NetEase numeric IDs and external string IDs', () => {
    likeState.likedSet.add(123456);
    likeState.likedExtSet.add('mf_kugou_abc');
    likeState.likedExtSet.add('夜曲___周杰伦');

    // NetEase number
    expect(isTrackLiked(123456)).toBe(true);
    expect(isTrackLiked(999999)).toBe(false);

    // External string
    expect(isTrackLiked('mf_kugou_abc')).toBe(true);
    expect(isTrackLiked('mf_unknown')).toBe(false);

    // Combo title + artist
    expect(isTrackLiked('mf_unknown', '夜曲', '周杰伦')).toBe(true);
    expect(isTrackLiked('mf_unknown', '晴天', '周杰伦')).toBe(false);
  });

  it('toggleLike routes NetEase song to api.like and updates likedSet', async () => {
    const spyLike = vi.spyOn(api, 'like').mockResolvedValue({ code: '000000', msg: 'ok' } as any);

    await toggleLike(1001, '稻香');
    expect(likeState.likedSet.has(1001)).toBe(true);
    expect(spyLike).toHaveBeenCalledWith(1001, true);

    await toggleLike(1001, '稻香');
    expect(likeState.likedSet.has(1001)).toBe(false);
    expect(spyLike).toHaveBeenCalledWith(1001, false);
  });

  it('toggleLike routes external MusicFree track to local_favorites playlist without touching NetEase API', async () => {
    const spyLike = vi.spyOn(api, 'like');
    const spyAdd = vi.spyOn(api, 'localPlaylistAddTrack').mockResolvedValue({ code: '000000' } as any);
    const spyRemove = vi.spyOn(api, 'localPlaylistRemoveTrack').mockResolvedValue({ code: '000000' } as any);

    const extId = 'mf_kugou_xyz';
    await toggleLike(extId, '睡前别想太多', '李雨霏');

    // Never calls NetEase official like API
    expect(spyLike).not.toHaveBeenCalled();
    // Added to local_favorites in SQLite
    expect(spyAdd).toHaveBeenCalledWith('local_favorites', expect.objectContaining({
      name: '睡前别想太多',
      artist: '李雨霏'
    }));
    expect(isTrackLiked(extId, '睡前别想太多', '李雨霏')).toBe(true);

    // Toggle again removes from local_favorites
    await toggleLike(extId, '睡前别想太多', '李雨霏');
    expect(spyRemove).toHaveBeenCalledWith('local_favorites', extId, '睡前别想太多', '李雨霏');
    expect(isTrackLiked(extId, '睡前别想太多', '李雨霏')).toBe(false);
  });

  it('safely handles track with NaN id or extra metadata without polluting with NaN', async () => {
    const spyAdd = vi.spyOn(api, 'localPlaylistAddTrack').mockResolvedValue({ code: '000000' } as any);
    await toggleLike(NaN as any, '山海不说话', undefined, { artist: '陳鴨梨Charlie' });

    expect(spyAdd).toHaveBeenCalledWith('local_favorites', expect.objectContaining({
      name: '山海不说话',
      artist: '陳鴨梨Charlie'
    }));
    expect(isTrackLiked(undefined, '山海不说话', '陳鴨梨Charlie')).toBe(true);
    expect(isTrackLiked('NaN', '山海不说话', '陳鴨梨Charlie')).toBe(true);
  });
});
