<script lang="ts">
  import { aiStudioStore } from '../../lib/aiStudio/aiStudioStore.svelte';
  import { showToast } from '../../lib/toast.svelte';
  import { Copy, Check, Sparkles, Sliders, Music, Zap, Flame, Radio, CheckSquare, Square, Wand2, Loader2, Database } from '@lucide/svelte';

  let activePrompts = $derived(aiStudioStore.activePrompts);
  let activePlan = $derived(aiStudioStore.activeVersionPlan);
  let project = $derived(aiStudioStore.project);
  let selectedVersion = $derived(aiStudioStore.selectedVersion);
  let updatingModels = $derived(aiStudioStore.updatingModels);
  let refiningModelId = $derived(aiStudioStore.refiningModelId);

  let copiedId = $state<string | null>(null);
  let modelInputs = $state<Record<string, string>>({});

  const allVersions: Array<{ key: 'V1_FIDELITY' | 'V2_FUSION' | 'V3_EMOTIONAL'; label: string; desc: string }> = [
    { key: 'V1_FIDELITY', label: '方案1 · 经典原味升华', desc: '48kHz 母带级高保真原味与长篇完整叙事' },
    { key: 'V2_FUSION', label: '方案2 · 跨界裂变融合', desc: '赛博交响 / 新国风空灵Trap 激进碰撞与极速快嘴' },
    { key: 'V3_EMOTIONAL', label: '方案3 · 极致情绪微表情', desc: '弱音钢琴独白至全管弦撕裂爆发与真声 Belting' }
  ];

  const availableModels = [
    { id: 'YuE2-3B', label: 'YuE2-3B' },
    { id: 'MiniMax-Music3', label: 'MiniMax-Music3' },
    { id: 'ACE-Step-1.5', label: 'ACE-Step-1.5' }
  ];

  function copyText(id: string, text: string, label: string = '内容已复制到剪贴板') {
    navigator.clipboard.writeText(text);
    copiedId = id;
    showToast(label, 'success');
    setTimeout(() => {
      copiedId = null;
    }, 2000);
  }

  function handleModelRefine(trackPromptId: string) {
    const val = (modelInputs[trackPromptId] || '').trim();
    if (!val) return;
    modelInputs[trackPromptId] = '';
    aiStudioStore.refineModel(trackPromptId, val);
  }
</script>

<div class="flex flex-col h-full bg-neutral-900/55 rounded-2xl p-4 border border-white/10 text-xs text-neutral-300 overflow-hidden">
  <!-- 顶部：Tab 切换歌词与编曲方案 -->
  <div class="flex items-center justify-between pb-3 border-b border-white/10 gap-2 shrink-0">
    <div class="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
      {#each allVersions as v}
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer {selectedVersion === v.key
            ? 'bg-zinc-100 text-zinc-950'
            : 'text-zinc-400 hover:text-white'}"
          onclick={() => { aiStudioStore.selectedVersion = v.key; }}
        >
          {v.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- 主体区 -->
  {#if !project}
    <div class="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500 gap-2">
      <div class="font-medium text-zinc-300">尚未生成方案</div>
      <div class="text-[11px] max-w-xs">在左侧点击「生成编曲方案」开始创作</div>
    </div>
  {:else if !activePlan}
    <div class="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500 gap-2">
      <div class="text-zinc-300 font-medium">当前方案暂无数据</div>
    </div>
  {:else}
    <div class="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1">
      <!-- 1. 主歌词与编曲卡 -->
      <div class="bg-zinc-950/80 rounded-xl p-3.5 border border-white/10 flex flex-col gap-2.5">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-white">{activePlan.planTitle}</span>
            <span class="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded">
              {activePlan.musicalKey} · {activePlan.bpm} BPM
            </span>
          </div>

          <button
            type="button"
            class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
            onclick={() => copyText('master_lyrics', `${activePlan.planTitle}\n编曲：${activePlan.arrangementNotes}\n\n${activePlan.lyricsText}`, '已复制')}
          >
            {#if copiedId === 'master_lyrics'}
              <Check size={12} class="text-emerald-400" />
              <span class="text-emerald-400">已复制</span>
            {:else}
              <Copy size={12} />
              <span>复制</span>
            {/if}
          </button>
        </div>

        <div class="text-[11px] text-zinc-400 leading-relaxed">
          {activePlan.arrangementNotes}
        </div>

        <div class="bg-black/40 rounded-lg p-3 border border-white/5 text-[11px] text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto select-all">
          {activePlan.lyricsText}
        </div>
      </div>

      <!-- 2. 渲染模型选择与微调 -->
      <div class="bg-zinc-900/50 rounded-xl p-3 border border-white/10 flex flex-col gap-2.5">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <span class="text-[11px] font-medium text-zinc-400">渲染模型</span>
          <div class="flex items-center gap-1.5">
            {#each availableModels as m}
              {@const isApplied = activePrompts.some(p => p.modelName === m.id)}
              <button
                type="button"
                disabled={updatingModels}
                class="px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 {isApplied
                  ? 'bg-zinc-100 border-zinc-100 text-zinc-950'
                  : 'bg-black/30 border-white/10 text-zinc-400 hover:text-white'}"
                onclick={() => aiStudioStore.toggleActiveVersionModel(m.id)}
              >
                {#if isApplied}
                  <CheckSquare size={11} />
                {:else}
                  <Square size={11} />
                {/if}
                <span>{m.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="space-y-2.5">
          {#each activePrompts as p (p.id)}
            <div class="bg-zinc-950/60 rounded-xl p-3 border border-white/10 flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-semibold text-zinc-100">{p.modelName}</span>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer text-[10px]"
                  onclick={() => copyText(p.id, p.promptContent + '\n\n' + (activePlan?.lyricsText || p.lyricsPlan), `已复制 ${p.modelName}`)}
                >
                  {#if copiedId === p.id}
                    <Check size={11} class="text-emerald-400" />
                    <span class="text-emerald-400">已复制</span>
                  {:else}
                    <Copy size={11} />
                    <span>复制</span>
                  {/if}
                </button>
              </div>

              <div class="bg-black/40 rounded-lg p-2.5 font-mono text-[11px] text-zinc-300 border border-white/5 leading-relaxed whitespace-pre-wrap select-all">
                {p.promptContent}
              </div>

              <div class="text-[10px] text-zinc-500 font-mono truncate">
                {p.modelParamsJson}
              </div>

              <div class="flex items-center gap-1.5 pt-1 border-t border-white/5">
                <input
                  type="text"
                  bind:value={modelInputs[p.id]}
                  onkeydown={(e) => { if (e.key === 'Enter') handleModelRefine(p.id); }}
                  placeholder={`微调 ${p.modelName} Prompt...`}
                  disabled={refiningModelId === p.id}
                  class="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-zinc-500 outline-none focus:border-white/30"
                />
                <button
                  type="button"
                  disabled={refiningModelId === p.id || !(modelInputs[p.id] || '').trim()}
                  onclick={() => handleModelRefine(p.id)}
                  class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-200 border border-white/10 text-[10px] font-medium cursor-pointer transition-colors disabled:opacity-40 shrink-0"
                >
                  {refiningModelId === p.id ? '微调中...' : '微调'}
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
