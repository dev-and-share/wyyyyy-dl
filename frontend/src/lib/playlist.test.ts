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

  it('manages loading state and clears stale playlist during loadPlaylistDetail', async () => {
    const { loadPlaylistDetail, isPlaylistLoading, getPlaylistLoadingId, playlistState } = await import('./playlist.svelte');
    const { api } = await import('./api');
    const { vi } = await import('vitest');

    playlistState.playlist = { id: 999, name: '旧歌单', tracks: [{ id: 1 }] };

    let loadingDuringRequest = false;
    let loadingIdDuringRequest = '';
    let stalePlaylistClearedDuringRequest = false;

    vi.spyOn(api, 'playlist').mockImplementation(async (id: string) => {
      loadingDuringRequest = isPlaylistLoading();
      loadingIdDuringRequest = getPlaylistLoadingId();
      stalePlaylistClearedDuringRequest = playlistState.playlist === null;
      return {
        code: '000000',
        data: {
          playlist: { id: Number(id), name: '新歌单', tracks: [{ id: 2, name: '歌曲2' }] }
        }
      };
    });

    const res = await loadPlaylistDetail('4658757');
    expect(loadingDuringRequest).toBe(true);
    expect(loadingIdDuringRequest).toBe('4658757');
    expect(stalePlaylistClearedDuringRequest).toBe(true);
    expect(isPlaylistLoading()).toBe(false);
    expect(getPlaylistLoadingId()).toBe('');
    expect(res.name).toBe('新歌单');
  });

  it('Cache First: renders immediately from cache with NO loading UI, while silently revalidating in background', async () => {
    const { loadPlaylistDetail, isPlaylistLoading, playlistState } = await import('./playlist.svelte');
    const { api } = await import('./api');
    const { setApiCache, getApiCache } = await import('./utils');
    const { vi } = await import('vitest');

    // 预置旧缓存数据
    setApiCache('playlist_8888', {
      playlist: { id: 8888, name: '旧缓存歌单', tracks: [{ id: 88, name: '旧歌曲' }] }
    });

    const apiSpy = vi.spyOn(api, 'playlist').mockResolvedValue({
      code: '000000',
      data: {
        playlist: { id: 8888, name: '后台最新歌单', tracks: [{ id: 88, name: '新歌曲' }] }
      }
    });

    const res = await loadPlaylistDetail('8888');

    // 断言 1: 秒显缓存数据
    expect(res.name).toBe('旧缓存歌单');
    // 断言 2: 零 loading UI (isPlaylistLoading 始终保持 false)
    expect(isPlaylistLoading()).toBe(false);
    // 断言 3: 后台依然静默调用了 API
    expect(apiSpy).toHaveBeenCalledWith('8888');

    // 等待微任务队列执行完成
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 断言 4: 后台 API 成功后默默更新了数据
    expect(playlistState.playlist?.name).toBe('后台最新歌单');
    expect(getApiCache('playlist_8888')?.data?.playlist?.name).toBe('后台最新歌单');
  });

  it('Anti-Race Condition: ignores stale background revalidate when user switched to another playlist', async () => {
    const { loadPlaylistDetail, playlistState } = await import('./playlist.svelte');
    const { api } = await import('./api');
    const { setApiCache, getApiCache } = await import('./utils');
    const { vi } = await import('vitest');

    // 预置两个不同歌单的旧缓存数据
    setApiCache('playlist_111', {
      playlist: { id: 111, name: '黄磊经典', tracks: [{ id: 11, name: '边走边唱' }] }
    });
    setApiCache('playlist_222', {
      playlist: { id: 222, name: '张宇精选', tracks: [{ id: 22, name: '用心良苦' }] }
    });

    let resolve111: any;
    let resolve222: any;
    const promise111 = new Promise((resolve) => { resolve111 = resolve; });
    const promise222 = new Promise((resolve) => { resolve222 = resolve; });

    vi.spyOn(api, 'playlist').mockImplementation((id: string) => {
      if (id === '111') return promise111 as any;
      if (id === '222') return promise222 as any;
      return Promise.resolve({ code: '000000', data: { playlist: { id: Number(id), tracks: [{ id: 1 }] } } });
    });

    // 1. 用户先切换到黄磊（Cache First 立即显示黄磊，后台发起了 111 的网络请求）
    await loadPlaylistDetail('111');
    expect(playlistState.playlist?.name).toBe('黄磊经典');

    // 2. 用户快速切换到张宇（Cache First 立即显示张宇，后台发起了 222 的网络请求）
    await loadPlaylistDetail('222');
    expect(playlistState.playlist?.name).toBe('张宇精选');

    // 3. 模拟“黄磊”慢速后台请求耗时 1s 后终于返回
    resolve111({
      code: '000000',
      data: {
        playlist: { id: 111, name: '后台最新黄磊', tracks: [{ id: 11, name: '边走边唱新版' }] }
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 关键断言：即使黄磊请求返回了，UI 也决不能跳回黄磊！张宇保持不变！
    expect(playlistState.playlist?.name).toBe('张宇精选');
    expect(playlistState.playlist?.id).toBe(222);
    // 但黄磊的本地离线缓存依然默默被更新了
    expect(getApiCache('playlist_111')?.data?.playlist?.name).toBe('后台最新黄磊');

    // 4. “张宇”请求返回
    resolve222({
      code: '000000',
      data: {
        playlist: { id: 222, name: '后台最新张宇', tracks: [{ id: 22, name: '用心良苦新版' }] }
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 当前处于张宇，张宇的最新数据成功应用
    expect(playlistState.playlist?.name).toBe('后台最新张宇');
    expect(playlistState.playlist?.id).toBe(222);
  });
});
