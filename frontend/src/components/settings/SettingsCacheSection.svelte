<script lang="ts">
  import { onMount } from 'svelte';
  import { platform } from '../../lib/platform';
  import { formatBytes } from '../../lib/utils';
  import { autoCacheState, setAutoCacheEnabled } from '../../lib/pwaCache.svelte';
  import { t } from '../../lib/i18n';
  import {
    scanBrowserCache,
    scanImageCache,
    clearLowPlayCountCacheEntries,
    clearAllBrowserAudioCache,
    clearAllImageCache
  } from '../../lib/browserCacheHelper';

  let { showToast = () => {} } = $props<{
    showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error', dur?: number) => void;
  }>();

  let cacheBytes = $state(0);
  let cacheCount = $state(0);
  let imageCacheCount = $state(0);
  let imageCacheBytes = $state(0);
  let isCacheLoading = $state(false);
  let minPlayThreshold = $state(2);

  const wakeUrl = typeof window !== 'undefined'
    ? `webapp://${window.location.host}${window.location.pathname.replace(/\/$/, '')}`
    : 'webapp://music.yourdomain.com';

  async function handleCopyWakeUrl() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(wakeUrl);
      } else {
        const input = document.createElement('input');
        input.value = wakeUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      showToast(t('settings.iosShortcutCopied', { url: wakeUrl }), 'success');
    } catch {
      showToast(wakeUrl, 'info');
    }
  }

  export async function refreshCache() {
    if (!platform.supportsCache) return;
    isCacheLoading = true;
    try {
      const [audioRes, imgRes] = await Promise.all([
        scanBrowserCache(),
        scanImageCache()
      ]);
      cacheBytes = audioRes.totalBytes;
      cacheCount = audioRes.list.length;
      imageCacheCount = imgRes.count;
      imageCacheBytes = imgRes.totalBytes;
    } catch {
      // Ignore scan exceptions
    } finally {
      isCacheLoading = false;
    }
  }

  async function handleClearLowPlayCount() {
    if (!platform.supportsCache || cacheCount === 0) return;
    const ok = confirm(t('settings.confirmCleanLowTracks', { threshold: minPlayThreshold }));
    if (!ok) return;
    isCacheLoading = true;
    try {
      const res = await scanBrowserCache();
      const lowItems = res.list.filter(item => item.playCount < minPlayThreshold);
      const removedCount = await clearLowPlayCountCacheEntries(lowItems);
      await refreshCache();
      showToast(t('settings.cleanedLowTracks', { count: removedCount || lowItems.length }), 'success');
    } catch (e: any) {
      showToast(t('settings.cleanLowCacheFailed', { error: e?.message || e }), 'error');
    } finally {
      isCacheLoading = false;
    }
  }

  async function handleClearImageCache() {
    if (!platform.supportsCache || imageCacheCount === 0) return;
    const ok = confirm(t('settings.confirmClearCovers'));
    if (!ok) return;
    isCacheLoading = true;
    try {
      await clearAllImageCache();
      await refreshCache();
      showToast(t('settings.clearedCoversSuccess'), 'success');
    } catch (e: any) {
      showToast(t('settings.clearCoversFailed', { error: e?.message || e }), 'error');
    } finally {
      isCacheLoading = false;
    }
  }

  async function handleClearAllCache() {
    if (!platform.supportsCache || (cacheCount === 0 && imageCacheCount === 0)) return;
    const ok = confirm(t('settings.confirmClearAllMusicAndCovers'));
    if (!ok) return;
    isCacheLoading = true;
    try {
      await Promise.all([
        clearAllBrowserAudioCache(),
        clearAllImageCache()
      ]);
      await refreshCache();
      showToast(t('settings.clearedAllMusicAndCoversSuccess'), 'success');
    } catch (e: any) {
      showToast(t('cache.clearFailed', { error: e?.message || e }), 'error');
    } finally {
      isCacheLoading = false;
    }
  }

  onMount(() => {
    refreshCache();
  });
</script>

