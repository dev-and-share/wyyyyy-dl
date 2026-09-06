import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import DesktopSearchView from './DesktopSearchView.svelte';

vi.mock('../../lib/api', () => ({
  api: {
    search: vi.fn().mockResolvedValue({
      code: '000000',
      data: {
        songs: [
          { id: 1001, name: '七里香', ar: [{ name: '周杰伦' }], al: { name: '七里香', picUrl: '/cover.png' } }
        ]
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
});
