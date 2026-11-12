import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DesktopTaskQueueWorkbench from './DesktopTaskQueueWorkbench.svelte';
import { taskState } from '../../lib/taskStore.svelte';
import { playerStore } from '../../lib/playerStore.svelte';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    downloadSingle: vi.fn().mockResolvedValue({
      code: '000000',
      data: { status: 'PENDING' }
    }),
    tasks: vi.fn().mockResolvedValue({
      code: '000000',
      data: []
    }),
    tasksClear: vi.fn().mockResolvedValue({
      code: '000000'
    })
  }
}));

describe('DesktopTaskQueueWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    taskState.tasks = [
      { id: 101, name: '序曲', status: 'FAILED', errorMsg: '该歌曲未成功获取有效完整音频(大小: 1088074 字节)，已自动阻止落盘与入库' },
      { id: 102, name: '晴天', status: 'SUCCESS', filePath: '/music/晴天.flac' },
      { id: 103, name: '心火烧', status: 'FAILED', errorMsg: '该歌曲未成功获取有效完整音频(大小: 643283 字节)，已自动阻止落盘与入库' }
    ];
  });

  it('renders tasks and failed items with retry, preview and force-save buttons', async () => {
    const onReveal = vi.fn();
    const { getByText, getAllByTestId, getByTestId } = render(DesktopTaskQueueWorkbench, {
      props: {
        onReveal
      }
    });

    expect(getByText('序曲')).toBeInTheDocument();
    expect(getByText('心火烧')).toBeInTheDocument();
    expect(getByText(/FAILED \(2\)/)).toBeInTheDocument();

    const retryAllBtn = getByTestId('btn-retry-all-failed');
    expect(retryAllBtn).toBeInTheDocument();

    const previewBtns = getAllByTestId('btn-preview-task');
    expect(previewBtns.length).toBe(2);

    const forceBtns = getAllByTestId('btn-force-download-task');
    expect(forceBtns.length).toBe(2);

    const retryBtns = getAllByTestId('btn-retry-task');
    expect(retryBtns.length).toBe(2);

    // 点击重试
    await fireEvent.click(retryBtns[0]);
    expect(api.downloadSingle).toHaveBeenCalledWith('101');
  });

  it('triggers force download with force=true on force-save button click', async () => {
    const { getAllByTestId } = render(DesktopTaskQueueWorkbench, {
      props: {
        onReveal: vi.fn()
      }
    });

    const forceBtns = getAllByTestId('btn-force-download-task');
    expect(forceBtns.length).toBe(2);

    // 点击第二首歌曲的强制落盘
    await fireEvent.click(forceBtns[1]);
    expect(api.downloadSingle).toHaveBeenCalledWith('103', true);
  });

  it('triggers audition with allowTrial=true on preview button click', async () => {
    const spySetQueue = vi.spyOn(playerStore, 'setQueue');
    const { getAllByTestId } = render(DesktopTaskQueueWorkbench, {
      props: {
        onReveal: vi.fn()
      }
    });

    const previewBtns = getAllByTestId('btn-preview-task');
    await fireEvent.click(previewBtns[0]);

    expect(spySetQueue).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: '101',
          name: '序曲',
          allowTrial: true,
          isLocal: false
        })
      ],
      0
    );
  });

  it('triggers batch retry when clicking retry all failed', async () => {
    const { getByTestId } = render(DesktopTaskQueueWorkbench, {
      props: {
        onReveal: vi.fn()
      }
    });

    const retryAllBtn = getByTestId('btn-retry-all-failed');
    await fireEvent.click(retryAllBtn);

    await waitFor(() => {
      expect(api.downloadSingle).toHaveBeenCalledWith('101');
      expect(api.downloadSingle).toHaveBeenCalledWith('103');
    });
  });
});
