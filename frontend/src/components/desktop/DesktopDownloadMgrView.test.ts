import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DesktopDownloadMgrView from './DesktopDownloadMgrView.svelte';
import { routerState } from '../../lib/router.svelte';

vi.mock('../../lib/api', () => ({
  api: {
    historyList: vi.fn().mockResolvedValue({
      code: '000000',
      data: {
        list: [
          { id: 1, songId: 101, name: '晴天', artist: '周杰伦', fileSize: 4096000, format: 'flac', path: '/music/晴天.flac' }
        ],
        total: 1
      }
    }),
    historyStats: vi.fn().mockResolvedValue({
      code: '000000',
      data: { totalCount: 1, totalSize: 4096000, missingCount: 0 }
    }),
    folderRoots: vi.fn().mockResolvedValue({
      code: '000000',
      data: [{ name: '本地音乐', path: '/music' }]
    }),
    folderBrowse: vi.fn().mockResolvedValue({
      code: '000000',
      data: []
    }),
    historyDelete: vi.fn().mockResolvedValue({ code: '000000' }),
    historyScanExternal: vi.fn().mockResolvedValue({ code: '000000' }),
    historyScan: vi.fn().mockResolvedValue({ code: '000000' })
  }
}));

describe('DesktopDownloadMgrView', () => {
  beforeEach(() => {
    routerState.downloadSubTab = 'local-playlists';
    routerState.downloadTasksTrigger = 0;
  });

  it('renders workbench with local-playlists subtab as default', async () => {
    const { getByTestId, findByText } = render(DesktopDownloadMgrView, {
      props: {
        onPlayQueue: vi.fn(),
        onReveal: vi.fn(),
        showToast: vi.fn()
      }
    });

    expect(getByTestId('desktop-download-mgr-view')).toBeInTheDocument();
    expect(getByTestId('subtab-local-playlists')).toHaveClass('bg-emerald-600');
    expect(getByTestId('local-playlists-section')).toBeInTheDocument();

    const historySubTab = getByTestId('subtab-history');
    await fireEvent.click(historySubTab);
    const songName = await findByText('晴天');
    expect(songName).toBeInTheDocument();
  });

  it('switches between history, browser cache, and local playlists subtabs', async () => {
    const { getByTestId, getByText } = render(DesktopDownloadMgrView, {
      props: {
        onPlayQueue: vi.fn(),
        onReveal: vi.fn(),
        showToast: vi.fn()
      }
    });

    const cacheSubTab = getByTestId('subtab-cache');
    await fireEvent.click(cacheSubTab);
    expect(getByText(/手机离线缓存管理/i)).toBeInTheDocument();

    const historySubTab = getByTestId('subtab-history');
    await fireEvent.click(historySubTab);
    expect(getByTestId('subtab-history')).toHaveClass('bg-red-500');

    const tasksSubTab = getByTestId('subtab-tasks');
    await fireEvent.click(tasksSubTab);
    expect(getByTestId('subtab-tasks')).toHaveClass('bg-red-500');

    const localPlaylistsSubTab = getByTestId('subtab-local-playlists');
    await fireEvent.click(localPlaylistsSubTab);
    expect(getByTestId('subtab-local-playlists')).toHaveClass('bg-emerald-600');
    expect(getByTestId('local-playlists-section')).toBeInTheDocument();

    const folderSubTab = getByTestId('subtab-folder');
    await fireEvent.click(folderSubTab);
    expect(folderSubTab).toHaveClass('bg-sky-600');
  });

  it('switches to tasks tab when tasksTrigger changes', async () => {
    const { getByTestId, rerender } = render(DesktopDownloadMgrView, {
      props: {
        onPlayQueue: vi.fn(),
        onReveal: vi.fn(),
        showToast: vi.fn(),
        tasksTrigger: 0
      }
    });

    expect(getByTestId('subtab-local-playlists')).toHaveClass('bg-emerald-600');

    await rerender({
      onPlayQueue: vi.fn(),
      onReveal: vi.fn(),
      showToast: vi.fn(),
      tasksTrigger: 1
    });

    expect(getByTestId('subtab-tasks')).toHaveClass('bg-red-500');
  });
});
