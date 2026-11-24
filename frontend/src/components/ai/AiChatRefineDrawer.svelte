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

<div class="flex flex-col h-full bg-black/30 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-xs text-neutral-300 overflow-hidden">
  <!-- 头部：显示当前版本的独立 Session 标识 -->
  <div class="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
    <div class="flex items-center gap-1.5 font-semibold text-neutral-200">
      <Bot size={15} class="text-purple-400" />
      <span>AI 音乐总监 · 持续追问</span>
    </div>
    <div class="flex items-center gap-1.5">
      <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium font-mono">
        {versionLabels[selectedVersion] || selectedVersion} 会话
      </span>
    </div>
  </div>

  <!-- 消息流容器 (按当前版本展示独立上下文) -->
  <div class="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
    {#each messages as msg (msg.id)}
      <div class="flex gap-2 {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
        {#if msg.role !== 'user'}
          <div class="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
            <Sparkles size={13} />
          </div>
        {/if}

        <div
          class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[11px] leading-relaxed whitespace-pre-wrap {msg.role === 'user'
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs shadow-sm'
            : 'bg-neutral-900/80 text-neutral-200 border border-white/5 rounded-bl-xs'}"
        >
          {msg.content}
        </div>

        {#if msg.role === 'user'}
          <div class="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/30">
            <User size={13} />
          </div>
        {/if}
      </div>
    {/each}

    {#if refining}
      <div class="flex gap-2 justify-start items-center text-purple-400 text-[11px] py-1">
        <Loader2 size={14} class="animate-spin" />
        <span>agy 正在针对【{versionLabels[selectedVersion]}】深度推演并更新歌词...</span>
      </div>
    {/if}
  </div>

  <!-- 底部追问输入框 -->
  <div class="pt-2 border-t border-white/10 shrink-0">
    <div class="relative flex items-end bg-neutral-900/90 rounded-xl border border-white/10 focus-within:border-purple-500/50 transition-all p-1.5">
      <textarea
        bind:value={inputPrompt}
        onkeydown={handleKeyDown}
        placeholder={project ? `针对【${versionLabels[selectedVersion]}】输入指令 (如：延长歌词、增加木吉他SOLO)...` : "请先生成 Prompt 矩阵..."}
        disabled={!project || refining}
        rows="2"
        class="w-full bg-transparent resize-none text-[11px] text-white placeholder-neutral-500 outline-none px-2 py-1 leading-relaxed disabled:cursor-not-allowed"
      ></textarea>

      <button
        type="button"
        class="w-8 h-8 rounded-lg bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shrink-0 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-sm"
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
