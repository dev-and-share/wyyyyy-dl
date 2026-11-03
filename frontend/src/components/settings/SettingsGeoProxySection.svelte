<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../lib/api';
  import { t } from '../../lib/i18n';

  let { showToast = () => {} } = $props<{
    showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error', dur?: number) => void;
  }>();

  const DEFAULT_SUB_URL = 'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&country=cn';
  const MONOSANS_SUB_URL = 'https://fastly.jsdelivr.net/gh/monosans/proxy-list@main/proxies/http.txt';

  let enabled = $state(false);
  let mode = $state<'pool' | 'custom'>('pool');
  let customProxyUrl = $state('');
  let subscriptionUrl = $state(DEFAULT_SUB_URL);
  let scope = $state('resolve_only');
  let poolSize = $state(0);
  let lastRefreshedAt = $state(0);

  let activeProxy = $state('');
  let activeLocation = $state('');
  let activeLatencyMs = $state<number | null>(null);
  let fallbackDirect = $state(false);

  let isSaving = $state(false);
  let isTesting = $state(false);
  let testResult = $state<any>(null);

  onMount(async () => {
    await loadConfig();
  });

  async function loadConfig() {
    try {
      const res = await api.getGeoProxyConfig();
      if (res?.code === '000000' && res.data) {
        enabled = Boolean(res.data.enabled);
        mode = res.data.mode === 'custom' ? 'custom' : 'pool';
        customProxyUrl = res.data.customProxyUrl || '';
        subscriptionUrl = res.data.subscriptionUrl || DEFAULT_SUB_URL;
        scope = res.data.scope || 'resolve_only';
        poolSize = res.data.poolSize || 0;
        lastRefreshedAt = res.data.lastRefreshedAt || 0;
        activeProxy = res.data.activeProxy || '';
        activeLocation = res.data.activeLocation || '';
        activeLatencyMs = res.data.activeLatencyMs ?? null;
        fallbackDirect = Boolean(res.data.fallbackDirect);
      }
    } catch (e: any) {
      console.warn('加载网络代理配置失败:', e);
    }
  }

  async function handleToggleEnabled() {
    enabled = !enabled;
    await saveConfig(true);
  }

  async function saveConfig(showFeedback = true) {
    isSaving = true;
    try {
      const payload = {
        enabled,
        mode,
        customProxyUrl: customProxyUrl.trim(),
        subscriptionUrl: subscriptionUrl.trim(),
        scope
      };
      const res = await api.updateGeoProxyConfig(payload);
      if (res?.code === '000000') {
        if (showFeedback) {
          showToast(enabled ? t('settings.geoProxy.enabledToast') : t('settings.geoProxy.disabledToast'), 'success');
        }
        if (res.data) {
          poolSize = res.data.poolSize || 0;
          lastRefreshedAt = res.data.lastRefreshedAt || 0;
          activeProxy = res.data.activeProxy || '';
          activeLocation = res.data.activeLocation || '';
          activeLatencyMs = res.data.activeLatencyMs ?? null;
          fallbackDirect = Boolean(res.data.fallbackDirect);
        }
      } else {
        showToast(res?.msg || t('settings.geoProxy.saveFailedToast'), 'error');
      }
    } catch (e: any) {
      showToast(t('settings.geoProxy.saveExceptionToast', { error: e.message || e }), 'error');
    } finally {
      isSaving = false;
    }
  }

  async function handleTest() {
    isTesting = true;
    testResult = null;
    try {
      const targetUrl = mode === 'custom' ? customProxyUrl.trim() : '';
      const res = await api.testGeoProxy(targetUrl);
      if (res?.code === '000000' && res.data) {
        testResult = res.data;
        if (testResult.success) {
          activeProxy = testResult.ip || testResult.proxy || '';
          activeLocation = testResult.location || '';
          activeLatencyMs = testResult.latencyMs ?? null;
          fallbackDirect = false;
          const winnerMsg = testResult.isFastestWinner
            ? t('settings.geoProxy.winnerMsgFastest', { latency: testResult.latencyMs })
            : t('settings.geoProxy.winnerMsgConnected', { latency: testResult.latencyMs });
          showToast(t('settings.geoProxy.winnerToast', { winnerMsg, location: testResult.location || '' }), 'success');
        } else {
          fallbackDirect = true;
          showToast(t('settings.geoProxy.testFailToast', { error: testResult.error || '无响应' }), 'warning');
        }
      } else {
        showToast(res?.msg || t('settings.geoProxy.testFailedToast'), 'error');
      }
    } catch (e: any) {
      showToast(t('settings.geoProxy.saveExceptionToast', { error: e.message || e }), 'error');
    } finally {
      isTesting = false;
    }
  }

  async function handleRefreshPool() {
    try {
      showToast(t('settings.geoProxy.refreshingPool'), 'info', 2000);
      const res = await api.refreshGeoProxyPool();
      if (res?.code === '000000') {
        showToast(t('settings.geoProxy.refreshPoolTriggered'), 'success');
        setTimeout(loadConfig, 1500);
      }
    } catch (e: any) {
      showToast(t('settings.geoProxy.refreshPoolFailed', { error: e.message || e }), 'error');
    }
  }
