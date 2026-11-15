import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DownloadAuditModal from './DownloadAuditModal.svelte';

describe('DownloadAuditModal', () => {
  const sampleList = [
    {
      id: 1,
      songName: '爱似水仙',
      filePath: '/media/music/歌单/AndyF喜欢的音乐/金海心 - 爱似水仙.flac',
      format: 'flac'
    },
    {
      id: 2,
      songName: '给电影人的情书',
      filePath: '/media/music/歌单/AndyF喜欢的音乐/蔡琴 - 给电影人的情书.wav',
      format: 'wav'
    }
  ];

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  it('renders non-mp3 items with titles and format badges', () => {
    const { getByText, getAllByTitle } = render(DownloadAuditModal, {
      props: {
        modalType: 'nonMp3',
        modalList: sampleList,
        modalLoading: false,
        onClose: vi.fn(),
        onCleanMissing: vi.fn(),
        onCleanNonMp3: vi.fn()
      }
    });

    expect(getByText('爱似水仙')).toBeInTheDocument();
    expect(getByText('.flac')).toBeInTheDocument();
    expect(getByText('.wav')).toBeInTheDocument();

    const pathButtons = getAllByTitle(/完整路径：/);
    expect(pathButtons.length).toBe(2);
    expect(pathButtons[0]).toHaveAttribute(
      'title',
      '完整路径：/media/music/歌单/AndyF喜欢的音乐/金海心 - 爱似水仙.flac\n（点击直接复制）'
    );
  });

  it('copies path to clipboard and shows copied feedback on click', async () => {
    const { getAllByTitle, findByText } = render(DownloadAuditModal, {
      props: {
        modalType: 'nonMp3',
        modalList: sampleList,
        modalLoading: false,
        onClose: vi.fn(),
        onCleanMissing: vi.fn(),
        onCleanNonMp3: vi.fn()
      }
    });

    const pathButtons = getAllByTitle(/完整路径：/);
    await fireEvent.click(pathButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      '/media/music/歌单/AndyF喜欢的音乐/金海心 - 爱似水仙.flac'
    );
    expect(await findByText(/已复制/i)).toBeInTheDocument();
  });

  it('toggles expanded view to reveal full break-all path', async () => {
    const { getByText, findByText, queryByText } = render(DownloadAuditModal, {
      props: {
        modalType: 'nonMp3',
        modalList: sampleList,
        modalLoading: false,
        onClose: vi.fn(),
        onCleanMissing: vi.fn(),
        onCleanNonMp3: vi.fn()
      }
    });

    expect(queryByText('物理文件完整路径:')).not.toBeInTheDocument();

    const songItem = getByText('爱似水仙');
    await fireEvent.click(songItem);

    expect(await findByText('物理文件完整路径:')).toBeInTheDocument();
  });
});
