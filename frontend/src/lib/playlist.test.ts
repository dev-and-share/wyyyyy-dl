import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordPlaylistPlay,
  getPlaylistPlayCount,
  isFavoritePlaylist,
  sortPlaylistsByPlayCount,
  playlistPlayCounts,
  myPlaylists
} from './playlist.svelte';

describe('Playlist Play Count & Sorting Contract', () => {
  beforeEach(() => {
    localStorage.clear();
    for (const key of Object.keys(playlistPlayCounts)) {
      delete playlistPlayCounts[key];
    }
    myPlaylists.length = 0;
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

  it('correctly identifies ONLY the single undeletable system favorite playlist', () => {
    // 模拟用户有多个名字带“喜欢的音乐”的普通歌单，但只有第一个自建是系统歌单
    myPlaylists.push(
      { id: 1, name: 'AndyF喜欢的音乐', specialType: 5, subscribed: false },
      { id: 2, name: 'AndyF喜欢的音乐', subscribed: false },
      { id: 3, name: '女声+我喜欢的音乐...等4个', subscribed: false },
      { id: 4, name: '女声+我喜欢的音乐...等4个', subscribed: false }
    );

    // 只有第 1 个是不可删除的系统喜欢歌单
    expect(isFavoritePlaylist(myPlaylists[0])).toBe(true);
    // 后面 3 个名字虽然也带“喜欢的音乐”，但它们绝不是系统置顶歌单
    expect(isFavoritePlaylist(myPlaylists[1])).toBe(false);
    expect(isFavoritePlaylist(myPlaylists[2])).toBe(false);
    expect(isFavoritePlaylist(myPlaylists[3])).toBe(false);
  });

  it('sorts by play count descending, but keeps ONLY the single undeletable favorite playlist at top', () => {
    const list = [
      { id: 101, name: 'AndyF喜欢的音乐', specialType: 5, subscribed: false },
      { id: 102, name: 'AndyF喜欢的音乐 (普通备份)', subscribed: false },
      { id: 103, name: '女声+我喜欢的音乐...等4个', subscribed: false },
      { id: 104, name: '流行金曲', subscribed: false }
    ];
    myPlaylists.push(...list);

    // 播放记录：
    // 女声+我喜欢的音乐: 20 次
    // 流行金曲: 10 次
    // 备份: 5 次
    // 系统喜欢歌单: 0 次
    for (let i = 0; i < 20; i++) recordPlaylistPlay('103');
    for (let i = 0; i < 10; i++) recordPlaylistPlay('104');
    for (let i = 0; i < 5; i++) recordPlaylistPlay('102');

    const sorted = sortPlaylistsByPlayCount(list);

    // 1. 唯一不可删除的系统喜欢歌单永远置顶在第 1 位
    expect(sorted[0].id).toBe(101);
    // 2. 播放次数最多的“女声+我喜欢的音乐...等4个”排在第 2 位
    expect(sorted[1].id).toBe(103);
    // 3. 流行金曲排第 3 位
    expect(sorted[2].id).toBe(104);
    // 4. 普通备份排第 4 位
    expect(sorted[3].id).toBe(102);
  });
});
