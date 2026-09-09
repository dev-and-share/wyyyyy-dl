import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PlaylistDrawer from './PlaylistDrawer.svelte';
import { taskState } from '../lib/taskStore.svelte';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    downloadSingle: vi.fn().mockResolvedValue({
      code: '000000',
      data: { status: 'PENDING', name: '趁早' }
    })
  }
}));

describe('PlaylistDrawer Collector Mode (Pending Download)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    taskState.downloadedSet = new Set([101, 102]);
  });

  const mockQueue = [
    { id: 101, name: '雨一直下', artist: '张宇', isLocal: false },
    { id: 102, name: '月亮惹的祸', artist: '张宇', isLocal: false },
    { id: 103, name: '趁早', artist: '张宇', isLocal: false } // 待下载
  ];

  it('correctly calculates pending download count as 1', () => {
    const { getByText } = render(PlaylistDrawer, {
      props: {
        queue: mockQueue,
        qIndex: 0,
        tasks: [],
        likedSet: new Set<number>(),
        autoSkipTrial: true,
        serverOnly: false,
        offlineOnly: false,
        downloadedSet: taskState.downloadedSet,
        onPlayIndex: vi.fn(),
        onClearQueue: vi.fn(),
        onRemoveItem: vi.fn(),
        onToggleLike: vi.fn(),
        onToggleAutoSkip: vi.fn(),
        onToggleServerOnly: vi.fn(),
        onToggleOfflineOnly: vi.fn(),
        onClearTasks: vi.fn(),
        onReveal: vi.fn(),
        onClose: vi.fn()
      }
    });

    expect(getByText('待下载 1')).toBeInTheDocument();
  });

  it('filters to only pending tracks when clicking "待下载 1" tab', async () => {
    const { getByText, queryByText } = render(PlaylistDrawer, {
      props: {
        queue: mockQueue,
        qIndex: 0,
        tasks: [],
        likedSet: new Set<number>(),
        autoSkipTrial: true,
        serverOnly: false,
        offlineOnly: false,
        downloadedSet: taskState.downloadedSet,
        onPlayIndex: vi.fn(),
        onClearQueue: vi.fn(),
        onRemoveItem: vi.fn(),
        onToggleLike: vi.fn(),
        onToggleAutoSkip: vi.fn(),
        onToggleServerOnly: vi.fn(),
        onToggleOfflineOnly: vi.fn(),
        onClearTasks: vi.fn(),
        onReveal: vi.fn(),
        onClose: vi.fn()
      }
    });

    const pendingTab = getByText('待下载 1');
    await fireEvent.click(pendingTab);

    expect(getByText(/趁早/)).toBeInTheDocument();
    expect(queryByText(/雨一直下/)).toBeNull();
    expect(queryByText(/月亮惹的祸/)).toBeNull();
  });

  it('triggers api.downloadSingle and dispatches event when clicking fast download button', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const { getByTitle } = render(PlaylistDrawer, {
      props: {
        queue: mockQueue,
        qIndex: 0,
        tasks: [],
        likedSet: new Set<number>(),
        autoSkipTrial: true,
        serverOnly: false,
        offlineOnly: false,
        downloadedSet: taskState.downloadedSet,
        onPlayIndex: vi.fn(),
        onClearQueue: vi.fn(),
        onRemoveItem: vi.fn(),
        onToggleLike: vi.fn(),
        onToggleAutoSkip: vi.fn(),
        onToggleServerOnly: vi.fn(),
        onToggleOfflineOnly: vi.fn(),
        onClearTasks: vi.fn(),
        onReveal: vi.fn(),
        onClose: vi.fn()
      }
    });

    const downloadBtn = getByTitle('快速下载到服务器磁盘');
    expect(downloadBtn).toBeInTheDocument();
    await fireEvent.click(downloadBtn);

    expect(api.downloadSingle).toHaveBeenCalledWith('103');
    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'wyyyy:download-submitted' }));
    });
  });

  it('triggers onShuffle when clicking shuffle button in drawer header', async () => {
    const mockOnShuffle = vi.fn();

    const { getByTitle } = render(PlaylistDrawer, {
      props: {
        queue: mockQueue,
        qIndex: 0,
        tasks: [],
        likedSet: new Set<number>(),
        autoSkipTrial: true,
        serverOnly: false,
        offlineOnly: false,
        downloadedSet: taskState.downloadedSet,
        onPlayIndex: vi.fn(),
        onClearQueue: vi.fn(),
        onRemoveItem: vi.fn(),
        onToggleLike: vi.fn(),
        onToggleAutoSkip: vi.fn(),
        onToggleServerOnly: vi.fn(),
        onToggleOfflineOnly: vi.fn(),
        onClearTasks: vi.fn(),
        onShuffle: mockOnShuffle,
        onReveal: vi.fn(),
        onClose: vi.fn()
      }
    });

    const shuffleBtn = getByTitle('WYSIWYG 洗牌：当前歌曲置顶，剩余曲目随机重排');
    expect(shuffleBtn).toBeInTheDocument();
    await fireEvent.click(shuffleBtn);

    expect(mockOnShuffle).toHaveBeenCalledTimes(1);
  });
});
