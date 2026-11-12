<script lang="ts">
  import Modal from './Modal.svelte';
  import { t } from '../lib/i18n';
  import { formatBytes } from '../lib/utils';
  import { getTrackBrowserCacheInfo, removeTrackBrowserCache } from '../lib/library/browserCacheHelper';

  let {
    path = '',
    msg = '',
    songId = null,
    songName = '',
    isServer = undefined,
    isPhone = undefined,
    onClose,
    showToast
  } = $props<{
    path?: string;
    msg?: string;
    songId?: string | number | null;
    songName?: string;
    isServer?: boolean;
    isPhone?: boolean;
    onClose: () => void;
    showToast: (m: string, t?: string) => void;
  }>();

  // 浏览器离线缓存状态
  let cacheInfo = $state<{ isCached: boolean; size: number }>({ isCached: false, size: 0 });
  let isClearing = $state(false);

  $effect(() => {
    if (songId) {
      getTrackBrowserCacheInfo(songId).then((info) => {
        cacheInfo = info;
      }).catch(() => {});
    }
  });

  // Generate direct open command according to OS
  function getSystemOpenCommand(filePath: string) {
    if (!filePath) return { os: 'macOS', cmd: '', tip: '' };
    const userAgent = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
    const platform = (typeof navigator !== 'undefined' ? navigator.platform : '').toLowerCase();

    const isMac = platform.includes('mac') || userAgent.includes('macintosh') || userAgent.includes('mac os');
    const isWin = platform.includes('win') || userAgent.includes('windows');

    if (isMac) {
      return {
        os: 'macOS',
        cmd: `open -R "${filePath}"`,
        tip: t('reveal.tipMac')
      };
    } else if (isWin) {
      const winPath = filePath.replace(/\//g, '\\');
      return {
        os: 'Windows',
        cmd: `explorer.exe /select,"${winPath}"`,
        tip: t('reveal.tipWin')
      };
    } else {
      return {
        os: 'Linux',
        cmd: `xdg-open "${filePath}"`,
        tip: t('reveal.tipLinux')
      };
    }
  }

  let sysCmdInfo = $derived(getSystemOpenCommand(path));
  let isSuccess = $derived(msg && (msg.includes('成功') || msg.toLowerCase().includes('success'))); // i18n-ignore: status check

  function copyText(text: string, successMsg: string) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          showToast(successMsg, 'success');
          onClose();
        })
        .catch(() => showToast(t('reveal.copyFailedManual'), 'warning'));
    } else {
      showToast(t('reveal.copyFailedManual'), 'warning');
    }
  }

  async function handleClearBrowserCache() {
    if (!songId || isClearing) return;
    isClearing = true;
    try {
      await removeTrackBrowserCache(songId);
      showToast(t('reveal.cacheCleared'), 'success');
      cacheInfo = { isCached: false, size: 0 };
      if (!path) {
        setTimeout(() => {
          onClose();
        }, 900);
      }
    } catch (e: any) {
      showToast(e?.message || '清除缓存失败', 'error');
    } finally {
      isClearing = false;
    }
  }
</script>

