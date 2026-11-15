import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BottomSheet from './BottomSheet.svelte';
import { sheetState, openSheet, closeSheet } from '../lib/ui.svelte';

describe('BottomSheet Component', () => {
  beforeEach(() => {
    closeSheet();
    vi.useRealTimers();
  });

  it('renders nothing when sheetState.data is null', () => {
    const { container } = render(BottomSheet);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders title, subtitle, actions and default cancel button', () => {
    const mockAction = vi.fn();
    openSheet({
      title: '周杰伦',
      subtitle: '我创建的歌单 · 54 首',
      actions: [
        {
          label: '▶️ 立即播放整张歌单',
          style: 'primary',
          onclick: mockAction
        }
      ]
    });

    const { getByText, getByRole } = render(BottomSheet);
    expect(getByText('周杰伦')).toBeInTheDocument();
    expect(getByText('我创建的歌单 · 54 首')).toBeInTheDocument();
    expect(getByText('▶️ 立即播放整张歌单')).toBeInTheDocument();
    // 兜底取消按钮
    expect(getByText('取消')).toBeInTheDocument();
    expect(getByRole('dialog')).toBeInTheDocument();
  });

  it('closes when clicking the cancel button', async () => {
    openSheet({
      title: '测试歌单',
      actions: [
        {
          label: '操作1',
          onclick: vi.fn()
        }
      ]
    });

    const { getByText } = render(BottomSheet);
    const cancelBtn = getByText('取消');
    await fireEvent.click(cancelBtn);

    // 等待 200ms 关闭动画后 sheetState.data 置空
    await new Promise((r) => setTimeout(r, 260));
    expect(sheetState.data).toBeNull();
  });

  it('closes when clicking the close (X) button', async () => {
    openSheet({
      title: '测试歌单',
      actions: []
    });

    const { getByTestId } = render(BottomSheet);
    const closeBtn = getByTestId('bottom-sheet-close-btn');
    await fireEvent.click(closeBtn);

    await new Promise((r) => setTimeout(r, 260));
    expect(sheetState.data).toBeNull();
  });

  it('closes when clicking the backdrop', async () => {
    openSheet({
      title: '测试歌单',
      actions: []
    });

    const { container } = render(BottomSheet);
    const backdrop = container.querySelector('.fixed.inset-0') as HTMLElement;
    expect(backdrop).not.toBeNull();
    await fireEvent.click(backdrop);

    await new Promise((r) => setTimeout(r, 260));
    expect(sheetState.data).toBeNull();
  });

  it('does not duplicate cancel button if actions already contain one', () => {
    openSheet({
      title: '测试歌单',
      actions: [
        {
          label: '放弃操作',
          style: 'cancel',
          onclick: vi.fn()
        }
      ]
    });

    const { queryByText, getByText } = render(BottomSheet);
    expect(getByText('放弃操作')).toBeInTheDocument();
    expect(queryByText('取消')).toBeNull();
  });
});
