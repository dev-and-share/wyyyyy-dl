<script lang="ts">
  import { aiStudioStore } from '../../lib/aiStudio/aiStudioStore.svelte';
  import { Loader2, Sparkles, Cpu, Globe, Music, Disc, Sliders, CheckSquare, Square, RotateCcw } from '@lucide/svelte';

  let analysis = $derived(aiStudioStore.analysis);
  let analyzing = $derived(aiStudioStore.analyzing);
  let generating = $derived(aiStudioStore.generating);
  let project = $derived(aiStudioStore.project);
  let engineType = $derived(aiStudioStore.engineType);
  let plannedCount = $derived(aiStudioStore.totalPlannedSongs);

  const availableModels = [
    { id: 'YuE2-3B', label: 'YuE2-3B', desc: '分乐章思维链' },
    { id: 'MiniMax-Music3', label: 'MiniMax-Music3', desc: '录音棚微表情' },
    { id: 'ACE-Step-1.5', label: 'ACE-Step 1.5', desc: '网格瞬态律动' }
  ];

  const availableVersions = [
    { id: 'V1_FIDELITY', label: '版本1 · 原味升华', desc: '高保真还原' },
    { id: 'V2_FUSION', label: '版本2 · 跨界裂变', desc: '激进流派碰撞' },
    { id: 'V3_EMOTIONAL', label: '版本3 · 极致情绪', desc: '戏剧化大动态' }
  ];
</script>

