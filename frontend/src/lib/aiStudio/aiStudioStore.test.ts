import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiStudioStore } from './aiStudioStore.svelte';
import { aiStudioService } from './aiStudioService';

describe('AI Studio Store Contracts (Svelte 5 Runes)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    aiStudioStore.close();
  });

  it('initializes in closed state with LOCAL_AGY engine by default', () => {
    expect(aiStudioStore.isOpen).toBe(false);
    expect(aiStudioStore.engineType).toBe('LOCAL_AGY');
    expect(aiStudioStore.selectedVersion).toBe('V1_FIDELITY');
  });

  it('opens for a given track and initiates auto-analysis', async () => {
    const mockAnalysis = {
      refSongId: '12345',
      title: '夜曲',
      artist: '周杰伦',
      album: '十一月的萧邦',
      duration: 226,
      format: 'flac',
      bitrate: 980,
      sampleRate: 44100,
      genre: '03_mandopop_emotional_ballad',
      lyric: '为你弹奏肖邦的夜曲，纪念我死去的爱情...',
      mood: '伤感古典流行',
      instrumentation: '钢琴、古典弦乐',
      estimatedBpm: 72,
      estimatedKey: 'C minor',
      analysisSummary: '原曲分析摘要'
    };

    const spyAnalyze = vi.spyOn(aiStudioService, 'analyzeSong').mockResolvedValue(mockAnalysis);

    aiStudioStore.open({ id: 12345, name: '夜曲', artist: '周杰伦' });

    expect(aiStudioStore.isOpen).toBe(true);
    expect(aiStudioStore.currentTrack?.name).toBe('夜曲');
    expect(spyAnalyze).toHaveBeenCalledWith('12345', '夜曲', '周杰伦');

    // 等待异步分析完成
    await vi.waitFor(() => expect(aiStudioStore.analyzing).toBe(false));
    expect(aiStudioStore.analysis).toEqual(mockAnalysis);
    expect(aiStudioStore.chatMessages.length).toBeGreaterThanOrEqual(2);
  });

  it('allows toggling between LOCAL_AGY and NEW_API engine', () => {
    aiStudioStore.setEngine('NEW_API');
    expect(aiStudioStore.engineType).toBe('NEW_API');

    aiStudioStore.setEngine('LOCAL_AGY');
    expect(aiStudioStore.engineType).toBe('LOCAL_AGY');
  });

  it('generates 3x3=9 prompt matrix and organizes active prompts by selected version', async () => {
    const mockProject = {
      id: 'aip_20261124_001',
      refSongId: '12345',
      refSongTitle: '夜曲',
      refArtist: '周杰伦',
      genreCategory: '03_mandopop_emotional_ballad',
      projectDir: '/mock/path/__AI__/projects/aip_20261124_001',
      status: 'PROMPT_READY',
      createdAt: '2026-11-24 12:00:00',
      updatedAt: '2026-11-24 12:00:00',
      trackPrompts: [
        {
          id: 'p1',
          projectId: 'aip_20261124_001',
          versionLabel: 'V1_FIDELITY',
          modelName: 'YuE2-3B',
          trackTitle: '夜曲 · 经典升华',
          promptContent: 'Style: Nocturne classical...',
          lyricsPlan: '[Movement 1]...',
          modelParamsJson: '{}'
        },
        {
          id: 'p2',
          projectId: 'aip_20261124_001',
          versionLabel: 'V1_FIDELITY',
          modelName: 'MiniMax-Music3',
          trackTitle: '夜曲 · 经典升华',
          promptContent: 'Prompt: Studio vocal...',
          lyricsPlan: '[intro]...',
          modelParamsJson: '{}'
        },
        {
          id: 'p3',
          projectId: 'aip_20261124_001',
          versionLabel: 'V1_FIDELITY',
          modelName: 'ACE-Step-1.5',
          trackTitle: '夜曲 · 经典升华',
          promptContent: '[Global Metadata]...',
          lyricsPlan: '[Intro]...',
          modelParamsJson: '{}'
        },
        {
          id: 'p4',
          projectId: 'aip_20261124_001',
          versionLabel: 'V2_FUSION',
          modelName: 'YuE2-3B',
          trackTitle: '夜曲 · 跨界裂变',
          promptContent: 'Style: Crossover...',
          lyricsPlan: '[Movement 1]...',
          modelParamsJson: '{}'
        }
      ]
    };

    vi.spyOn(aiStudioService, 'generateMatrix').mockResolvedValue(mockProject);
    aiStudioStore.open({ id: 12345, name: '夜曲', artist: '周杰伦' });

    await aiStudioStore.generateMatrix();

    expect(aiStudioStore.project?.id).toBe('aip_20261124_001');
    expect(aiStudioStore.activePrompts.length).toBe(3);

    // 切换至 V2_FUSION
    aiStudioStore.selectedVersion = 'V2_FUSION';
    expect(aiStudioStore.activePrompts.length).toBe(1);
    expect(aiStudioStore.activePrompts[0].trackTitle).toBe('夜曲 · 跨界裂变');
  });

  it('supports multi-turn refine and updates project history', async () => {
    const mockProject = {
      id: 'aip_test_001',
      refSongId: '1',
      refSongTitle: '晴天',
      refArtist: '周杰伦',
      genreCategory: 'pop',
      projectDir: '/mock/path',
      status: 'PROMPT_READY',
      createdAt: '2026-11-24',
      updatedAt: '2026-11-24'
    };

    aiStudioStore.open({ id: 1, name: '晴天', artist: '周杰伦' });
    aiStudioStore.project = mockProject;

    const spyRefine = vi.spyOn(aiStudioService, 'refineProject').mockResolvedValue({
      ...mockProject,
      status: 'PROMPT_READY'
    });

    await aiStudioStore.sendRefine('歌词的高潮部分需要更多雨声与雷鸣意象');

    expect(spyRefine).toHaveBeenCalledWith('aip_test_001', '歌词的高潮部分需要更多雨声与雷鸣意象', 'LOCAL_AGY');
    const userMsg = aiStudioStore.chatMessages.find(m => m.content === '歌词的高潮部分需要更多雨声与雷鸣意象');
    expect(userMsg).toBeDefined();
    expect(userMsg?.role).toBe('user');
  });

  it('scans and syncs rendered assets and marks project as completed', async () => {
    const mockAssets = Array.from({ length: 9 }).map((_, i) => ({
      id: `asset_${i}`,
      projectId: 'aip_001',
      trackPromptId: `track_${i}`,
      audioPath: `/mock/renders/track_${i}.mp3`,
      audioDurationSeconds: 60.0,
      sampleRate: 48000,
      bitrate: 320,
      spectralEntropy: 6.9,
      rmsStd: 0.08,
      qaPassed: 1
    }));

    aiStudioStore.project = {
      id: 'aip_001',
      refSongId: '1',
      refSongTitle: '晴天',
      refArtist: '周杰伦',
      genreCategory: 'pop',
      projectDir: '/mock/path',
      status: 'OFFLINE_RENDERING',
      createdAt: '2026-11-24',
      updatedAt: '2026-11-24',
      renderedAssets: []
    };

    vi.spyOn(aiStudioService, 'syncAssets').mockResolvedValue(mockAssets);

    await aiStudioStore.syncAssets();

    expect(aiStudioStore.project.renderedAssets?.length).toBe(9);
    expect(aiStudioStore.project.status).toBe('COMPLETED');
  });
});
