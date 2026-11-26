import { aiStudioService } from './aiStudioService';
import type { AiChatMessage, AiProject, AiSongAnalysis, AiTrackPrompt, AiVersionPlan } from './aiStudioTypes';
import { showToast } from '../toast.svelte';

class AiStudioStore {
  isOpen = $state(false);
  currentTrack = $state<{ id: string | number; name: string; artist: string } | null>(null);
  analysis = $state<AiSongAnalysis | null>(null);
  project = $state<AiProject | null>(null);

  // 当前主工作台查看的版本
  selectedVersion = $state<'V1_FIDELITY' | 'V2_FUSION' | 'V3_EMOTIONAL'>('V1_FIDELITY');

  // 模型与创意版本的勾选多选状态 (自由组合参数化)
  selectedModels = $state<string[]>(['YuE2-3B', 'MiniMax-Music3', 'ACE-Step-1.5']);
  selectedVersions = $state<string[]>(['V1_FIDELITY', 'V2_FUSION', 'V3_EMOTIONAL']);

  engineType = $state<'LOCAL_AGY' | 'NEW_API'>('LOCAL_AGY');

  analyzing = $state(false);
  generating = $state(false);
  refining = $state(false);
  updatingModels = $state(false);
  refiningModelId = $state<string | null>(null);
  syncing = $state(false);
  error = $state<string | null>(null);

  chatMessages = $state<AiChatMessage[]>([]);

  // 派生计划生成的总曲目数 M x N
  totalPlannedSongs = $derived(this.selectedModels.length * this.selectedVersions.length);

  // 派生当前选中版本的已选模型 prompts
  activePrompts = $derived.by<AiTrackPrompt[]>(() => {
    if (!this.project || !this.project.trackPrompts) return [];
    return this.project.trackPrompts.filter(p => p.versionLabel === this.selectedVersion);
  });

  // 派生当前选中版本的「独立歌词与编曲主方案」(优先读取 DB versionPlans，兼容旧数据兜底)
  activeVersionPlan = $derived.by<AiVersionPlan | null>(() => {
    if (!this.project) return null;
    const plan = this.project.versionPlans?.find(v => v.versionLabel === this.selectedVersion);
    if (plan) return plan;
    const prompts = this.activePrompts;
    if (prompts.length === 0) return null;
    return {
      id: `${this.project.id}_${this.selectedVersion.toLowerCase()}`,
      projectId: this.project.id,
      versionLabel: this.selectedVersion,
      planTitle: prompts[0].trackTitle,
      genre: this.project.genreCategory || '',
      bpm: this.analysis?.estimatedBpm || 104,
      musicalKey: this.analysis?.estimatedKey || 'G Major',
      arrangementNotes: '本版本共享主编曲与乐理企划（可通过右侧独立 AI Session 聊天微调并落盘 DB）',
      lyricsText: prompts[0].lyricsPlan,
      appliedModels: prompts.map(p => p.modelName)
    };
  });

  // 派生当前激活版本的追问会话记录 (支持每版本独立追问)
  currentVersionMessages = $derived.by<AiChatMessage[]>(() => {
    return this.chatMessages.filter(
      m => !m.versionLabel || m.versionLabel === 'ALL' || m.versionLabel === this.selectedVersion
    );
  });

  toggleModel(model: string) {
    if (this.selectedModels.includes(model)) {
      if (this.selectedModels.length <= 1) {
        showToast('至少需要保留 1 个模型', 'warning');
        return;
      }
      this.selectedModels = this.selectedModels.filter(m => m !== model);
    } else {
      this.selectedModels = [...this.selectedModels, model];
    }
  }

  toggleVersion(version: string) {
    if (this.selectedVersions.includes(version)) {
      if (this.selectedVersions.length <= 1) {
        showToast('至少需要保留 1 个创意版本', 'warning');
        return;
      }
      this.selectedVersions = this.selectedVersions.filter(v => v !== version);
    } else {
      this.selectedVersions = [...this.selectedVersions, version];
    }
  }

  open(track: { id: string | number; name: string; artist: string }) {
    this.isOpen = true;
    this.currentTrack = track;
    this.analysis = null;
    this.project = null;
    this.error = null;
    this.selectedVersion = 'V1_FIDELITY';
    this.selectedModels = ['YuE2-3B', 'MiniMax-Music3', 'ACE-Step-1.5'];
    this.selectedVersions = ['V1_FIDELITY', 'V2_FUSION', 'V3_EMOTIONAL'];

    this.chatMessages = [
      {
        id: 'init-msg',
        versionLabel: 'ALL',
        role: 'assistant',
        content: `欢迎来到 AI 音乐创作工坊！当前参考曲目：《${track.name}》- ${track.artist || '未知艺术家'}。\n已接入真实本地 agy 乐理分析引擎。可在左侧自由勾选模型与创意版本，支持定制 M × N 首母盘并随时追问。`
      }
    ];

    this.runAnalysis(String(track.id), track.name, track.artist, false);
    this.restoreSavedProject(String(track.id));
  }

