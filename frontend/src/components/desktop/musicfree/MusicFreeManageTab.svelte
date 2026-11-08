<script lang="ts">
  import { t } from '../../../lib/i18n';
  import { musicFreeStore } from '../../../lib/musicfree/musicFreeStore.svelte';
  import { getPluginDisplayName, getPluginDisplayAuthor } from '../../../lib/musicfree/pluginI18n';

  let {
    showToast
  } = $props<{
    showToast: (m: string, t?: string) => void;
  }>();

  let inputUrl = $state('');

  const PRESET_SOURCES = $derived([
    {
      name: t('musicfree.presetSourcePureFive'),
      url: 'https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/myPlugins.json'
    },
    {
      name: t('musicfree.presetSourceDailySync'),
      url: 'https://fastly.jsdelivr.net/gh/hebijunge/musicfree-plugins@master/plugins.json'
    },
    {
      name: t('musicfree.presetSourceOfficial'),
      url: 'https://gitee.com/maotoumao/MusicFreePlugins/raw/master/plugins.json'
    }
  ]);

  const SINGLE_PRESETS = [
    { name: '酷我音乐 (小蜗)', url: 'https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaowo.js' },
    { name: 'QQ音乐 (小秋)', url: 'https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaoqiu.js' },
    { name: '酷狗音乐 (小枸)', url: 'https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaogou.js' },
    { name: '猫耳FM (广播剧)', url: 'https://gitee.com/maotoumao/MusicFreePlugins/raw/v0.1/dist/maoerfm/index.js' }
  ];

  function handleCleanupJunk() {
    const count = musicFreeStore.cleanupJunkPlugins();
    if (count > 0) {
      showToast(t('musicfree.cleanJunkSuccess', { count }), 'success');
    } else {
      showToast(t('musicfree.cleanJunkNoop'), 'info');
    }
  }

  function handleSelectAll() {
    musicFreeStore.setAllPluginsEnabled(true);
    showToast(t('musicfree.enabledAllToast'), 'success');
  }

  function handleSelectNone() {
    musicFreeStore.setAllPluginsEnabled(false);
    showToast(t('musicfree.disabledAllToast'), 'info');
  }

  function handleInvertSelection() {
    musicFreeStore.invertAllPlugins();
    showToast(t('musicfree.invertToast'), 'info');
  }

  function handleRestoreBuiltins() {
    const count = musicFreeStore.restoreBuiltinPlugins();
    if (count > 0) {
      showToast(t('musicfree.restoreBuiltinsSuccess', { count }), 'success');
    } else {
      showToast(t('musicfree.restoreBuiltinsNoop'), 'info');
    }
  }

  async function handleImport(urlToImport?: string) {
    const url = (urlToImport || inputUrl).trim();
    if (!url) {
      showToast(t('musicfree.urlRequired'), 'warning');
      return;
    }

    try {
      showToast(t('musicfree.importing'), 'info', 3000);
      const res = await musicFreeStore.installFromUrl(url);
      if (res.successCount > 0) {
        showToast(t('musicfree.importSuccess', { count: res.successCount }), 'success');
        inputUrl = '';
      } else {
        showToast(t('musicfree.importFailedZero'), 'error');
      }
      if (res.errors.length > 0) {
        console.warn('插件导入过程部分异常:', res.errors);
      }
    } catch (err: any) {
      showToast(t('musicfree.importFailedError', { error: err.message || err }), 'error');
    }
  }
</script>

