import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SongDetailModal from './SongDetailModal.svelte';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    songV1: vi.fn(),
    downloadSingle: vi.fn(),
    playlistAdd: vi.fn()
  }
}));

describe('SongDetailModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and displays song details and allows quality switching', async () => {
    const mockSong = {
      id: '202',
      name: '晴天',
      ar: [{ name: '周杰伦' }],
      al_name: '叶惠美',
      al_id: '1001',
      size: '35.4MB',
      level: 'lossless',
      picUrl: 'https://example.com/qingtian.jpg',
      lyric: '[00:00.00] 故事的小黄花'
    };

    (api.songV1 as any).mockResolvedValue({
      code: '000000',
      data: mockSong
    });

    const onPlayQueue = vi.fn();
    const onToggleLike = vi.fn();
    const onClose = vi.fn();
    const showToast = vi.fn();

    const { getByText, getAllByText, getByRole, getByTitle } = render(SongDetailModal, {
      props: {
        songId: '202',
        likedSet: new Set([202]),
        onToggleLike,
        onPlayQueue,
        onAlbum: vi.fn(),
        onClose,
        showToast
      }
    });

    // 验证初始按无损 (lossless) 请求
    expect(api.songV1).toHaveBeenCalledWith('202', 'lossless');

    // 等待歌曲信息渲染
    await waitFor(() => {
      expect(getByText('晴天')).toBeInTheDocument();
    });

    expect(getAllByText(/周杰伦/).length).toBeGreaterThan(0);
    expect(getAllByText(/叶惠美/).length).toBeGreaterThan(0);
    expect(getAllByText(/35.4MB/).length).toBeGreaterThan(0);
    expect(getAllByText(/故事的小黄花/).length).toBeGreaterThan(0);

    // 验证切换音质
    const select = getByRole('combobox');
    await fireEvent.change(select, { target: { value: 'standard' } });
    expect(api.songV1).toHaveBeenCalledWith('202', 'standard');

    // 验证试听按钮触发播放
    const playBtn = getByRole('button', { name: /立即试听/i });
    await fireEvent.click(playBtn);
    expect(onPlayQueue).toHaveBeenCalled();

    // 验证已设喜欢按钮状态并触发取消
    const likeBtn = getByRole('button', { name: /已设喜欢/i });
    await fireEvent.click(likeBtn);
    expect(onToggleLike).toHaveBeenCalledWith(202, '晴天', '周杰伦');
  });

  it('triggers downloadSingle when clicking download button', async () => {
    (api.songV1 as any).mockResolvedValue({
      code: '000000',
      data: {
        id: '303',
        name: '夜曲',
        ar: [{ name: '周杰伦' }]
      }
    });

    (api.downloadSingle as any).mockResolvedValue({
      data: { name: '夜曲', status: 'SUCCESS' }
    });

    const showToast = vi.fn();
    const { getByRole } = render(SongDetailModal, {
      props: {
        songId: '303',
        onClose: vi.fn(),
        showToast
      }
    });

    await waitFor(() => {
      expect(getByRole('button', { name: /下载单曲/i })).toBeInTheDocument();
    });

    const downloadBtn = getByRole('button', { name: /下载单曲/i });
    await fireEvent.click(downloadBtn);

    expect(api.downloadSingle).toHaveBeenCalledWith('303');
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('夜曲'), 'success');
    });
  });
});