  close() {
    this.isOpen = false;
  }

  setEngine(engine: 'LOCAL_AGY' | 'NEW_API') {
    this.engineType = engine;
    showToast(`已切换推理引擎为: ${engine === 'LOCAL_AGY' ? '本地 agy Agent' : '网络 New API'}`, 'success');
  }

  async restoreSavedProject(songId: string) {
    try {
      if (typeof aiStudioService.getLatestProjectBySong !== 'function') return;
      const saved = await aiStudioService.getLatestProjectBySong(songId);
      if (saved && this.currentTrack && String(this.currentTrack.id) === songId) {
        this.project = saved;
        if (saved.trackPrompts && saved.trackPrompts.length > 0) {
          const models = Array.from(new Set(saved.trackPrompts.map(p => p.modelName)));
          const versions = Array.from(new Set(saved.trackPrompts.map(p => p.versionLabel)));
          if (models.length > 0) this.selectedModels = models;
          if (versions.length > 0) {
            this.selectedVersions = versions;
            if (!versions.includes(this.selectedVersion)) {
              this.selectedVersion = versions[0] as 'V1_FIDELITY' | 'V2_FUSION' | 'V3_EMOTIONAL';
            }
          }
        }
        if (saved.sessionHistories && saved.sessionHistories.length > 0) {
          const restoredMsgs: AiChatMessage[] = saved.sessionHistories.map(h => ({
            id: h.id,
            versionLabel: h.versionLabel || 'ALL',
            role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: h.content,
            createdAt: h.createdAt
          }));
          this.chatMessages = [...this.chatMessages, ...restoredMsgs];
        }
        showToast('已从本地数据库恢复上次创作工程与对话记录', 'success');
      }
    } catch {
      // 静默忽略，不影响新工程创建
    }
  }

  async reAnalyze() {
    if (!this.currentTrack) return;
    await this.runAnalysis(String(this.currentTrack.id), this.currentTrack.name, this.currentTrack.artist, true);
    showToast('已重新提取原曲乐理与声学特征并更新数据库', 'success');
  }

  async retryFromScratch() {
    if (!this.currentTrack) return;
    const track = this.currentTrack;
    this.project = null;
    this.analysis = null;
    this.error = null;
    this.selectedVersion = 'V1_FIDELITY';
    this.selectedModels = ['YuE2-3B', 'MiniMax-Music3', 'ACE-Step-1.5'];
    this.selectedVersions = ['V1_FIDELITY', 'V2_FUSION', 'V3_EMOTIONAL'];
    this.chatMessages = [
      {
        id: `retry-init-${Date.now()}`,
        versionLabel: 'ALL',
        role: 'assistant',
        content: `🔄 已开启全新创作流程！正在重新调用真实 agy 引擎逆向解构《${track.name}》...`
      }
    ];
    await this.runAnalysis(String(track.id), track.name, track.artist, true);
  }

  async runAnalysis(songId: string, title?: string, artist?: string, forceRefresh: boolean = false) {
    this.analyzing = true;
    this.error = null;
    try {
      this.analysis = forceRefresh
        ? await aiStudioService.analyzeSong(songId, title, artist, this.engineType, true)
        : await aiStudioService.analyzeSong(songId, title, artist, this.engineType);
      this.chatMessages.push({
        id: `analysis-${Date.now()}`,
        versionLabel: 'ALL',
        role: 'assistant',
        content: `🎯 原曲声学与乐理逆向解构完成！\n- 赛道: **${this.analysis.genre}**\n- 调性/速度: **${this.analysis.estimatedKey}** / **${this.analysis.estimatedBpm} BPM**\n- 情绪基调: ${this.analysis.mood}\n- 标志配器: ${this.analysis.instrumentation}\n随时点击【生成 Prompt 矩阵】启动创作！`
      });
    } catch (err: any) {
      this.error = err.message || '原曲特征解构失败';
      showToast(this.error || '解构失败', 'error');
    } finally {
      this.analyzing = false;
    }
  }

  async generateMatrix() {
    if (!this.currentTrack) return;
    this.generating = true;
    this.error = null;
    const count = this.totalPlannedSongs;
    try {
      this.chatMessages.push({
        id: `user-gen-${Date.now()}`,
        versionLabel: 'ALL',
        role: 'user',
        content: `启动生成类似歌曲：自由选择 ${this.selectedModels.length} 个模型 × ${this.selectedVersions.length} 个版本 = 共 ${count} 首曲目规划矩阵。`
      });

      const res = await aiStudioService.generateMatrix(
        String(this.currentTrack.id),
        this.currentTrack.name,
        this.currentTrack.artist,
        this.engineType,
        this.selectedModels,
        this.selectedVersions
      );
      this.project = res;

      this.chatMessages.push({
        id: `assistant-gen-${Date.now()}`,
        versionLabel: 'ALL',
        role: 'assistant',
        content: `🎉 ${count} 首曲目 Prompt 矩阵与 3 套独立长篇歌词已规划完成并落盘本地！\n工程目录: \`${res.projectDir}\`\n当前每个版本都拥有独立的 agy 会话上下文，可针对各版本随时在右侧进行追问与歌词深化。`
      });
      showToast(`${count} 首 Prompt 矩阵规划完成！`, 'success');
    } catch (err: any) {
      this.error = err.message || 'Prompt 矩阵生成失败';
      showToast(this.error || '生成失败', 'error');
    } finally {
      this.generating = false;
    }
  }

