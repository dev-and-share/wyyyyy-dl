import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LyricModal from './LyricModal.svelte';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    songV1: vi.fn(),
    playlistAdd: vi.fn()
  }
}));

describe('LyricModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTrack = {
    id: '888',
    name: '晴天',
    artist: '周杰伦',
    cover: 'https://example.com/cover.jpg',
    lyric: '[00:00.00] 故事的小黄花\n[00:02.00] 从出生那年就飘着'
  };

  it('renders immersive player and opens AddToPlaylistModal when clicking add-to-playlist button', async () => {
    const onTogglePlay = vi.fn();
    const onToggleLike = vi.fn();
    const onClose = vi.fn();

    const { getByText, getAllByTitle } = render(LyricModal, {
      props: {
        track: mockTrack,
        currentTime: 0,
        duration: 269,
        playing: true,
        playMode: 'list',
        isLiked: false,
        onTogglePlay,
        onPrev: vi.fn(),
        onNext: vi.fn(),
        onToggleMode: vi.fn(),
        onSeek: vi.fn(),
        onSeekTime: vi.fn(),
        onToggleLike,
        onTogglePeq: vi.fn(),
        onToggleDrawer: vi.fn(),
        onClose
      }
    });

    expect(getByText(/全屏沉浸播放/)).toBeInTheDocument();
    expect(getByText('晴天')).toBeInTheDocument();
    expect(getByText('周杰伦')).toBeInTheDocument();

    // 曲名旁与底部控制栏中的收藏按钮
    const addBtns = getAllByTitle(/收藏/);
    expect(addBtns.length).toBeGreaterThan(0);

    // 点击收藏当前歌曲
    await fireEvent.click(addBtns[0]);

    await waitFor(() => {
      expect(getByText('添加歌曲到歌单')).toBeInTheDocument();
    });
  });
});
