<script lang="ts">
  import { aiStudioStore } from '../../lib/aiStudio/aiStudioStore.svelte';
  import AiSongProfileCard from './AiSongProfileCard.svelte';
  import AiPromptMatrixView from './AiPromptMatrixView.svelte';
  import AiChatRefineDrawer from './AiChatRefineDrawer.svelte';
  import AiAssetSyncBar from './AiAssetSyncBar.svelte';
  import { X, Sparkles } from '@lucide/svelte';

  let isOpen = $derived(aiStudioStore.isOpen);
  let currentTrack = $derived(aiStudioStore.currentTrack);

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      aiStudioStore.close();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      aiStudioStore.close();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xl animate-fade-in select-none"
    onclick={handleBackdropClick}
  >
    <div
      class="w-full max-w-7xl h-[92vh] max-h-[960px] bg-neutral-950/90 border border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-neutral-100"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- 弹窗顶栏 -->
      <div class="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-black/40 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
            <Sparkles size={16} />
          </div>
          <div>
            <div class="font-bold text-sm text-white flex items-center gap-2">
              <span>AI 音乐创作工坊 (AI Music Studio)</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-normal">
                三大顶尖模型 · 最高峰战力矩阵
              </span>
            </div>
            <div class="text-[11px] text-neutral-400">
              参考曲目：《{currentTrack?.name || '未知曲目'}》- {currentTrack?.artist || '未知艺术家'}
            </div>
          </div>
        </div>

        <button
          type="button"
          class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-neutral-400 hover:text-white transition-all cursor-pointer active:scale-95"
          onclick={() => aiStudioStore.close()}
          title="关闭"
        >
          <X size={16} />
        </button>
      </div>

      <!-- 弹窗主体内容区：三栏布局 -->
      <div class="flex-1 p-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-y-auto lg:overflow-hidden">
        <!-- 左栏：原曲特征与引擎选择 (3 cols) -->
        <div class="lg:col-span-3 h-full min-h-[300px]">
          <AiSongProfileCard />
        </div>

        <!-- 中栏：9 首 Prompt 矩阵工作台 (6 cols) -->
        <div class="lg:col-span-6 h-full min-h-[400px]">
          <AiPromptMatrixView />
        </div>

        <!-- 右栏：持续多轮追问调优 (3 cols) -->
        <div class="lg:col-span-3 h-full min-h-[300px]">
          <AiChatRefineDrawer />
        </div>
      </div>

      <!-- 底部操作与资产回扫栏 -->
      <div class="p-3 border-t border-white/10 bg-black/40 shrink-0">
        <AiAssetSyncBar />
      </div>
    </div>
  </div>
{/if}
