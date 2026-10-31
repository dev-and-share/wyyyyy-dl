<script lang="ts">
  import { platform } from '../lib/platform';
  import type { ThemeMode } from '../lib/theme';
  import { skin } from '../lib/skinStore.svelte';
  import { SKIN_LIST } from './skins/skinTypes';
  import SettingsCacheSection from './settings/SettingsCacheSection.svelte';
  import SettingsAccountSection from './settings/SettingsAccountSection.svelte';
  import SettingsMaintenanceSection from './settings/SettingsMaintenanceSection.svelte';
  import SettingsLanguageSection from './settings/SettingsLanguageSection.svelte';
  import { getF3TimeoutMinutes, setF3TimeoutMinutes } from '../lib/iosF3KeepAlive';
  import { t } from '../lib/i18n';

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

  // Animation and drag state
  let closing = $state(false);
  let dragStartY = $state(0);
  let dragOffset = $state(0);
  let isDragging = $state(false);
  let iosKeepAliveMin = $state(getF3TimeoutMinutes());

  function handleClose() {
    if (closing) return;
    closing = true;
    setTimeout(() => {
      onClose();
    }, 200);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

  function handleTouchStart(e: TouchEvent) {
    dragStartY = e.touches[0].clientY;
    dragOffset = 0;
    isDragging = true;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY;
    if (diff > 0) {
      dragOffset = diff;
    }
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (dragOffset > 100) {
      handleClose();
    } else {
      dragOffset = 0;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Global Backdrop (融入皮肤色彩与顶部状态栏，深浅色自适应) -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-[100049] transition-opacity duration-200 backdrop-blur-md {closing ? 'opacity-0' : 'opacity-100'}
    bg-black/40 dark:bg-gradient-to-b dark:from-[var(--bg-color)]/95 dark:via-[var(--bg-color)]/70 dark:to-black/80"
  onclick={handleClose}
></div>

<!-- Settings Drawer Panel -->
<div
  role="dialog"
  aria-modal="true"
  aria-label={t('settings.title')}
  class="fixed z-[100050] bg-[var(--card-bg-solid,var(--card-bg))] text-[var(--text-main)] transition-transform duration-200 ease-out flex flex-col
    inset-x-0 bottom-0 max-h-[88vh] rounded-t-[28px] border-t border-[var(--border-color)] backdrop-blur-2xl
    pb-[calc(16px+env(safe-area-inset-bottom,0px))]
    lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[420px] lg:max-h-full lg:rounded-none lg:border-l lg:border-t-0 lg:pb-0"
  style="transform: {closing ? 'translateY(100%)' : `translateY(${dragOffset}px)`};
         box-shadow: 0 -12px 40px var(--primary-glow, rgba(0, 0, 0, 0.5)), 0 -1px 0 0 var(--border-color);"
>
  <!-- Mobile Drag Handle -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="lg:hidden flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing select-none"
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
  >
    <div class="w-10 h-1.2 rounded-full bg-[var(--primary-color)] opacity-40 shadow-[0_0_8px_var(--primary-glow)]"></div>
  </div>

  <!-- Header -->
  <div class="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-color)] shrink-0 select-none">
    <div class="flex items-center gap-2">
      <span class="text-xl leading-none">⚙️</span>
      <h2 class="text-base font-bold text-[var(--text-main)] m-0">{t('settings.title')}</h2>
    </div>
    <button
      type="button"
      data-testid="btn-close-settings"
      class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent"
      onclick={handleClose}
      aria-label={t('settings.close')}
    >
      ✕
    </button>
  </div>

  <!-- Content -->
  <div class="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-8 flex flex-col gap-6 custom-scrollbar text-sm">
    <!-- Section 1: Download Preferences -->
    <section class="flex flex-col gap-2.5">
      <div class="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
        <span>📥</span>
        <span>{t('settings.downloadPreference')}</span>
      </div>
      <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex items-center justify-between gap-3">
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="font-semibold text-sm text-[var(--text-main)]">{t('settings.allowDuplicateDownload')}</span>
          <span class="text-xs text-[var(--text-secondary)]">{t('settings.allowDuplicateDownloadDesc')}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={repeat}
          aria-label={t('settings.allowDuplicateAria')}
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

    <!-- Section 2: Appearance -->
    <section class="flex flex-col gap-2.5">
      <div class="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
        <span>🎨</span>
        <span>{t('settings.interfaceAppearance')}</span>
      </div>
      <div class="p-1.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] grid grid-cols-3 gap-1">
        <button
          type="button"
          class="py-2 rounded-xl text-xs font-medium cursor-pointer border-none transition-all flex items-center justify-center gap-1.5 {themeMode === 'light' ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => onSelectTheme('light')}
        >
          <span>☀️</span> {t('settings.themeLight')}
        </button>
        <button
          type="button"
          class="py-2 rounded-xl text-xs font-medium cursor-pointer border-none transition-all flex items-center justify-center gap-1.5 {themeMode === 'dark' ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => onSelectTheme('dark')}
        >
          <span>🌙</span> {t('settings.themeDark')}
        </button>
        <button
          type="button"
          class="py-2 rounded-xl text-xs font-medium cursor-pointer border-none transition-all flex items-center justify-center gap-1.5 {themeMode === 'auto' ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
          onclick={() => onSelectTheme('auto')}
        >
          <span>🌓</span> {t('settings.themeAuto')}
        </button>
      </div>

      <!-- Player Skin Selection -->
      <div class="flex items-center justify-between text-xs text-[var(--text-secondary)] mt-1 px-1">
        <span>{t('settings.playerSkin')}</span>
        <span class="text-[11px] text-[var(--text-muted)] font-medium">{t(`player.skin.${skin.current}.name` as any)}</span>
      </div>
      <div class="p-1.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] grid grid-cols-3 sm:grid-cols-5 gap-1">
        {#each SKIN_LIST as s}
          <button
            type="button"
            data-testid="settings-skin-{s.id}"
            class="py-2 px-1 rounded-xl text-xs font-medium cursor-pointer border-none transition-all flex items-center justify-center gap-1 whitespace-nowrap {skin.current === s.id ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
            onclick={() => skin.set(s.id)}
          >
            <span>{s.emoji}</span> {t(`player.skin.${s.id}.name` as any)}
          </button>
        {/each}
      </div>
    </section>

    <!-- Section 2.5: Language -->
    <SettingsLanguageSection />

    <!-- Section 3: Audio Experience -->
    <section class="flex flex-col gap-2.5">
      <div class="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
        <span>🎛️</span>
        <span>{t('settings.audioExperience')}</span>
      </div>
      <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex items-center justify-between gap-3">
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="font-semibold text-sm text-[var(--text-main)]">{t('settings.peqTitle')}</span>
          <span class="text-xs text-[var(--text-secondary)]">
            {#if platform.canUseAudioProcessing}
              {t('settings.peqDesc')}
            {:else}
              {t('settings.peqIosWarning')}
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
            {t('settings.adjust')}
          </button>
        {:else}
          <span class="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-slate-500/10 text-[var(--text-muted)]">{t('settings.unavailable')}</span>
        {/if}
      </div>

      <!-- iOS 锁屏暂停保活时长 (仅 iOS 平台展示) -->
      {#if platform.isIOS}
        <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-2.5">
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="font-semibold text-sm text-[var(--text-main)]">{t('settings.iosKeepAliveTitle')}</span>
            <span class="text-xs text-[var(--text-secondary)]">{t('settings.iosKeepAliveDesc')}</span>
          </div>
          <div class="grid grid-cols-3 gap-1.5 pt-1">
            {#each [
              { val: 3, label: t('settings.iosKeepAliveMin3') },
              { val: 5, label: t('settings.iosKeepAliveMin5') },
              { val: 10, label: t('settings.iosKeepAliveMin10') },
              { val: 15, label: t('settings.iosKeepAliveMin15') },
              { val: 30, label: t('settings.iosKeepAliveMin30') },
              { val: 0, label: t('settings.iosKeepAliveNever') }
            ] as opt}
              <button
                type="button"
                data-testid="btn-ios-keepalive-{opt.val}"
                class="py-2 px-1 rounded-xl text-xs font-medium cursor-pointer border-none transition-all flex items-center justify-center text-center {iosKeepAliveMin === opt.val ? 'bg-red-500 text-white shadow-sm font-bold' : 'bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
                onclick={() => {
                  iosKeepAliveMin = opt.val;
                  setF3TimeoutMinutes(opt.val);
                  showToast(`${t('settings.iosKeepAliveTitle')}: ${opt.label}`, 'success', 2000);
                }}
              >
                {opt.label}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <!-- Section 4: Mobile Offline Cache -->
    <SettingsCacheSection {showToast} />

    <!-- Section 5: Account & Auth -->
    <SettingsAccountSection {showToast} />

    <!-- Section 6: Maintenance -->
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
