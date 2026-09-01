<script lang="ts">
  let {
    tab,
    themeMode,
    repeat,
    onSwitchTab,
    onToggleTheme,
    onToggleRepeat,
    onSwitchToLegacy,
    onRefresh
  } = $props<{
    tab: 'playlist' | 'search' | 'download-mgr';
    themeMode: 'dark' | 'light' | 'auto';
    repeat: boolean;
    onSwitchTab: (tab: 'playlist' | 'search' | 'download-mgr') => void;
    onToggleTheme: () => void;
    onToggleRepeat: () => void;
    onSwitchToLegacy: () => void;
    onRefresh?: () => void;
  }>();
</script>

<!-- 顶栏 (TopBar) -->
<div class="max-w-[900px] mx-auto mb-3 md:mb-4 px-2 py-1.5 md:px-3 md:py-1.5 bg-[var(--topbar-bg)] backdrop-blur-md rounded-[26px] shadow-md border border-[var(--topbar-border)] flex items-center justify-between gap-1.5 md:gap-2.5 transition-all duration-300">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="flex items-center gap-1.5 pl-1 shrink-0 select-none cursor-pointer" onclick={onRefresh} title="点击刷新数据">
    <span class="text-lg leading-none">🎵</span>
    <span class="hidden sm:inline font-bold text-sm text-[var(--text-main)] tracking-[-0.2px] whitespace-nowrap">网易云下载器</span>
    <span class="hidden sm:inline-block text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded-[10px] ml-0.5 font-semibold leading-tight">Svelte 5</span>
  </div>
  <div class="flex bg-[var(--nav-tabs-bg)] p-[3px] rounded-[20px] gap-0.5 flex-1 max-w-full md:max-w-[440px] justify-center">
    <button
      class="flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none {tab === 'playlist' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
      onclick={() => onSwitchTab('playlist')}>📁 歌单</button>
    <button
      class="flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none {tab === 'search' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
      onclick={() => onSwitchTab('search')}>🔍 搜索</button>
    <button
      class="flex-1 bg-transparent border-none py-1.5 px-1.5 sm:px-2 md:px-3 rounded-[16px] text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap transition-all duration-200 text-center select-none {tab === 'download-mgr' ? 'bg-[var(--nav-tab-active-bg)] text-[var(--nav-tab-active-color)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : ''}"
      onclick={() => onSwitchTab('download-mgr')}>📥 本地</button>
  </div>
  <div class="shrink-0 flex items-center gap-1 md:gap-1.5 pr-0.5">
    <button
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
    <button
      class="bg-purple-500/12 hover:bg-purple-500/22 text-purple-400 border border-purple-500/30 py-1 px-1.5 sm:px-2.5 rounded-[12px] text-xs font-semibold cursor-pointer inline-flex items-center justify-center whitespace-nowrap transition-all duration-200 select-none shrink-0"
      onclick={onSwitchToLegacy}
      title="返回旧版 (localStorage+Cookie)"
    >
      <span>↩️</span><span class="hidden sm:inline"> 旧版</span>
    </button>
  </div>
</div>
