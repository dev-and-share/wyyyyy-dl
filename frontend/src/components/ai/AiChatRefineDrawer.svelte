<script lang="ts">
  import { aiStudioStore } from '../../lib/aiStudio/aiStudioStore.svelte';
  import { Send, Loader2, Bot, User, Sparkles, MessageSquare } from '@lucide/svelte';

  let messages = $derived(aiStudioStore.currentVersionMessages);
  let refining = $derived(aiStudioStore.refining);
  let project = $derived(aiStudioStore.project);
  let selectedVersion = $derived(aiStudioStore.selectedVersion);
  let inputPrompt = $state('');

  const versionLabels: Record<string, string> = {
    V1_FIDELITY: '版本1 · 原味升华',
    V2_FUSION: '版本2 · 跨界裂变',
    V3_EMOTIONAL: '版本3 · 极致情绪'
  };

  function handleSubmit() {
    if (!inputPrompt.trim() || refining || !project) return;
    const text = inputPrompt.trim();
    inputPrompt = '';
    aiStudioStore.sendRefine(text);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }
</script>

<div class="flex flex-col h-full bg-neutral-900/55 rounded-2xl p-4 border border-white/10 text-xs text-neutral-300 overflow-hidden">
  <!-- 头部 -->
  <div class="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
    <span class="font-semibold text-zinc-200">编曲微调</span>
    <span class="text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10">
      {versionLabels[selectedVersion] || selectedVersion}
    </span>
  </div>

  <!-- 消息流 -->
  <div class="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
    {#each messages as msg (msg.id)}
      <div class="flex gap-2 {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
        <div
          class="max-w-[88%] rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap {msg.role === 'user'
            ? 'bg-zinc-100 text-zinc-950'
            : 'bg-zinc-900/80 text-zinc-200 border border-white/5'}"
        >
          {msg.content}
        </div>
      </div>
    {/each}

    {#if refining}
      <div class="flex gap-2 justify-start items-center text-zinc-400 text-[11px] py-1">
        <Loader2 size={13} class="animate-spin" />
        <span>正在微调...</span>
      </div>
    {/if}
  </div>

  <!-- 输入框 -->
  <div class="pt-2 border-t border-white/10 shrink-0">
    <div class="relative flex items-end bg-black/40 rounded-xl border border-white/10 focus-within:border-white/30 transition-colors p-1.5">
      <textarea
        bind:value={inputPrompt}
        onkeydown={handleKeyDown}
        placeholder={project ? `微调【${versionLabels[selectedVersion]}】歌词或编曲...` : "请先生成方案..."}
        disabled={!project || refining}
        rows="2"
        class="w-full bg-transparent resize-none text-[11px] text-white placeholder-zinc-500 outline-none px-2 py-1 leading-relaxed disabled:cursor-not-allowed"
      ></textarea>

      <button
        type="button"
        class="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!project || refining || !inputPrompt.trim()}
        onclick={handleSubmit}
        title="发送追问指令"
      >
        {#if refining}
          <Loader2 size={14} class="animate-spin" />
        {:else}
          <Send size={14} />
        {/if}
      </button>
    </div>
  </div>
</div>