<div class="flex flex-col gap-3 h-full bg-neutral-900/55 rounded-2xl p-3.5 border border-white/10 text-xs text-neutral-300 overflow-y-auto">
  <!-- 头部：参考曲目信息 -->
  <div class="flex items-center gap-2.5 pb-2.5 border-b border-white/10 shrink-0">
    <div class="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
      <Music size={18} />
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
  <div class="bg-neutral-900/60 rounded-xl p-2 border border-white/5 flex flex-col gap-1.5 shrink-0">
    <div class="text-[11px] font-semibold text-neutral-400 flex items-center justify-between">
      <span>AI 乐理推理引擎</span>
      <span class="text-[10px] text-purple-400 font-mono">
        {engineType === 'LOCAL_AGY' ? '本地 agy Agent (已联通)' : '云端 New API'}
      </span>
    </div>
    <div class="grid grid-cols-2 gap-1.5 p-0.5 bg-black/40 rounded-lg">
      <button
        type="button"
        class="py-1 px-2 rounded-md font-medium text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer {engineType === 'LOCAL_AGY'
          ? 'bg-purple-600 text-white shadow-sm'
          : 'text-neutral-400 hover:text-white'}"
        onclick={() => aiStudioStore.setEngine('LOCAL_AGY')}
      >
        <Cpu size={12} />
        <span>本地 agy CLI</span>
      </button>
      <button
        type="button"
        class="py-1 px-2 rounded-md font-medium text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer {engineType === 'NEW_API'
          ? 'bg-purple-600 text-white shadow-sm'
          : 'text-neutral-400 hover:text-white'}"
        onclick={() => aiStudioStore.setEngine('NEW_API')}
      >
        <Globe size={12} />
        <span>网络 New API</span>
      </button>
    </div>
  </div>

  <!-- 自由组合多选参数器 (模型 x 版本) -->
  <div class="bg-neutral-900/60 rounded-xl p-2.5 border border-white/5 flex flex-col gap-2 shrink-0">
    <div class="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
      <span class="flex items-center gap-1.5">
        <Sliders size={13} class="text-purple-400" />
        <span>自由组合参数 (多选)</span>
      </span>
      <span class="text-[10px] text-purple-300 font-mono px-1.5 py-0.5 bg-purple-500/20 rounded border border-purple-500/30">
        {aiStudioStore.selectedModels.length} 模型 × {aiStudioStore.selectedVersions.length} 版本 = {plannedCount} 首
      </span>
    </div>

    <!-- 模型多选 -->
    <div>
      <div class="text-[10px] text-neutral-400 mb-1">参与推演模型：</div>
      <div class="grid grid-cols-3 gap-1">
        {#each availableModels as m}
          {@const isChecked = aiStudioStore.selectedModels.includes(m.id)}
          <button
            type="button"
            class="p-1 rounded border text-left cursor-pointer transition-all flex flex-col justify-between {isChecked
              ? 'bg-purple-600/25 border-purple-500/50 text-white'
              : 'bg-black/30 border-white/5 text-neutral-400 hover:text-neutral-200'}"
            onclick={() => aiStudioStore.toggleModel(m.id)}
          >
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-semibold leading-tight">{m.label}</span>
              {#if isChecked}
                <CheckSquare size={11} class="text-purple-400" />
              {:else}
                <Square size={11} class="text-neutral-600" />
              {/if}
            </div>
            <span class="text-[9px] text-neutral-400 scale-95 origin-left truncate">{m.desc}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- 创意版本多选 -->
    <div>
      <div class="text-[10px] text-neutral-400 mb-1">创意版本企划：</div>
      <div class="grid grid-cols-3 gap-1">
        {#each availableVersions as v}
          {@const isChecked = aiStudioStore.selectedVersions.includes(v.id)}
          <button
            type="button"
            class="p-1 rounded border text-left cursor-pointer transition-all flex flex-col justify-between {isChecked
              ? 'bg-indigo-600/25 border-indigo-500/50 text-white'
              : 'bg-black/30 border-white/5 text-neutral-400 hover:text-neutral-200'}"
            onclick={() => aiStudioStore.toggleVersion(v.id)}
          >
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-semibold leading-tight truncate">{v.label}</span>
              {#if isChecked}
                <CheckSquare size={11} class="text-indigo-400" />
              {:else}
                <Square size={11} class="text-neutral-600" />
              {/if}
            </div>
            <span class="text-[9px] text-neutral-400 scale-95 origin-left truncate">{v.desc}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- 原曲解构分析报告 -->
  <div class="flex-1 flex flex-col gap-1.5 min-h-0">
    <div class="text-[11px] font-semibold text-neutral-400 flex items-center justify-between">
      <span class="flex items-center gap-1.5">
        <Disc size={13} class="text-purple-400" />
        <span>原曲声学与乐理逆向解构</span>
      </span>
      {#if analysis}
        <div class="flex items-center gap-2">
          <span class="text-[9px] text-emerald-400">agy 深度解析</span>
          <button
            type="button"
            class="text-[10px] text-neutral-400 hover:text-purple-300 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 hover:bg-purple-500/20 border border-white/10 cursor-pointer transition-all disabled:opacity-40"
            disabled={analyzing}
            onclick={() => aiStudioStore.reAnalyze()}
            title="忽略缓存，重新调用 agy 提取原曲乐理"
          >
            <RotateCcw size={10} class={analyzing ? 'animate-spin' : ''} />
            <span>重新提取</span>
          </button>
        </div>
      {/if}
    </div>

    {#if analyzing}
      <div class="flex-1 flex flex-col items-center justify-center py-6 text-neutral-400 gap-2 bg-neutral-900/30 rounded-xl border border-white/5">
        <Loader2 size={20} class="animate-spin text-purple-400" />
        <span class="text-[10px]">agy 正在逆向提取原曲乐理与情绪...</span>
      </div>
    {:else if analysis}
      <div class="flex-1 space-y-1.5 bg-neutral-900/40 p-2.5 rounded-xl border border-white/5 overflow-y-auto text-[11px]">
        <div class="flex justify-between items-center py-0.5 border-b border-white/5">
          <span class="text-neutral-400">推导风格赛道</span>
          <span class="font-semibold text-purple-300 font-mono text-[11px]">{analysis.genre}</span>
        </div>
        <div class="flex justify-between items-center py-0.5 border-b border-white/5">
          <span class="text-neutral-400">建议调性 / BPM</span>
          <span class="font-medium text-amber-300 font-mono">{analysis.estimatedKey} · {analysis.estimatedBpm} BPM</span>
        </div>
        <div class="flex justify-between items-center py-0.5 border-b border-white/5">
          <span class="text-neutral-400">音频物理规格</span>
          <span class="font-mono text-neutral-300 text-[10px]">{analysis.format.toUpperCase()} · {analysis.bitrate}k · {analysis.sampleRate}Hz</span>
        </div>
        <div class="py-0.5">
          <div class="text-neutral-400 text-[10px]">主配器与氛围：</div>
          <div class="text-neutral-200 text-[10px] leading-relaxed">{analysis.instrumentation}</div>
        </div>
        <div class="py-0.5">
          <div class="text-neutral-400 text-[10px]">情绪基调：</div>
          <div class="text-neutral-200 text-[10px] leading-relaxed">{analysis.mood}</div>
        </div>
      </div>
    {:else}
      <div class="flex-1 flex flex-col items-center justify-center py-4 text-neutral-400 text-[10px] gap-2 bg-neutral-900/30 rounded-xl border border-white/5">
        <span class="text-neutral-500">{aiStudioStore.error ? '解构提示: ' + aiStudioStore.error : '点击下方按钮直接生成'}</span>
        {#if aiStudioStore.currentTrack}
          <button
            type="button"
            class="px-2.5 py-1 rounded bg-purple-600/30 text-purple-200 border border-purple-500/30 hover:bg-purple-600/50 cursor-pointer transition-all active:scale-95"
            onclick={() => aiStudioStore.runAnalysis(String(aiStudioStore.currentTrack?.id), aiStudioStore.currentTrack?.name, aiStudioStore.currentTrack?.artist)}
          >
            重新解构原曲
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- 触发生成 Prompt 矩阵按钮 -->
  <button
    type="button"
    class="w-full py-2.5 px-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 text-xs"
    disabled={generating || !aiStudioStore.currentTrack}
    onclick={() => aiStudioStore.generateMatrix()}
  >
    {#if generating}
      <Loader2 size={15} class="animate-spin" />
      <span>正在为三大模型推演定制 Prompt 矩阵...</span>
    {:else}
      <Sparkles size={15} class="text-amber-300" />
      <span>{project ? `重新生成 ${plannedCount} 首 Prompt 矩阵` : `生成 ${plannedCount} 首最高峰 Prompt 矩阵`}</span>
    {/if}
  </button>
</div>
