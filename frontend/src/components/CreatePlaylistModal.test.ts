import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import CreatePlaylistModal from './CreatePlaylistModal.svelte';

vi.mock('../lib/api', () => ({
  api: { playlistCreate: vi.fn().mockResolvedValue({ code: '000000', data: { id: '123' } }) }
}));

describe('CreatePlaylistModal', () => {
  it('renders input and checkbox', async () => {
    const { getByPlaceholderText, getByText } = render(CreatePlaylistModal, { props: { onClose: vi.fn(), onSuccess: vi.fn() } });
    expect(getByPlaceholderText('输入歌单名称')).toBeInTheDocument();
    expect(getByText('设置为隐私歌单（仅自己可见）')).toBeInTheDocument();
    expect(getByText('立即创建')).toBeDisabled(); // empty name
  });
  it('enables create when name filled', async () => {
    const { getByPlaceholderText, getByText } = render(CreatePlaylistModal, { props: { onClose: vi.fn(), onSuccess: vi.fn() } });
    const input = getByPlaceholderText('输入歌单名称') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '我的测试歌单' } });
    expect(getByText('立即创建')).not.toBeDisabled();
  });
  it('calls onSuccess on submit', async () => {
    const onSuccess = vi.fn();
    const { getByPlaceholderText, getByText } = render(CreatePlaylistModal, { props: { onClose: vi.fn(), onSuccess } });
    const input = getByPlaceholderText('输入歌单名称') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Test' } });
    await fireEvent.click(getByText('立即创建'));
    // wait for async
    await new Promise(r=> setTimeout(r, 200));
    expect(onSuccess).toHaveBeenCalled();
  });
});
