import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SegmentedTabs, { type SegmentItem } from './SegmentedTabs.svelte';

describe('SegmentedTabs Component', () => {
  const items: SegmentItem[] = [
    { id: 'my', label: '我的歌单', icon: '📋', accent: 'red' },
    { id: 'detail', label: '歌单详情', icon: '🎼', accent: 'blue' },
    { id: 'recommend', label: '每日推荐', icon: '📅', accent: 'amber' }
  ];

  it('renders all tab buttons with labels and icons', () => {
    const { getByText } = render(SegmentedTabs, {
      props: {
        items,
        activeId: 'my',
        onChange: () => {}
      }
    });

    expect(getByText('我的歌单')).toBeDefined();
    expect(getByText('歌单详情')).toBeDefined();
    expect(getByText('每日推荐')).toBeDefined();
    expect(getByText('📋')).toBeDefined();
  });

  it('calls onChange callback when clicking an inactive tab', async () => {
    const onChange = vi.fn();
    const { getByText } = render(SegmentedTabs, {
      props: {
        items,
        activeId: 'my',
        onChange
      }
    });

    const detailBtn = getByText('歌单详情').closest('button');
    expect(detailBtn).toBeDefined();
    await fireEvent.click(detailBtn!);

    expect(onChange).toHaveBeenCalledWith('detail');
  });

  it('highlights the active tab with the proper accent style', () => {
    const { getByText } = render(SegmentedTabs, {
      props: {
        items,
        activeId: 'detail',
        onChange: () => {}
      }
    });

    const detailBtn = getByText('歌单详情').closest('button');
    expect(detailBtn?.className).toContain('from-sky-500');
  });
});
