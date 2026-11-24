import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AiChatRefineDrawer from './AiChatRefineDrawer.svelte';
import { aiStudioStore } from '../../lib/aiStudio/aiStudioStore.svelte';

describe('AiChatRefineDrawer Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    aiStudioStore.close();
    aiStudioStore.open({ id: 186016, name: '晴天', artist: '周杰伦' });
    aiStudioStore.project = {
      id: 'aip_test_001',
      refSongId: '186016',
      status: 'PROMPT_READY',
      tracks: []
    } as any;
  });

  it('renders current version session badge', () => {
    aiStudioStore.selectedVersion = 'V1_FIDELITY';
    const { getByText } = render(AiChatRefineDrawer);

    expect(getByText(/版本1 · 原味升华 会话/)).toBeDefined();
  });

  it('renders chat messages filtered for current version session', () => {
    aiStudioStore.selectedVersion = 'V1_FIDELITY';
    aiStudioStore.chatMessages = [
      {
        id: 'msg_v1_1',
        role: 'assistant',
        content: '版本1专属分析消息',
        createdAt: '2026-11-25 01:00:00',
        versionLabel: 'V1_FIDELITY'
      },
      {
        id: 'msg_v2_1',
        role: 'assistant',
        content: '版本2专属分析消息',
        createdAt: '2026-11-25 01:00:00',
        versionLabel: 'V2_FUSION'
      }
    ];

    const { getByText, queryByText } = render(AiChatRefineDrawer);

    expect(getByText('版本1专属分析消息')).toBeDefined();
    expect(queryByText('版本2专属分析消息')).toBeNull();
  });

  it('allows typing and triggers sendRefine when Send button is clicked', async () => {
    const spyRefine = vi.spyOn(aiStudioStore, 'sendRefine').mockResolvedValue();

    const { getByPlaceholderText, getByTitle } = render(AiChatRefineDrawer);

    const textarea = getByPlaceholderText(/针对【版本1 · 原味升华】输入指令/);
    await fireEvent.input(textarea, { target: { value: '延长第二段歌词' } });

    const sendBtn = getByTitle('发送追问指令');
    await fireEvent.click(sendBtn);

    expect(spyRefine).toHaveBeenCalledWith('延长第二段歌词');
  });

  it('shows loader and status text when refining is in progress', () => {
    aiStudioStore.refining = true;

    const { getByText } = render(AiChatRefineDrawer);
    expect(getByText(/agy 正在针对【版本1 · 原味升华】深度推演并更新歌词/)).toBeDefined();
  });
});