<section class="flex flex-col gap-2.5">
  <div class="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
    <div class="flex items-center gap-1.5">
      <span>📲</span>
      <span>{t('settings.mobileOfflineCacheTitle')}</span>
    </div>
    {#if platform.supportsCache}
      <button
        type="button"
        class="text-[11px] text-red-500 hover:underline cursor-pointer bg-transparent border-none p-0 flex items-center gap-0.5"
        onclick={refreshCache}
      >
        {isCacheLoading ? t('settings.checkingStatus') : '🔄 ' + t('common.refresh')}
      </button>
    {/if}
  </div>

  {#if platform.supportsCache}
    <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-0.5">
          <span class="font-semibold text-sm text-[var(--text-main)]">{t('settings.autoOfflineCachePwa')}</span>
          <span class="text-xs text-[var(--text-secondary)]">{t('settings.autoOfflineCachePwaDesc')}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoCacheState.enabled}
          aria-label={t('settings.autoCacheAria')}
          class="relative shrink-0 w-12 h-6.5 rounded-full transition-colors duration-200 cursor-pointer border-none p-0.5 {autoCacheState.enabled ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-700'}"
          onclick={() => setAutoCacheEnabled(!autoCacheState.enabled)}
        >
          <span
            class="block w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform duration-200 {autoCacheState.enabled ? 'translate-x-5.5' : 'translate-x-0'}"
          ></span>
        </button>
      </div>

      <div class="pt-2 border-t border-[var(--border-color)] flex flex-col gap-1.5 text-xs text-[var(--text-secondary)]">
        <div class="flex items-center justify-between">
          <span>{t('settings.offlineAudioLabel')}</span>
          <span class="font-mono font-bold text-[var(--text-main)]">
            {formatBytes(cacheBytes)} ({t('playlist.trackCount', { count: cacheCount })})
          </span>
        </div>
        <div class="flex items-center justify-between">
          <span>{t('settings.coverCacheLabel')}</span>
          <span class="font-mono font-bold text-[var(--text-main)]">
            {imageCacheBytes > 0 ? formatBytes(imageCacheBytes) : ''} ({imageCacheCount})
          </span>
        </div>
      </div>

      {#if cacheCount > 0 || imageCacheCount > 0}
        <div class="pt-2 border-t border-[var(--border-color)] flex flex-wrap items-center gap-2">
          {#if cacheCount > 0}
            <button
              type="button"
              class="flex-1 py-1.5 px-2 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs text-[var(--text-main)] font-medium border border-[var(--border-color)] cursor-pointer transition-all"
              onclick={handleClearLowPlayCount}
            >
              {t('settings.cleanLowAudioBtn', { threshold: minPlayThreshold })}
            </button>
          {/if}
          {#if imageCacheCount > 0}
            <button
              type="button"
              class="py-1.5 px-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs text-[var(--text-main)] font-medium border border-[var(--border-color)] cursor-pointer transition-all shrink-0"
              onclick={handleClearImageCache}
            >
              {t('settings.cleanCoversBtn')}
            </button>
          {/if}
          <button
            type="button"
            class="py-1.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs text-red-500 font-medium border border-red-500/20 cursor-pointer transition-all shrink-0"
            onclick={handleClearAllCache}
          >
            {t('settings.clearAllOfflineBtn')}
          </button>
        </div>
      {/if}
    </div>

    <!-- 📱 iOS 快捷指令独立唤醒小技巧 -->
    <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 font-semibold text-xs text-[var(--text-main)]">
          <span>⚡</span>
          <span>{t('settings.iosShortcutTitle')}</span>
        </div>
        <a
          href="https://github.com/dev-and-share/wyyyyy-dl/blob/main/docs/ios-shortcuts-pwa.md"
          target="_blank"
          rel="noopener noreferrer"
          class="text-[11px] text-red-500 hover:underline flex items-center gap-0.5"
        >
          {t('settings.iosShortcutDoc')} ↗
        </a>
      </div>
      <p class="text-xs text-[var(--text-secondary)] m-0 leading-relaxed">
        {t('settings.iosShortcutDesc')}
      </p>
      <div class="flex items-center gap-2 pt-1">
        <code class="flex-1 px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-color)] font-mono text-[11px] text-[var(--text-main)] truncate select-all">
          {wakeUrl}
        </code>
        <button
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs text-[var(--text-main)] font-medium border border-[var(--border-color)] cursor-pointer transition-all active:scale-95"
          onclick={handleCopyWakeUrl}
        >
          {t('settings.iosShortcutCopy')}
        </button>
      </div>
    </div>
  {:else}
    <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
      {t('settings.cacheStorageUnsupported')}
    </div>
  {/if}
</section>
