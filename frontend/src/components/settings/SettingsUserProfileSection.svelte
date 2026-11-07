<script lang="ts">
  import { authStore } from '../../lib/authStore.svelte';
  import { t } from '../../lib/i18n';

  let { showToast = () => {} } = $props<{
    showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error', dur?: number) => void;
  }>();

  let isRefreshing = $state(false);

  async function handleRefresh() {
    isRefreshing = true;
    try {
      await authStore.fetchProfile();
      showToast(t('settings.refreshUserStatus') + ': OK', 'success', 1500);
    } catch {
      showToast('刷新失败', 'error', 2000);
    } finally {
      isRefreshing = false;
    }
  }
</script>

<section class="flex flex-col gap-2.5" data-testid="settings-user-profile-section">
  <div class="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
    <div class="flex items-center gap-1.5">
      <span>👤</span>
      <span>{t('settings.userAuthTitle')}</span>
    </div>
    <button
      type="button"
      class="text-[11px] text-[var(--primary-color)] hover:underline cursor-pointer bg-transparent border-none p-0 flex items-center gap-1 transition-opacity {isRefreshing ? 'opacity-50' : ''}"
      onclick={handleRefresh}
      disabled={isRefreshing}
    >
      <span class={isRefreshing ? 'animate-spin inline-block' : ''}>🔄</span>
      <span>{t('settings.refreshUserStatus')}</span>
    </button>
  </div>

  <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-3">
    <!-- 当前登录邮箱 -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-base shrink-0">📧</span>
        <div class="flex flex-col min-w-0">
          <span class="text-[11px] text-[var(--text-muted)] leading-tight">{t('settings.currentLoginAccount')}</span>
          <span class="text-xs font-semibold text-[var(--text-main)] truncate max-w-[200px] sm:max-w-[260px] font-mono">
            {authStore.email || '—'}
          </span>
        </div>
      </div>

      <!-- 角色身份徽章 -->
      <div class="shrink-0 flex items-center">
        {#if !authStore.authEnabled}
          <span class="text-[11px] font-semibold px-2 py-0.8 rounded-full bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/20">
            {t('settings.roleOpen')}
          </span>
        {:else if authStore.isAdmin}
          <span class="text-[11px] font-bold px-2.5 py-0.8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shadow-sm">
            <span>👑</span>
            <span>{t('settings.roleAdmin')}</span>
          </span>
        {:else}
          <span class="text-[11px] font-semibold px-2.5 py-0.8 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center gap-1 shadow-sm">
            <span>🎧</span>
            <span>{t('settings.roleGuest')}</span>
          </span>
        {/if}
      </div>
    </div>

    <!-- 权限提示描述说明 -->
    <div class="pt-2 border-t border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
      {#if !authStore.authEnabled}
        {t('settings.openDesc')}
      {:else if authStore.isAdmin}
        {t('settings.adminDesc')}
      {:else}
        {t('settings.guestDesc')}
      {/if}
    </div>
  </div>
</section>
