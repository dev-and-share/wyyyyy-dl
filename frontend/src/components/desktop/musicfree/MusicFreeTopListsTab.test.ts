import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/svelte';
import MusicFreeTopListsTab from './MusicFreeTopListsTab.svelte';
import { musicFreeStore } from '../../../lib/musicfree/musicFreeStore.svelte';

describe('MusicFreeTopListsTab', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders top lists and select dropdown with proper selected value (not empty)', async () => {
    vi.spyOn(musicFreeStore, 'getTopLists').mockResolvedValue([
      {
        pluginId: 'builtin_QQ音乐 (官方)',
        pluginName: 'QQ音乐 (官方)',
        subGroups: [
          {
            groupTitle: 'QQ音乐官方排行榜',
            charts: [
              { id: '26', title: '热歌榜', coverImg: '', description: 'QQ音乐热歌榜' },
              { id: '27', title: '新歌榜', coverImg: '', description: 'QQ音乐新歌榜' }
            ]
          }
        ]
      },
      {
        pluginId: 'builtin_酷狗音乐 (官方)',
        pluginName: '酷狗音乐 (官方)',
        subGroups: [
          {
            groupTitle: '官方精选榜单',
            charts: [
              { id: '1', title: '酷狗飙升榜', coverImg: '', description: '酷狗飙升' }
            ]
          }
        ]
      }
    ]);

    const { container, getByText } = render(MusicFreeTopListsTab, {
      showToast: vi.fn()
    });

    await waitFor(() => {
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect(select.options.length).toBe(2);
    });

    const select = container.querySelector('select') as HTMLSelectElement;
    // Kugou has higher priority weight, so it should be first and selected
    expect(select.value).toBe('builtin_酷狗音乐 (官方)');
    expect(select.selectedIndex).toBe(0);
    expect(select.options[select.selectedIndex].text).toContain('酷狗');

    // Change select to QQ音乐
    await fireEvent.change(select, { target: { value: 'builtin_QQ音乐 (官方)' } });
    expect(select.value).toBe('builtin_QQ音乐 (官方)');
    expect(getByText('热歌榜')).toBeInTheDocument();
  });

  it('automatically repairs activePluginId when stale cache has missing pluginId', async () => {
    localStorage.setItem('api_cache_mf_toplists_groups', JSON.stringify({
      timestamp: Date.now() - 4000 * 1000,
      data: [
        {
          pluginId: 'removed_plugin',
          pluginName: '已下架音源',
          subGroups: [{ groupTitle: '测试榜', charts: [{ id: '99', title: '下架榜' }] }]
        }
      ]
    }));

    vi.spyOn(musicFreeStore, 'getTopLists').mockResolvedValue([
      {
        pluginId: 'builtin_QQ音乐 (官方)',
        pluginName: 'QQ音乐 (官方)',
        subGroups: [
          {
            groupTitle: 'QQ音乐官方排行榜',
            charts: [
              { id: '26', title: '热歌榜', coverImg: '', description: 'QQ音乐热歌榜' }
            ]
          }
        ]
      }
    ]);

    const { container } = render(MusicFreeTopListsTab, {
      showToast: vi.fn()
    });

    await waitFor(() => {
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect(select.options[0]?.value).toBe('builtin_QQ音乐 (官方)');
    });

    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('builtin_QQ音乐 (官方)');
    expect(select.value).not.toBe('');
    expect(select.selectedIndex).toBe(0);
  });
});
