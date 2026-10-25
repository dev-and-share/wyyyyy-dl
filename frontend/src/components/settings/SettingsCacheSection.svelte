<script lang="ts">
  import { onMount } from 'svelte';
  import { platform } from '../../lib/platform';
  import { formatBytes } from '../../lib/utils';
  import { autoCacheState, setAutoCacheEnabled } from '../../lib/pwaCache.svelte';
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
      // 忽略扫描异常
    } finally {
      isCacheLoading = false;
    }
  }

  async function handleClearLowPlayCount() {
    if (!platform.supportsCache || cacheCount === 0) return;
    const ok = confirm(`确定清除播放次数少于 ${minPlayThreshold} 次的离线歌曲？\n（服务器文件不受影响）`);
    if (!ok) return;
    isCacheLoading = true;
    try {
      const res = await scanBrowserCache();
      const lowItems = res.list.filter(item => item.playCount < minPlayThreshold);
      const removedCount = await clearLowPlayCountCacheEntries(lowItems);
      await refreshCache();
      showToast(`已清理 ${removedCount || lowItems.length} 首低频离线歌曲`, 'success');
    } catch (e: any) {
      showToast('清理离线缓存失败: ' + (e?.message || e), 'error');
    } finally {
      isCacheLoading = false;
    }
  }

  async function handleClearImageCache() {
    if (!platform.supportsCache || imageCacheCount === 0) return;
    const ok = confirm('确定清空所有已缓存的专辑/歌单封面图片？\n（下次浏览时将重新联网下载）');
    if (!ok) return;
    isCacheLoading = true;
    try {
      await clearAllImageCache();
      await refreshCache();
      showToast('已清空封面图片离线缓存', 'success');
    } catch (e: any) {
      showToast('清空图片缓存失败: ' + (e?.message || e), 'error');
    } finally {
      isCacheLoading = false;
    }
  }

  async function handleClearAllCache() {
    if (!platform.supportsCache || (cacheCount === 0 && imageCacheCount === 0)) return;
    const ok = confirm('确定清空手机浏览器中保存的所有离线音乐及封面缓存？');
    if (!ok) return;
    isCacheLoading = true;
    try {
      await Promise.all([
        clearAllBrowserAudioCache(),
        clearAllImageCache()
      ]);
      await refreshCache();
      showToast('已清空全部离线音乐与图片缓存', 'success');
    } catch (e: any) {
      showToast('清空缓存失败: ' + (e?.message || e), 'error');
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
      <span>手机离线缓存</span>
    </div>
    {#if platform.supportsCache}
      <button
        type="button"
        class="text-[11px] text-red-500 hover:underline cursor-pointer bg-transparent border-none p-0 flex items-center gap-0.5"
        onclick={refreshCache}
      >
        {isCacheLoading ? '扫描中...' : '🔄 刷新'}
      </button>
    {/if}
  </div>

  {#if platform.supportsCache}
    <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-0.5">
          <span class="font-semibold text-sm text-[var(--text-main)]">自动离线缓存 (PWA)</span>
          <span class="text-xs text-[var(--text-secondary)]">播放歌曲时在后台自动写入手机离线空间</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoCacheState.enabled}
          aria-label="自动离线缓存开关"
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
          <span>离线音乐音频：</span>
          <span class="font-mono font-bold text-[var(--text-main)]">
            {formatBytes(cacheBytes)} ({cacheCount} 首)
          </span>
        </div>
        <div class="flex items-center justify-between">
          <span>封面图片缓存 (SW)：</span>
          <span class="font-mono font-bold text-[var(--text-main)]">
            {imageCacheBytes > 0 ? formatBytes(imageCacheBytes) : ''} ({imageCacheCount} 张)
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
              清理 &lt;{minPlayThreshold} 次音频
            </button>
          {/if}
          {#if imageCacheCount > 0}
            <button
              type="button"
              class="py-1.5 px-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs text-[var(--text-main)] font-medium border border-[var(--border-color)] cursor-pointer transition-all shrink-0"
              onclick={handleClearImageCache}
            >
              清理封面图
            </button>
          {/if}
          <button
            type="button"
            class="py-1.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs text-red-500 font-medium border border-red-500/20 cursor-pointer transition-all shrink-0"
            onclick={handleClearAllCache}
          >
            清空离线
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
      当前浏览器环境不支持 CacheStorage 离线存储（无痕模式或不支持的环境）。
    </div>
  {/if}
</section>
