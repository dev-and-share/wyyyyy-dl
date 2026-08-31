<script lang="ts">
  let {
    tab,
    themeMode,
    repeat,
    onSwitchTab,
    onToggleTheme,
    onToggleRepeat,
    onSwitchToLegacy
  } = $props<{
    tab: 'playlist' | 'search' | 'download-mgr';
    themeMode: 'dark' | 'light' | 'auto';
    repeat: boolean;
    onSwitchTab: (tab: 'playlist' | 'search' | 'download-mgr') => void;
    onToggleTheme: () => void;
    onToggleRepeat: () => void;
    onSwitchToLegacy: () => void;
  }>();
</script>

<!-- 顶栏 (TopBar) -->
<div class="app-top-bar">
  <div class="app-brand">
    <span class="brand-logo">🎵</span>
    <span class="brand-title">网易云下载器</span>
    <span style="font-size:10px; background:#8b5cf6; color:#fff; padding:1px 6px; border-radius:8px; margin-left:4px;">Svelte 5</span>
  </div>
  <div class="app-nav-tabs">
    <button class="nav-tab-btn" class:active={tab === 'playlist'} onclick={() => onSwitchTab('playlist')}>📁 歌单</button>
    <button class="nav-tab-btn" class:active={tab === 'search'} onclick={() => onSwitchTab('search')}>🔍 搜索</button>
    <button class="nav-tab-btn" class:active={tab === 'download-mgr'} onclick={() => onSwitchTab('download-mgr')}>📥 本地</button>
  </div>
  <div class="app-top-actions">
    <button class="theme-toggle-btn" onclick={onToggleTheme} title="切换主题">
      {themeMode === 'dark' ? '🌙' : themeMode === 'light' ? '☀️' : '🌓'}
    </button>
    <label class="compact-switch-label">
      <input type="checkbox" checked={repeat} onchange={onToggleRepeat} />
      <span>允许重复</span>
    </label>
    <button
      class="theme-toggle-btn"
      style="background:rgba(139,92,246,0.15); border-color:rgba(139,92,246,0.3); color:#a78bfa;"
      onclick={onSwitchToLegacy}
      title="返回旧版 (localStorage+Cookie)"
    >
      ↩️ 旧版
    </button>
  </div>
</div>
