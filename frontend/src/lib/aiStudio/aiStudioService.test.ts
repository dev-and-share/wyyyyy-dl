import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiStudioService } from './aiStudioService';

describe('aiStudioService API Client Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('analyzeSong sends proper query parameters and parses result', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '000000',
        msg: '分析成功',
        data: {
          refSongId: '186016',
          title: '晴天',
          artist: '周杰伦',
          genre: '03_campus_nostalgia_ballad',
          estimatedBpm: 104,
          estimatedKey: 'G Major'
        }
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await aiStudioService.analyzeSong('186016', '晴天', '周杰伦', 'LOCAL_AGY');

    expect(mockFetch).toHaveBeenCalledWith(
      '/v3/ai/analyze?songId=186016&title=%E6%99%B4%E5%A4%A9&artist=%E5%91%A8%E6%9D%B0%E4%BC%A6&engineType=LOCAL_AGY',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' })
      })
    );
    expect(result.estimatedBpm).toBe(104);
    expect(result.estimatedKey).toBe('G Major');
  });

  it('generateMatrix posts dynamic selected models and versions', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '000000',
        msg: '生成成功',
        data: {
          id: 'aip_test_001',
          refSongId: '186016',
          status: 'PROMPT_READY',
          selectedModels: ['YuE2-3B', 'ACE-Step-1.5'],
          selectedVersions: ['V1_FIDELITY', 'V2_FUSION']
        }
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await aiStudioService.generateMatrix(
      '186016',
      '晴天',
      '周杰伦',
      'LOCAL_AGY',
      ['YuE2-3B', 'ACE-Step-1.5'],
      ['V1_FIDELITY', 'V2_FUSION']
    );

    expect(mockFetch).toHaveBeenCalledWith('/v3/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        songId: '186016',
        title: '晴天',
        artist: '周杰伦',
        engineType: 'LOCAL_AGY',
        selectedModels: ['YuE2-3B', 'ACE-Step-1.5'],
        selectedVersions: ['V1_FIDELITY', 'V2_FUSION']
      })
    });
    expect(result.id).toBe('aip_test_001');
    expect(result.selectedModels).toEqual(['YuE2-3B', 'ACE-Step-1.5']);
  });

  it('refineProject posts per-version session instruction', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '000000',
        msg: '调优成功',
        data: {
          id: 'aip_test_001',
          status: 'PROMPT_READY',
          lastAssistantMessage: '已为您在版本1中延长歌词。'
        }
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await aiStudioService.refineProject(
      'aip_test_001',
      'V1_FIDELITY',
      '延长歌词',
      'LOCAL_AGY'
    );

    expect(mockFetch).toHaveBeenCalledWith('/v3/ai/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'aip_test_001',
        versionLabel: 'V1_FIDELITY',
        instruction: '延长歌词',
        engineType: 'LOCAL_AGY'
      })
    });
    expect(result.lastAssistantMessage).toContain('延长歌词');
  });

  it('listProjects sends GET request with limit', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '000000',
        msg: '成功',
        data: [{ id: 'aip_1' }, { id: 'aip_2' }]
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const projects = await aiStudioService.listProjects(20);
    expect(mockFetch).toHaveBeenCalledWith('/v3/ai/projects?limit=20', expect.anything());
    expect(projects.length).toBe(2);
  });

  it('getProject sends GET request for specific id', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        msg: '成功',
        data: { id: 'aip_test' }
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const project = await aiStudioService.getProject('aip_test');
    expect(mockFetch).toHaveBeenCalledWith('/v3/ai/project/aip_test', expect.anything());
    expect(project.id).toBe('aip_test');
  });

  it('syncAssets triggers POST to /project/{id}/sync', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        msg: '成功',
        data: [{ id: 'asset_1', qaPassed: 1 }]
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const assets = await aiStudioService.syncAssets('aip_test');
    expect(mockFetch).toHaveBeenCalledWith('/v3/ai/project/aip_test/sync', expect.objectContaining({ method: 'POST' }));
    expect(assets[0].qaPassed).toBe(1);
  });

  it('syncAllProjects triggers POST to /v3/ai/sync-all', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '000000',
        msg: '全量同步完成',
        data: {
          scannedProjects: 3,
          totalSyncedAssets: 9,
          completedProjects: 1
        }
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await aiStudioService.syncAllProjects();
    expect(mockFetch).toHaveBeenCalledWith('/v3/ai/sync-all', expect.objectContaining({ method: 'POST' }));
    expect(result.scannedProjects).toBe(3);
    expect(result.totalSyncedAssets).toBe(9);
  });

  it('deleteProject triggers DELETE request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '000000',
        msg: '删除成功',
        data: true
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const ok = await aiStudioService.deleteProject('aip_test');
    expect(mockFetch).toHaveBeenCalledWith('/v3/ai/project/aip_test', expect.objectContaining({ method: 'DELETE' }));
    expect(ok).toBe(true);
  });

  it('throws error when server responds with HTTP error status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(aiStudioService.getProject('error_id')).rejects.toThrow('HTTP error 500');
  });

  it('throws error when backend returns business error code', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '999999',
        msg: '未找到原曲音轨'
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(aiStudioService.analyzeSong('999999')).rejects.toThrow('未找到原曲音轨');
  });
});