<Modal title={t('reveal.modalTitle')} icon={path ? (isSuccess ? '🚀' : '📂') : '📲'} maxWidth="max-w-[540px]" {onClose}>
  {#if msg}
    <div class="mb-3 font-semibold text-xs {path ? (isSuccess ? 'text-emerald-400' : 'text-sky-400') : 'text-purple-400 dark:text-purple-300'}">
      {msg}
    </div>
  {/if}

  <!-- 🖥️ 服务器物理路径卡片 (仅当 path 存在时展示) -->
  {#if path}
    <div class="flex justify-between items-center text-xs text-[var(--text-secondary)] mb-1.5 select-none">
      <span>{t('reveal.filePathCard')}</span>
      <span class="text-[11px] text-sky-400 opacity-90">{t('reveal.clickCardToCopy')}</span>
    </div>
    <div 
      class="group relative cursor-pointer border border-sky-400/25 bg-sky-400/5 hover:bg-sky-400/10 hover:border-sky-400 rounded-xl px-3.5 py-2.5 pr-12 transition-all hover:-translate-y-px duration-150 flex items-center break-all select-text" 
      onclick={() => path && copyText(path, t('reveal.pathCopied'))}
      title={t('reveal.clickToCopyPathTooltip')}
      role="button"
      tabindex="0"
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && path && copyText(path, t('reveal.pathCopied'))}
    >
      <span class="text-xs text-sky-500 dark:text-sky-300 flex-1">{path || t('reveal.unknownPath')}</span>
      <span class="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 group-hover:bg-sky-500 group-hover:text-white border border-white/20 group-hover:border-sky-500 rounded px-1.5 py-0.5 text-[11px] text-[var(--text-main)] pointer-events-none transition-all">{t('reveal.copyBtn')}</span>
    </div>
  {/if}

  <!-- 💻 Terminal Command Clickable Card (仅当 path 存在时展示) -->
  {#if sysCmdInfo.cmd}
    <div class="flex justify-between items-center text-xs text-[var(--text-secondary)] mt-3.5 mb-1.5 select-none">
      <span>{t('reveal.terminalCmdCard', { os: sysCmdInfo.os })}</span>
      <span class="text-[11px] text-purple-400 opacity-90">{t('reveal.clickCardToCopyFast')}</span>
    </div>
    <div 
      class="group relative cursor-pointer border border-purple-500/25 bg-black/20 dark:bg-black/40 hover:bg-purple-500/10 hover:border-purple-500 rounded-xl px-3.5 py-2.5 pr-12 transition-all hover:-translate-y-px duration-150 flex items-center break-all select-text" 
      onclick={() => copyText(sysCmdInfo.cmd, t('reveal.cmdCopied', { os: sysCmdInfo.os }))}
      title={t('reveal.clickToCopyCmdTooltip')}
      role="button"
      tabindex="0"
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && copyText(sysCmdInfo.cmd, t('reveal.cmdCopied', { os: sysCmdInfo.os }))}
    >
      <span class="text-xs font-mono text-emerald-500 dark:text-emerald-300 flex-1">{sysCmdInfo.cmd}</span>
      <span class="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 group-hover:bg-purple-500 group-hover:text-white border border-white/20 group-hover:border-purple-500 rounded px-1.5 py-0.5 text-[11px] text-[var(--text-main)] pointer-events-none transition-all">{t('reveal.copyCmdBtn')}</span>
    </div>
  {/if}

  <!-- 📲 浏览器离线缓存卡片 (当存在浏览器缓存时展示，提供精准清除此歌缓存功能) -->
  {#if cacheInfo.isCached}
    <div class="mt-3.5 border border-purple-500/30 bg-purple-500/10 dark:bg-purple-950/30 rounded-xl p-3 flex items-center justify-between gap-3 select-none">
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="text-xl leading-none">📲</span>
        <div class="min-w-0">
          <div class="text-xs font-semibold text-purple-600 dark:text-purple-300">
            {t('reveal.browserCacheCard')}
          </div>
          <div class="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">
            {t('reveal.browserCacheSize', { size: cacheInfo.size > 0 ? formatBytes(cacheInfo.size) : t('playlist.offlineCachedBadge') })}
          </div>
        </div>
      </div>
      <button
        type="button"
        disabled={isClearing}
        class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
        onclick={handleClearBrowserCache}
        title={t('reveal.clearCacheBtn')}
      >
        <span>🗑️</span>
        <span>{isClearing ? t('common.loading') : t('reveal.clearCacheBtn')}</span>
      </button>
    </div>
  {/if}

  {#if path}
    <div class="mt-3.5 text-xs text-[var(--text-secondary)] leading-relaxed bg-black/5 dark:bg-white/[0.04] p-2.5 rounded-xl border border-black/5 dark:border-white/5">
      {t('reveal.tipNotice')}
    </div>
  {/if}

  {#snippet footer()}
    <button
      type="button"
      class="w-full btn-primary text-xs py-2 font-semibold"
      onclick={onClose}
    >
      {t('reveal.iKnow')}
    </button>
  {/snippet}
</Modal>
