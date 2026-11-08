<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  import { scrollToPageTop, type ActiveTab } from '../lib/router.svelte';
  import WyyLogo from './WyyLogo.svelte';

  let {
    tab,
    themeMode,
    repeat = false,
    isDesktopLayout = false,
    onSwitchTab,
    onToggleTheme,
    onToggleRepeat,
    onRefresh,
    onOpenSettings
  } = $props<{
    tab: ActiveTab;
    themeMode: 'dark' | 'light' | 'auto';
    repeat?: boolean;
    isDesktopLayout?: boolean;
    onSwitchTab: (tab: ActiveTab) => void;
    onToggleTheme: () => void;
    onToggleRepeat?: () => void;
    onRefresh?: () => void;
    onOpenSettings?: () => void;
  }>();
</script>

<!-- 顶栏 (TopBar) -->
{#if !isDesktopLayout}
  <!-- 📱 移动端 / 窄屏：标准顶栏 (撑满两端对齐，全面适配 PWA WCO 顶栏拖拽与安全区，解决 SP 顶部空白) -->
  <div
    class="mobile-top-bar w-full max-w-[900px] mx-auto mb-1 md:mb-4 px-3.5 py-2 md:px-4 md:py-2 bg-[var(--topbar-bg)] backdrop-blur-md rounded-none md:rounded-[26px] shadow-sm md:shadow-md border-x-0 md:border border-t-0 md:border-t border-b border-[var(--topbar-border)] flex items-center justify-between gap-2 transition-all duration-300 wco-drag-region"
    style="
      padding-top: max(8px, calc(env(safe-area-inset-top, 0px) + 8px));
      padding-left: max(14px, var(--wco-left, env(titlebar-area-x, 0px)), env(safe-area-inset-left, 0px));
      padding-right: max(14px, var(--wco-right, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw))), env(safe-area-inset-right, 0px));
    "
  >
    <WyyLogo
      class="pl-1 shrink-0"
      onclick={() => {
        if (typeof window !== 'undefined' && window.scrollY > 20) {
          scrollToPageTop();
        } else if (onRefresh) {
          onRefresh();
        }
      }}
      title={t('topbar.refresh')}
    />
    <div class="hidden md:flex bg-[var(--nav-tabs-bg)] p-[3px] rounded-[20px] gap-0.5 flex-1 max-w-[520px] justify-center">
      <button
        data-testid="tab-playlist"
        class="flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none {tab === 'playlist' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
        onclick={() => onSwitchTab('playlist')}>📁 {t('topbar.playlist')}</button>
      <button
        data-testid="tab-search"
        class="flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none {tab === 'search' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
        onclick={() => onSwitchTab('search')}>🔍 {t('topbar.search')}</button>
      <button
        data-testid="tab-musicfree"
        class="flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none {tab === 'musicfree' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
        onclick={() => onSwitchTab('musicfree')}>🧩 {t('topbar.discover')}</button>
      <button
        data-testid="tab-download-mgr"
        class="flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none {tab === 'download-mgr' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
        onclick={() => onSwitchTab('download-mgr')}>📥 {t('topbar.local')}</button>
    </div>
    <div class="shrink-0 flex items-center gap-1 pr-0.5 ml-auto">
      <a
        href="/minimal-player.html"
        class="w-8 h-8 rounded-xl text-sm cursor-pointer inline-flex items-center justify-center whitespace-nowrap select-none shrink-0 bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-200 no-underline"
        title="极简锁屏播放测试"
      >
        🧪
      </a>

      <button
        data-testid="btn-toggle-theme"
        class="w-8 h-8 rounded-xl text-sm cursor-pointer inline-flex items-center justify-center whitespace-nowrap select-none shrink-0 bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-200"
        onclick={onToggleTheme}
        title={t('topbar.toggleTheme')}
      >
        {themeMode === 'dark' ? '🌙' : themeMode === 'light' ? '☀️' : '🌓'}
      </button>

      {#if onOpenSettings}
        <button
          data-testid="btn-open-settings"
          class="w-8 h-8 rounded-xl text-sm cursor-pointer inline-flex items-center justify-center whitespace-nowrap select-none shrink-0 bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-200"
          onclick={onOpenSettings}
          title={t('topbar.settings')}
        >
          ⚙️
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  @media (min-width: 768px) {
    .mobile-top-bar {
      padding-top: 8px !important;
    }
  }
</style>
