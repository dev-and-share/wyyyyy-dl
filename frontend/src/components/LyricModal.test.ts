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

    const { getByText, getAllByTitle, getByTestId, getByTitle } = render(LyricModal, {
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

    expect(getByTestId('btn-open-skin-picker')).toBeInTheDocument();
    expect(getByTitle(/关闭/)).toBeInTheDocument();
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

    // 点击 Winamp
    const winampCard = getByText('Winamp');
    await fireEvent.click(winampCard);
    expect(skin.current).toBe('winamp');

    await waitFor(() => {
      expect(getByTestId('skin-stage-winamp')).toBeInTheDocument();
      expect(queryByTestId('skin-stage-cassette')).toBeNull();
    });

    // 点击春日青绿
    const springCard = getByText('春日青绿');
    await fireEvent.click(springCard);
    expect(skin.current).toBe('spring');

    await waitFor(() => {
      expect(getByTestId('skin-stage-spring')).toBeInTheDocument();
      expect(queryByTestId('skin-stage-winamp')).toBeNull();
    });

    // 点击春樱初绽 (sakura)
    const sakuraCard = getByText('春樱初绽');
    await fireEvent.click(sakuraCard);
    expect(skin.current).toBe('sakura');

    await waitFor(() => {
      expect(getByTestId('skin-stage-sakura')).toBeInTheDocument();
      expect(queryByTestId('skin-stage-spring')).toBeNull();
    });

    // 点击盛夏晴空 (summer)
    const summerCard = getByText('盛夏晴空');
    await fireEvent.click(summerCard);
    expect(skin.current).toBe('summer');

    await waitFor(() => {
      expect(getByTestId('skin-stage-summer')).toBeInTheDocument();
      expect(queryByTestId('skin-stage-sakura')).toBeNull();
    });

    // 点击金秋落叶 (autumn)
    const autumnCard = getByText('金秋落叶');
    await fireEvent.click(autumnCard);
    expect(skin.current).toBe('autumn');

    await waitFor(() => {
      expect(getByTestId('skin-stage-autumn')).toBeInTheDocument();
      expect(queryByTestId('skin-stage-summer')).toBeNull();
    });

    // 点击凛冬初雪 (winter)
    const winterCard = getByText('凛冬初雪');
    await fireEvent.click(winterCard);
    expect(skin.current).toBe('winter');

    await waitFor(() => {
      expect(getByTestId('skin-stage-winter')).toBeInTheDocument();
      expect(queryByTestId('skin-stage-autumn')).toBeNull();
    });
  });

  it('renders low-key mini player and handles hover control logic on bottom player bar', async () => {
    vi.useFakeTimers();
    const onTogglePlay = vi.fn();
    const onPrev = vi.fn();
    const onNext = vi.fn();

    const { getByTestId } = render(LyricModal, {
      props: {
        track: mockTrack,
        currentTime: 45,
        duration: 200,
        playing: true,
        playMode: 'list',
        isLiked: false,
        onTogglePlay,
        onPrev,
        onNext,
        onToggleMode: vi.fn(),
        onSeek: vi.fn(),
        onSeekTime: vi.fn(),
        onToggleLike: vi.fn(),
        onTogglePeq: vi.fn(),
        onToggleDrawer: vi.fn(),
        onClose: vi.fn()
      }
    });

    // 验证低调 mini 播放器控制面板已渲染
    expect(getByTestId('immersive-mini-player')).toBeInTheDocument();
    const miniPlayBtn = getByTestId('mini-btn-play');
    await fireEvent.click(miniPlayBtn);
    expect(onTogglePlay).toHaveBeenCalledTimes(1);

    // 验证底部控制面板与贴底感应区
    const bottomControls = getByTestId('immersive-bottom-controls');
    const bottomTrigger = getByTestId('immersive-bottom-progress-trigger');

    // 初始状态 uiVisible 为 true
    expect(bottomControls.className).toContain('opacity-100');

    // 鼠标 mouseenter 到底部控制栏，保持显示并不应在 3.2s 后消失
    await fireEvent.mouseEnter(bottomControls);
    vi.advanceTimersByTime(4000);
    expect(bottomControls.className).toContain('opacity-100');

    // 鼠标移出底部控制栏，启动 3.2s 渐隐倒计时
    await fireEvent.mouseLeave(bottomControls);
    vi.advanceTimersByTime(3500);
    await waitFor(() => {
      expect(bottomControls.className).toContain('opacity-0');
    });

    // 鼠标悬停贴底进度条感应区（mouse on 触发显示）
    await fireEvent.mouseEnter(bottomTrigger);
    await waitFor(() => {
      expect(bottomControls.className).toContain('opacity-100');
    });

    vi.useRealTimers();
  });

  it('dynamically switches meta theme-color to dark on mount and restores on unmount', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    skin.set('spring');
    // 白天模式下普通浏览：浅色
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f0fdf4');

    const { unmount } = render(LyricModal, {
      props: {
        track: mockTrack,
        currentTime: 0,
        duration: 269,
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

    // 挂载后：强制切为深色，以彻底消除 Chrome WCO 左右两侧白块门牙
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#06140f');
    expect(document.documentElement.style.getPropertyValue('--wco-titlebar-bg')).toBe('#06140f');

    // 卸载后：自动恢复白天模式浅色
    unmount();
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f0fdf4');
    expect(document.documentElement.style.getPropertyValue('--wco-titlebar-bg')).toBe('#f0fdf4');

    document.documentElement.removeAttribute('data-theme');
  });
});
