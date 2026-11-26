/**
 * 🎨 AI 音乐创作工坊前端类型定义
 */

export interface AiSongAnalysis {
  refSongId: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  format: string;
  bitrate: number;
  sampleRate: number;
  genre: string;
  lyric: string;
  mood: string;
  instrumentation: string;
  estimatedBpm: number;
  estimatedKey: string;
  analysisSummary: string;
}

export interface AiTrackPrompt {
  id: string;
  projectId: string;
  versionLabel: 'V1_FIDELITY' | 'V2_FUSION' | 'V3_EMOTIONAL' | string;
  modelName: 'YuE2-3B' | 'MiniMax-Music3' | 'ACE-Step-1.5' | string;
  trackTitle: string;
  promptContent: string;
  lyricsPlan: string;
  modelParamsJson: string;
  createdAt?: string;
}

export interface AiRenderedAsset {
  id: string;
  projectId: string;
  trackPromptId: string;
  audioPath: string;
  audioDurationSeconds: number;
  sampleRate: number;
  bitrate: number;
  spectralEntropy: number;
  rmsStd: number;
  qaPassed: number;
  syncedAt?: string;
}

export interface AiVersionPlan {
  id: string;
  projectId: string;
  versionLabel: 'V1_FIDELITY' | 'V2_FUSION' | 'V3_EMOTIONAL' | string;
  planTitle: string;
  genre: string;
  bpm: number;
  musicalKey: string;
  arrangementNotes: string;
  lyricsText: string;
  sessionId?: string;
  appliedModels: string[];
  updatedAt?: string;
}

export interface AiProject {
  id: string;
  refSongId: string;
  refSongTitle: string;
  refArtist: string;
  genreCategory: string;
  projectDir: string;
  status: 'CREATED' | 'PROMPT_READY' | 'OFFLINE_RENDERING' | 'COMPLETED' | string;
  createdAt: string;
  updatedAt: string;
  analysisReport?: string;
  trackPrompts?: AiTrackPrompt[];
  versionPlans?: AiVersionPlan[];
  renderedAssets?: AiRenderedAsset[];
  lastAssistantMessage?: string;
  selectedModels?: string[];
  selectedVersions?: string[];
  sessionHistories?: {
    id: string;
    projectId: string;
    versionLabel?: string;
    engineType: string;
    sessionId: string;
    role: string;
    content: string;
    createdAt?: string;
  }[];
}

export interface AiChatMessage {
  id: string;
  versionLabel?: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt?: string;
}
