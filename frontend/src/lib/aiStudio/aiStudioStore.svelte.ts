import { aiStudioService } from './aiStudioService';
import type { AiChatMessage, AiProject, AiSongAnalysis, AiTrackPrompt } from './aiStudioTypes';
import { showToast } from '../toast.svelte';

class AiStudioStore {
  isOpen = $state(false);
  currentTrack = $state<{ id: string | number; name: string; artist: string } | null>(null);
  analysis = $state<AiSongAnalysis | null>(null);
  project = $state<AiProject | null>(null);
  selectedVersion = $state<'V1_FIDELITY' | 'V2_FUSION' | 'V3_EMOTIONAL'>('V1_FIDELITY');
  engineType = $state<'LOCAL_AGY' | 'NEW_API'>('LOCAL_AGY');

  analyzing = $state(false);
  generating = $state(false);
  refining = $state(false);
  syncing = $state(false);
  error = $state<string | null>(null);

  chatMessages = $state<AiChatMessage[]>([]);

  // 派生当前选中版本的 3 大模型 prompts
  activePrompts = $derived.by<AiTrackPrompt[]>(() => {
    if (!this.project || !this.project.trackPrompts) return [];
    return this.project.trackPrompts.filter(p => p.versionLabel === this.selectedVersion);
  });

  open(track: { id: string | number; name: string; artist: string }) {
    this.isOpen = true;
    this.currentTrack = track;
    this.analysis = null;
    this.project = null;
    this.error = null;
    this.selectedVersion = 'V1_FIDELITY';
    this.chatMessages = [
      {
        id: 'init-msg',
        role: 'assistant',
        content: `欢迎来到 AI 音乐创作工坊！当前参考曲目：《${track.name}》- ${track.artist || '未知艺术家'}。我将基于 3 大模型最高峰战力为您策划 9 首类似母盘定制 Prompt。`
      }
    ];

    this.runAnalysis(String(track.id), track.name, track.artist);
  }

  close() {
    this.isOpen = false;
  }

  setEngine(engine: 'LOCAL_AGY' | 'NEW_API') {
    this.engineType = engine;
    showToast(`已切换推理引擎为: ${engine === 'LOCAL_AGY' ? '本地 agy Agent' : '网络 New API'}`, 'success');
  }

  async runAnalysis(songId: string, title?: string, artist?: string) {
    this.analyzing = true;
    this.error = null;
    try {
      this.analysis = await aiStudioService.analyzeSong(songId, title, artist);
      this.chatMessages.push({
        id: `analysis-${Date.now()}`,
        role: 'assistant',
        content: `✅ 原曲声学与歌词逆向分析完成！推导流派为「${this.analysis.genre}」，情绪基调为「${this.analysis.mood}」，建议调性 ${this.analysis.estimatedKey} / ${this.analysis.estimatedBpm} BPM。随时点击【生成 9 首最高峰 Prompt 矩阵】启动创作！`
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
    try {
      this.chatMessages.push({
        id: `user-gen-${Date.now()}`,
        role: 'user',
        content: `启动生成类似歌曲：压榨三大模型最高峰战力（YuE2-3B 多乐章规划、MiniMax-Music3 录音棚微表情、ACE-Step 1.5 网格瞬态），产出 3 创意版本 x 3 模型 = 9 首曲目。`
      });

      const res = await aiStudioService.generateMatrix(
        String(this.currentTrack.id),
        this.currentTrack.name,
        this.currentTrack.artist,
        this.engineType
      );
      this.project = res;

      this.chatMessages.push({
        id: `assistant-gen-${Date.now()}`,
        role: 'assistant',
        content: `🎉 9 首曲目最高峰 Prompt 矩阵已全部规划完成并落盘本地！\n工程目录: \`${res.projectDir}\`\n如需调整歌词、配器或节奏，可在右侧随时追问我。`
      });
      showToast('9 首 Prompt 矩阵规划完成！', 'success');
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
    this.refining = true;
    this.chatMessages.push({
      id: `refine-user-${Date.now()}`,
      role: 'user',
      content: text
    });

    try {
      const updated = await aiStudioService.refineProject(this.project.id, text, this.engineType);
      this.project = updated;
      this.chatMessages.push({
        id: `refine-resp-${Date.now()}`,
        role: 'assistant',
        content: `✨ 调优建议已吸收并更新至工程！相关分段乐理与参数已完成调整。`
      });
      showToast('调优完成', 'success');
    } catch (err: any) {
      showToast(err.message || '调优执行失败', 'error');
    } finally {
      this.refining = false;
    }
  }

  async syncAssets() {
    if (!this.project) return;
    this.syncing = true;
    try {
      const assets = await aiStudioService.syncAssets(this.project.id);
      this.project.renderedAssets = assets;
      if (assets.length >= 9) {
        this.project.status = 'COMPLETED';
      }
      showToast(`扫描同步完成，共发现 ${assets.length} 首已渲染母盘`, 'success');
    } catch (err: any) {
      showToast(err.message || '扫描同步失败', 'error');
    } finally {
      this.syncing = false;
    }
  }
}

export const aiStudioStore = new AiStudioStore();
