<script lang="ts">
  import { platform } from '../lib/platform';
  import type { ThemeMode } from '../lib/theme';
  import SettingsCacheSection from './settings/SettingsCacheSection.svelte';
  import SettingsAccountSection from './settings/SettingsAccountSection.svelte';
  import SettingsMaintenanceSection from './settings/SettingsMaintenanceSection.svelte';

  let {
    repeat,
    themeMode,
    onToggleRepeat,
    onSelectTheme,
    onOpenPeq,
    onClose,
    showToast = () => {}
  } = $props<{
    repeat: boolean;
    themeMode: ThemeMode;
    onToggleRepeat: () => void;
    onSelectTheme: (mode: ThemeMode) => void;
    onOpenPeq: () => void;
    onClose: () => void;
    showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error', dur?: number) => void;
  }>();

  // 动画与手势下拉状态
  let closing = $state(false);
  let dragOffset = $state(0);
  let isDragging = $state(false);
  let startY = 0;

  function handleClose() {
    if (closing) return;
    closing = true;
    setTimeout(() => {
      closing = false;
      onClose();
    }, 200);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleClose();
  }

  // 手势拖拽关闭
  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      startY = e.touches[0].clientY;
      isDragging = true;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging || closing) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) {
      dragOffset = diff;
    } else {
      dragOffset = 0;
    }
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (dragOffset > 75) {
      dragOffset = 500;
      closing = true;
      setTimeout(() => {
        closing = false;
        dragOffset = 0;
        onClose();
      }, 200);
    } else {
      dragOffset = 0;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- 全局遮罩背景 -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200 {closing ? 'opacity-0' : 'opacity-100'}"
  onclick={handleClose}
></div>

<!-- 设置抽屉面板 -->
<div
  role="dialog"
  aria-modal="true"
  aria-label="系统偏好设置"
  class="fixed z-50 bg-[var(--card-bg)] text-[var(--text-main)] shadow-2xl transition-transform duration-200 ease-out border-[var(--border-color)] flex flex-col
    inset-x-0 bottom-0 max-h-[85vh] rounded-t-[28px] border-t
    lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[420px] lg:max-h-full lg:rounded-none lg:border-l lg:border-t-0"
  style="transform: {closing ? 'translateY(100%)' : `translateY(${dragOffset}px)`};"
>
  <!-- 移动端手势拖拽把手 -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="lg:hidden flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing select-none"
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
  >
    <div class="w-10 h-1 bg-[var(--text-muted)] opacity-30 rounded-full"></div>
  </div>

  <!-- 抽屉头部标题栏 -->
  <div class="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-color)] shrink-0 select-none">
    <div class="flex items-center gap-2">
      <span class="text-xl leading-none">⚙️</span>
      <h2 class="text-base font-bold text-[var(--text-main)] m-0">系统偏好设置</h2>
    </div>
    <button
      type="button"
      data-testid="btn-close-settings"
      class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent"
      onclick={handleClose}
      aria-label="关闭设置"
    >
      ✕
    </button>
  </div>

  <!-- 设置内容区域 (纵向可滚动) -->
  <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-6 custom-scrollbar text-sm">
    <!-- 板块 1: 下载偏好 -->
    <section class="flex flex-col gap-2.5">
      <div class="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
        <span>📥</span>
        <span>下载偏好</span>
      </div>
      <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex items-center justify-between gap-3">
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="font-semibold text-sm text-[var(--text-main)]">允许重复下载</span>
          <span class="text-xs text-[var(--text-secondary)]">关闭时跳过已有歌曲，开启后强制重新下载覆盖</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={repeat}
          aria-label="允许重复下载开关"
          data-testid="switch-repeat"
          class="relative shrink-0 w-12 h-6.5 rounded-full transition-colors duration-200 cursor-pointer border-none p-0.5 {repeat ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-700'}"
          onclick={onToggleRepeat}
        >
          <span
            class="block w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform duration-200 {repeat ? 'translate-x-5.5' : 'translate-x-0'}"
          ></span>
        </button>
      </div>
    </section>

    <!-- 板块 2: 外观与个性化 -->
    <section class="flex flex-col gap-2.5">
      <div class="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
        <span>🎨</span>
        <span>界面外观</span>
      </div>
      <div class="p-1.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] grid grid-cols-3 gap-1">
        <button
          type="button"
          class="py-2 rounded-xl text-xs font-medium cursor-pointer border-none transition-all flex items-center justify-center gap-1.5 {themeMode === 'light' ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => onSelectTheme('light')}
        >
          <span>☀️</span> 浅色
        </button>
        <button
          type="button"
          class="py-2 rounded-xl text-xs font-medium cursor-pointer border-none transition-all flex items-center justify-center gap-1.5 {themeMode === 'dark' ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => onSelectTheme('dark')}
        >
          <span>🌙</span> 深色
        </button>
        <button
          type="button"
          class="py-2 rounded-xl text-xs font-medium cursor-pointer border-none transition-all flex items-center justify-center gap-1.5 {themeMode === 'auto' ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => onSelectTheme('auto')}
        >
          <span>🌓</span> 自动
        </button>
      </div>
    </section>

    <!-- 板块 3: 音频与音质体验 -->
    <section class="flex flex-col gap-2.5">
      <div class="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
        <span>🎛️</span>
        <span>音频体验</span>
      </div>
      <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex items-center justify-between gap-3">
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="font-semibold text-sm text-[var(--text-main)]">5 段参量均衡器 (PEQ)</span>
          <span class="text-xs text-[var(--text-secondary)]">
            {#if platform.canUseAudioProcessing}
              定制人声、低音增强与各频段声学校准
            {:else}
              ⚠️ iOS 锁屏保活机制限制，均衡器暂不可用（防熄屏断音）
            {/if}
          </span>
        </div>
        {#if platform.canUseAudioProcessing}
          <button
            type="button"
            data-testid="btn-open-peq"
            class="shrink-0 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold cursor-pointer border-none transition-all shadow-sm active:scale-95"
            onclick={() => { handleClose(); onOpenPeq(); }}
          >
            调节
          </button>
        {:else}
          <span class="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-slate-500/10 text-[var(--text-muted)]">不可用</span>
        {/if}
      </div>
    </section>

    <!-- 板块 4: 手机离线缓存模块 -->
    <SettingsCacheSection {showToast} />

    <!-- 板块 5: 网易云账号与授权模块 -->
    <SettingsAccountSection {showToast} />

    <!-- 板块 6: 本地曲库与磁盘维护模块 -->
    <SettingsMaintenanceSection {showToast} />
  </div>
</div>

<style>
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: var(--border-color, rgba(255, 255, 255, 0.15)) transparent;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: var(--border-color, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
  }
</style>