</script>

<section class="flex flex-col gap-2.5" data-testid="settings-geo-proxy-section">
  <!-- 标题栏：简洁中性，无敏感词与长说明 -->
  <div class="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
    <span>🌐</span>
    <span>{t('settings.geoProxy.sectionTitle')}</span>
  </div>

  <!-- 统一的单一卡片 Block -->
  <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-3">
    <!-- 顶部开关行 -->
    <div class="flex items-center justify-between gap-3 min-w-0">
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="font-semibold text-sm text-[var(--text-main)]">{t('settings.geoProxy.enableTitle')}</span>
        <span class="text-xs text-[var(--text-secondary)]">
          {t('settings.geoProxy.enableDesc')}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t('settings.geoProxy.enableAria')}
        data-testid="switch-geoproxy"
        class="relative shrink-0 w-12 h-6.5 rounded-full transition-colors duration-200 cursor-pointer border-none p-0.5 {enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}"
        onclick={handleToggleEnabled}
      >
        <span
          class="block w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform duration-200 {enabled ? 'translate-x-5.5' : 'translate-x-0'}"
        ></span>
      </button>
    </div>

    <!-- 详细配置面板：同一个卡片内向下展开 -->
    {#if enabled}
      <div class="border-t border-[var(--border-color)] pt-3 flex flex-col gap-3 transition-all text-xs">
        <!-- 常驻展示当前实际生效使用的代理出口 IP -->
        <div
          class="p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all {activeProxy && !fallbackDirect
            ? 'bg-emerald-500/10 border-emerald-500/25'
            : 'bg-amber-500/10 border-amber-500/25'}"
          data-testid="active-proxy-badge"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-2 h-2 shrink-0 rounded-full {activeProxy && !fallbackDirect ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}"></span>
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-[var(--text-muted)] text-[11px] shrink-0">{t('settings.geoProxy.outIpLabel')}</span>
              <strong class="font-mono text-xs text-[var(--text-main)] truncate">
                {activeProxy || t('settings.geoProxy.notLockedTitle')}
              </strong>
            </div>
            {#if activeLocation}
              <span class="text-[11px] text-[var(--text-secondary)] truncate max-w-[140px]">
                ({activeLocation})
              </span>
            {/if}
          </div>
          {#if activeLatencyMs}
            <span class="shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/20 text-emerald-300 border border-emerald-500/20">
              {activeLatencyMs} ms
            </span>
          {/if}
        </div>

        <!-- 模式选择 Tab -->
        <div class="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-color)]">
          <button
            type="button"
            class="py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none transition-all {mode === 'pool' ? 'bg-[var(--card-bg)] text-purple-400 font-bold shadow-xs' : 'bg-transparent text-[var(--text-secondary)]'}"
            onclick={() => { mode = 'pool'; saveConfig(false); }}
          >
            {t('settings.geoProxy.modePool')}
          </button>
          <button
            type="button"
            class="py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none transition-all {mode === 'custom' ? 'bg-[var(--card-bg)] text-purple-400 font-bold shadow-xs' : 'bg-transparent text-[var(--text-secondary)]'}"
            onclick={() => { mode = 'custom'; saveConfig(false); }}
          >
            {t('settings.geoProxy.modeCustom')}
          </button>
        </div>

        <!-- 模式 A: 聚合源配置 -->
        {#if mode === 'pool'}
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[var(--text-secondary)] font-medium text-[11px]">{t('settings.geoProxy.subUrlLabel')}</span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="text-[10px] text-purple-400 hover:underline cursor-pointer border-none bg-transparent p-0"
                  onclick={() => { subscriptionUrl = MONOSANS_SUB_URL; saveConfig(false); }}
                >
                  {t('settings.geoProxy.sourceMonosans')}
                </button>
                <span class="opacity-30">|</span>
                <button
                  type="button"
                  class="text-[10px] text-purple-400 hover:underline cursor-pointer border-none bg-transparent p-0"
                  onclick={() => { subscriptionUrl = DEFAULT_SUB_URL; saveConfig(false); }}
                >
                  {t('settings.geoProxy.sourceDefault')}
                </button>
              </div>
            </div>
            <input
              type="text"
              bind:value={subscriptionUrl}
              placeholder="http://.../.txt"
              class="px-2.5 py-1.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-main)] outline-none focus:border-purple-500 font-mono text-xs"
              onblur={() => saveConfig(false)}
            />
            <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>{t('settings.geoProxy.poolSizeText')}<strong class="text-purple-400">{poolSize}</strong> {t('settings.geoProxy.nodesCount')}</span>
              <button
                type="button"
                class="text-[11px] text-purple-400 hover:underline cursor-pointer border-none bg-transparent p-0"
                onclick={handleRefreshPool}
              >
                {t('settings.geoProxy.refreshBtn')}
              </button>
            </div>
          </div>
        {:else}
          <!-- 模式 B: 自定义单一代理 -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[var(--text-secondary)] font-medium text-[11px]">{t('settings.geoProxy.customProxyLabel')}</span>
            <input
              type="text"
              bind:value={customProxyUrl}
              placeholder="http://1.2.3.4:8080 或 socks5://user:pass@host:port"
              class="px-2.5 py-1.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-main)] outline-none focus:border-purple-500 font-mono text-xs"
              onblur={() => saveConfig(false)}
            />
            <span class="text-[10px] text-[var(--text-muted)]">
              {t('settings.geoProxy.customProxyDesc')}
            </span>
          </div>
        {/if}

        <!-- 测试结果反馈卡片 -->
        {#if testResult}
          <div class="p-2.5 rounded-xl border {testResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'} flex flex-col gap-1">
            <div class="flex items-center justify-between font-semibold">
              <div class="flex items-center gap-1.5">
                <span>{testResult.success ? t('settings.geoProxy.testSuccess') : t('settings.geoProxy.testFail')}</span>
                {#if testResult.isFastestWinner}
                  <span class="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    {t('settings.geoProxy.fastestWinnerBadge')}
                  </span>
                {/if}
              </div>
              {#if testResult.latencyMs}
                <span class="text-[10px] font-mono">{testResult.latencyMs} ms</span>
              {/if}
            </div>
            {#if testResult.success}
              <div class="text-[11px] opacity-90 flex items-center justify-between">
                <span>{t('settings.geoProxy.outIpLabel')} <strong class="font-mono">{testResult.ip || testResult.proxy}</strong></span>
                {#if testResult.location}
                  <span class="text-emerald-300">({testResult.location})</span>
                {/if}
              </div>
            {:else}
              <div class="text-[11px] opacity-80 truncate">{testResult.error}</div>
            {/if}
          </div>
        {/if}

        <!-- 底部操作按钮 -->
        <div class="flex items-center gap-2 pt-1 border-t border-[var(--border-color)]">
          <button
            type="button"
            disabled={isTesting}
            class="flex-1 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
            onclick={handleTest}
          >
            {#if isTesting}
              <div class="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
              <span>{t('settings.geoProxy.testing')}</span>
            {:else}
              <span>{t('settings.geoProxy.testBtn')}</span>
            {/if}
          </button>
          <button
            type="button"
            disabled={isSaving}
            class="px-4 py-1.5 rounded-xl text-xs font-medium cursor-pointer border-none transition-all bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)]"
            onclick={() => saveConfig(true)}
          >
            {isSaving ? t('settings.geoProxy.savingBtn') : t('settings.geoProxy.saveBtn')}
          </button>
        </div>
      </div>
    {/if}
  </div>
</section>
