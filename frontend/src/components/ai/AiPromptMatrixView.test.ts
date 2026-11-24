import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AiPromptMatrixView from './AiPromptMatrixView.svelte';
import { aiStudioStore } from '../../lib/aiStudio/aiStudioStore.svelte';

describe('AiPromptMatrixView Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    aiStudioStore.close();
  });

  it('renders empty state placeholder when no project is loaded', () => {
    aiStudioStore.project = null;

    const { getByText } = render(AiPromptMatrixView);
    expect(getByText('暂未生成 Prompt 矩阵')).toBeDefined();
    expect(getByText(/点击左侧【生成定制 Prompt 矩阵】/)).toBeDefined();
  });

  it('renders version tabs and prompt cards when project is loaded', async () => {
    aiStudioStore.open({ id: 186016, name: '晴天', artist: '周杰伦' });
    aiStudioStore.project = {
      id: 'aip_test_001',
      refSongId: '186016',
      refSongTitle: '晴天',
      status: 'PROMPT_READY',
      trackPrompts: [
        {
          id: 'trk_v1_yue',
          projectId: 'aip_test_001',
          versionLabel: 'V1_FIDELITY',
          modelName: 'YuE2-3B',
          trackTitle: '晴天 - 原味升华版 (YuE2-3B)',
          promptContent: 'Prompt for V1 YuE2',
          lyricsPlan: 'V1 Distinct Lyrics: 故事的小黄花...',
          modelParamsJson: '{"bpm": 104}'
        },
        {
          id: 'trk_v2_minimax',
          projectId: 'aip_test_001',
          versionLabel: 'V2_FUSION',
          modelName: 'MiniMax-Music3',
          trackTitle: '晴天 - 跨界裂变版 (MiniMax-Music3)',
          promptContent: 'Prompt for V2 MiniMax',
          lyricsPlan: 'V2 Distinct Lyrics: 霓虹穿过玻璃窗...',
          modelParamsJson: '{"bpm": 140}'
        }
      ]
    } as any;
    aiStudioStore.selectedVersion = 'V1_FIDELITY';

    const { getByText, queryByText } = render(AiPromptMatrixView);

    // Verify V1 track is displayed
    expect(getByText('晴天 - 原味升华版 (YuE2-3B)')).toBeDefined();
    expect(getByText('Prompt for V1 YuE2')).toBeDefined();
    expect(getByText(/V1 Distinct Lyrics: 故事的小黄花/)).toBeDefined();

    // Verify V2 track is NOT displayed in V1 view
    expect(queryByText('晴天 - 跨界裂变版 (MiniMax-Music3)')).toBeNull();

    // Switch tab to V2
    const v2Tab = getByText('版本2 · 跨界裂变融合');
    await fireEvent.click(v2Tab);

    expect(aiStudioStore.selectedVersion).toBe('V2_FUSION');
  });

  it('copies prompt and lyrics to clipboard on click', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    aiStudioStore.open({ id: 186016, name: '晴天', artist: '周杰伦' });
    aiStudioStore.project = {
      id: 'aip_test_001',
      refSongId: '186016',
      trackPrompts: [
        {
          id: 'trk_v1_yue',
          projectId: 'aip_test_001',
          versionLabel: 'V1_FIDELITY',
          modelName: 'YuE2-3B',
          trackTitle: '晴天 - 原味升华版',
          promptContent: 'Prompt text',
          lyricsPlan: 'Lyrics text',
          modelParamsJson: '{}'
        }
      ]
    } as any;
    aiStudioStore.selectedVersion = 'V1_FIDELITY';

    const { getByText } = render(AiPromptMatrixView);

    const copyBtn = getByText('复制全部');
    await fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith('Prompt text\n\nLyrics text');
  });
});
