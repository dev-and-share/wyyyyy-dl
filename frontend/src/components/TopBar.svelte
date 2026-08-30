<script lang="ts">
  let { tab, repeat, themeMode, onSwitch, onToggleTheme, onToggleRepeat, onLegacy } = $props<{
    tab:string, repeat:boolean, themeMode:string,
    onSwitch:(t:string)=>void, onToggleTheme:()=>void, onToggleRepeat:()=>void, onLegacy:()=>void
  }>();
</script>
<div class="app-top-bar">
  <div class="app-brand"><span class="brand-logo">🎵</span><span class="brand-title">网易云下载器</span><span style="font-size:10px; background:#8b5cf6; color:#fff; padding:1px 6px; border-radius:8px; margin-left:4px;">Svelte 5</span></div>
  <div class="app-nav-tabs">
    <button class="nav-tab-btn" class:active={tab==='playlist'} onclick={()=>onSwitch('playlist')}>📁 歌单</button>
    <button class="nav-tab-btn" class:active={tab==='search'} onclick={()=>onSwitch('search')}>🔍 搜索</button>
    <button class="nav-tab-btn" class:active={tab==='download-mgr'} onclick={()=>onSwitch('download-mgr')}>📥 本地</button>
  </div>
  <div class="app-top-actions">
    <button class="theme-toggle-btn" onclick={onToggleTheme} title="切换主题">{themeMode==='dark'?'🌙':themeMode==='light'?'☀️':'🌓'} <span class="theme-text">{themeMode==='dark'?'深色':themeMode==='light'?'浅色':'跟随'}</span></button>
    <label class="compact-switch-label"><input type="checkbox" checked={repeat} onchange={onToggleRepeat} /><span>允许重复</span></label>
    <button class="theme-toggle-btn" style="background:rgba(139,92,246,0.15); border-color:rgba(139,92,246,0.3); color:#a78bfa;" onclick={onLegacy}>↩️ 旧版</button>
  </div>
</div>