  async sendRefine(instruction: string) {
    if (!this.project || !instruction.trim()) return;
    const text = instruction.trim();
    const currentVer = this.selectedVersion;
    this.refining = true;
    this.chatMessages.push({
      id: `refine-user-${Date.now()}`,
      versionLabel: currentVer,
      role: 'user',
      content: text
    });

    try {
      const updated = await aiStudioService.refineProject(this.project.id, currentVer, text, this.engineType);
      this.project = updated;

      // 展示 AI 真实的回复与思考过程
      const replyContent = updated.lastAssistantMessage || '已基于指令完成乐理与歌词深度调整，相关音轨已同步刷新。';
      this.chatMessages.push({
        id: `refine-resp-${Date.now()}`,
        versionLabel: currentVer,
        role: 'assistant',
        content: replyContent
      });
      showToast('调优完成，已同步更新音轨！', 'success');
    } catch (err: any) {
      showToast(err.message || '调优执行失败', 'error');
      this.chatMessages.push({
        id: `refine-err-${Date.now()}`,
        versionLabel: currentVer,
        role: 'assistant',
        content: `❌ 追问执行异常: ${err.message || '未知错误'}`
      });
    } finally {
      this.refining = false;
    }
  }

  async toggleActiveVersionModel(model: string) {
    if (!this.project || this.updatingModels) return;
    const currentPlan = this.activeVersionPlan;
    const currentModels = currentPlan?.appliedModels?.length
      ? [...currentPlan.appliedModels]
      : this.activePrompts.map(p => p.modelName);

    let nextModels: string[];
    if (currentModels.includes(model)) {
      if (currentModels.length <= 1) {
        showToast('当前编曲方案至少需要保留 1 个渲染模型', 'warning');
        return;
      }
      nextModels = currentModels.filter(m => m !== model);
    } else {
      nextModels = [...currentModels, model];
    }

    this.updatingModels = true;
    try {
      const updated = await aiStudioService.updateVersionModels(this.project.id, this.selectedVersion, nextModels);
      this.project = updated;
      showToast(`已将本套歌词编曲应用至 ${nextModels.length} 个模型`, 'success');
    } catch (err: any) {
      showToast(err.message || '切换应用模型失败', 'error');
    } finally {
      this.updatingModels = false;
    }
  }

  async refineModel(trackPromptId: string, instruction: string) {
    if (!this.project || !instruction.trim() || this.refiningModelId) return;
    this.refiningModelId = trackPromptId;
    try {
      const updated = await aiStudioService.refineModelPrompt(
        this.project.id,
        trackPromptId,
        instruction.trim(),
        this.engineType
      );
      this.project = updated;
      showToast(updated.lastAssistantMessage || '模型专属微调完成！', 'success');
    } catch (err: any) {
      showToast(err.message || '模型微调失败', 'error');
    } finally {
      this.refiningModelId = null;
    }
  }

  async syncAssets() {
    if (!this.project) return;
    this.syncing = true;
    try {
      const assets = await aiStudioService.syncAssets(this.project.id);
      this.project.renderedAssets = assets;
      if (assets.length >= (this.project.trackPrompts?.length || 9)) {
        this.project.status = 'COMPLETED';
      }
      showToast(`扫描同步完成，发现 ${assets.length} 首已渲染母盘`, 'success');
    } catch (err: any) {
      showToast(err.message || '扫描同步失败', 'error');
    } finally {
      this.syncing = false;
    }
  }

  async syncAllProjects() {
    this.syncing = true;
    try {
      const res = await aiStudioService.syncAllProjects();
      showToast(`全量扫描完成！已扫 ${res.scannedProjects} 工程，新同步 ${res.totalSyncedAssets} 首母盘`, 'success');
    } catch (err: any) {
      showToast(err.message || '全量扫描失败', 'error');
    } finally {
      this.syncing = false;
    }
  }

  async queueForGpu() {
    if (!this.project) return;
    try {
      const updated = await aiStudioService.queueProjectForGpu(this.project.id);
      this.project = updated;
      showToast('已加入 GPU 批量生产等待队列并落盘 DB！', 'success');
    } catch (err: any) {
      showToast(err.message || '加入队列失败', 'error');
    }
  }
}

export const aiStudioStore = new AiStudioStore();
