import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AiAssetSyncBar from './AiAssetSyncBar.svelte';
import { aiStudioStore } from '../../lib/aiStudio/aiStudioStore.svelte';

describe('AiAssetSyncBar Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    aiStudioStore.close();
  });

  it('renders default project directory when no project is loaded', () => {
    const { getByText } = render(AiAssetSyncBar);
    expect(getByText('工程落盘目录: ./__AI__/projects/')).toBeDefined();
    expect(getByText('全量同步')).toBeDefined();
    expect(getByText('同步当前工程 (Scan & Sync)')).toBeDefined();
  });

  it('renders project directory and status when project is loaded', () => {
    aiStudioStore.project = {
      id: 'aip_001',
      projectDir: '/my/workspace/__AI__/projects/aip_001',
      status: 'PROMPT_READY',
      renderedAssets: []
    } as any;

    const { getByText } = render(AiAssetSyncBar);
    expect(getByText('/my/workspace/__AI__/projects/aip_001')).toBeDefined();
    expect(getByText('等待离线批处理')).toBeDefined();
  });

  it('triggers syncAllProjects when 全量同步 button is clicked', async () => {
    const spySyncAll = vi.spyOn(aiStudioStore, 'syncAllProjects').mockResolvedValue();

    const { getByTitle } = render(AiAssetSyncBar);
    const syncAllBtn = getByTitle('全量扫描所有歌曲已渲染的母盘');
    await fireEvent.click(syncAllBtn);

    expect(spySyncAll).toHaveBeenCalledTimes(1);
  });

  it('triggers syncAssets when 同步当前工程 button is clicked', async () => {
    aiStudioStore.project = {
      id: 'aip_001',
      projectDir: '/my/workspace/__AI__/projects/aip_001',
      status: 'PROMPT_READY',
      renderedAssets: []
    } as any;

    const spySync = vi.spyOn(aiStudioStore, 'syncAssets').mockResolvedValue();

    const { getByTitle } = render(AiAssetSyncBar);
    const syncBtn = getByTitle('扫描当前工程渲染音频做资产管理');
    await fireEvent.click(syncBtn);

    expect(spySync).toHaveBeenCalledTimes(1);
  });

  it('displays rendered assets with QA passed badge and play buttons', () => {
    aiStudioStore.project = {
      id: 'aip_001',
      projectDir: '/my/workspace/__AI__/projects/aip_001',
      status: 'COMPLETED',
      renderedAssets: [
        {
          id: 'asset_01',
          projectId: 'aip_001',
          audioPath: '/path/to/01_master_yue2.mp3',
          audioDurationSeconds: 180,
          sampleRate: 48000,
          bitrate: 320,
          spectralEntropy: 6.8,
          rmsStd: 0.08,
          qaPassed: 1
        }
      ]
    } as any;

    const { getByText } = render(AiAssetSyncBar);
    expect(getByText('母盘全量就绪')).toBeDefined();
    expect(getByText('已就绪母盘 (1首):')).toBeDefined();
    expect(getByText('01_master_yue2.mp3')).toBeDefined();
    expect(getByText('熵:6.80')).toBeDefined();
  });
});
