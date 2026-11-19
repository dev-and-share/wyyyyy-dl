import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskQueueView from './TaskQueueView.svelte';
import { playerStore } from '../lib/playerStore.svelte';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    downloadSingle: vi.fn().mockResolvedValue({
      code: '000000',
      data: { status: 'PENDING' }
    }),
    tasks: vi.fn().mockResolvedValue({
      code: '000000',
      data: []
    })
  }
}));

describe('TaskQueueView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders retry, preview and force-save button for failed tasks and triggers actions', async () => {
    const mockTasks = [
      { id: 201, name: '高山低谷', status: 'FAILED', errorMsg: '该歌曲未成功获取有效完整音频(大小: 1088074 字节)，已自动阻止落盘与入库' },
      { id: 202, name: '水手', status: 'SUCCESS' }
    ];

    const { getByText, getByTestId } = render(TaskQueueView, {
      props: {
        tasks: mockTasks,
        onReveal: vi.fn()
      }
    });

    expect(getByText('高山低谷')).toBeInTheDocument();
    expect(getByText(/该歌曲未成功获取有效完整音频/)).toBeInTheDocument();

    const previewBtn = getByTestId('btn-preview-task');
    const forceBtn = getByTestId('btn-force-download-task');
    const retryBtn = getByTestId('btn-retry-task');

    expect(previewBtn).toBeInTheDocument();
    expect(forceBtn).toBeInTheDocument();
    expect(retryBtn).toBeInTheDocument();

    const spySetQueue = vi.spyOn(playerStore, 'setQueue');
    await fireEvent.click(previewBtn);
    expect(spySetQueue).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: '201',
          name: '高山低谷',
          allowTrial: true,
          isLocal: false
        })
      ],
      0
    );

    await fireEvent.click(forceBtn);
    expect(api.downloadSingle).toHaveBeenCalledWith('201', true);
  });
});
