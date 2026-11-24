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

  it('renders track title, artist and default 3x3=9 configuration', () => {
    const { getByText } = render(AiSongProfileCard);

    expect(getByText('晴天')).toBeDefined();
    expect(getByText('周杰伦')).toBeDefined();
    expect(getByText(/3 模型 × 3 版本 = 9 首/)).toBeDefined();
    expect(getByText(/生成 9 首最高峰 Prompt 矩阵/)).toBeDefined();
  });

  it('switches engine type on button click', async () => {
    const { getByText } = render(AiSongProfileCard);

    const netApiBtn = getByText('网络 New API');
    await fireEvent.click(netApiBtn);
    expect(aiStudioStore.engineType).toBe('NEW_API');

    const agyBtn = getByText('本地 agy CLI');
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
    expect(getByText(/2 模型 × 3 版本 = 6 首/)).toBeDefined();
    expect(getByText(/生成 6 首最高峰 Prompt 矩阵/)).toBeDefined();

    // Toggle off V3_EMOTIONAL -> from 3 to 2 versions
    const v3Btn = getByText('版本3 · 极致情绪');
    await fireEvent.click(v3Btn);

    expect(aiStudioStore.selectedVersions).toEqual(['V1_FIDELITY', 'V2_FUSION']);
    expect(aiStudioStore.totalPlannedSongs).toBe(4);
    expect(getByText(/2 模型 × 2 版本 = 4 首/)).toBeDefined();
    expect(getByText(/生成 4 首最高峰 Prompt 矩阵/)).toBeDefined();
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

  it('shows loader when analyzing is true', () => {
    aiStudioStore.analyzing = true;
    aiStudioStore.analysis = null;

    const { getByText } = render(AiSongProfileCard);
    expect(getByText('agy 正在逆向提取原曲乐理与情绪...')).toBeDefined();
  });

  it('triggers generateMatrix on button click', async () => {
    const spyGenerate = vi.spyOn(aiStudioStore, 'generateMatrix').mockResolvedValue();

    const { getByText } = render(AiSongProfileCard);
    const generateBtn = getByText(/生成 9 首最高峰 Prompt 矩阵/);
    await fireEvent.click(generateBtn);

    expect(spyGenerate).toHaveBeenCalledTimes(1);
  });
});
