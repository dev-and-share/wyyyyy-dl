import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LyricModal from './LyricModal.svelte';
import { api } from '../lib/api';
import { skin } from '../lib/skinStore.svelte';

vi.mock('../lib/api', () => ({
  api: {
    songV1: vi.fn(),
    playlistAdd: vi.fn(),
    songStats: vi.fn().mockResolvedValue({ code: '000000', data: { redCount: 52000, commentCount: 13140 } }),
    songComments: vi.fn().mockResolvedValue({ code: '000000', data: { total: 0, hotComments: [], comments: [] } })
  }
}));

describe('LyricModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    skin._reset();
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

    // 默认展示经典黑胶舞台
    expect(document.querySelector('[data-testid="skin-stage-vinyl"]')).toBeInTheDocument();

    // 曲名旁与底部控制栏中的收藏按钮
    const addBtns = getAllByTitle(/收藏/);
    expect(addBtns.length).toBeGreaterThan(0);

    // 点击收藏当前歌曲
    await fireEvent.click(addBtns[0]);

    await waitFor(() => {
      expect(getByText('添加歌曲到歌单')).toBeInTheDocument();
    });
  });

  it('opens skin picker sheet and dynamically switches player skins', async () => {
    const { getByTestId, getByText, queryByTestId } = render(LyricModal, {
      props: {
        track: mockTrack,
        currentTime: 30,
        duration: 200,
        playing: true,
        playMode: 'list',
        isLiked: false,
        onTogglePlay: vi.fn(),
        onPrev: vi.fn(),
        onNext: vi.fn(),
        onToggleMode: vi.fn(),
        onSeek: vi.fn(),
        onSeekTime: vi.fn(),
        onToggleLike: vi.fn(),
        onTogglePeq: vi.fn(),
        onToggleDrawer: vi.fn(),
        onClose: vi.fn()
      }
    });

    // 初始黑胶
    expect(getByTestId('skin-stage-vinyl')).toBeInTheDocument();

    // 点击 🎨 入口打开换肤面板
    const pickerBtn = getByTestId('btn-open-skin-picker');
    await fireEvent.click(pickerBtn);

    expect(getByTestId('skin-picker-sheet')).toBeInTheDocument();

    // 点击灵动极光
    const auroraCard = getByText('灵动极光');
    await fireEvent.click(auroraCard);
    expect(skin.current).toBe('aurora');

    await waitFor(() => {
      expect(getByTestId('skin-stage-aurora')).toBeInTheDocument();
      expect(queryByTestId('skin-stage-vinyl')).toBeNull();
    });

    // 点击复古磁带
    const cassetteCard = getByText('复古磁带');
    await fireEvent.click(cassetteCard);
    expect(skin.current).toBe('cassette');

    await waitFor(() => {
      expect(getByTestId('skin-stage-cassette')).toBeInTheDocument();
      expect(queryByTestId('skin-stage-aurora')).toBeNull();
    });

    // 点击 Winamp 经典
    const winampCard = getByText('Winamp 经典');
    await fireEvent.click(winampCard);
    expect(skin.current).toBe('winamp');

    await waitFor(() => {
      expect(getByTestId('skin-stage-winamp')).toBeInTheDocument();
      expect(queryByTestId('skin-stage-cassette')).toBeNull();
    });
  });
});
