<script lang="ts">
  import { aiStudioStore } from '../../lib/aiStudio/aiStudioStore.svelte';
  import { showToast } from '../../lib/toast.svelte';
  import { Copy, Check, Sparkles, Sliders, Music, Zap, Flame, Radio } from '@lucide/svelte';

  let activePrompts = $derived(aiStudioStore.activePrompts);
  let project = $derived(aiStudioStore.project);
  let selectedVersion = $derived(aiStudioStore.selectedVersion);
  let copiedId = $state<string | null>(null);

  const allVersions: Array<{ key: 'V1_FIDELITY' | 'V2_FUSION' | 'V3_EMOTIONAL'; label: string; desc: string }> = [
    { key: 'V1_FIDELITY', label: '版本1 · 经典原味升华', desc: '48kHz 母带级高保真原味与长篇完整叙事' },
    { key: 'V2_FUSION', label: '版本2 · 跨界裂变融合', desc: '赛博交响 / 新国风空灵Trap 激进碰撞与极速快嘴' },
    { key: 'V3_EMOTIONAL', label: '版本3 · 极致情绪微表情', desc: '弱音钢琴独白至全管弦撕裂爆发与真声 Belting' }
  ];

  function copyText(id: string, text: string) {
    navigator.clipboard.writeText(text);
    copiedId = id;
    showToast('Prompt 与完整歌词已复制到剪贴板', 'success');
    setTimeout(() => {
      copiedId = null;
    }, 2000);
  }
</script>

<div class="flex flex-col h-full bg-black/30 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-xs text-neutral-300 overflow-hidden">
  <!-- 顶部：3 个创意版本切换 Tab (对应独立 Session) -->
  <div class="flex items-center justify-between pb-3 border-b border-white/10 gap-2 shrink-0">
    <div class="flex items-center gap-1.5 p-1 bg-neutral-900/80 rounded-xl border border-white/5">
      {#each allVersions as v}
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 {selectedVersion === v.key
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
            : 'text-neutral-400 hover:text-white'}"
          onclick={() => { aiStudioStore.selectedVersion = v.key; }}
        >
          <span>{v.label}</span>
        </button>
      {/each}
    </div>

    <div class="text-[11px] text-neutral-400 hidden sm:flex items-center gap-1.5">
      <Radio size={12} class="text-purple-400" />
      <span>{allVersions.find(v => v.key === selectedVersion)?.desc || ''}</span>
    </div>
  </div>

  <!-- 内容区：各大模型专属 Prompt 与独立长篇歌词卡片 -->
  {#if !project}
    <div class="flex-1 flex flex-col items-center justify-center text-center p-8 text-neutral-400 gap-3">
      <div class="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
        <Sparkles size={28} />
      </div>
      <div class="font-semibold text-neutral-200">暂未生成 Prompt 矩阵</div>
      <div class="text-[11px] text-neutral-400 max-w-sm leading-relaxed">
        已就绪真实 agy 乐理 Agent。点击左侧【生成定制 Prompt 矩阵】，系统将为每个版本构建独立 AI Session，产出 3 套完全独立的完整长篇歌词与顶尖 Prompt。
      </div>
    </div>
  {:else if activePrompts.length === 0}
    <div class="flex-1 flex flex-col items-center justify-center text-center p-8 text-neutral-400 gap-2">
      <div class="text-neutral-300 font-semibold">当前版本未勾选或无音轨规划</div>
      <div class="text-[11px] text-neutral-500">可在左侧勾选该版本后重新生成。</div>
    </div>
  {:else}
    <div class="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1">
      {#each activePrompts as p (p.id)}
        <div class="bg-neutral-900/60 rounded-xl p-3.5 border border-white/10 hover:border-purple-500/30 transition-all flex flex-col gap-2.5">
          <!-- 头部：模型标识与特长 -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              {#if p.modelName.includes('YuE2')}
                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Music size={11} /> YuE2-3B (自回归符号推演)
                </span>
                <span class="text-[10px] text-neutral-400">上帝区: 长篇多乐章、复调管弦、非循环长动机</span>
              {:else if p.modelName.includes('MiniMax')}
                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <Flame size={11} /> MiniMax-Music3 (连续声学DiT)
                </span>
                <span class="text-[10px] text-neutral-400">上帝区: 真人人声微表情 (气声/颤音/胸声爆发)</span>
              {:else}
                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  <Zap size={11} /> ACE-Step 1.5 (网格高瞬态扩散)
                </span>
                <span class="text-[10px] text-neutral-400">上帝区: 网格级音准、高速律动、打击乐瞬态控制</span>
              {/if}
            </div>

            <button
              type="button"
              class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer text-[11px]"
              onclick={() => copyText(p.id, p.promptContent + '\n\n' + p.lyricsPlan)}
              title="复制完整 Prompt 与独立歌词"
            >
              {#if copiedId === p.id}
                <Check size={12} class="text-emerald-400" />
                <span class="text-emerald-400">已复制</span>
              {:else}
                <Copy size={12} />
                <span>复制全部</span>
              {/if}
            </button>
          </div>

          <!-- 曲目拟定标题 -->
          <div class="text-xs font-semibold text-neutral-100 flex items-center gap-1.5">
            <span class="text-neutral-400">规划曲目:</span>
            <span class="text-purple-300 font-bold">{p.trackTitle}</span>
          </div>

          <!-- 核心生产级 Prompt -->
          <div class="bg-black/50 rounded-lg p-2.5 font-mono text-[11px] text-neutral-200 border border-white/5 leading-relaxed whitespace-pre-wrap select-all">
            {p.promptContent}
          </div>

          <!-- 独立长篇歌词与分段结构 -->
          <div class="bg-neutral-950/50 rounded-lg p-3 border border-white/5 text-[11px] text-neutral-300 leading-relaxed whitespace-pre-wrap">
            <div class="text-[10px] font-semibold text-purple-400 mb-1.5 flex items-center gap-1 border-b border-white/5 pb-1">
              <Sliders size={11} />
              <span>本版本专属独立长篇歌词与乐章结构</span>
            </div>
            {p.lyricsPlan}
          </div>

          <!-- 模型特定参数 -->
          <div class="flex items-center gap-2 text-[10px] text-neutral-400 font-mono">
            <span class="text-neutral-500">参数设定:</span>
            <span class="bg-white/5 px-2 py-0.5 rounded border border-white/5 text-neutral-300">
              {p.modelParamsJson}
            </span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
