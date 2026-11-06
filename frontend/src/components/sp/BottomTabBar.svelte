<script lang="ts">
  import { t } from '../../lib/i18n/index.svelte';
  import type { ActiveTab } from '../../lib/router.svelte';

  let {
    tab,
    onSwitchTab
  } = $props<{
    tab: ActiveTab;
    onSwitchTab: (tab: ActiveTab) => void;
  }>();
</script>

<!-- 📱 移动端固定底栏 Tab Bar (原生 iOS 风格，紧贴屏幕物理底边并自适应安全区) -->
<nav
  data-testid="mobile-bottom-nav"
  class="mobile-bottom-tab-bar md:hidden fixed bottom-0 left-0 right-0 z-[9990] bg-[var(--card-bg-solid)] backdrop-blur-2xl border-t border-[var(--border-color)] flex items-center justify-around px-2 box-border transition-colors duration-300"
>
  <button
    type="button"
    data-testid="bottom-tab-playlist"
    class="flex-1 flex flex-col items-center justify-center py-0.5 rounded-xl transition-all cursor-pointer bg-transparent border-none select-none {tab === 'playlist' ? 'text-red-500 dark:text-red-400 font-bold scale-105' : 'text-[var(--text-secondary)] opacity-75 hover:opacity-100 font-medium'}"
    onclick={() => onSwitchTab('playlist')}
  >
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block shrink-0">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
    <span class="text-[10px] mt-0.5 leading-none">{t('topbar.playlist')}</span>
  </button>

  <button
    type="button"
    data-testid="bottom-tab-search"
    class="flex-1 flex flex-col items-center justify-center py-0.5 rounded-xl transition-all cursor-pointer bg-transparent border-none select-none {tab === 'search' ? 'text-red-500 dark:text-red-400 font-bold scale-105' : 'text-[var(--text-secondary)] opacity-75 hover:opacity-100 font-medium'}"
    onclick={() => onSwitchTab('search')}
  >
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="inline-block shrink-0">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <span class="text-[10px] mt-0.5 leading-none">{t('topbar.search')}</span>
  </button>

  <button
    type="button"
    data-testid="bottom-tab-musicfree"
    class="flex-1 flex flex-col items-center justify-center py-0.5 rounded-xl transition-all cursor-pointer bg-transparent border-none select-none {tab === 'musicfree' ? 'text-purple-500 dark:text-purple-400 font-bold scale-105' : 'text-[var(--text-secondary)] opacity-75 hover:opacity-100 font-medium'}"
    onclick={() => onSwitchTab('musicfree')}
  >
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block shrink-0">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
    <span class="text-[10px] mt-0.5 leading-none">{t('topbar.discover')}</span>
  </button>

  <button
    type="button"
    data-testid="bottom-tab-download-mgr"
    class="flex-1 flex flex-col items-center justify-center py-0.5 rounded-xl transition-all cursor-pointer bg-transparent border-none select-none {tab === 'download-mgr' ? 'text-red-500 dark:text-red-400 font-bold scale-105' : 'text-[var(--text-secondary)] opacity-75 hover:opacity-100 font-medium'}"
    onclick={() => onSwitchTab('download-mgr')}
  >
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block shrink-0">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
    <span class="text-[10px] mt-0.5 leading-none">{t('topbar.local')}</span>
  </button>
</nav>
