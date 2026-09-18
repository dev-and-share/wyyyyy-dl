<script lang="ts">
  import { onMount } from 'svelte';
  import { platform } from '../lib/platform';
  import { api } from '../lib/api';
  import { formatBytes } from '../lib/utils';
  import { autoCacheState, setAutoCacheEnabled } from '../lib/pwaCache.svelte';
  import {
    scanBrowserCache,
    clearLowPlayCountCacheEntries,
    clearAllBrowserAudioCache
  } from '../lib/browserCacheHelper';
  import type { ThemeMode } from '../lib/theme';

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

  // 账号与授权状态
  let isCheckingLogin = $state(false);
  let isLoggedIn = $state<boolean | null>(null);
  let showCookieInput = $state(false);
  let cookieText = $state('');
  let isSavingCookie = $state(false);

  // 离线缓存状态
  let cacheBytes = $state(0);
  let cacheCount = $state(0);
  let isCacheLoading = $state(false);
  let minPlayThreshold = $state(2);

  // 磁盘维护加载状态
  let maintenanceLoading = $state(false);
  let maintenanceMsg = $state('');

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

  // 扫描手机缓存
  async function refreshCache() {
    if (!platform.supportsCache) return;
    isCacheLoading = true;
    try {
      const res = await scanBrowserCache();
      cacheBytes = res.totalBytes;
      cacheCount = res.list.length;
    } catch {
      // 忽略离线扫描错误
    } finally {
      isCacheLoading = false;
    }
  }

  // 清理低频缓存
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

  // 清空全部离线缓存
  async function handleClearAllCache() {
    if (!platform.supportsCache || cacheCount === 0) return;
    const ok = confirm('确定清空手机浏览器中保存的所有离线音乐？');
    if (!ok) return;
    isCacheLoading = true;
    try {
      await clearAllBrowserAudioCache();
      await refreshCache();
      showToast('已清空全部离线音乐缓存', 'success');
    } catch (e: any) {
      showToast('清空缓存失败: ' + (e?.message || e), 'error');
    } finally {
      isCacheLoading = false;
    }
  }

  // 磁盘维护通用包装
  async function runMaintenance(actionName: string, fn: () => Promise<any>) {
    maintenanceLoading = true;
    maintenanceMsg = `正在执行${actionName}...`;
    try {
      const res = await fn();
      if (res?.code === '000000') {
        showToast(`${actionName}成功！`, 'success');
      } else {
        showToast(res?.msg || `${actionName}完成`, 'info');
      }
    } catch (e: any) {
      showToast(`${actionName}失败: ` + (e?.message || e), 'error');
    } finally {
      maintenanceLoading = false;
      maintenanceMsg = '';
    }
  }

  // 检查账号状态
  async function checkLogin() {
    isCheckingLogin = true;
    try {
      const res = await api.loginStatus();
      isLoggedIn = res?.code === '000000' && res?.data === true;
    } catch {
      isLoggedIn = false;
    } finally {
      isCheckingLogin = false;
    }
  }

  // 保存 Cookie
  async function saveCookie() {
    if (!cookieText.trim()) {
      showToast('请输入有效 Cookie 内容', 'warning');
      return;
    }
    isSavingCookie = true;
    try {
      const res = await api.setCookie(cookieText.trim());
      if (res?.code === '000000') {
        showToast('Cookie 保存成功！', 'success');
        cookieText = '';
        showCookieInput = false;
        checkLogin();
      } else {
        showToast(res?.msg || '保存 Cookie 失败', 'warning');
      }
    } catch (e: any) {
      showToast('保存异常: ' + (e?.message || e), 'error');
    } finally {
      isSavingCookie = false;
    }
  }

  onMount(() => {
    refreshCache();
    checkLogin();
  });
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

    <!-- 板块 4: 离线与缓存管理 -->
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

          <div class="pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>当前已用离线空间：</span>
            <span class="font-mono font-bold text-[var(--text-main)]">
              {formatBytes(cacheBytes)} ({cacheCount} 首)
            </span>
          </div>

          {#if cacheCount > 0}
            <div class="pt-2 border-t border-[var(--border-color)] flex items-center gap-2">
              <button
                type="button"
                class="flex-1 py-1.5 px-2 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs text-[var(--text-main)] font-medium border border-[var(--border-color)] cursor-pointer transition-all"
                onclick={handleClearLowPlayCount}
              >
                清理少于 {minPlayThreshold} 次播放
              </button>
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

    <!-- 板块 5: 网易云账号与授权 -->
    <section class="flex flex-col gap-2.5">
      <div class="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
        <div class="flex items-center gap-1.5">
          <span>👤</span>
          <span>网易云账号与 Cookie</span>
        </div>
        <button
          type="button"
          class="text-[11px] text-red-500 hover:underline cursor-pointer bg-transparent border-none p-0"
          onclick={checkLogin}
        >
          {isCheckingLogin ? '检测中...' : '检测状态'}
        </button>
      </div>

      <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">授权状态：</span>
          {#if isCheckingLogin}
            <span class="text-xs text-[var(--text-muted)]">检测中...</span>
          {:else if isLoggedIn}
            <span class="text-xs font-semibold text-emerald-500 flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span> 已配置账号 / VIP 活跃
            </span>
          {:else}
            <span class="text-xs font-semibold text-amber-500 flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span> 游客模式 / Cookie 未登录
            </span>
          {/if}
        </div>

        <div class="pt-2 border-t border-[var(--border-color)] flex items-center gap-2">
          <button
            type="button"
            class="flex-1 py-1.5 px-3 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs font-medium text-[var(--text-main)] border border-[var(--border-color)] cursor-pointer transition-all"
            onclick={() => showCookieInput = !showCookieInput}
          >
            {showCookieInput ? '收起 Cookie 录入' : '配置 Cookie'}
          </button>
          <a
            href="/login"
            target="_blank"
            rel="noreferrer"
            class="py-1.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-500 border border-red-500/20 cursor-pointer transition-all text-center no-underline shrink-0"
          >
            扫码登录
          </a>
        </div>

        {#if showCookieInput}
          <div class="pt-2 flex flex-col gap-2">
            <textarea
              bind:value={cookieText}
              rows="3"
              placeholder="在此粘贴 MUSIC_U 或完整 Cookie 字符串..."
              class="w-full p-2 text-xs rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-main)] outline-none focus:border-red-500 resize-none font-mono"
            ></textarea>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="px-3 py-1 text-xs rounded-lg border border-[var(--border-color)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer"
                onclick={() => { showCookieInput = false; cookieText = ''; }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={isSavingCookie}
                class="px-3 py-1 text-xs rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold cursor-pointer border-none disabled:opacity-50"
                onclick={saveCookie}
              >
                {isSavingCookie ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </section>

    <!-- 板块 6: 本地曲库与磁盘维护 -->
    <section class="flex flex-col gap-2.5">
      <div class="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
        <span>💽</span>
        <span>本地曲库与磁盘维护</span>
      </div>
      <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-2">
        <span class="text-xs text-[var(--text-secondary)] leading-relaxed">
          服务器端物理音频文件同步与 SQLite 数据库维护：
        </span>
        {#if maintenanceMsg}
          <div class="text-xs text-amber-500 font-medium py-1">{maintenanceMsg}</div>
        {/if}
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            disabled={maintenanceLoading}
            class="py-2 px-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs font-medium text-[var(--text-main)] border border-[var(--border-color)] cursor-pointer transition-all disabled:opacity-50"
            onclick={() => runMaintenance('磁盘对齐扫描', api.historyScan)}
          >
            🔍 对齐磁盘扫描
          </button>
          <button
            type="button"
            disabled={maintenanceLoading}
            class="py-2 px-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs font-medium text-[var(--text-main)] border border-[var(--border-color)] cursor-pointer transition-all disabled:opacity-50"
            onclick={() => runMaintenance('外部曲库扫描', api.historyScanExternal)}
          >
            📁 扫描外部曲库
          </button>
          <button
            type="button"
            disabled={maintenanceLoading}
            class="py-2 px-2.5 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs font-medium text-[var(--text-main)] border border-[var(--border-color)] cursor-pointer transition-all disabled:opacity-50"
            onclick={() => runMaintenance('导入未录入物理音频', api.historyImportUntracked)}
          >
            📥 导入物理音频
          </button>
          <button
            type="button"
            disabled={maintenanceLoading}
            class="py-2 px-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-500 border border-red-500/20 cursor-pointer transition-all disabled:opacity-50"
            onclick={() => runMaintenance('清理失效记录', api.historyCleanMissing)}
          >
            🧹 清理失效记录
          </button>
        </div>
      </div>
    </section>
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
