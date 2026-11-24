<script lang="ts">
  import { aiStudioStore } from '../../lib/aiStudio/aiStudioStore.svelte';
  import { RefreshCw, Play, Pause, ShieldCheck, Folder, Terminal, Music } from '@lucide/svelte';

  let project = $derived(aiStudioStore.project);
  let syncing = $derived(aiStudioStore.syncing);
  let renderedAssets = $derived(project?.renderedAssets || []);

  let playingAssetId = $state<string | null>(null);
  let audioPlayer = $state<HTMLAudioElement | null>(null);

  function togglePlayAsset(assetId: string) {
    if (playingAssetId === assetId) {
      audioPlayer?.pause();
      playingAssetId = null;
    } else {
      if (!audioPlayer) {
        audioPlayer = new Audio();
        audioPlayer.onended = () => { playingAssetId = null; };
      }
      audioPlayer.src = `/v3/ai/audio/${encodeURIComponent(assetId)}`;
      audioPlayer.play().catch(e => console.error('Play error', e));
      playingAssetId = assetId;
    }
  }
</script>

<div class="flex flex-col gap-2.5 bg-black/30 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-xs text-neutral-300 shrink-0">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <!-- 左侧：工程状态与落盘路径 -->
    <div class="flex items-center gap-2.5 min-w-0">
      <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900/80 border border-white/10 text-neutral-300">
        <Folder size={13} class="text-purple-400 shrink-0" />
        <span class="text-[11px] font-mono truncate max-w-xs sm:max-w-md">
          {project ? project.projectDir : '工程落盘目录: ./__AI__/projects/'}
        </span>
      </div>

      {#if project}
        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold border {project.status === 'COMPLETED'
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}">
          {project.status === 'COMPLETED' ? '母盘全量就绪' : '等待离线批处理'}
        </span>
      {/if}
    </div>

    <!-- 右侧：Colab 批处理准备与 Scan & Sync 按钮 -->
    <div class="flex items-center gap-2">
      <div class="hidden md:flex items-center gap-1 text-[11px] text-neutral-400 mr-1">
        <Terminal size={12} class="text-cyan-400" />
        <span>Colab A100 批处理: <code>python colab_batch_runner.py</code></span>
      </div>

      <button
        type="button"
        class="py-1.5 px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 flex items-center gap-1.5 font-medium transition-all cursor-pointer active:scale-95 disabled:opacity-40"
        disabled={!project || syncing}
        onclick={() => aiStudioStore.syncAssets()}
        title="离线跑完音频后，点击扫描同步回本地数据库做资产管理"
      >
        <RefreshCw size={13} class={syncing ? 'animate-spin text-purple-400' : ''} />
        <span>{syncing ? '扫描中...' : '扫描同步渲染资产 (Scan & Sync)'}</span>
      </button>
    </div>
  </div>

  <!-- 已就绪的渲染母盘资产试听列表 -->
  {#if renderedAssets.length > 0}
    <div class="flex items-center gap-2 overflow-x-auto py-1 border-t border-white/5">
      <span class="text-[11px] text-neutral-400 shrink-0">已就绪母盘 ({renderedAssets.length}首):</span>
      {#each renderedAssets as a (a.id)}
        <div class="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-neutral-900/80 border border-white/10 shrink-0">
          <button
            type="button"
            class="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all"
            onclick={() => togglePlayAsset(a.id)}
          >
            {#if playingAssetId === a.id}
              <Pause size={10} />
            {:else}
              <Play size={10} class="ml-0.5" />
            {/if}
          </button>
          <span class="text-[11px] font-mono text-neutral-200 truncate max-w-[120px]">
            {a.audioPath.substring(a.audioPath.lastIndexOf('/') + 1)}
          </span>
          <span class="text-[10px] text-emerald-400 flex items-center gap-0.5">
            <ShieldCheck size={11} />
            <span>熵:{a.spectralEntropy.toFixed(2)}</span>
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>
