import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MusicFreeManageTab from './MusicFreeManageTab.svelte';
import { musicFreeStore } from '../../../lib/musicfree/musicFreeStore.svelte';

describe('MusicFreeManageTab', () => {
  const showToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    musicFreeStore.plugins = [
      {
        id: 'plug_1',
        name: '插件1',
        version: '1.0.0',
        author: 'Author 1',
        url: '',
        code: '',
        enabled: true,
        supportedSearchType: ['music']
      },
      {
        id: 'plug_2',
        name: '插件2',
        version: '1.0.0',
        author: 'Author 2',
        url: '',
        code: '',
        enabled: false,
        supportedSearchType: ['music']
      }
    ];
  });

  it('renders select all, deselect all, and invert buttons and triggers actions', async () => {
    const { getByRole, getByText } = render(MusicFreeManageTab, {
      props: {
        showToast
      }
    });

    const selectAllBtn = getByRole('button', { name: '全选' });
    const selectNoneBtn = getByRole('button', { name: '全不选' });
    const invertBtn = getByRole('button', { name: '反选' });
    const cleanupBtn = getByText(/一键清理失效垃圾源/);

    expect(selectAllBtn).toBeInTheDocument();
    expect(selectNoneBtn).toBeInTheDocument();
    expect(invertBtn).toBeInTheDocument();
    expect(cleanupBtn).toBeInTheDocument();

    // 点击全选
    await fireEvent.click(selectAllBtn);
    expect(musicFreeStore.plugins.every((p) => p.enabled)).toBe(true);
    expect(showToast).toHaveBeenCalledWith('已全部启用音源插件', 'success');

    // 点击全不选
    await fireEvent.click(selectNoneBtn);
    expect(musicFreeStore.plugins.every((p) => !p.enabled)).toBe(true);
    expect(showToast).toHaveBeenCalledWith('已全部停用音源插件', 'info');

    // 点击反选
    await fireEvent.click(invertBtn);
    expect(musicFreeStore.plugins.every((p) => p.enabled)).toBe(true);
    expect(showToast).toHaveBeenCalledWith('已反转音源插件启用状态', 'info');
  });
});
