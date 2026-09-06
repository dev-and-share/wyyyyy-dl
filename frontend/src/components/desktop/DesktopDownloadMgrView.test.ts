import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import DesktopDownloadMgrView from './DesktopDownloadMgrView.svelte';

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
  it('renders two-column workbench and loads history', async () => {
    const { getByTestId, findByText } = render(DesktopDownloadMgrView, {
      props: {
        onPlayQueue: vi.fn(),
        onReveal: vi.fn(),
        showToast: vi.fn()
      }
    });

    expect(getByTestId('desktop-download-mgr-view')).toBeInTheDocument();
    const songName = await findByText('晴天');
    expect(songName).toBeInTheDocument();
  });

  it('switches between history and browser cache subtabs', async () => {
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
  });
});
