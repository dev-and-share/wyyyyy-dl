<script lang="ts">
  let {
    tab,
    onSwitchTab
  } = $props<{
    tab: 'playlist' | 'search' | 'download-mgr';
    onSwitchTab: (tab: 'playlist' | 'search' | 'download-mgr') => void;
  }>();
</script>

<!-- 📱 移动端固定底栏 Tab Bar (原生 iOS 风格，紧贴屏幕物理底边并自适应安全区) -->
<nav
  data-testid="mobile-bottom-nav"
  class="mobile-bottom-tab-bar md:hidden fixed bottom-0 left-0 right-0 z-[9990] bg-[var(--card-bg-solid)] backdrop-blur-2xl border-t border-[var(--border-color)] flex items-center justify-around px-2 pt-1 box-border transition-colors duration-300"
>
  <button
    type="button"
    data-testid="bottom-tab-playlist"
    class="flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer bg-transparent border-none select-none {tab === 'playlist' ? 'text-red-500 dark:text-red-400 font-bold scale-105' : 'text-[var(--text-secondary)] opacity-80 hover:opacity-100 font-medium'}"
    onclick={() => onSwitchTab('playlist')}
  >
    <span class="text-[17px] leading-tight">📁</span>
    <span class="text-[11px] mt-0.5 leading-none">歌单</span>
  </button>
  <button
    type="button"
    data-testid="bottom-tab-search"
    class="flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer bg-transparent border-none select-none {tab === 'search' ? 'text-red-500 dark:text-red-400 font-bold scale-105' : 'text-[var(--text-secondary)] opacity-80 hover:opacity-100 font-medium'}"
    onclick={() => onSwitchTab('search')}
  >
    <span class="text-[17px] leading-tight">🔍</span>
    <span class="text-[11px] mt-0.5 leading-none">搜索</span>
  </button>
  <button
    type="button"
    data-testid="bottom-tab-download-mgr"
    class="flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer bg-transparent border-none select-none {tab === 'download-mgr' ? 'text-red-500 dark:text-red-400 font-bold scale-105' : 'text-[var(--text-secondary)] opacity-80 hover:opacity-100 font-medium'}"
    onclick={() => onSwitchTab('download-mgr')}
  >
    <span class="text-[17px] leading-tight">📥</span>
    <span class="text-[11px] mt-0.5 leading-none">本地</span>
  </button>
</nav>
