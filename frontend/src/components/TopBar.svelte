<script lang="ts">
  import { Folder, Search, Puzzle, HardDriveDownload, Moon, Sun, SunMoon, Settings } from '@lucide/svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { scrollToPageTop, exitPlaylistToGallery, routerState, AppRoute, type ActiveTab } from '../lib/router.svelte';
  import { globalUiState } from '../lib/ui.svelte';
  import { layoutState } from '../lib/layout.svelte';
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
  <!-- 📱 移动端 / 窄屏：标准顶栏 (在 WCO 沉浸窗口模式下铺满通栏并同色融合，普通模式下保持精致卡片) -->
  <div
    class="mobile-top-bar w-full relative z-[35] {layoutState.wco.visible ? 'max-w-none rounded-none border-none mb-1 bg-[var(--wco-titlebar-bg,var(--bg-color))]' : 'max-w-[900px] mx-auto mb-1 md:mb-4 rounded-none md:rounded-[26px] md:border border-x-0 border-t-0 md:border-t border-b border-[var(--topbar-border)] bg-[var(--topbar-bg)] shadow-sm md:shadow-md'} px-3.5 py-2 md:px-4 md:py-2 backdrop-blur-md flex items-center justify-between gap-2 transition-all duration-300 wco-drag-region"
    style="
      padding-top: max(8px, calc(env(safe-area-inset-top, 0px) + 8px));
      padding-left: max(14px, var(--wco-left, env(titlebar-area-x, 0px)), env(safe-area-inset-left, 0px));
      padding-right: max(14px, var(--wco-right, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw))), env(safe-area-inset-right, 0px));
    "
  >
    <WyyLogo
      class="pl-1 shrink-0 wco-no-drag"
      onclick={() => {
        if (tab !== AppRoute.PLAYLIST || routerState.playlistId) {
          exitPlaylistToGallery();
          onSwitchTab(AppRoute.PLAYLIST);
          scrollToPageTop();
        } else if (typeof window !== 'undefined' && window.scrollY > 20) {
          scrollToPageTop();
        } else if (onRefresh) {
          onRefresh();
        }
      }}
      title={tab === AppRoute.PLAYLIST && !routerState.playlistId ? t('topbar.refresh') : t('topbar.playlist')}
    />
    <div class="hidden md:flex bg-[var(--nav-tabs-bg)] p-[3px] rounded-[20px] gap-0.5 flex-1 max-w-[520px] justify-center wco-no-drag">
      <button
        data-testid="tab-playlist"
        class="wco-no-drag flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none pointer-events-auto flex items-center justify-center gap-1.5 {tab === 'playlist' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
        onclick={() => onSwitchTab('playlist')}
      >
        <Folder size={14} />
        <span>{t('topbar.playlist')}</span>
      </button>
      <button
        data-testid="tab-search"
        class="wco-no-drag flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none pointer-events-auto flex items-center justify-center gap-1.5 {tab === 'search' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
        onclick={() => onSwitchTab('search')}
      >
        <Search size={14} />
        <span>{t('topbar.search')}</span>
      </button>
      <button
        data-testid="tab-musicfree"
        class="wco-no-drag flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none pointer-events-auto flex items-center justify-center gap-1.5 {tab === 'musicfree' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
        onclick={() => onSwitchTab('musicfree')}
      >
        <Puzzle size={14} />
        <span>{t('topbar.discover')}</span>
      </button>
      <button
        data-testid="tab-download-mgr"
        class="wco-no-drag flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none pointer-events-auto flex items-center justify-center gap-1.5 {tab === 'download-mgr' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
        onclick={() => onSwitchTab('download-mgr')}
      >
        <HardDriveDownload size={14} />
        <span>{t('topbar.local')}</span>
      </button>
    </div>
    <div class="shrink-0 flex items-center gap-1.5 pr-0.5 ml-auto wco-no-drag">
      <button
        data-testid="btn-toggle-theme"
        class="wco-no-drag w-8 h-8 rounded-xl text-sm cursor-pointer inline-flex items-center justify-center whitespace-nowrap select-none shrink-0 bg-[var(--card-bg)]/60 hover:bg-[var(--card-bg)] border border-[var(--border-subtle)] shadow-xs backdrop-blur-sm text-[var(--text-main)] hover:scale-105 active:scale-95 transition-all duration-200 pointer-events-auto"
        onclick={onToggleTheme}
        title={t('topbar.toggleTheme')}
      >
        {#if themeMode === 'dark'}
          <Moon size={15} />
        {:else if themeMode === 'light'}
          <Sun size={15} />
        {:else}
          <SunMoon size={15} />
        {/if}
      </button>

      {#if onOpenSettings}
        <button
          data-testid="btn-open-settings"
          class="wco-no-drag relative w-8 h-8 rounded-xl text-sm cursor-pointer inline-flex items-center justify-center whitespace-nowrap select-none shrink-0 bg-[var(--card-bg)]/60 hover:bg-[var(--card-bg)] border border-[var(--border-subtle)] shadow-xs backdrop-blur-sm text-[var(--text-main)] hover:scale-105 active:scale-95 transition-all duration-200 pointer-events-auto"
          onclick={onOpenSettings}
          title={t('topbar.settings')}
        >
          <Settings size={15} />
          {#if globalUiState.hasPwaUpdate}
            <span
              data-testid="badge-topbar-update"
              class="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse pointer-events-none"
            ></span>
          {/if}
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
