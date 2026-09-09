<script lang="ts">
  import TaskStatusBadge from './TaskStatusBadge.svelte';

  let {
    tasks = [],
    onReveal
  } = $props<{
    tasks: any[];
    onReveal: (item: any) => void;
  }>();
</script>

<!-- 📥 后台下载任务独立抽屉视图 (已从 PlaylistDrawer 解耦) -->
<div class="flex flex-col flex-1 min-h-0 overflow-hidden">
  <div
    class="flex-1 overflow-y-auto overscroll-contain p-2.5 custom-table-scroll"
    style="-webkit-overflow-scrolling: touch; touch-action: pan-y;"
  >
    <div class="flex flex-col gap-1.5">
      {#each tasks as t}
        <div class="flex justify-between items-center px-2.5 py-2 rounded-xl bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 gap-2">
          <div class="flex-1 min-w-0">
            <span class="truncate block text-xs text-[var(--text-main)] font-medium">
              {t.name || t.id}
            </span>
            {#if t.errorMsg}
              <span class="text-[10px] text-amber-500/90 dark:text-amber-400/90 block truncate mt-0.5" title={t.errorMsg}>
                {t.errorMsg}
              </span>
            {/if}
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            {#if t.status === 'SUCCESS'}
              <button
                type="button"
                class="btn-primary px-2 py-0.5 text-[11px] rounded"
                onclick={() => onReveal(t)}
                title="在系统文件管理器中定位真实物理路径"
              >
                📂 定位
              </button>
            {/if}
            <TaskStatusBadge status={t.status} />
          </div>
        </div>
      {:else}
        <div class="py-12 px-4 text-center text-[var(--text-muted)] text-xs">暂无下载任务</div>
      {/each}
    </div>
  </div>
</div>
