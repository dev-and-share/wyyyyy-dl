<script lang="ts">
  import { Music2, Search, Puzzle, HardDriveDownload } from '@lucide/svelte';
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
    <Music2 size={18} class="inline-block shrink-0" />
    <span class="text-[10px] mt-0.5 leading-none">{t('topbar.playlist')}</span>
  </button>

  <button
    type="button"
    data-testid="bottom-tab-search"
    class="flex-1 flex flex-col items-center justify-center py-0.5 rounded-xl transition-all cursor-pointer bg-transparent border-none select-none {tab === 'search' ? 'text-red-500 dark:text-red-400 font-bold scale-105' : 'text-[var(--text-secondary)] opacity-75 hover:opacity-100 font-medium'}"
    onclick={() => onSwitchTab('search')}
  >
    <Search size={18} class="inline-block shrink-0" />
    <span class="text-[10px] mt-0.5 leading-none">{t('topbar.search')}</span>
  </button>

  <button
    type="button"
    data-testid="bottom-tab-musicfree"
    class="flex-1 flex flex-col items-center justify-center py-0.5 rounded-xl transition-all cursor-pointer bg-transparent border-none select-none {tab === 'musicfree' ? 'text-purple-500 dark:text-purple-400 font-bold scale-105' : 'text-[var(--text-secondary)] opacity-75 hover:opacity-100 font-medium'}"
    onclick={() => onSwitchTab('musicfree')}
  >
    <Puzzle size={18} class="inline-block shrink-0" />
    <span class="text-[10px] mt-0.5 leading-none">{t('topbar.discover')}</span>
  </button>

  <button
    type="button"
    data-testid="bottom-tab-download-mgr"
    class="flex-1 flex flex-col items-center justify-center py-0.5 rounded-xl transition-all cursor-pointer bg-transparent border-none select-none {tab === 'download-mgr' ? 'text-red-500 dark:text-red-400 font-bold scale-105' : 'text-[var(--text-secondary)] opacity-75 hover:opacity-100 font-medium'}"
    onclick={() => onSwitchTab('download-mgr')}
  >
    <HardDriveDownload size={18} class="inline-block shrink-0" />
    <span class="text-[10px] mt-0.5 leading-none">{t('topbar.local')}</span>
  </button>
</nav>
