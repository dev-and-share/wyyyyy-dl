import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AiSongProfileCard from './AiSongProfileCard.svelte';
import { aiStudioStore } from '../../lib/aiStudio/aiStudioStore.svelte';

describe('AiSongProfileCard Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    aiStudioStore.close();
    aiStudioStore.open({ id: 186016, name: '晴天', artist: '周杰伦' });
  });

  it('renders default 3x3=9 configuration', () => {
    const { getByText } = render(AiSongProfileCard);

    expect(getByText('推理引擎')).toBeDefined();
    expect(getByText(/生成编曲方案 \(9\)/)).toBeDefined();
  });

  it('switches engine type on button click', async () => {
    const { getByText } = render(AiSongProfileCard);

    const netApiBtn = getByText('New API');
    await fireEvent.click(netApiBtn);
    expect(aiStudioStore.engineType).toBe('NEW_API');

    const agyBtn = getByText('本地 agy');
    await fireEvent.click(agyBtn);
    expect(aiStudioStore.engineType).toBe('LOCAL_AGY');
  });

  it('toggles model selection and updates planned song count calculation', async () => {
    const { getByText } = render(AiSongProfileCard);

    // Toggle off ACE-Step 1.5 -> from 3 to 2 models
    const aceBtn = getByText('ACE-Step 1.5');
    await fireEvent.click(aceBtn);

    expect(aiStudioStore.selectedModels).toEqual(['YuE2-3B', 'MiniMax-Music3']);
    expect(aiStudioStore.totalPlannedSongs).toBe(6);
    expect(getByText(/生成编曲方案 \(6\)/)).toBeDefined();

    // Toggle off V3_EMOTIONAL -> from 3 to 2 versions
    const v3Btn = getByText('方案3 · 情绪');
    await fireEvent.click(v3Btn);

    expect(aiStudioStore.selectedVersions).toEqual(['V1_FIDELITY', 'V2_FUSION']);
    expect(aiStudioStore.totalPlannedSongs).toBe(4);
    expect(getByText(/生成编曲方案 \(4\)/)).toBeDefined();
  });

  it('renders acoustic & music theory analysis details when present', () => {
    aiStudioStore.analysis = {
      refSongId: '186016',
      title: '晴天',
      artist: '周杰伦',
      album: '叶惠美',
      duration: 269,
      format: 'mp3',
      bitrate: 320,
      sampleRate: 44100,
      genre: '03_campus_nostalgia_ballad',
      lyric: '故事的小黄花 从出生那年就飘着...',
      mood: '校园初恋、遗憾怀旧、轻快律动',
      instrumentation: '原声木吉他扫弦、低保真失真电吉他、架子鼓',
      estimatedBpm: 104,
      estimatedKey: 'G Major',
      analysisSummary: '经典校园民谣摇滚'
    };
    aiStudioStore.analyzing = false;

    const { getByText } = render(AiSongProfileCard);

    expect(getByText('03_campus_nostalgia_ballad')).toBeDefined();
    expect(getByText('G Major · 104 BPM')).toBeDefined();
    expect(getByText('MP3 · 320k · 44100Hz')).toBeDefined();
    expect(getByText(/原声木吉他扫弦/)).toBeDefined();
    expect(getByText(/校园初恋、遗憾怀旧、轻快律动/)).toBeDefined();
  });

  it('triggers reAnalyze when 重新提取 button is clicked', async () => {
    const spyReAnalyze = vi.spyOn(aiStudioStore, 'reAnalyze').mockResolvedValue();
    aiStudioStore.analysis = {
      refSongId: '186016',
      title: '晴天',
      artist: '周杰伦',
      album: '叶惠美',
      duration: 269,
      format: 'mp3',
      bitrate: 320,
      sampleRate: 44100,
      genre: '03_campus_nostalgia_ballad',
      lyric: '',
      mood: '轻快',
      instrumentation: '木吉他',
      estimatedBpm: 104,
      estimatedKey: 'G Major',
      analysisSummary: '摘要'
    };
    aiStudioStore.analyzing = false;

    const { getByText } = render(AiSongProfileCard);
    await fireEvent.click(getByText('重新提取'));
    expect(spyReAnalyze).toHaveBeenCalledTimes(1);
  });

  it('shows loader when analyzing is true', () => {
    aiStudioStore.analyzing = true;
    aiStudioStore.analysis = null;

    const { getByText } = render(AiSongProfileCard);
    expect(getByText('提取中...')).toBeDefined();
  });

  it('triggers generateMatrix on button click', async () => {
    const spyGenerate = vi.spyOn(aiStudioStore, 'generateMatrix').mockResolvedValue();

    const { getByText } = render(AiSongProfileCard);
    const generateBtn = getByText(/生成编曲方案 \(9\)/);
    await fireEvent.click(generateBtn);

    expect(spyGenerate).toHaveBeenCalledTimes(1);
  });
});
