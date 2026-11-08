<script lang="ts">
  import { t } from '../../lib/i18n';
  import { globalUiState, toggleTheme, openSettings } from '../../lib/ui.svelte';
</script>

<!-- 🖥️ PC 桌面端统一全局控制图标组 (🧪 锁屏测试 · 🌙/☀️ 主题 · ⚙️ 设置) -->
<div class="hidden lg:flex items-center gap-1 shrink-0 p-0.5 select-none wco-no-drag" data-testid="desktop-header-actions">
  <a
    href="/minimal-player.html"
    class="w-7 h-7 rounded-lg text-xs cursor-pointer inline-flex items-center justify-center whitespace-nowrap select-none shrink-0 bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-200 no-underline"
    title={t('topbar.minimalPlayerTest')}
  >
    🧪
  </a>

  <button
    type="button"
    data-testid="btn-toggle-theme"
    class="w-7 h-7 rounded-lg text-xs cursor-pointer inline-flex items-center justify-center whitespace-nowrap select-none shrink-0 bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-200"
    onclick={toggleTheme}
    title={t('topbar.toggleTheme')}
  >
    {globalUiState.themeMode === 'dark' ? '🌙' : globalUiState.themeMode === 'light' ? '☀️' : '🌓'}
  </button>

  <button
    type="button"
    data-testid="btn-open-settings"
    class="w-7 h-7 rounded-lg text-xs cursor-pointer inline-flex items-center justify-center whitespace-nowrap select-none shrink-0 bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-200"
    onclick={openSettings}
    title={t('topbar.settings')}
  >
    ⚙️
  </button>
</div>
