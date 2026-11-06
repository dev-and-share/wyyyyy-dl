import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DesktopTaskQueueWorkbench from './DesktopTaskQueueWorkbench.svelte';
import { taskState } from '../../lib/taskStore.svelte';
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
      { id: 101, name: '拯救', status: 'FAILED', errorMsg: '分析歌曲URL失败' },
      { id: 102, name: '晴天', status: 'SUCCESS', filePath: '/music/晴天.flac' },
      { id: 103, name: '乡间的小路', status: 'FAILED', errorMsg: '分析歌曲URL失败' }
    ];
  });

  it('renders tasks and failed items with retry buttons', async () => {
    const onReveal = vi.fn();
    const { getByText, getAllByTestId, getByTestId } = render(DesktopTaskQueueWorkbench, {
      props: {
        onReveal
      }
    });

    expect(getByText('拯救')).toBeInTheDocument();
    expect(getByText(/FAILED \(2\)/)).toBeInTheDocument();

    const retryAllBtn = getByTestId('btn-retry-all-failed');
    expect(retryAllBtn).toBeInTheDocument();

    const retryBtns = getAllByTestId('btn-retry-task');
    expect(retryBtns.length).toBe(2);

    await fireEvent.click(retryBtns[0]);
    expect(api.downloadSingle).toHaveBeenCalledWith('101');
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
