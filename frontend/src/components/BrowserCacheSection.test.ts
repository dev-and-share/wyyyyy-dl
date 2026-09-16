import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BrowserCacheSection from './BrowserCacheSection.svelte';
import * as cacheHelper from '../lib/browserCacheHelper';

const mockList: cacheHelper.BrowserCacheItem[] = [
  {
    key: 'song_1',
    id: '1',
    urls: ['/v3/stream?id=1'],
    relUrls: ['/v3/stream?id=1'],
    relUrl: '/v3/stream?id=1',
    name: '晴天',
    artist: '周杰伦',
    size: 5000000,
    time: 1000,
    playCount: 5
  },
  {
    key: 'song_2',
    id: '2',
    urls: ['/v3/stream?id=2'],
    relUrls: ['/v3/stream?id=2'],
    relUrl: '/v3/stream?id=2',
    name: '七里香',
    artist: '周杰伦',
    size: 4000000,
    time: 2000,
    playCount: 2
  },
  {
    key: 'song_3',
    id: '3',
    urls: ['/v3/stream?id=3'],
    relUrls: ['/v3/stream?id=3'],
    relUrl: '/v3/stream?id=3',
    name: '稻香',
    artist: '周杰伦',
    size: 3000000,
    time: 3000,
    playCount: 0
  }
];

describe('BrowserCacheSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (window as any).caches = {
      keys: vi.fn().mockResolvedValue(['audio-cache-v1'])
    };
  });

  it('renders Play All and Play >= N buttons, and plays all cached tracks on click', async () => {
    vi.spyOn(cacheHelper, 'scanBrowserCache').mockResolvedValue({
      list: mockList,
      totalBytes: 12000000
    });

    const mockPlayQueue = vi.fn();
    const mockShowToast = vi.fn();

    const { getByTestId, findByText } = render(BrowserCacheSection, {
      props: {
        onPlayQueue: mockPlayQueue,
        showToast: mockShowToast
      }
    });

    await findByText('晴天');

    const playAllBtn = getByTestId('btn-cache-play-all');
    expect(playAllBtn).toBeInTheDocument();
    expect(playAllBtn).not.toBeDisabled();

    await fireEvent.click(playAllBtn);

    expect(mockPlayQueue).toHaveBeenCalledTimes(1);
    const queue = mockPlayQueue.mock.calls[0][0];
    expect(queue.length).toBe(3);
    expect(queue[0].id).toBe('1');
    expect(queue[1].id).toBe('2');
    expect(queue[2].id).toBe('3');
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('已开始播放全部离线歌曲'), 'success', 2000);
  });

  it('filters tracks by play count threshold and plays on click', async () => {
    vi.spyOn(cacheHelper, 'scanBrowserCache').mockResolvedValue({
      list: mockList,
      totalBytes: 12000000
    });

    const mockPlayQueue = vi.fn();
    const mockShowToast = vi.fn();

    const { getByTestId, findByText } = render(BrowserCacheSection, {
      props: {
        onPlayQueue: mockPlayQueue,
        showToast: mockShowToast
      }
    });

    await findByText('晴天');

    const playFilteredBtn = getByTestId('btn-cache-play-filtered');
    const inputThreshold = getByTestId('input-cache-play-min');

    // Default minPlayCount is 1 -> Should include song 1 (5) and song 2 (2), excluding song 3 (0)
    await fireEvent.click(playFilteredBtn);

    expect(mockPlayQueue).toHaveBeenCalledTimes(1);
    const queue1 = mockPlayQueue.mock.calls[0][0];
    expect(queue1.length).toBe(2);
    expect(queue1.map((t: any) => t.id)).toEqual(['1', '2']);
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('≥ 1 次，共 2 首'), 'success', 2000);

    // Change threshold to 4 -> Should only include song 1 (5)
    await fireEvent.input(inputThreshold, { target: { value: '4' } });
    await fireEvent.click(playFilteredBtn);

    expect(mockPlayQueue).toHaveBeenCalledTimes(2);
    const queue2 = mockPlayQueue.mock.calls[1][0];
    expect(queue2.length).toBe(1);
    expect(queue2[0].id).toBe('1');

    // Change threshold to 10 -> Should have no matching songs
    await fireEvent.input(inputThreshold, { target: { value: '10' } });
    await fireEvent.click(playFilteredBtn);

    expect(mockPlayQueue).toHaveBeenCalledTimes(2); // No new play queue
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('当前没有播放次数 ≥ 10 次的离线歌曲'), 'info', 2000);
  });
});
