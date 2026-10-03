import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DesktopDailyRecommendDetail from './DesktopDailyRecommendDetail.svelte';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    recommendSongs: vi.fn(),
    downloadBatch: vi.fn(),
    downloadSingle: vi.fn(),
    playlistTracks: vi.fn(),
    playlistCreate: vi.fn()
  }
}));

describe('DesktopDailyRecommendDetail Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const mockSongs = [
    {
      id: 101,
      name: '晴天',
      artists: '周杰伦',
      album: { id: 1, name: '叶惠美', picUrl: 'https://example.com/cover1.jpg' },
      isLocal: false
    },
    {
      id: 102,
      name: '一路向北',
      artists: '周杰伦',
      album: { id: 2, name: '十一月的萧邦', picUrl: 'https://example.com/cover2.jpg' },
      isLocal: false
    }
  ];

  it('renders daily recommend songs list and triggers play all', async () => {
    (api.recommendSongs as any).mockResolvedValue({
      code: '000000',
      data: mockSongs
    });

    const onPlayQueue = vi.fn();
    const onBackToGallery = vi.fn();
    const showToast = vi.fn();

    const { getByTestId, findByText } = render(DesktopDailyRecommendDetail, {
      props: {
        curTrack: null,
        playing: false,
        likedSet: new Set<number>(),
        onBackToGallery,
        onPlayQueue,
        showToast
      }
    });

    // 检查加载调用与歌曲渲染
    expect(api.recommendSongs).toHaveBeenCalled();
    const songName = await findByText('晴天');
    expect(songName).toBeDefined();

    // 检查返回画廊按钮
    const backBtn = getByTestId('btn-back-gallery');
    await fireEvent.click(backBtn);
    expect(onBackToGallery).toHaveBeenCalledTimes(1);

    // 检查播放全部按钮
    const playAllBtn = getByTestId('btn-play-all-recommend');
    await fireEvent.click(playAllBtn);
    expect(onPlayQueue).toHaveBeenCalledTimes(1);
    expect(onPlayQueue.mock.calls[0][0]).toHaveLength(2);
  });

  it('handles batch download action', async () => {
    (api.recommendSongs as any).mockResolvedValue({
      code: '000000',
      data: mockSongs
    });
    (api.downloadSingle as any).mockResolvedValue({
      code: '000000',
      msg: 'success'
    });

    const showToast = vi.fn();

    const { getByTestId, findByText } = render(DesktopDailyRecommendDetail, {
      props: {
        onBackToGallery: vi.fn(),
        showToast
      }
    });

    await findByText('一路向北');

    const downloadAllBtn = getByTestId('btn-download-all-recommend');
    await fireEvent.click(downloadAllBtn);

    expect(api.downloadSingle).toHaveBeenCalledWith('101');
    expect(api.downloadSingle).toHaveBeenCalledWith('102');
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('已提交 2 首歌曲'), 'success');
    });
  });
});
