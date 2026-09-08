<script lang="ts">
  let {
    tab,
    themeMode,
    repeat,
    isDesktopLayout = false,
    onSwitchTab,
    onToggleTheme,
    onToggleRepeat,
    onRefresh
  } = $props<{
    tab: 'playlist' | 'search' | 'download-mgr';
    themeMode: 'dark' | 'light' | 'auto';
    repeat: boolean;
    isDesktopLayout?: boolean;
    onSwitchTab: (tab: 'playlist' | 'search' | 'download-mgr') => void;
    onToggleTheme: () => void;
    onToggleRepeat: () => void;
    onRefresh?: () => void;
  }>();
</script>

<!-- 顶栏 (TopBar) -->
{#if isDesktopLayout}
  <!-- 💻 PC 桌面侧边栏模式：右上角极简控制胶囊 (与主区首行平齐并排，不占垂直高度) -->
  <header class="hidden lg:flex absolute right-4 top-4 z-20 items-center justify-end select-none pointer-events-auto" data-testid="desktop-top-bar">
    <div class="flex items-center gap-1.5 p-1 bg-[var(--topbar-bg)] backdrop-blur-md rounded-2xl border border-[var(--topbar-border)] shadow-sm">
      <button
        data-testid="btn-toggle-theme"
        class="bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--btn-secondary-color)] hover:text-[var(--btn-secondary-hover-color)] border border-[var(--btn-secondary-border)] w-7 h-7 rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center justify-center whitespace-nowrap transition-all select-none shrink-0"
        onclick={onToggleTheme}
        title="切换主题"
      >
        {themeMode === 'dark' ? '🌙' : themeMode === 'light' ? '☀️' : '🌓'}
      </button>

      <label
        class="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer select-none bg-[var(--nav-tabs-bg)] px-2.5 py-1 rounded-xl border border-[var(--border-color)] transition-all"
        title="允许重复下载"
      >
        <input type="checkbox" checked={repeat} onchange={onToggleRepeat} class="m-0 accent-[var(--primary-color)] cursor-pointer" />
        <span>允许重复</span>
      </label>
    </div>
  </header>
{:else}
  <!-- 📱 移动端：标准顶栏 -->
  <div class="max-w-[900px] mx-auto mb-1 md:mb-4 px-3 py-1.5 md:px-3 md:py-1.5 bg-[var(--topbar-bg)] backdrop-blur-md rounded-none md:rounded-[26px] shadow-sm md:shadow-md border-x-0 md:border border-t-0 md:border-t border-b border-[var(--topbar-border)] flex items-center justify-between gap-1.5 md:gap-2.5 transition-all duration-300">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="flex items-center gap-1.5 pl-1 shrink-0 select-none cursor-pointer" onclick={onRefresh} title="点击刷新数据">
      <span class="text-lg leading-none">🎵</span>
      <span class="hidden sm:inline font-bold text-sm text-[var(--text-main)] tracking-[-0.2px] whitespace-nowrap">网易云下载器</span>
    </div>
    <div class="hidden md:flex bg-[var(--nav-tabs-bg)] p-[3px] rounded-[20px] gap-0.5 flex-1 max-w-[440px] justify-center">
      <button
        data-testid="tab-playlist"
        class="flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none {tab === 'playlist' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
        onclick={() => onSwitchTab('playlist')}>📁 歌单</button>
      <button
        data-testid="tab-search"
        class="flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none {tab === 'search' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
        onclick={() => onSwitchTab('search')}>🔍 搜索</button>
      <button
        data-testid="tab-download-mgr"
        class="flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none {tab === 'download-mgr' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
        onclick={() => onSwitchTab('download-mgr')}>📥 本地</button>
    </div>
    <div class="shrink-0 flex items-center gap-1 md:gap-1.5 pr-0.5 ml-auto">
      <button
        data-testid="btn-toggle-theme"
        class="bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--btn-secondary-color)] hover:text-[var(--btn-secondary-hover-color)] border border-[var(--btn-secondary-border)] py-1 px-1.5 sm:px-2.5 rounded-[12px] text-xs font-semibold cursor-pointer inline-flex items-center justify-center whitespace-nowrap transition-all duration-200 select-none shrink-0"
        onclick={onToggleTheme}
        title="切换主题"
      >
        {themeMode === 'dark' ? '🌙' : themeMode === 'light' ? '☀️' : '🌓'}
      </button>
      <label
        class="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer select-none bg-[var(--nav-tabs-bg)] py-1 px-1.5 sm:px-2.5 rounded-[12px] sm:rounded-[14px] border border-[var(--border-color)] transition-all duration-200"
        title="允许重复下载"
      >
        <input type="checkbox" checked={repeat} onchange={onToggleRepeat} class="m-0 accent-[var(--primary-color)] cursor-pointer" />
        <span class="hidden sm:inline">允许重复</span>
      </label>
    </div>
  </div>
{/if}
