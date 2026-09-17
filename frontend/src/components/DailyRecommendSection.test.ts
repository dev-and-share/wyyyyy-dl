import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DailyRecommendSection from './DailyRecommendSection.svelte';
import { api } from '../lib/api';
import { setLastBackupPlaylist } from '../lib/playlist.svelte';

vi.mock('../lib/api', () => ({
  api: {
    recommendSongs: vi.fn(),
    playlistAdd: vi.fn(),
    downloadSingle: vi.fn()
  }
}));

describe('DailyRecommendSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const mockSongs = [
    {
      id: 101,
      name: '七里香',
      artists: '周杰伦',
      album: '七里香',
      reason: '根据你喜欢的《晴天》推荐',
      picUrl: 'https://example.com/cover1.jpg',
      isLocal: false
    },
    {
      id: 102,
      name: '爱在西元前',
      artists: '周杰伦',
      album: '范特西',
      reason: '根据你的常听推荐',
      picUrl: 'https://example.com/cover2.jpg',
      isLocal: false
    }
  ];

  it('renders recommend songs and allows play all', async () => {
    (api.recommendSongs as any).mockResolvedValue({
      code: '000000',
      data: mockSongs
    });

    const onPlayQueue = vi.fn();
    const showToast = vi.fn();

    const { container, getByText, getByRole } = render(DailyRecommendSection, {
      props: {
        open: true,
        onToggle: vi.fn(),
        onPlayQueue,
        showToast
      }
    });

    expect(api.recommendSongs).toHaveBeenCalled();

    await waitFor(() => {
      expect(container.textContent).toContain('七里香');
      expect(container.textContent).toContain('爱在西元前');
      expect(getByText('根据你喜欢的《晴天》推荐')).toBeInTheDocument();
    });

    // 播放全部
    const playAllBtn = getByText('播放全部');
    await fireEvent.click(playAllBtn);
    expect(onPlayQueue).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('已开始连播今日推荐'), 'success');
  });

  it('supports one-click backup to remembered playlist', async () => {
    // 预设上次备份的歌单
    setLastBackupPlaylist('99999', '我的私藏日推');

    (api.recommendSongs as any).mockResolvedValue({
      code: '000000',
      data: mockSongs
    });
    (api.playlistAdd as any).mockResolvedValue({
      code: '000000',
      msg: 'success'
    });

    const showToast = vi.fn();

    const { container, getByText } = render(DailyRecommendSection, {
      props: {
        open: true,
        onToggle: vi.fn(),
        showToast
      }
    });

    await waitFor(() => {
      expect(container.textContent).toContain('七里香');
    });

    // 应该显示备份到「我的私藏日推」
    const backupBtn = getByText('备份到「我的私藏日推」');
    expect(backupBtn).toBeInTheDocument();

    await fireEvent.click(backupBtn);

    // 应该批量将 101,102 添加到 99999
    expect(api.playlistAdd).toHaveBeenCalledWith('99999', '101,102');

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('备份到「我的私藏日推」'), 'success');
    });
  });
});
