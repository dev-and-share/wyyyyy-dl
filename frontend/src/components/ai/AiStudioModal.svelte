<script lang="ts">
  import { aiStudioStore } from '../../lib/aiStudio/aiStudioStore.svelte';
  import AiSongProfileCard from './AiSongProfileCard.svelte';
  import AiPromptMatrixView from './AiPromptMatrixView.svelte';
  import AiChatRefineDrawer from './AiChatRefineDrawer.svelte';
  import AiAssetSyncBar from './AiAssetSyncBar.svelte';
  import { X, Sparkles, SlidersHorizontal, Disc3 } from '@lucide/svelte';

  let isOpen = $derived(aiStudioStore.isOpen);
  let currentTrack = $derived(aiStudioStore.currentTrack);
  let plannedCount = $derived(aiStudioStore.totalPlannedSongs);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      aiStudioStore.close();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isOpen}
  <!-- 全屏沉浸式 AI 音乐创作平台 (无顶部大门牙断层，无缝接管工作台) -->
  <div
    class="fixed inset-0 z-[10000] bg-neutral-950 text-neutral-100 flex flex-col overflow-hidden select-none animate-fade-in"
  >
    <!-- 创作平台统一顶栏 -->
    <header class="h-14 px-5 border-b border-white/10 flex items-center justify-between bg-black/60 backdrop-blur-xl shrink-0 z-20">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/25">
          <Sparkles size={16} />
        </div>
        <div>
          <div class="font-bold text-sm text-white flex items-center gap-2">
            <span>AI 音乐创作工坊 · Studio Master</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium flex items-center gap-1">
              <Disc3 size={11} class="animate-spin" />
              自由组合：{aiStudioStore.selectedModels.length} 模型 × {aiStudioStore.selectedVersions.length} 版本 ({plannedCount} 首)
            </span>
          </div>
          <div class="text-[11px] text-neutral-400 flex items-center gap-2">
            <span>参考曲目：《{currentTrack?.name || '未知曲目'}》- {currentTrack?.artist || '未知艺术家'}</span>
            <span class="text-neutral-600">•</span>
            <span class="text-purple-400/80 font-mono text-[10px]">Real agy Multi-Session Agent</span>
          </div>
        </div>
      </div>

      <!-- 右侧控制项 -->
      <div class="flex items-center gap-2.5">
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs text-neutral-300 hover:text-white transition-all cursor-pointer border border-white/10"
          onclick={() => aiStudioStore.syncAllProjects()}
          title="全量扫描所有歌曲的已渲染音频"
        >
          <SlidersHorizontal size={13} />
          <span>全量扫描资产</span>
        </button>

        <button
          type="button"
          class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 hover:text-white transition-all cursor-pointer active:scale-95"
          onclick={() => aiStudioStore.close()}
          title="关闭 (Esc)"
        >
          <X size={16} />
        </button>
      </div>
    </header>

    <!-- 工作台主体内容区：三栏专业架构 -->
    <div class="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-3.5 min-h-0 overflow-y-auto lg:overflow-hidden bg-radial from-neutral-900/60 to-neutral-950">
      <!-- 左栏：原曲真实解构与组合参数勾选 (3 cols) -->
      <div class="lg:col-span-3 h-full min-h-[320px] flex flex-col">
        <AiSongProfileCard />
      </div>

      <!-- 中栏：Prompt 矩阵与 3 套独立长篇歌词工作台 (6 cols) -->
      <div class="lg:col-span-6 h-full min-h-[420px] flex flex-col">
        <AiPromptMatrixView />
      </div>

      <!-- 右栏：按版本独立 Session 的多轮追问与歌词重写 (3 cols) -->
      <div class="lg:col-span-3 h-full min-h-[320px] flex flex-col">
        <AiChatRefineDrawer />
      </div>
    </div>

    <!-- 底部操作与一键批处理指引栏 -->
    <footer class="px-4 py-2.5 border-t border-white/10 bg-black/60 backdrop-blur-xl shrink-0">
      <AiAssetSyncBar />
    </footer>
  </div>
{/if}
