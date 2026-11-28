import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import PlaylistDownloadDropdown from './PlaylistDownloadDropdown.svelte';
import * as apiModule from '../lib/api';
import * as pwaCacheModule from '../lib/pwaCache.svelte';
import * as toastModule from '../lib/toast.svelte';
import * as trackStatusModule from '../lib/player/trackStatus.svelte';
import * as uiModule from '../lib/ui.svelte';

vi.mock('../lib/api', () => ({
  api: {
    downloadPlaylist: vi.fn().mockResolvedValue({ code: '000000', msg: 'ok' })
  }
}));

vi.mock('../lib/pwaCache.svelte', () => ({
  cacheTrackToBrowser: vi.fn().mockResolvedValue({ success: true, msg: 'cached' })
}));

vi.mock('../lib/toast.svelte', () => ({
  showToast: vi.fn()
}));

vi.mock('../lib/ui.svelte', () => ({
  openSheet: vi.fn(),
  closeSheet: vi.fn()
}));

describe('PlaylistDownloadDropdown Component', () => {
  const sampleTracks = [
    { id: 101, name: 'Song A', ar: [{ name: 'Artist 1' }], al: { name: 'Album 1', picUrl: '' } },
    { id: 102, name: 'Song B', ar: [{ name: 'Artist 2' }], al: { name: 'Album 2', picUrl: '' } }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to desktop viewport
    window.innerWidth = 1024;
  });

  it('renders download button and toggle button properly', () => {
    const { getByTestId } = render(PlaylistDownloadDropdown, {
      props: {
        playlistId: '12345',
        allTracks: sampleTracks
      }
    });

    const mainBtn = getByTestId('btn-detail-download-all');
    const toggleBtn = getByTestId('btn-detail-download-menu-toggle');

    expect(mainBtn).toBeInTheDocument();
    expect(toggleBtn).toBeInTheDocument();
    expect(mainBtn.textContent).toContain('全部下载到电脑');
  });

  it('triggers onDownloadAllToPc or api.downloadPlaylist when main button is clicked', async () => {
    const onDownloadAllToPc = vi.fn();
    const { getByTestId } = render(PlaylistDownloadDropdown, {
      props: {
        playlistId: '12345',
        allTracks: sampleTracks,
        onDownloadAllToPc
      }
    });

    const mainBtn = getByTestId('btn-detail-download-all');
    await fireEvent.click(mainBtn);

    expect(onDownloadAllToPc).toHaveBeenCalledTimes(1);
  });

  it('toggles dropdown menu on desktop when toggle button is clicked', async () => {
    window.innerWidth = 1024;
    const { getByTestId, queryByTestId } = render(PlaylistDownloadDropdown, {
      props: {
        playlistId: '12345',
        allTracks: sampleTracks
      }
    });

    const toggleBtn = getByTestId('btn-detail-download-menu-toggle');
    expect(queryByTestId('btn-cache-pc-only')).not.toBeInTheDocument();

    await fireEvent.click(toggleBtn);
    expect(getByTestId('btn-cache-pc-only')).toBeInTheDocument();
    expect(getByTestId('btn-cache-all-via-pc')).toBeInTheDocument();

    await fireEvent.click(toggleBtn);
    expect(queryByTestId('btn-cache-pc-only')).not.toBeInTheDocument();
  });

  it('opens bottom sheet on mobile (SP) when toggle button is clicked', async () => {
    window.innerWidth = 390;
    const { getByTestId } = render(PlaylistDownloadDropdown, {
      props: {
        playlistId: '12345',
        playlistName: '日推202611',
        allTracks: sampleTracks
      }
    });

    const toggleBtn = getByTestId('btn-detail-download-menu-toggle');
    await fireEvent.click(toggleBtn);

    expect(uiModule.openSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
        subtitle: '《日推202611》',
        actions: expect.arrayContaining([
          expect.objectContaining({ label: expect.stringContaining('仅缓存电脑已有') }),
          expect.objectContaining({ label: expect.stringContaining('先下到电脑并缓存全部') }),
          expect.objectContaining({ label: expect.stringContaining('全部下载到电脑') })
        ])
      })
    );
  });

  it('caches only pc-downloaded tracks when option 1 is selected', async () => {
    window.innerWidth = 1024;
    vi.spyOn(trackStatusModule, 'getTrackSourceStatus').mockImplementation((trackId) => ({
      isServer: trackId === 101,
      isPhone: false,
      isLocal: trackId === 101
    }));

    const { getByTestId } = render(PlaylistDownloadDropdown, {
      props: {
        playlistId: '12345',
        allTracks: sampleTracks
      }
    });

    await fireEvent.click(getByTestId('btn-detail-download-menu-toggle'));
    const pcOnlyBtn = getByTestId('btn-cache-pc-only');
    await fireEvent.click(pcOnlyBtn);

    await waitFor(() => {
      expect(pwaCacheModule.cacheTrackToBrowser).toHaveBeenCalledTimes(1);
      expect(pwaCacheModule.cacheTrackToBrowser).toHaveBeenCalledWith(
        expect.objectContaining({ id: 101, name: 'Song A' }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  it('shows warning when no tracks are on PC and option 1 is selected', async () => {
    window.innerWidth = 1024;
    vi.spyOn(trackStatusModule, 'getTrackSourceStatus').mockReturnValue({
      isServer: false,
      isPhone: false,
      isLocal: false
    });

    const { getByTestId } = render(PlaylistDownloadDropdown, {
      props: {
        playlistId: '12345',
        allTracks: sampleTracks
      }
    });

    await fireEvent.click(getByTestId('btn-detail-download-menu-toggle'));
    await fireEvent.click(getByTestId('btn-cache-pc-only'));

    await waitFor(() => {
      expect(toastModule.showToast).toHaveBeenCalledWith(
        expect.stringContaining('当前歌单在电脑上暂无已下载歌曲'),
        'warning',
        expect.any(Number)
      );
      expect(pwaCacheModule.cacheTrackToBrowser).not.toHaveBeenCalled();
    });
  });

  it('downloads to PC and caches all tracks when option 2 is selected', async () => {
    window.innerWidth = 1024;
    const { getByTestId } = render(PlaylistDownloadDropdown, {
      props: {
        playlistId: '12345',
        allTracks: sampleTracks
      }
    });

    await fireEvent.click(getByTestId('btn-detail-download-menu-toggle'));
    const cacheAllBtn = getByTestId('btn-cache-all-via-pc');
    await fireEvent.click(cacheAllBtn);

    await waitFor(() => {
      expect(apiModule.api.downloadPlaylist).toHaveBeenCalledWith('12345');
      expect(pwaCacheModule.cacheTrackToBrowser).toHaveBeenCalledTimes(2);
    });
  });

  it('prompts confirmation when clicking progress button while caching, and continues if dismissed', async () => {
    window.innerWidth = 1024;
    let resolveFirst!: (val: { success: boolean; msg: string }) => void;
    const firstPromise = new Promise<{ success: boolean; msg: string }>((r) => {
      resolveFirst = r;
    });
    vi.mocked(pwaCacheModule.cacheTrackToBrowser)
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce({ success: true, msg: 'cached' });

    const onDownloadAllToPc = vi.fn();
    const { getByTestId, getByText, queryByTestId } = render(PlaylistDownloadDropdown, {
      props: {
        playlistId: '12345',
        allTracks: sampleTracks,
        onDownloadAllToPc
      }
    });

    await fireEvent.click(getByTestId('btn-detail-download-menu-toggle'));
    await fireEvent.click(getByTestId('btn-cache-all-via-pc'));

    await waitFor(() => {
      expect(getByTestId('btn-detail-download-all').textContent).toContain('正在缓存 (1/2)...');
    });

    // Click progress button while caching -> should open confirm modal, NOT trigger PC download
    await fireEvent.click(getByTestId('btn-detail-download-all'));
    expect(onDownloadAllToPc).not.toHaveBeenCalled();
    expect(getByText('取消浏览器离线缓存？')).toBeInTheDocument();
    expect(getByTestId('btn-cancel-cache-continue')).toBeInTheDocument();

    // Click "继续缓存" -> closes modal and lets remaining tracks finish
    await fireEvent.click(getByTestId('btn-cancel-cache-continue'));
    expect(queryByTestId('btn-cancel-cache-continue')).not.toBeInTheDocument();

    resolveFirst({ success: true, msg: 'cached' });

    await waitFor(() => {
      expect(pwaCacheModule.cacheTrackToBrowser).toHaveBeenCalledTimes(2);
      expect(toastModule.showToast).toHaveBeenCalledWith(
        '浏览器离线缓存完成：成功 2 / 共 2 首',
        'success',
        3500
      );
    });
  });

  it('aborts caching and shows cancelled toast when user confirms cancellation', async () => {
    window.innerWidth = 1024;
    let capturedSignal: AbortSignal | undefined;
    let rejectOnAbort!: (err: Error) => void;
    const firstPromise = new Promise<{ success: boolean; msg: string }>((_, rej) => {
      rejectOnAbort = rej;
    });

    vi.mocked(pwaCacheModule.cacheTrackToBrowser).mockImplementationOnce((_track, opts) => {
      capturedSignal = opts?.signal;
      capturedSignal?.addEventListener('abort', () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        rejectOnAbort(err);
      });
      return firstPromise;
    });

    const { getByTestId } = render(PlaylistDownloadDropdown, {
      props: {
        playlistId: '12345',
        allTracks: sampleTracks
      }
    });

    await fireEvent.click(getByTestId('btn-detail-download-menu-toggle'));
    await fireEvent.click(getByTestId('btn-cache-all-via-pc'));

    await waitFor(() => {
      expect(getByTestId('btn-detail-download-all').textContent).toContain('正在缓存 (1/2)...');
    });

    await fireEvent.click(getByTestId('btn-detail-download-all'));
    await fireEvent.click(getByTestId('btn-cancel-cache-confirm'));

    await waitFor(() => {
      expect(capturedSignal?.aborted).toBe(true);
      expect(pwaCacheModule.cacheTrackToBrowser).toHaveBeenCalledTimes(1);
      expect(getByTestId('btn-detail-download-all').textContent).toContain('全部下载到电脑');
      expect(toastModule.showToast).toHaveBeenCalledWith(
        '已取消浏览器离线缓存（已缓存 0 / 共 2 首）',
        'info',
        3500
      );
    });
  });
});
