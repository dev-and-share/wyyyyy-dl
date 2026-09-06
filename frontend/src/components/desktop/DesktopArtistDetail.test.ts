import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import DesktopArtistDetail from './DesktopArtistDetail.svelte';

vi.mock('../../lib/api', () => ({
  api: {
    artist: vi.fn().mockResolvedValue({
      code: '000000',
      data: {
        artist: {
          id: 6452,
          name: '周杰伦',
          picUrl: '/jay.png',
          albumSize: 30,
          musicSize: 300,
          songs: [
            { id: 1001, name: '晴天', ar: [{ name: '周杰伦' }], al: { name: '叶惠美' } },
            { id: 1002, name: '七里香', ar: [{ name: '周杰伦' }], al: { name: '七里香专辑' } }
          ]
        }
      }
    }),
    playlistFork: vi.fn().mockResolvedValue({ code: '000000' }),
    downloadSingle: vi.fn().mockResolvedValue({ code: '000000', data: { status: 'SUCCESS' } })
  }
}));

describe('DesktopArtistDetail', () => {
  it('renders artist information and song table', async () => {
    const onBack = vi.fn();
    const { findAllByText, findByText, getByTestId } = render(DesktopArtistDetail, {
      props: {
        artistId: '6452',
        onBackToSearch: onBack,
        showToast: vi.fn()
      }
    });

    const artistNames = await findAllByText(/周杰伦/);
    expect(artistNames.length).toBeGreaterThanOrEqual(1);

    const song1 = await findByText('晴天');
    const song2 = await findByText('七里香');
    expect(song1).toBeInTheDocument();
    expect(song2).toBeInTheDocument();

    // 检查返回搜索结果按钮
    const backBtn = getByTestId('btn-back-search');
    await fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalled();
  });

  it('triggers play all top songs', async () => {
    const onPlayQueue = vi.fn();
    const { getByTestId, findByText } = render(DesktopArtistDetail, {
      props: {
        artistId: '6452',
        onBackToSearch: vi.fn(),
        onPlayQueue,
        showToast: vi.fn()
      }
    });

    await findByText('晴天');
    const playAllBtn = getByTestId('btn-artist-play-all');
    await fireEvent.click(playAllBtn);

    expect(onPlayQueue).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 1001, name: '晴天' }),
        expect.objectContaining({ id: 1002, name: '七里香' })
      ]),
      0
    );
  });
});
