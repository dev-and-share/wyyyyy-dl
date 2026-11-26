<script lang="ts">
  import { aiStudioStore } from '../../lib/aiStudio/aiStudioStore.svelte';
  import { Loader2, Sparkles, Cpu, Globe, Disc, CheckSquare, Square, RotateCcw } from '@lucide/svelte';

  let analysis = $derived(aiStudioStore.analysis);
  let analyzing = $derived(aiStudioStore.analyzing);
  let generating = $derived(aiStudioStore.generating);
  let project = $derived(aiStudioStore.project);
  let engineType = $derived(aiStudioStore.engineType);
  let plannedCount = $derived(aiStudioStore.totalPlannedSongs);

  const availableModels = [
    { id: 'YuE2-3B', label: 'YuE2-3B' },
    { id: 'MiniMax-Music3', label: 'MiniMax-Music3' },
    { id: 'ACE-Step-1.5', label: 'ACE-Step 1.5' }
  ];

  const availableVersions = [
    { id: 'V1_FIDELITY', label: '方案1 · 原味' },
    { id: 'V2_FUSION', label: '方案2 · 跨界' },
    { id: 'V3_EMOTIONAL', label: '方案3 · 情绪' }
  ];
</script>

<div class="flex flex-col gap-3 h-full bg-neutral-900/55 rounded-2xl p-3.5 border border-white/10 text-xs text-zinc-300 overflow-y-auto">
  <!-- 推理引擎 -->
  <div class="bg-zinc-900/60 rounded-xl p-2 border border-white/5 flex items-center justify-between gap-2 shrink-0">
    <span class="text-[11px] font-medium text-zinc-400 pl-1">推理引擎</span>
    <div class="grid grid-cols-2 gap-1 p-0.5 bg-black/40 rounded-lg">
      <button
        type="button"
        class="py-1 px-2.5 rounded-md font-medium text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer {engineType === 'LOCAL_AGY'
          ? 'bg-zinc-100 text-zinc-950'
          : 'text-zinc-400 hover:text-white'}"
        onclick={() => aiStudioStore.setEngine('LOCAL_AGY')}
      >
        <Cpu size={11} />
        <span>本地 agy</span>
      </button>
      <button
        type="button"
        class="py-1 px-2.5 rounded-md font-medium text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer {engineType === 'NEW_API'
          ? 'bg-zinc-100 text-zinc-950'
          : 'text-zinc-400 hover:text-white'}"
        onclick={() => aiStudioStore.setEngine('NEW_API')}
      >
        <Globe size={11} />
        <span>New API</span>
      </button>
    </div>
  </div>

  <!-- 方案与模型 -->
  <div class="bg-zinc-900/60 rounded-xl p-2.5 border border-white/5 flex flex-col gap-2 shrink-0">
    <div>
      <div class="text-[10px] text-zinc-500 mb-1">生成方案</div>
      <div class="grid grid-cols-3 gap-1">
        {#each availableVersions as v}
          {@const isChecked = aiStudioStore.selectedVersions.includes(v.id)}
          <button
            type="button"
            class="px-2 py-1.5 rounded-lg border text-left cursor-pointer transition-colors flex items-center justify-between {isChecked
              ? 'bg-white/10 border-white/25 text-white'
              : 'bg-black/25 border-white/5 text-zinc-500 hover:text-zinc-200'}"
            onclick={() => aiStudioStore.toggleVersion(v.id)}
          >
            <span class="text-[10px] font-medium truncate">{v.label}</span>
            {#if isChecked}
              <CheckSquare size={11} class="text-white shrink-0" />
            {:else}
              <Square size={11} class="text-zinc-600 shrink-0" />
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <div>
      <div class="text-[10px] text-zinc-500 mb-1">默认模型</div>
      <div class="grid grid-cols-3 gap-1">
        {#each availableModels as m}
          {@const isChecked = aiStudioStore.selectedModels.includes(m.id)}
          <button
            type="button"
            class="px-2 py-1.5 rounded-lg border text-left cursor-pointer transition-colors flex items-center justify-between {isChecked
              ? 'bg-white/10 border-white/25 text-white'
              : 'bg-black/25 border-white/5 text-zinc-500 hover:text-zinc-200'}"
            onclick={() => aiStudioStore.toggleModel(m.id)}
          >
            <span class="text-[10px] font-medium truncate">{m.label}</span>
            {#if isChecked}
              <CheckSquare size={11} class="text-white shrink-0" />
            {:else}
              <Square size={11} class="text-zinc-600 shrink-0" />
            {/if}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- 原曲特征 -->
  <div class="flex-1 flex flex-col gap-1.5 min-h-0">
    <div class="text-[11px] font-medium text-zinc-400 flex items-center justify-between">
      <span class="flex items-center gap-1.5">
        <Disc size={12} />
        <span>原曲特征</span>
      </span>
      {#if analysis}
        <button
          type="button"
          class="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors disabled:opacity-40"
          disabled={analyzing}
          onclick={() => aiStudioStore.reAnalyze()}
          title="重新提取原曲特征"
        >
          <RotateCcw size={10} class={analyzing ? 'animate-spin' : ''} />
          <span>重新提取</span>
        </button>
      {/if}
    </div>

    {#if analyzing}
      <div class="flex-1 flex flex-col items-center justify-center py-6 text-zinc-400 gap-2 bg-zinc-900/30 rounded-xl border border-white/5">
        <Loader2 size={18} class="animate-spin text-zinc-300" />
        <span class="text-[10px]">提取中...</span>
      </div>
    {:else if analysis}
      <div class="flex-1 space-y-1.5 bg-zinc-900/40 p-2.5 rounded-xl border border-white/5 overflow-y-auto text-[11px]">
        <div class="flex justify-between items-center py-0.5 border-b border-white/5">
          <span class="text-zinc-500">风格</span>
          <span class="font-medium text-zinc-200 font-mono text-[10px]">{analysis.genre}</span>
        </div>
        <div class="flex justify-between items-center py-0.5 border-b border-white/5">
          <span class="text-zinc-500">调性 / BPM</span>
          <span class="font-medium text-zinc-100 font-mono">{analysis.estimatedKey} · {analysis.estimatedBpm} BPM</span>
        </div>
        <div class="flex justify-between items-center py-0.5 border-b border-white/5">
          <span class="text-zinc-500">规格</span>
          <span class="font-mono text-zinc-300 text-[10px]">{analysis.format.toUpperCase()} · {analysis.bitrate}k · {analysis.sampleRate}Hz</span>
        </div>
        <div class="py-0.5">
          <div class="text-zinc-500 text-[10px]">配器</div>
          <div class="text-zinc-300 text-[10px] leading-relaxed">{analysis.instrumentation}</div>
        </div>
        <div class="py-0.5">
          <div class="text-zinc-500 text-[10px]">情绪</div>
          <div class="text-zinc-300 text-[10px] leading-relaxed">{analysis.mood}</div>
        </div>
      </div>
    {:else}
      <div class="flex-1 flex flex-col items-center justify-center py-4 text-zinc-500 text-[10px] gap-2 bg-zinc-900/30 rounded-xl border border-white/5">
        <span>{aiStudioStore.error || '准备就绪'}</span>
        {#if aiStudioStore.currentTrack}
          <button
            type="button"
            class="px-2.5 py-1 rounded bg-white/10 text-zinc-200 hover:bg-white/15 cursor-pointer transition-colors"
            onclick={() => aiStudioStore.runAnalysis(String(aiStudioStore.currentTrack?.id), aiStudioStore.currentTrack?.name, aiStudioStore.currentTrack?.artist)}
          >
            重新提取
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- 生成主按钮 -->
  <button
    type="button"
    class="w-full py-2 px-3 rounded-xl font-semibold text-zinc-950 bg-zinc-100 hover:bg-white active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 text-xs"
    disabled={generating || !aiStudioStore.currentTrack}
    onclick={() => aiStudioStore.generateMatrix()}
  >
    {#if generating}
      <Loader2 size={14} class="animate-spin" />
      <span>生成中...</span>
    {:else}
      <Sparkles size={14} />
      <span>{project ? `重新生成 (${plannedCount})` : `生成编曲方案 (${plannedCount})`}</span>
    {/if}
  </button>
</div>
