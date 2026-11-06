import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskQueueView from './TaskQueueView.svelte';
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

  it('renders retry button for failed tasks and triggers downloadSingle', async () => {
    const mockTasks = [
      { id: 201, name: '高山低谷', status: 'FAILED', errorMsg: '分析歌曲URL失败' },
      { id: 202, name: '水手', status: 'SUCCESS' }
    ];

    const { getByText, getByTitle } = render(TaskQueueView, {
      props: {
        tasks: mockTasks,
        onReveal: vi.fn()
      }
    });

    expect(getByText('高山低谷')).toBeInTheDocument();
    expect(getByText('分析歌曲URL失败')).toBeInTheDocument();

    const retryBtn = getByTitle('重试');
    expect(retryBtn).toBeInTheDocument();

    await fireEvent.click(retryBtn);
    expect(api.downloadSingle).toHaveBeenCalledWith('201');
  });
});
