import type { AiProject, AiRenderedAsset, AiSongAnalysis } from './aiStudioTypes';

interface ApiResponse<T> {
  code: number | string;
  msg: string;
  data: T;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
  }
  const json: ApiResponse<T> = await res.json();
  const isSuccess = json.code === '000000' || json.code === 200 || json.code === 0;
  if (!isSuccess) {
    throw new Error(json.msg || 'AI 服务请求异常');
  }
  return json.data;
}

export const aiStudioService = {
  async analyzeSong(songId: string, title?: string, artist?: string, engineType: string = 'LOCAL_AGY'): Promise<AiSongAnalysis> {
    const params = new URLSearchParams({ songId });
    if (title) params.append('title', title);
    if (artist) params.append('artist', artist);
    if (engineType) params.append('engineType', engineType);
    return request<AiSongAnalysis>(`/v3/ai/analyze?${params.toString()}`);
  },

  async generateMatrix(
    songId: string,
    title?: string,
    artist?: string,
    engineType: string = 'LOCAL_AGY',
    selectedModels?: string[],
    selectedVersions?: string[]
  ): Promise<AiProject> {
    return request<AiProject>('/v3/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ songId, title, artist, engineType, selectedModels, selectedVersions })
    });
  },

  async refineProject(
    projectId: string,
    versionLabel: string,
    instruction: string,
    engineType: string = 'LOCAL_AGY'
  ): Promise<AiProject> {
    return request<AiProject>('/v3/ai/refine', {
      method: 'POST',
      body: JSON.stringify({ projectId, versionLabel, instruction, engineType })
    });
  },

  async listProjects(limit: number = 50): Promise<AiProject[]> {
    return request<AiProject[]>(`/v3/ai/projects?limit=${limit}`);
  },

  async getProject(id: string): Promise<AiProject> {
    return request<AiProject>(`/v3/ai/project/${encodeURIComponent(id)}`);
  },

  async syncAssets(id: string): Promise<AiRenderedAsset[]> {
    return request<AiRenderedAsset[]>(`/v3/ai/project/${encodeURIComponent(id)}/sync`, {
      method: 'POST'
    });
  },

  async syncAllProjects(): Promise<{ scannedProjects: number; totalSyncedAssets: number; completedProjects: number }> {
    return request<{ scannedProjects: number; totalSyncedAssets: number; completedProjects: number }>('/v3/ai/sync-all', {
      method: 'POST'
    });
  },

  async deleteProject(id: string): Promise<boolean> {
    return request<boolean>(`/v3/ai/project/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }
};
