<script lang="ts">
  import { customBgStore } from '../../lib/customBgStore.svelte';
  import { t } from '../../lib/i18n';
  import { Image, Film, Camera } from '@lucide/svelte';

  let {
    showToast = () => {}
  } = $props<{
    showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error', dur?: number) => void;
  }>();

  let fileInputEl = $state<HTMLInputElement | null>(null);

  async function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      await customBgStore.setMedia(file);
      showToast(t('settings.customBgSaved'), 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save background', 'error');
    } finally {
      input.value = '';
    }
  }

  async function handleClear() {
    try {
      await customBgStore.clear();
      showToast(t('settings.customBgCleared'), 'info');
    } catch {}
  }

  function handleDimChange(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    customBgStore.setDimOpacity(val);
  }

  function handleBlurChange(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    customBgStore.setBlur(val);
  }

  function handleToggleEnabled() {
    customBgStore.setEnabled(!customBgStore.enabled);
  }
</script>

<div class="flex flex-col gap-2.5 mt-2" data-testid="settings-custom-bg-section">
  <!-- 标题栏 -->
  <div class="flex items-center justify-between text-xs text-[var(--text-secondary)] px-1">
    <div class="flex items-center gap-1.5 font-bold text-[var(--text-muted)] uppercase tracking-wider">
      <Image size={14} />
      <span>{t('settings.customBgTitle')}</span>
    </div>
    {#if customBgStore.url}
      <label class="flex items-center gap-1.5 cursor-pointer text-xs select-none">
        <input
          type="checkbox"
          data-testid="toggle-custom-bg"
          checked={customBgStore.enabled}
          onchange={handleToggleEnabled}
          class="accent-[var(--primary-color)] w-3.5 h-3.5 cursor-pointer"
        />
        <span class="text-[11px] text-[var(--text-secondary)]">{t('settings.customBgEnableToggle')}</span>
      </label>
    {/if}
  </div>

  <div class="p-3 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-3">
    <!-- 隐藏的文件选择器 -->
    <input
      bind:this={fileInputEl}
      data-testid="custom-bg-file-input"
      type="file"
      accept="image/*,video/*"
      class="hidden"
      onchange={handleFileChange}
    />

    {#if customBgStore.url}
      <!-- 已设置背景预览卡片 -->
      <div class="relative w-full h-36 rounded-xl overflow-hidden border border-[var(--border-color)] bg-black/40 flex items-center justify-center select-none group">
        {#if customBgStore.type === 'image'}
          <img
            src={customBgStore.url}
            alt="Custom Background Preview"
            data-testid="preview-custom-bg-image"
            class="absolute inset-0 w-full h-full object-cover object-center transition-[filter] duration-200"
            style="filter: blur({customBgStore.blur}px);"
          />
        {:else if customBgStore.type === 'video'}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            src={customBgStore.url}
            data-testid="preview-custom-bg-video"
            autoplay
            loop
            muted
            playsinline
            class="absolute inset-0 w-full h-full object-cover object-center transition-[filter] duration-200"
            style="filter: blur({customBgStore.blur}px);"
          ></video>
        {/if}

        <!-- 调光遮罩预览 -->
        <div
          class="absolute inset-0 pointer-events-none transition-colors duration-200"
          style="background: rgba(0, 0, 0, {customBgStore.dimOpacity});"
        ></div>

        <!-- 浮空类型徽标 -->
        <div class="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/60 text-white backdrop-blur-md border border-white/10 flex items-center gap-1">
          {#if customBgStore.type === 'video'}
            <Film size={12} />
          {:else}
            <Camera size={12} />
          {/if}
          <span>{customBgStore.type === 'video' ? t('settings.customBgVideoType') : t('settings.customBgImageType')}</span>
        </div>

        {#if customBgStore.name}
          <div class="absolute bottom-2 left-2 right-2 z-10 px-2 py-1 rounded-md text-[11px] bg-black/60 text-white/90 backdrop-blur-md truncate border border-white/10">
            {customBgStore.name}
          </div>
        {/if}
      </div>

      <!-- 操作按钮条 -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          data-testid="btn-change-custom-bg"
          class="flex-1 py-1.5 px-3 rounded-xl bg-[var(--primary-color)] hover:opacity-90 active:scale-97 text-white text-xs font-semibold cursor-pointer border-none transition-all text-center"
          onclick={() => fileInputEl?.click()}
        >
          {t('settings.customBgChange')}
        </button>
        <button
          type="button"
          data-testid="btn-clear-custom-bg"
          class="py-1.5 px-3 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-red-500/10 hover:text-red-500 active:scale-97 text-[var(--text-secondary)] text-xs font-medium cursor-pointer border-none transition-all text-center"
          onclick={handleClear}
        >
          {t('settings.customBgClear')}
        </button>
      </div>

      <!-- 调节滑块：暗度与虚化 -->
      <div class="flex flex-col gap-2 pt-1 border-t border-[var(--border-color)]">
        <!-- 暗化遮罩调节 -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>{t('settings.customBgDim')}</span>
            <span class="font-mono text-[11px] text-[var(--text-muted)]">{Math.round(customBgStore.dimOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            data-testid="range-custom-bg-dim"
            min="0"
            max="0.8"
            step="0.05"
            value={customBgStore.dimOpacity}
            oninput={handleDimChange}
            class="w-full accent-[var(--primary-color)] cursor-pointer"
          />
        </div>

        <!-- 虚化程度调节 -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>{t('settings.customBgBlur')}</span>
            <span class="font-mono text-[11px] text-[var(--text-muted)]">{customBgStore.blur}px</span>
          </div>
          <input
            type="range"
            data-testid="range-custom-bg-blur"
            min="0"
            max="20"
            step="1"
            value={customBgStore.blur}
            oninput={handleBlurChange}
            class="w-full accent-[var(--primary-color)] cursor-pointer"
          />
        </div>
      </div>

      {#if customBgStore.type === 'video'}
        <div class="text-[11px] text-amber-500/90 dark:text-amber-400/90 bg-amber-500/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
          <span>{t('settings.customBgVideoMutedHint')}</span>
        </div>
      {/if}
    {:else}
      <!-- 未设置状态：大点击选择框 -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        data-testid="btn-upload-custom-bg"
        class="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-[var(--border-color)] hover:border-[var(--primary-color)] bg-black/5 dark:bg-white/5 cursor-pointer transition-all text-center gap-2 group active:scale-98"
        onclick={() => fileInputEl?.click()}
      >
        <div class="w-10 h-10 rounded-full bg-[var(--primary-color)]/10 text-[var(--primary-color)] flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
          <Camera size={20} />
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-xs font-bold text-[var(--text-main)]">{t('settings.customBgUpload')}</span>
          <span class="text-[11px] text-[var(--text-muted)]">{t('settings.customBgDesc')}</span>
        </div>
        <span class="text-[10px] text-[var(--text-muted)] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">
          JPG / PNG / WebP / MP4 / WebM
        </span>
      </div>

      <div class="text-[11px] text-[var(--text-muted)] px-1 flex items-center gap-1">
        <span>{t('settings.customBgVideoMutedHint')}</span>
      </div>
    {/if}
  </div>
</div>
