<script lang="ts">
  import Modal from './Modal.svelte';

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

  // 根据当前操作系统生成直达命令
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
        tip: '在 macOS 终端中执行此命令可在 Finder 中直接高亮定位文件'
      };
    } else if (isWin) {
      const winPath = filePath.replace(/\//g, '\\');
      return {
        os: 'Windows',
        cmd: `explorer.exe /select,"${winPath}"`,
        tip: '在 CMD / PowerShell 中执行此命令可在资源管理器中高亮定位文件'
      };
    } else {
      return {
        os: 'Linux',
        cmd: `xdg-open "${filePath}"`,
        tip: '在终端中执行此命令可直接打开文件所在文件夹'
      };
    }
  }

  let sysCmdInfo = $derived(getSystemOpenCommand(path));
  let isSuccess = $derived(msg && msg.includes('成功'));

  function copyText(text: string, successMsg: string) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          showToast(successMsg, 'success');
          onClose();
        })
        .catch(() => showToast('复制失败，请手动选择复制', 'warning'));
    } else {
      showToast('复制失败，请手动选择复制', 'warning');
    }
  }
</script>

<Modal title="文件物理定位" icon={isSuccess ? '🚀' : '📂'} maxWidth="max-w-[540px]" {onClose}>
  {#if msg}
    <div class="mb-3 font-semibold text-xs {isSuccess ? 'text-emerald-400' : 'text-sky-400'}">
      {msg}
    </div>
  {/if}

  <!-- 物理路径可点击复制卡片 -->
  <div class="flex justify-between items-center text-xs text-[var(--text-secondary)] mb-1.5 select-none">
    <span>📁 文件物理路径</span>
    <span class="text-[11px] text-sky-400 opacity-90">📋 点击卡片直接复制</span>
  </div>
  <div 
    class="group relative cursor-pointer border border-sky-400/25 bg-sky-400/5 hover:bg-sky-400/10 hover:border-sky-400 rounded-xl px-3.5 py-2.5 pr-12 transition-all hover:-translate-y-px duration-150 flex items-center break-all select-text" 
    onclick={() => path && copyText(path, '📋 物理路径已复制！')}
    title="点击复制文件物理路径"
    role="button"
    tabindex="0"
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && path && copyText(path, '📋 物理路径已复制！')}
  >
    <span class="text-xs text-sky-500 dark:text-sky-300 flex-1">{path || '未知路径'}</span>
    <span class="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 group-hover:bg-sky-500 group-hover:text-white border border-white/20 group-hover:border-sky-500 rounded px-1.5 py-0.5 text-[11px] text-[var(--text-main)] pointer-events-none transition-all">📋 复制</span>
  </div>

  <!-- 终端命令可点击复制卡片 -->
  {#if sysCmdInfo.cmd}
    <div class="flex justify-between items-center text-xs text-[var(--text-secondary)] mt-3.5 mb-1.5 select-none">
      <span>💻 终端直达命令 ({sysCmdInfo.os})</span>
      <span class="text-[11px] text-purple-400 opacity-90">⚡ 点击卡片直接复制</span>
    </div>
    <div 
      class="group relative cursor-pointer border border-purple-500/25 bg-black/20 dark:bg-black/40 hover:bg-purple-500/10 hover:border-purple-500 rounded-xl px-3.5 py-2.5 pr-12 transition-all hover:-translate-y-px duration-150 flex items-center break-all select-text" 
      onclick={() => copyText(sysCmdInfo.cmd, `⚡ ${sysCmdInfo.os} 终端命令已复制！`)}
      title="点击复制终端命令"
      role="button"
      tabindex="0"
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && copyText(sysCmdInfo.cmd, `⚡ ${sysCmdInfo.os} 终端命令已复制！`)}
    >
      <span class="text-xs font-mono text-emerald-500 dark:text-emerald-300 flex-1">{sysCmdInfo.cmd}</span>
      <span class="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 group-hover:bg-purple-500 group-hover:text-white border border-white/20 group-hover:border-purple-500 rounded px-1.5 py-0.5 text-[11px] text-[var(--text-main)] pointer-events-none transition-all">⚡ 复制</span>
    </div>
  {/if}

  <div class="mt-3.5 text-xs text-[var(--text-secondary)] leading-relaxed bg-black/5 dark:bg-white/[0.04] p-2.5 rounded-xl border border-black/5 dark:border-white/5">
    💡 <b>提示</b>：点击上方任一代码框即可一键复制并自动关闭；在终端中直接粘贴回车即可秒级打开并定位！
  </div>

  {#snippet footer()}
    <button
      type="button"
      class="w-full btn-primary text-xs py-2 font-semibold"
      onclick={onClose}
    >
      我知道了
    </button>
  {/snippet}
</Modal>
