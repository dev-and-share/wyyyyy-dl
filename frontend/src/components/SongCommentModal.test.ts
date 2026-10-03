import { render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SongCommentModal from './SongCommentModal.svelte';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    songComments: vi.fn()
  }
}));

describe('SongCommentModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCommentsData = {
    code: '000000',
    data: {
      total: 100,
      hotComments: [
        {
          commentId: 101,
          content: '前奏一响，青春就回来了！',
          time: 1600000000000,
          likedCount: 8888,
          user: {
            nickname: '老乐迷',
            avatarUrl: 'https://example.com/avatar1.jpg'
          }
        }
      ],
      comments: [
        {
          commentId: 201,
          content: '打卡第一千次听。',
          time: 1600000000000,
          likedCount: 66,
          user: {
            nickname: '听歌少年',
            avatarUrl: 'https://example.com/avatar2.jpg'
          }
        }
      ]
    }
  };

  it('renders comments and hot comments properly', async () => {
    (api.songComments as any).mockResolvedValue(mockCommentsData);

    const onClose = vi.fn();
    const { getByText, findByText } = render(SongCommentModal, {
      props: {
        songId: 12345,
        songName: '晴天',
        onClose
      }
    });

    expect(await findByText('前奏一响，青春就回来了！')).toBeInTheDocument();
    expect(getByText('老乐迷')).toBeInTheDocument();
    expect(getByText(/精彩热评/)).toBeInTheDocument();
    expect(getByText(/最新评论/)).toBeInTheDocument();
    expect(getByText('打卡第一千次听。')).toBeInTheDocument();
    expect(getByText('听歌少年')).toBeInTheDocument();
    expect(getByText(/加载更多评论/)).toBeInTheDocument();
  });

  it('handles error state smoothly', async () => {
    (api.songComments as any).mockRejectedValue(new Error('Network error'));

    const onClose = vi.fn();
    const { findByText } = render(SongCommentModal, {
      props: {
        songId: 12345,
        songName: '晴天',
        onClose
      }
    });

    expect(await findByText(/网络异常/)).toBeInTheDocument();
  });
});
