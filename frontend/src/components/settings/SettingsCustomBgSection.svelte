<script lang="ts">
  import { customBgStore } from '../../lib/customBgStore.svelte';
  import { t } from '../../lib/i18n';
  import { Image, Film, Camera, Move, RotateCcw } from '@lucide/svelte';

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

  function handleScaleChange(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    customBgStore.setScale(val);
  }

  function handlePosXChange(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    customBgStore.setPositionX(val);
  }

  function handlePosYChange(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    customBgStore.setPositionY(val);
  }

  function handleToggleEnabled() {
    customBgStore.setEnabled(!customBgStore.enabled);
  }

  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let initialPosX = 50;
  let initialPosY = 50;

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialPosX = customBgStore.positionX;
    initialPosY = customBgStore.positionY;
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // 拖动画面：向右拖拽查看左侧内容（positionX 减小），向左拖拽查看右侧内容（positionX 增大）
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    const deltaPercentX = (deltaX / rect.width) * 100;
    const deltaPercentY = (deltaY / rect.height) * 100;

    const newX = Math.round(initialPosX - deltaPercentX);
    const newY = Math.round(initialPosY - deltaPercentY);

    customBgStore.setPosition(newX, newY);
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
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
      <div class="flex items-center gap-2 select-none">
        <span
          class="text-[11px] text-[var(--text-secondary)] cursor-pointer"
          onclick={handleToggleEnabled}
          role="presentation"
        >
          {t('settings.customBgEnableToggle')}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={customBgStore.enabled}
          aria-label={t('settings.customBgEnableToggle')}
          data-testid="toggle-custom-bg"
          class="relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer border-none p-0.5 {customBgStore.enabled ? 'bg-[var(--primary-color)]' : 'bg-slate-300 dark:bg-slate-700'}"
          onclick={handleToggleEnabled}
        >
          <span
            class="block w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 {customBgStore.enabled ? 'translate-x-5' : 'translate-x-0'}"
          ></span>
        </button>
      </div>
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
      <!-- 已设置背景预览卡片 (未打勾启用时仅紧凑展示小图，打勾启用后支持鼠标 / 触控拖拽自由微调位置) -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        data-testid="preview-custom-bg-card"
        class="relative w-full {customBgStore.enabled ? 'h-40' : 'h-32'} rounded-xl overflow-hidden border border-[var(--border-color)] bg-black/40 flex items-center justify-center select-none group touch-none transition-all duration-200 {customBgStore.enabled ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'opacity-85'}"
        onpointerdown={customBgStore.enabled ? handlePointerDown : undefined}
        onpointermove={customBgStore.enabled ? handlePointerMove : undefined}
        onpointerup={customBgStore.enabled ? handlePointerUp : undefined}
        onpointercancel={customBgStore.enabled ? handlePointerUp : undefined}
      >
        {#if customBgStore.type === 'image'}
          <img
            src={customBgStore.url}
            alt="Custom Background Preview"
            data-testid="preview-custom-bg-image"
            class="absolute inset-0 w-full h-full pointer-events-none {isDragging ? 'transition-none' : 'transition-[filter,transform,object-position] duration-200 ease-out'}"
            style="
              filter: blur({customBgStore.blur}px);
              object-fit: {customBgStore.fit};
              object-position: {customBgStore.positionX}% {customBgStore.positionY}%;
              transform: scale({customBgStore.scale});
              transform-origin: {customBgStore.positionX}% {customBgStore.positionY}%;
            "
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
            class="absolute inset-0 w-full h-full pointer-events-none {isDragging ? 'transition-none' : 'transition-[filter,transform,object-position] duration-200 ease-out'}"
            style="
              filter: blur({customBgStore.blur}px);
              object-fit: {customBgStore.fit};
              object-position: {customBgStore.positionX}% {customBgStore.positionY}%;
              transform: scale({customBgStore.scale});
              transform-origin: {customBgStore.positionX}% {customBgStore.positionY}%;
            "
          ></video>
        {/if}

        <!-- 调光遮罩预览 -->
        <div
          class="absolute inset-0 pointer-events-none transition-colors duration-200"
          style="background: rgba(0, 0, 0, {customBgStore.dimOpacity});"
        ></div>

        <!-- 浮空类型与尺寸徽标 -->
        <div class="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/60 text-white backdrop-blur-md border border-white/10 flex items-center gap-1 pointer-events-none">
          {#if customBgStore.type === 'video'}
            <Film size={12} />
          {:else}
            <Camera size={12} />
          {/if}
          <span>{customBgStore.type === 'video' ? t('settings.customBgVideoType') : t('settings.customBgImageType')}</span>
        </div>

        <!-- 右上角拖拽操作提示徽标 (仅在启用时展示) -->
        {#if customBgStore.enabled}
          <div class="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-md text-[10px] bg-black/60 text-white/90 backdrop-blur-md border border-white/10 flex items-center gap-1 pointer-events-none shadow-xs transition-opacity {isDragging ? 'opacity-100 bg-[var(--primary-color)] text-white' : 'opacity-80 group-hover:opacity-100'}">
            <Move size={11} />
            <span>{t('settings.customBgDragHint')}</span>
          </div>
        {/if}

        {#if customBgStore.name}
          <div class="absolute bottom-2 left-2 right-2 z-10 px-2 py-1 rounded-md text-[11px] bg-black/60 text-white/90 backdrop-blur-md truncate border border-white/10 pointer-events-none">
            {customBgStore.name}
          </div>
        {/if}
      </div>

      {#if customBgStore.enabled}
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

        <!-- 🌄 显示范围与位置调节模块 -->
        <div class="flex flex-col gap-2.5 pt-2 border-t border-[var(--border-color)]">
          <div class="flex items-center justify-between text-xs font-bold text-[var(--text-main)]">
            <div class="flex items-center gap-1.5">
              <Move size={13} class="text-[var(--primary-color)]" />
              <span>{t('settings.customBgScale')} / {t('settings.customBgFitMode')}</span>
            </div>
            <button
              type="button"
              data-testid="btn-custom-bg-reset-pos"
              class="text-[11px] text-[var(--text-muted)] hover:text-[var(--primary-color)] flex items-center gap-1 cursor-pointer border-none bg-transparent transition-colors p-0"
              onclick={() => customBgStore.resetPositionAndScale()}
              title={t('settings.customBgResetPosition')}
            >
              <RotateCcw size={11} />
              <span>{t('settings.customBgResetPosition')}</span>
            </button>
          </div>

          <!-- 填充模式分段切换 -->
          <div class="grid grid-cols-2 gap-1.5 p-0.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-color)] text-xs">
            <button
              type="button"
              data-testid="select-custom-bg-fit-cover"
              class="py-1 rounded-lg text-center font-medium transition-all border-none cursor-pointer {customBgStore.fit === 'cover'
                ? 'bg-[var(--primary-color)] text-white shadow-xs font-semibold'
                : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
              onclick={() => customBgStore.setFit('cover')}
            >
              {t('settings.customBgFitCover')}
            </button>
            <button
              type="button"
              data-testid="select-custom-bg-fit-contain"
              class="py-1 rounded-lg text-center font-medium transition-all border-none cursor-pointer {customBgStore.fit === 'contain'
                ? 'bg-[var(--primary-color)] text-white shadow-xs font-semibold'
                : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
              onclick={() => customBgStore.setFit('contain')}
            >
              {t('settings.customBgFitContain')}
            </button>
          </div>

          <!-- 缩放范围 (Scale) -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>{t('settings.customBgScale')}</span>
              <span class="font-mono text-[11px] text-[var(--text-muted)]">{Math.round(customBgStore.scale * 100)}%</span>
            </div>
            <input
              type="range"
              data-testid="range-custom-bg-scale"
              min="0.5"
              max="2.0"
              step="0.05"
              value={customBgStore.scale}
              oninput={handleScaleChange}
              class="w-full accent-[var(--primary-color)] cursor-pointer"
            />
          </div>

          <!-- 水平显示位置 (X) -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>{t('settings.customBgPositionX')}</span>
              <span class="font-mono text-[11px] text-[var(--text-muted)]">{customBgStore.positionX}%</span>
            </div>
            <input
              type="range"
              data-testid="range-custom-bg-pos-x"
              min="0"
              max="100"
              step="1"
              value={customBgStore.positionX}
              oninput={handlePosXChange}
              class="w-full accent-[var(--primary-color)] cursor-pointer"
            />
          </div>

          <!-- 垂直显示位置 (Y) -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>{t('settings.customBgPositionY')}</span>
              <span class="font-mono text-[11px] text-[var(--text-muted)]">{customBgStore.positionY}%</span>
            </div>
            <input
              type="range"
              data-testid="range-custom-bg-pos-y"
              min="0"
              max="100"
              step="1"
              value={customBgStore.positionY}
              oninput={handlePosYChange}
              class="w-full accent-[var(--primary-color)] cursor-pointer"
            />
          </div>

          <!-- 快捷位置按钮 -->
          <div class="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              data-testid="btn-custom-bg-pos-top"
              class="flex-1 py-1 px-1.5 rounded-lg text-[11px] bg-black/5 dark:bg-white/10 hover:bg-[var(--primary-color)] hover:text-white text-[var(--text-secondary)] font-medium border-none cursor-pointer transition-colors"
              onclick={() => customBgStore.setPosition(50, 10)}
            >
              {t('settings.customBgPosTop')}
            </button>
            <button
              type="button"
              data-testid="btn-custom-bg-pos-center"
              class="flex-1 py-1 px-1.5 rounded-lg text-[11px] bg-black/5 dark:bg-white/10 hover:bg-[var(--primary-color)] hover:text-white text-[var(--text-secondary)] font-medium border-none cursor-pointer transition-colors"
              onclick={() => customBgStore.setPosition(50, 50)}
            >
              {t('settings.customBgPosCenter')}
            </button>
            <button
              type="button"
              data-testid="btn-custom-bg-pos-bottom"
              class="flex-1 py-1 px-1.5 rounded-lg text-[11px] bg-black/5 dark:bg-white/10 hover:bg-[var(--primary-color)] hover:text-white text-[var(--text-secondary)] font-medium border-none cursor-pointer transition-colors"
              onclick={() => customBgStore.setPosition(50, 90)}
            >
              {t('settings.customBgPosBottom')}
            </button>
          </div>
        </div>

        <!-- 调节滑块：暗度与虚化 -->
        <div class="flex flex-col gap-2 pt-2 border-t border-[var(--border-color)]">
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
