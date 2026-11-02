<script lang="ts">
  import TaskStatusBadge from './TaskStatusBadge.svelte';
  import { t } from '../lib/i18n';

  let {
    tasks = [],
    onReveal
  } = $props<{
    tasks: any[];
    onReveal: (item: any) => void;
  }>();
</script>

<!-- Download Tasks View -->
<div class="flex flex-col flex-1 min-h-0 overflow-hidden">
  <div
    class="flex-1 overflow-y-auto overscroll-contain p-2.5 custom-table-scroll"
    style="-webkit-overflow-scrolling: touch; touch-action: pan-y;"
  >
    <div class="flex flex-col gap-1.5">
      {#each tasks as taskItem}
        <div class="flex justify-between items-center px-2.5 py-2 rounded-xl bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 gap-2">
          <div class="flex-1 min-w-0">
            <span class="truncate block text-xs text-[var(--text-main)] font-medium">
              {taskItem.name || taskItem.id}
            </span>
            {#if taskItem.errorMsg}
              <span class="text-[10px] text-amber-500/90 dark:text-amber-400/90 block truncate mt-0.5" title={taskItem.errorMsg}>
                {taskItem.errorMsg}
              </span>
            {/if}
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            {#if taskItem.status === 'SUCCESS'}
              <button
                type="button"
                class="btn-primary px-2 py-0.5 text-[11px] rounded"
                onclick={() => onReveal(taskItem)}
                title={t('download.locatePhysicalTooltip')}
              >
                {t('common.reveal')}
              </button>
            {/if}
            <TaskStatusBadge status={taskItem.status} />
          </div>
        </div>
      {:else}
        <div class="py-12 px-4 text-center text-[var(--text-muted)] text-xs">{t('download.empty')}</div>
      {/each}
    </div>
  </div>
</div>
