<script lang="ts">
  import Modal from './Modal.svelte';
  import { t } from '../lib/i18n';

  let {
    path,
    msg = '',
    onClose,
    showToast
  } = $props<{
    path: string;
    msg?: string;
    onClose: () => void;
    showToast: (m: string, t?: string) => void;
  }>();

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
</script>

<Modal title={t('reveal.modalTitle')} icon={isSuccess ? '🚀' : '📂'} maxWidth="max-w-[540px]" {onClose}>
  {#if msg}
    <div class="mb-3 font-semibold text-xs {isSuccess ? 'text-emerald-400' : 'text-sky-400'}">
      {msg}
    </div>
  {/if}

  <!-- Physical Path Clickable Card -->
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

  <!-- Terminal Command Clickable Card -->
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

  <div class="mt-3.5 text-xs text-[var(--text-secondary)] leading-relaxed bg-black/5 dark:bg-white/[0.04] p-2.5 rounded-xl border border-black/5 dark:border-white/5">
    {t('reveal.tipNotice')}
  </div>

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
