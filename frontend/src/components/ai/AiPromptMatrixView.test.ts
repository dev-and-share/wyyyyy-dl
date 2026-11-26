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
    expect(getByText('尚未生成方案')).toBeDefined();
  });

  it('renders version tabs, unified master lyrics plan, and model adapter cards', async () => {
    aiStudioStore.open({ id: 186016, name: '晴天', artist: '周杰伦' });
    aiStudioStore.project = {
      id: 'aip_test_001',
      refSongId: '186016',
      refSongTitle: '晴天',
      status: 'PROMPT_READY',
      versionPlans: [
        {
          id: 'aip_test_001_v1_fidelity',
          projectId: 'aip_test_001',
          versionLabel: 'V1_FIDELITY',
          planTitle: '《晴天 · 原味升华版》',
          genre: '03_campus_nostalgia_ballad',
          bpm: 104,
          musicalKey: 'G Major',
          arrangementNotes: '经典木吉他与大提琴复调编曲',
          lyricsText: 'V1 Master Lyrics: 故事的小黄花...',
          appliedModels: ['YuE2-3B']
        }
      ],
      trackPrompts: [
        {
          id: 'trk_v1_yue',
          projectId: 'aip_test_001',
          versionLabel: 'V1_FIDELITY',
          modelName: 'YuE2-3B',
          trackTitle: '晴天 - 原味升华版 (YuE2-3B)',
          promptContent: 'Prompt for V1 YuE2',
          lyricsPlan: 'V1 Master Lyrics: 故事的小黄花...',
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

    // Verify V1 unified plan and model prompt are displayed
    expect(getByText('《晴天 · 原味升华版》')).toBeDefined();
    expect(getByText('Prompt for V1 YuE2')).toBeDefined();
    expect(getByText(/V1 Master Lyrics: 故事的小黄花/)).toBeDefined();

    // Verify V2 prompt is NOT displayed in V1 view
    expect(queryByText('Prompt for V2 MiniMax')).toBeNull();

    // Switch tab to V2
    const v2Tab = getByText('方案2 · 跨界裂变融合');
    await fireEvent.click(v2Tab);

    expect(aiStudioStore.selectedVersion).toBe('V2_FUSION');
  });

  it('copies prompt and master lyrics to clipboard and supports per-model refine', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });
    const spyRefineModel = vi.spyOn(aiStudioStore, 'refineModel').mockResolvedValue();

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

    const { getAllByText, getByPlaceholderText } = render(AiPromptMatrixView);

    const copyBtns = getAllByText('复制');
    await fireEvent.click(copyBtns[copyBtns.length - 1]);
    expect(writeTextMock).toHaveBeenCalledWith('Prompt text\n\nLyrics text');

    const input = getByPlaceholderText(/微调 YuE2-3B Prompt/);
    await fireEvent.input(input, { target: { value: '加强木吉他扫弦' } });
    await fireEvent.click(getAllByText('微调')[0]);
    expect(spyRefineModel).toHaveBeenCalledWith('trk_v1_yue', '加强木吉他扫弦');
  });
});
