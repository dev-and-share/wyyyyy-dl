<script lang="ts">
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

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!-- 📂 文件物理定位弹窗 -->
<div class="app-modal-backdrop" style="opacity:1;" onclick={(e) => e.target === e.currentTarget && onClose()}>
  <div class="app-modal-card">
    <div class="app-modal-header">
      <span>{isSuccess ? '🚀' : '📂'} 文件物理定位</span>
      <button class="app-modal-close-btn" onclick={onClose}>✕</button>
    </div>
    <div class="app-modal-body">
      {#if msg}
        <div style="margin-bottom:12px; font-weight:600; color:{isSuccess ? '#4ade80' : '#38bdf8'}; font-size:13px;">
          {msg}
        </div>
      {/if}
      
      <!-- 物理路径可点击复制卡片 -->
      <div class="copy-field-header">
        <span>📁 文件物理路径</span>
        <span class="click-hint">📋 点击卡片直接复制</span>
      </div>
      <div 
        class="app-modal-path-box clickable-copy-box" 
        onclick={() => path && copyText(path, '📋 物理路径已复制！')}
        title="点击复制文件物理路径"
        role="button"
        tabindex="0"
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && path && copyText(path, '📋 物理路径已复制！')}
      >
        <span class="code-text">{path || '未知路径'}</span>
        <span class="copy-badge">📋 复制</span>
      </div>
      
      <!-- 终端命令可点击复制卡片 -->
      {#if sysCmdInfo.cmd}
        <div class="copy-field-header" style="margin-top:14px;">
          <span>💻 终端直达命令 ({sysCmdInfo.os})</span>
          <span class="click-hint">⚡ 点击卡片直接复制</span>
        </div>
        <div 
          class="app-modal-path-box clickable-copy-box cmd-box" 
          onclick={() => copyText(sysCmdInfo.cmd, `⚡ ${sysCmdInfo.os} 终端命令已复制！`)}
          title="点击复制终端命令"
          role="button"
          tabindex="0"
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && copyText(sysCmdInfo.cmd, `⚡ ${sysCmdInfo.os} 终端命令已复制！`)}
        >
          <span class="code-text font-mono">{sysCmdInfo.cmd}</span>
          <span class="copy-badge">⚡ 复制</span>
        </div>
      {/if}

      <div class="app-modal-tip" style="margin-top:14px; font-size:12px; line-height:1.5;">
        💡 <b>提示</b>：点击上方任一代码框即可一键复制并自动关闭；在终端中直接粘贴回车即可秒级打开并定位！
      </div>
    </div>

    <!-- 底部仅保留单主按钮，避免误触 -->
    <div class="app-modal-footer">
      <button class="app-modal-btn app-modal-btn-confirm full-btn" onclick={onClose}>
        我知道了
      </button>
    </div>
  </div>
</div>

<style>
  .app-modal-backdrop {
    box-sizing: border-box;
    padding: 16px;
    width: 100vw;
    max-width: 100vw;
    overflow-x: hidden;
  }
  .app-modal-card {
    width: 100%;
    max-width: min(520px, calc(100vw - 32px));
    box-sizing: border-box;
  }
  .copy-field-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 5px;
  }
  .click-hint {
    font-size: 11px;
    color: #38bdf8;
    opacity: 0.85;
  }
  .clickable-copy-box {
    position: relative;
    cursor: pointer;
    border: 1px solid rgba(56, 189, 248, 0.25);
    background: rgba(56, 189, 248, 0.06);
    border-radius: 8px;
    padding: 10px 48px 10px 12px;
    transition: all 0.2s ease;
    word-break: break-all;
    user-select: text;
    box-sizing: border-box;
    display: flex;
    align-items: center;
  }
  .clickable-copy-box:hover {
    border-color: #38bdf8;
    background: rgba(56, 189, 248, 0.12);
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
    transform: translateY(-1px);
  }
  .clickable-copy-box.cmd-box {
    border-color: rgba(168, 85, 247, 0.3);
    background: rgba(0, 0, 0, 0.35);
  }
  .clickable-copy-box.cmd-box:hover {
    border-color: #a855f7;
    background: rgba(168, 85, 247, 0.12);
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.2);
  }
  .code-text {
    font-size: 12px;
    color: #38bdf8;
    flex: 1;
  }
  .code-text.font-mono {
    font-family: monospace;
    color: #a7f3d0;
  }
  .copy-badge {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 11px;
    color: var(--text-main);
    pointer-events: none;
    transition: all 0.2s;
  }
  .clickable-copy-box:hover .copy-badge {
    background: #38bdf8;
    color: #fff;
    border-color: #38bdf8;
  }
  .clickable-copy-box.cmd-box:hover .copy-badge {
    background: #a855f7;
    color: #fff;
    border-color: #a855f7;
  }
  .app-modal-footer {
    display: flex;
    padding: 12px 18px;
    border-top: 1px solid var(--border-subtle);
    box-sizing: border-box;
  }
  .full-btn {
    width: 100%;
    text-align: center;
    padding: 9px 16px;
    font-size: 13px;
    font-weight: 600;
  }
</style>