<div class="space-y-6">
  <!-- 导入订阅源 / 单插件卡片 -->
  <section class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
    <h2 class="text-sm font-semibold text-[var(--text-main)] flex items-center gap-1.5">
      <span>📥</span> {t('musicfree.importTitle')}
    </h2>

    <div class="flex flex-col sm:flex-row gap-2.5">
      <input
        type="text"
        bind:value={inputUrl}
        placeholder={t('musicfree.importPlaceholder')}
        class="flex-1 px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-xs lg:text-sm text-[var(--text-main)] outline-none focus:border-purple-500 transition-colors"
        onkeydown={(e) => e.key === 'Enter' && handleImport()}
      />
      <button
        type="button"
        disabled={musicFreeStore.loading}
        onclick={() => handleImport()}
        class="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-medium text-xs lg:text-sm hover:bg-purple-500 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center gap-2"
      >
        {#if musicFreeStore.loading}
          <span class="animate-spin text-sm">⏳</span>
          <span>{musicFreeStore.statusMessage || t('musicfree.fetchingParsing')}</span>
        {:else}
          <span>{t('musicfree.importBtn')}</span>
        {/if}
      </button>
    </div>

    <!-- 预设接口快捷点击标签 -->
    <div class="pt-2 border-t border-[var(--border-color)]/50 space-y-2">
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-xs text-[var(--text-muted)] font-medium">{t('musicfree.presetSourcesLabel')}</span>
        {#each PRESET_SOURCES as preset}
          <button
            type="button"
            class="px-2.5 py-1 rounded-lg text-[11px] bg-[var(--btn-secondary-bg)] hover:bg-purple-500/10 hover:text-purple-400 text-[var(--text-secondary)] border border-[var(--border-color)] transition-colors cursor-pointer"
            onclick={() => {
              inputUrl = preset.url;
              handleImport(preset.url);
            }}
          >
            {preset.name}
          </button>
        {/each}
      </div>

      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-xs text-[var(--text-muted)] font-medium">{t('musicfree.singlePresetsLabel')}</span>
        {#each SINGLE_PRESETS as single}
          <button
            type="button"
            class="px-2 py-0.5 rounded-md text-[10px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 transition-colors cursor-pointer"
            onclick={() => {
              inputUrl = single.url;
              handleImport(single.url);
            }}
          >
            + {single.name}
          </button>
        {/each}
      </div>
    </div>
  </section>

  <!-- 已安装插件网格列表 -->
  <section class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-[var(--text-main)] flex items-center gap-1.5 shrink-0">
        <span>📦</span> {t('musicfree.installedPluginsTitle', { count: musicFreeStore.plugins.length })}
      </h2>
      <div class="flex items-center gap-2 flex-wrap">
        {#if musicFreeStore.canRestoreBuiltins}
          <button
            type="button"
            onclick={handleRestoreBuiltins}
            class="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 transition-colors cursor-pointer flex items-center gap-1"
            title={t('musicfree.restoreBuiltinsTooltip')}
          >
            <span>🔄</span> {t('musicfree.restoreBuiltins')}
          </button>
        {/if}
        {#if musicFreeStore.plugins.length > 0}
          <button
            type="button"
            onclick={handleCleanupJunk}
            class="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
            title={t('musicfree.cleanJunkTooltip')}
          >
            {t('musicfree.cleanJunk')}
          </button>
          <button
            type="button"
            onclick={handleSelectAll}
            class="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--btn-secondary-bg)] hover:bg-purple-500/10 hover:text-purple-400 text-[var(--text-secondary)] border border-[var(--border-color)] transition-colors cursor-pointer"
            title={t('musicfree.selectAll')}
          >
            {t('musicfree.selectAll')}
          </button>
          <button
            type="button"
            onclick={handleSelectNone}
            class="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--btn-secondary-bg)] hover:bg-purple-500/10 hover:text-purple-400 text-[var(--text-secondary)] border border-[var(--border-color)] transition-colors cursor-pointer"
            title={t('musicfree.selectNone')}
          >
            {t('musicfree.selectNone')}
          </button>
          <button
            type="button"
            onclick={handleInvertSelection}
            class="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--btn-secondary-bg)] hover:bg-purple-500/10 hover:text-purple-400 text-[var(--text-secondary)] border border-[var(--border-color)] transition-colors cursor-pointer"
            title={t('musicfree.invertSelection')}
          >
            {t('musicfree.invertSelection')}
          </button>
        {/if}
        <span class="text-xs text-[var(--text-muted)] hidden lg:inline">
          {t('musicfree.toggleHint')}
        </span>
      </div>
    </div>

    {#if musicFreeStore.plugins.length === 0}
      <div class="p-8 text-center border border-dashed border-[var(--border-color)] rounded-2xl bg-[var(--card-bg)]/40 text-[var(--text-muted)] text-xs sm:text-sm">
        {t('musicfree.emptyPlugins')}
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {#each musicFreeStore.plugins as plugin (plugin.id)}
          <div class="p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-xs flex flex-col justify-between hover:border-purple-500/40 transition-all">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="font-bold text-xs sm:text-sm text-[var(--text-main)] truncate max-w-[130px]" title={getPluginDisplayName(plugin)}>
                    {getPluginDisplayName(plugin)}
                  </span>
                  {#if plugin.id.startsWith('builtin_')}
                    <span class="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 shrink-0 font-medium">{t('musicfree.builtinBadge')}</span>
                  {/if}
                </div>
                <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--btn-secondary-bg)] text-[var(--text-muted)] font-mono shrink-0">
                  v{plugin.version}
                </span>
              </div>
              <p class="text-[11px] text-[var(--text-secondary)] line-clamp-1">
                {t('musicfree.authorLabel', { author: getPluginDisplayAuthor(plugin) })}
              </p>
              {#if plugin.error}
                <p class="text-[10px] text-red-500 line-clamp-1" title={plugin.error}>
                  {t('musicfree.pluginError', { error: plugin.error })}
                </p>
              {/if}
            </div>

            <div class="mt-3 pt-2.5 border-t border-[var(--border-color)]/60 flex items-center justify-between">
              <label class="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={plugin.enabled}
                  onchange={() => musicFreeStore.togglePlugin(plugin.id)}
                  class="rounded text-purple-600 focus:ring-0 cursor-pointer"
                />
                <span class="text-xs {plugin.enabled ? 'text-emerald-500 font-medium' : 'text-[var(--text-muted)]'}">
                  {plugin.enabled ? t('musicfree.enabledStatus') : t('musicfree.disabledStatus')}
                </span>
              </label>

              <button
                type="button"
                onclick={() => musicFreeStore.removePlugin(plugin.id)}
                class="text-[11px] text-red-400 hover:text-red-300 p-1 cursor-pointer bg-transparent border-none"
                title={t('musicfree.deletePlugin')}
              >
                {t('musicfree.deletePlugin')}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>
