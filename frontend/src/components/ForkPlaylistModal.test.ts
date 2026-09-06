import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ForkPlaylistModal from './ForkPlaylistModal.svelte';

vi.mock('../lib/api', () => ({
  api: {
    playlistFork: vi.fn().mockResolvedValue({
      code: '000000',
      data: { id: 88888, name: '转存的新歌单' }
    })
  }
}));

describe('ForkPlaylistModal', () => {
  it('renders modal with default name and track count', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const showToast = vi.fn();

    const { getByDisplayValue, getByText } = render(ForkPlaylistModal, {
      props: {
        playlistName: '经典华语金曲',
        trackCount: 30,
        trackIds: [1, 2, 3],
        onClose,
        onSuccess,
        showToast
      }
    });

    const input = getByDisplayValue('经典华语金曲') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    const submitBtn = getByText(/确认转存 \(30 首\)/i);
    expect(submitBtn).toBeInTheDocument();

    await fireEvent.click(submitBtn);

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('正在转存 3 首歌曲'),
      'info',
      3000
    );
  });
});
