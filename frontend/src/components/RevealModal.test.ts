import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RevealModal from './RevealModal.svelte';
import * as browserCacheHelper from '../lib/library/browserCacheHelper';

vi.mock('../lib/library/browserCacheHelper', async () => {
  const actual = await vi.importActual<any>('../lib/library/browserCacheHelper');
  return {
    ...actual,
    getTrackBrowserCacheInfo: vi.fn(),
    removeTrackBrowserCache: vi.fn()
  };
});

describe('RevealModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders physical file path and macOS terminal command when path is provided', () => {
    (browserCacheHelper.getTrackBrowserCacheInfo as any).mockResolvedValue({
      isCached: false,
      size: 0
    });

    const onClose = vi.fn();
    const showToast = vi.fn();

    const { getByText } = render(RevealModal, {
      props: {
        path: '/Users/houtokki/Downloads/fast_sr/__曲库__/林俊杰 - 她说.mp3',
        msg: '🚀 已为您在系统文件管理器中定位物理文件！',
        onClose,
        showToast
      }
    });

    expect(getByText('/Users/houtokki/Downloads/fast_sr/__曲库__/林俊杰 - 她说.mp3')).toBeDefined();
    expect(getByText(/林俊杰 - 她说\.mp3"/)).toBeDefined();
  });

  it('shows browser offline cache size and allows clearing single track cache', async () => {
    // 模拟检测到 2.73 MB (2862612 bytes) 离线缓存
    (browserCacheHelper.getTrackBrowserCacheInfo as any).mockResolvedValue({
      isCached: true,
      size: 2862612
    });
    (browserCacheHelper.removeTrackBrowserCache as any).mockResolvedValue(true);

    const onClose = vi.fn();
    const showToast = vi.fn();

    const { getByText, getByTitle } = render(RevealModal, {
      props: {
        path: '/Users/houtokki/Downloads/fast_sr/__曲库__/林俊杰 - 她说.mp3',
        msg: '🚀 已为您在系统文件管理器中定位物理文件！',
        songId: 108242,
        songName: '她说',
        onClose,
        showToast
      }
    });

    await waitFor(() => {
      expect(getByText(/浏览器离线缓存/)).toBeDefined();
      expect(getByText(/2\.73 MB/)).toBeDefined();
    });

    const clearBtn = getByTitle(/清除此歌缓存/);
    expect(clearBtn).toBeDefined();

    await fireEvent.click(clearBtn);

    expect(browserCacheHelper.removeTrackBrowserCache).toHaveBeenCalledWith(108242);
    expect(showToast).toHaveBeenCalledWith('已清除该歌曲的浏览器离线缓存', 'success');
  });

  it('gracefully renders when song is only cached in browser without server physical file', async () => {
    (browserCacheHelper.getTrackBrowserCacheInfo as any).mockResolvedValue({
      isCached: true,
      size: 1500000
    });

    const onClose = vi.fn();
    const showToast = vi.fn();

    const { getByText, queryByText } = render(RevealModal, {
      props: {
        path: '',
        msg: '📲 本曲目当前保存在本机浏览器离线缓存中（服务器未下载物理文件）',
        songId: 66666,
        songName: '江南',
        isServer: false,
        isPhone: true,
        onClose,
        showToast
      }
    });

    expect(getByText(/本曲目当前保存在本机浏览器离线缓存中/)).toBeDefined();
    // 无物理文件时，不渲染 open -R 终端命令卡片
    expect(queryByText(/open -R/)).toBeNull();

    await waitFor(() => {
      expect(getByText(/浏览器离线缓存/)).toBeDefined();
    });
  });
});
