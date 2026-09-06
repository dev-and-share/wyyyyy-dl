import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordPlaylistPlay,
  getPlaylistPlayCount,
  isFavoritePlaylist,
  sortPlaylistsByPlayCount,
  playlistPlayCounts
} from './playlist.svelte';

describe('Playlist Play Count & Sorting Contract', () => {
  beforeEach(() => {
    localStorage.clear();
    for (const key of Object.keys(playlistPlayCounts)) {
      delete playlistPlayCounts[key];
    }
  });

  it('records play count and increments sequentially', () => {
    expect(getPlaylistPlayCount('1001')).toBe(0);
    recordPlaylistPlay('1001');
    expect(getPlaylistPlayCount('1001')).toBe(1);
    recordPlaylistPlay('1001');
    expect(getPlaylistPlayCount('1001')).toBe(2);

    // Verify localStorage persistence
    const raw = localStorage.getItem('wyyyy_playlist_play_counts');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({ '1001': 2 });
  });

  it('correctly identifies favorite playlist across varied criteria', () => {
    expect(isFavoritePlaylist({ id: 1, specialType: 5, name: '音乐' })).toBe(true);
    expect(isFavoritePlaylist({ id: 2, name: '我喜欢的音乐' })).toBe(true);
    expect(isFavoritePlaylist({ id: 3, name: 'houtokki 喜欢的音乐' })).toBe(true);
    expect(isFavoritePlaylist({ id: 4, name: '普通歌单', subscribed: false }, 0)).toBe(true);
    expect(isFavoritePlaylist({ id: 5, name: '普通歌单', subscribed: false }, 1)).toBe(false);
    expect(isFavoritePlaylist({ id: 6, name: '收藏的歌单', subscribed: true }, 0)).toBe(false);
  });

  it('sorts by play count descending, but keeps favorite playlist permanently at the top', () => {
    const list = [
      { id: 101, name: '我喜欢的音乐', specialType: 5 },
      { id: 102, name: '摇滚合辑' },
      { id: 103, name: '古典精选' },
      { id: 104, name: '流行金曲' }
    ];

    // Record plays:
    // 古典精选: 10 次
    // 摇滚合辑: 3 次
    // 流行金曲: 0 次
    // 我喜欢的音乐: 0 次
    for (let i = 0; i < 10; i++) recordPlaylistPlay('103');
    for (let i = 0; i < 3; i++) recordPlaylistPlay('102');

    const sorted = sortPlaylistsByPlayCount(list);

    // 1. 喜欢的音乐必须牢牢在第 1 位 (喜欢的除外)
    expect(sorted[0].id).toBe(101);
    // 2. 播放次数最多的古典精选排在第 2 位
    expect(sorted[1].id).toBe(103);
    // 3. 摇滚合辑排第 3 位
    expect(sorted[2].id).toBe(102);
    // 4. 0 次的流行金曲排第 4 位
    expect(sorted[3].id).toBe(104);
  });

  it('even if favorite playlist has many plays, it stays at top', () => {
    const list = [
      { id: 201, name: '我喜欢的音乐', specialType: 5 },
      { id: 202, name: '二次元' },
      { id: 203, name: '车载' }
    ];
    for (let i = 0; i < 50; i++) recordPlaylistPlay('201');
    for (let i = 0; i < 20; i++) recordPlaylistPlay('203');

    const sorted = sortPlaylistsByPlayCount(list);
    expect(sorted[0].id).toBe(201);
    expect(sorted[1].id).toBe(203);
    expect(sorted[2].id).toBe(202);
  });
});
