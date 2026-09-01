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
    <span class="brand-badge">Svelte 5</span>
  </div>
  <div class="app-nav-tabs">
    <button class="nav-tab-btn" class:active={tab === 'playlist'} onclick={() => onSwitchTab('playlist')}>📁 歌单</button>
    <button class="nav-tab-btn" class:active={tab === 'search'} onclick={() => onSwitchTab('search')}>🔍 搜索</button>
    <button class="nav-tab-btn" class:active={tab === 'download-mgr'} onclick={() => onSwitchTab('download-mgr')}>📥 本地</button>
  </div>
  <div class="app-top-actions">
    <button class="topbar-action-btn" onclick={onToggleTheme} title="切换主题">
      {themeMode === 'dark' ? '🌙' : themeMode === 'light' ? '☀️' : '🌓'}
    </button>
    <label class="compact-switch-label" title="允许重复下载">
      <input type="checkbox" checked={repeat} onchange={onToggleRepeat} />
      <span class="repeat-label-text">允许重复</span>
    </label>
    <button
      class="topbar-action-btn legacy-btn"
      onclick={onSwitchToLegacy}
      title="返回旧版 (localStorage+Cookie)"
    >
      <span>↩️</span><span class="legacy-btn-text"> 旧版</span>
    </button>
  </div>
</div>

<style>
  .brand-badge {
    font-size: 10px;
    background: #8b5cf6;
    color: #fff;
    padding: 2px 6px;
    border-radius: 10px;
    margin-left: 2px;
    font-weight: 600;
  }
  .topbar-action-btn {
    background: var(--btn-secondary-bg);
    border: 1px solid var(--btn-secondary-border);
    color: var(--btn-secondary-color);
    padding: 5px 9px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    transition: all 0.2s ease;
    user-select: none;
    flex-shrink: 0;
  }
  .topbar-action-btn:hover {
    background: var(--btn-secondary-hover-bg);
    color: var(--btn-secondary-hover-color);
  }
  .legacy-btn {
    background: rgba(139, 92, 246, 0.12) !important;
    border-color: rgba(139, 92, 246, 0.3) !important;
    color: #a78bfa !important;
  }
  .legacy-btn:hover {
    background: rgba(139, 92, 246, 0.22) !important;
  }

  /* 📱 移动端小屏极简适配 (< 640px) */
  @media (max-width: 640px) {
    .brand-title, .brand-badge {
      display: none !important;
    }
    .repeat-label-text {
      display: none !important;
    }
    .legacy-btn-text {
      display: none !important;
    }
    .topbar-action-btn {
      padding: 4px 6px;
      font-size: 11.5px;
    }
    :global(.nav-tab-btn) {
      padding: 5px 8px !important;
      font-size: 11.5px !important;
    }
  }
</style>
