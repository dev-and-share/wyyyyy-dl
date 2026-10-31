<script lang="ts">
  import { sleepTimer, type SleepTimerOption } from '../../lib/sleepTimer.svelte';
  import { t } from '../../lib/i18n';

  let { showToast = () => {} } = $props<{
    showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error', dur?: number) => void;
  }>();

  const OPTIONS: { val: SleepTimerOption; labelKey: string }[] = [
    { val: 15, labelKey: 'settings.sleepTimerMin15' },
    { val: 30, labelKey: 'settings.sleepTimerMin30' },
    { val: 45, labelKey: 'settings.sleepTimerMin45' },
    { val: 60, labelKey: 'settings.sleepTimerMin60' },
    { val: 90, labelKey: 'settings.sleepTimerMin90' },
    { val: 'endOfTrack', labelKey: 'settings.sleepTimerEndOfTrack' }
  ];

  function handleSelect(opt: SleepTimerOption, label: string) {
    if (sleepTimer.option === opt) {
      handleCancel();
      return;
    }
    sleepTimer.setTimer(opt);
    showToast(t('settings.sleepTimerSetSuccess', { label }), 'success', 2000);
  }

  function handleCancel() {
    sleepTimer.cancelTimer();
    showToast(t('settings.sleepTimerCancelled'), 'info', 2000);
  }
</script>

<section class="flex flex-col gap-2.5" data-testid="settings-sleep-timer-section">
  <div class="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
    <div class="flex items-center gap-1.5">
      <span>⏱️</span>
      <span>{t('settings.sleepTimerTitle')}</span>
    </div>
    {#if sleepTimer.isActive}
      <button
        type="button"
        data-testid="btn-cancel-sleep-timer"
        class="text-[11px] text-red-500 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-none p-0"
        onclick={handleCancel}
      >
        {t('settings.sleepTimerCancel')}
      </button>
    {/if}
  </div>

  <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-3">
    <div class="flex items-center justify-between gap-3 min-w-0">
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="font-semibold text-sm text-[var(--text-main)]">{t('settings.sleepTimerTitle')}</span>
        <span class="text-xs text-[var(--text-secondary)]">{t('settings.sleepTimerDesc')}</span>
      </div>
      {#if sleepTimer.isActive}
        <div class="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-mono font-bold animate-pulse">
          {#if sleepTimer.option === 'endOfTrack'}
            <span>🎵</span>
            <span class="text-[11px] font-sans">{t('settings.sleepTimerStatusEndOfTrack')}</span>
          {:else}
            <span>⏳</span>
            <span>{sleepTimer.formattedRemaining}</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- 选项卡按钮网格 -->
    <div class="grid grid-cols-3 gap-1.5 pt-1">
      {#each OPTIONS as opt}
        {@const isSelected = sleepTimer.option === opt.val}
        <button
          type="button"
          data-testid="btn-sleep-timer-{opt.val}"
          class="py-2 px-1.5 rounded-xl text-xs font-medium cursor-pointer border-none transition-all flex items-center justify-center text-center {isSelected ? 'bg-red-500 text-white shadow-sm font-bold' : 'bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => handleSelect(opt.val, t(opt.labelKey as any))}
        >
          <span class="break-words leading-tight">{t(opt.labelKey as any)}</span>
        </button>
      {/each}
    </div>
  </div>
</section>
