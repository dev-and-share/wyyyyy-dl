<script lang="ts">
  import { aiStudioStore } from '../../lib/aiStudio/aiStudioStore.svelte';
  import { Loader2, Sparkles, Cpu, Globe, Music, Disc, Layers } from '@lucide/svelte';

  let analysis = $derived(aiStudioStore.analysis);
  let analyzing = $derived(aiStudioStore.analyzing);
  let generating = $derived(aiStudioStore.generating);
  let project = $derived(aiStudioStore.project);
  let engineType = $derived(aiStudioStore.engineType);
</script>

<div class="flex flex-col gap-3.5 h-full bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-xs text-neutral-300 overflow-y-auto">
  <!-- 头部：参考曲目信息 -->
  <div class="flex items-center gap-2.5 pb-3 border-b border-white/10">
    <div class="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
      <Music size={20} />
    </div>
    <div class="min-w-0 flex-1">
      <div class="text-sm font-bold text-white truncate">
        {aiStudioStore.currentTrack?.name || '未知曲目'}
      </div>
      <div class="text-[11px] text-neutral-400 truncate">
        {aiStudioStore.currentTrack?.artist || '未知艺术家'}
      </div>
    </div>
  </div>

  <!-- 引擎选择器 (本地 agy vs 网络 New API) -->
  <div class="bg-neutral-900/60 rounded-xl p-2.5 border border-white/5 flex flex-col gap-2">
    <div class="text-[11px] font-semibold text-neutral-400 flex items-center justify-between">
      <span>AI 推理引擎选择</span>
      <span class="text-[10px] text-purple-400 font-mono">
        {engineType === 'LOCAL_AGY' ? '本地高算力' : '云端中转'}
      </span>
    </div>
    <div class="grid grid-cols-2 gap-1.5 p-0.5 bg-black/40 rounded-lg">
      <button
        type="button"
        class="py-1.5 px-2 rounded-md font-medium text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer {engineType === 'LOCAL_AGY'
          ? 'bg-purple-600 text-white shadow-sm'
          : 'text-neutral-400 hover:text-white'}"
        onclick={() => aiStudioStore.setEngine('LOCAL_AGY')}
      >
        <Cpu size={13} />
        <span>本地 agy CLI</span>
      </button>
      <button
        type="button"
        class="py-1.5 px-2 rounded-md font-medium text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer {engineType === 'NEW_API'
          ? 'bg-purple-600 text-white shadow-sm'
          : 'text-neutral-400 hover:text-white'}"
        onclick={() => aiStudioStore.setEngine('NEW_API')}
      >
        <Globe size={13} />
        <span>网络 New API</span>
      </button>
    </div>
  </div>

  <!-- 原曲解构分析报告 -->
  <div class="flex-1 flex flex-col gap-2 min-h-0">
    <div class="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
      <Disc size={13} class="text-purple-400" />
      <span>原曲声学与乐理逆向解构</span>
    </div>

    {#if analyzing}
      <div class="flex-1 flex flex-col items-center justify-center py-8 text-neutral-400 gap-2">
        <Loader2 size={24} class="animate-spin text-purple-400" />
        <span class="text-[11px]">正在提取 ID3、物理声学与歌词特征...</span>
      </div>
    {:else if analysis}
      <div class="space-y-2 bg-neutral-900/40 p-3 rounded-xl border border-white/5 overflow-y-auto">
        <div class="flex justify-between items-center py-0.5 border-b border-white/5">
          <span class="text-neutral-400">推导风格赛道</span>
          <span class="font-semibold text-purple-300 font-mono text-[11px]">{analysis.genre}</span>
        </div>
        <div class="flex justify-between items-center py-0.5 border-b border-white/5">
          <span class="text-neutral-400">建议调性 / BPM</span>
          <span class="font-medium text-neutral-200">{analysis.estimatedKey} / {analysis.estimatedBpm} BPM</span>
        </div>
        <div class="flex justify-between items-center py-0.5 border-b border-white/5">
          <span class="text-neutral-400">音频物理规格</span>
          <span class="font-mono text-neutral-200">{analysis.format.toUpperCase()} · {analysis.bitrate}k · {analysis.sampleRate}Hz</span>
        </div>
        <div class="py-1">
          <div class="text-neutral-400 mb-0.5">主配器与氛围：</div>
          <div class="text-neutral-300 text-[11px] leading-relaxed">{analysis.instrumentation}</div>
        </div>
        <div class="py-1">
          <div class="text-neutral-400 mb-0.5">情绪基调：</div>
          <div class="text-neutral-300 text-[11px] leading-relaxed">{analysis.mood}</div>
        </div>
      </div>
    {:else}
      <div class="text-center py-6 text-neutral-500 text-[11px]">
        暂无解析数据
      </div>
    {/if}
  </div>

  <!-- 触发生成 9 首 Prompt 按钮 -->
  <button
    type="button"
    class="w-full py-2.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    disabled={analyzing || generating || !analysis}
    onclick={() => aiStudioStore.generateMatrix()}
  >
    {#if generating}
      <Loader2 size={16} class="animate-spin" />
      <span>三大模型最高峰推演中...</span>
    {:else}
      <Sparkles size={16} class="text-amber-300" />
      <span>{project ? '重新生成 9 首 Prompt 矩阵' : '生成 9 首最高峰 Prompt 矩阵'}</span>
    {/if}
  </button>
</div>
