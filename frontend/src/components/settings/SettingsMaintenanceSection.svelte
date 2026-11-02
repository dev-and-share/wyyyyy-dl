<script lang="ts">
  import { api } from '../../lib/api';
  import { t } from '../../lib/i18n';

  let { showToast = () => {} } = $props<{
    showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error', dur?: number) => void;
  }>();

  let maintenanceLoading = $state(false);
  let maintenanceMsg = $state('');

  async function runMaintenance(actionKey: 'actionDiskAlign' | 'actionExternalScan' | 'actionImportUntracked' | 'actionCleanMissing', fn: () => Promise<any>) {
    const actionName = t(`settings.${actionKey}` as any);
    maintenanceLoading = true;
    maintenanceMsg = t('settings.maintenanceRunning', { name: actionName });
    try {
      const res = await fn();
      if (res?.code === '000000') {
        showToast(t('settings.maintenanceSuccess', { name: actionName }), 'success');
      } else {
        showToast(res?.msg || t('settings.maintenanceCompleted', { name: actionName }), 'info');
      }
    } catch (e: any) {
      showToast(t('settings.maintenanceFailed', { name: actionName, error: e?.message || e }), 'error');
    } finally {
      maintenanceLoading = false;
      maintenanceMsg = '';
    }
  }
</script>

<section class="flex flex-col gap-2.5">
  <div class="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
    <span>💽</span>
    <span>{t('settings.maintenanceSectionTitle')}</span>
  </div>
  <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-2">
    <span class="text-xs text-[var(--text-secondary)] leading-relaxed">
      {t('settings.maintenanceSectionDesc')}
    </span>
    {#if maintenanceMsg}
      <div class="text-xs text-amber-500 font-medium py-1">{maintenanceMsg}</div>
    {/if}
    <div class="grid grid-cols-2 gap-2 pt-1">
      <button
        type="button"
        disabled={maintenanceLoading}
        class="py-2 px-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs font-medium text-[var(--text-main)] border border-[var(--border-color)] cursor-pointer transition-all disabled:opacity-50"
        onclick={() => runMaintenance('actionDiskAlign', api.historyScan)}
      >
        {t('settings.btnDiskAlign')}
      </button>
      <button
        type="button"
        disabled={maintenanceLoading}
        class="py-2 px-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs font-medium text-[var(--text-main)] border border-[var(--border-color)] cursor-pointer transition-all disabled:opacity-50"
        onclick={() => runMaintenance('actionExternalScan', api.historyScanExternal)}
      >
        {t('settings.btnExternalScan')}
      </button>
      <button
        type="button"
        disabled={maintenanceLoading}
        class="py-2 px-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs font-medium text-[var(--text-main)] border border-[var(--border-color)] cursor-pointer transition-all disabled:opacity-50"
        onclick={() => runMaintenance('actionImportUntracked', api.historyImportUntracked)}
      >
        {t('settings.btnImportUntracked')}
      </button>
      <button
        type="button"
        disabled={maintenanceLoading}
        class="py-2 px-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-500 border border-red-500/20 cursor-pointer transition-all disabled:opacity-50"
        onclick={() => runMaintenance('actionCleanMissing', api.historyCleanMissing)}
      >
        {t('settings.btnCleanMissing')}
      </button>
    </div>
  </div>
</section>
