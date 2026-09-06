import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import DesktopSearchView from './DesktopSearchView.svelte';

vi.mock('../../lib/api', () => ({
  api: {
    search: vi.fn().mockImplementation((query: string, type: string) => {
      if (type === '100') {
        return Promise.resolve({
          code: '000000',
          data: {
            artists: [
              { id: 6452, name: '周杰伦', picUrl: '/jay.png', albumSize: 30, musicSize: 300 }
            ]
          }
        });
      }
      return Promise.resolve({
        code: '000000',
        data: {
          songs: [
            { id: 1001, name: '七里香', ar: [{ name: '周杰伦' }], al: { name: '七里香', picUrl: '/cover.png' } }
          ]
        }
      });
    }),
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
            { id: 1002, name: '七里香', ar: [{ name: '周杰伦' }], al: { name: '七里香' } }
          ]
        }
      }
    }),
    downloadSingle: vi.fn().mockResolvedValue({ code: '000000', data: { status: 'SUCCESS' } }),
    downloadAlbum: vi.fn().mockResolvedValue({ code: '000000' }),
    downloadPlaylist: vi.fn().mockResolvedValue({ code: '000000' })
  }
}));

describe('DesktopSearchView', () => {
  it('renders search controls and allows typing keyword', async () => {
    const { getByTestId, getByPlaceholderText } = render(DesktopSearchView, {
      props: {
        onPlaylist: vi.fn(),
        showToast: vi.fn()
      }
    });

    const input = getByPlaceholderText(/搜索歌曲、歌手/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();

    await fireEvent.input(input, { target: { value: '周杰伦' } });
    expect(input.value).toBe('周杰伦');
  });

  it('triggers search and renders track table', async () => {
    const { getByTestId, getByPlaceholderText, findAllByText } = render(DesktopSearchView, {
      props: {
        onPlaylist: vi.fn(),
        showToast: vi.fn()
      }
    });

    const input = getByPlaceholderText(/搜索歌曲、歌手/i) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '周杰伦' } });

    const searchBtn = getByTestId('desktop-search-btn');
    await fireEvent.click(searchBtn);

    const songTitles = await findAllByText('七里香');
    expect(songTitles.length).toBeGreaterThanOrEqual(1);
  });

  it('switches search types', async () => {
    const { getByTestId } = render(DesktopSearchView, {
      props: {
        onPlaylist: vi.fn(),
        showToast: vi.fn()
      }
    });

    const albumTypeBtn = getByTestId('search-type-10');
    await fireEvent.click(albumTypeBtn);
    expect(albumTypeBtn.className).toContain('bg-red-500');
  });

  it('displays artist ID and enables clicking to view top 50 songs', async () => {
    const { getByTestId, getByPlaceholderText, findByText, findByTestId } = render(DesktopSearchView, {
      props: {
        onPlaylist: vi.fn(),
        showToast: vi.fn()
      }
    });

    // 切换到歌手搜索
    const artistTypeBtn = getByTestId('search-type-100');
    await fireEvent.click(artistTypeBtn);

    const input = getByPlaceholderText(/搜索歌曲、歌手/i) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '周杰伦' } });

    const searchBtn = getByTestId('desktop-search-btn');
    await fireEvent.click(searchBtn);

    // 验证显示歌手卡片与 ID
    const artistCardId = await findByText('(ID: 6452)');
    expect(artistCardId).toBeInTheDocument();

    // 点击进入热门 50 首
    const top50Btn = await findByTestId('btn-artist-view-top50');
    expect(top50Btn).toBeInTheDocument();
    await fireEvent.click(top50Btn);

    // 验证切换到 DesktopArtistDetail
    const detailHeader = await findByTestId('desktop-artist-detail');
    expect(detailHeader).toBeInTheDocument();

    const topSong = await findByText('晴天');
    expect(topSong).toBeInTheDocument();
  });
});
