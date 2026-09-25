<script lang="ts">
  import { api } from '../../lib/api';

  let { showToast = () => {} } = $props<{
    showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error', dur?: number) => void;
  }>();

  let maintenanceLoading = $state(false);
  let maintenanceMsg = $state('');

  async function runMaintenance(actionName: string, fn: () => Promise<any>) {
    maintenanceLoading = true;
    maintenanceMsg = `正在执行${actionName}...`;
    try {
      const res = await fn();
      if (res?.code === '000000') {
        showToast(`${actionName}成功！`, 'success');
      } else {
        showToast(res?.msg || `${actionName}完成`, 'info');
      }
    } catch (e: any) {
      showToast(`${actionName}失败: ` + (e?.message || e), 'error');
    } finally {
      maintenanceLoading = false;
      maintenanceMsg = '';
    }
  }
</script>

<section class="flex flex-col gap-2.5">
  <div class="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
    <span>💽</span>
    <span>本地曲库与磁盘维护</span>
  </div>
  <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-2">
    <span class="text-xs text-[var(--text-secondary)] leading-relaxed">
      服务器端物理音频文件同步与 SQLite 数据库维护：
    </span>
    {#if maintenanceMsg}
      <div class="text-xs text-amber-500 font-medium py-1">{maintenanceMsg}</div>
    {/if}
    <div class="grid grid-cols-2 gap-2 pt-1">
      <button
        type="button"
        disabled={maintenanceLoading}
        class="py-2 px-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs font-medium text-[var(--text-main)] border border-[var(--border-color)] cursor-pointer transition-all disabled:opacity-50"
        onclick={() => runMaintenance('磁盘对齐扫描', api.historyScan)}
      >
        🔍 对齐磁盘扫描
      </button>
      <button
        type="button"
        disabled={maintenanceLoading}
        class="py-2 px-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs font-medium text-[var(--text-main)] border border-[var(--border-color)] cursor-pointer transition-all disabled:opacity-50"
        onclick={() => runMaintenance('外部曲库扫描', api.historyScanExternal)}
      >
        📁 扫描外部曲库
      </button>
      <button
        type="button"
        disabled={maintenanceLoading}
        class="py-2 px-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs font-medium text-[var(--text-main)] border border-[var(--border-color)] cursor-pointer transition-all disabled:opacity-50"
        onclick={() => runMaintenance('导入未录入物理音频', api.historyImportUntracked)}
      >
        📥 导入物理音频
      </button>
      <button
        type="button"
        disabled={maintenanceLoading}
        class="py-2 px-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-500 border border-red-500/20 cursor-pointer transition-all disabled:opacity-50"
        onclick={() => runMaintenance('清理失效记录', api.historyCleanMissing)}
      >
        🧹 清理失效记录
      </button>
    </div>
  </div>
</section>
