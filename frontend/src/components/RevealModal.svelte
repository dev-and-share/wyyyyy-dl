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

<!-- 📂 文件物理定位弹窗 (对齐旧版 UI) -->
<div class="app-modal-backdrop" style="opacity:1;" onclick={(e) => e.target === e.currentTarget && onClose()}>
  <div class="app-modal-card" style="transform:scale(1); max-width:560px;">
    <div class="app-modal-header">
      <span>{isSuccess ? '🚀' : '📂'} 文件物理定位</span>
      <button class="app-modal-close-btn" onclick={onClose}>✕</button>
    </div>
    <div class="app-modal-body">
      {#if msg}
        <div style="margin-bottom:10px; font-weight:600; color:{isSuccess ? '#4ade80' : '#38bdf8'}; font-size:13px;">
          {msg}
        </div>
      {/if}
      
      <div style="font-size:12px; color:var(--text-secondary); margin-bottom:4px;">📁 文件物理路径：</div>
      <div class="app-modal-path-box" style="word-break:break-all; user-select:text;">{path || '未知路径'}</div>
      
      <div style="font-size:12px; color:var(--text-secondary); margin:12px 0 4px 0;">💻 终端直达命令 ({sysCmdInfo.os})：</div>
      <div class="app-modal-path-box" style="background:rgba(0,0,0,0.35); color:#a7f3d0; font-family:monospace; border-color:rgba(168,85,247,0.3); font-size:12px; word-break:break-all; user-select:text;">
        {sysCmdInfo.cmd}
      </div>

      <div class="app-modal-tip" style="margin-top:12px; font-size:12px; color:var(--text-muted); line-height:1.5;">
        💡 <b>终端秒开提示</b>：点击下方「⚡ 复制 {sysCmdInfo.os} 命令」，在终端中直接粘贴回车，即可秒级打开并高亮选中该文件！
      </div>
    </div>
    <div class="app-modal-footer">
      {#if path}
        <button class="app-modal-btn btn-copy-path" onclick={() => copyText(path, '📋 物理路径已复制！')}>
          📋 复制物理路径
        </button>
      {/if}
      {#if sysCmdInfo.cmd}
        <button class="app-modal-btn btn-copy-cmd" onclick={() => copyText(sysCmdInfo.cmd, '💻 终端命令已复制！')}>
          ⚡ 复制 {sysCmdInfo.os} 命令
        </button>
      {/if}
      <button class="app-modal-btn app-modal-btn-confirm" onclick={onClose}>
        我知道了
      </button>
    </div>
  </div>
</div>

<style>
  .app-modal-backdrop {
    box-sizing: border-box;
    padding: 12px;
    width: 100vw;
    max-width: 100vw;
    overflow-x: hidden;
  }
  .app-modal-card {
    width: 100%;
    max-width: min(560px, calc(100vw - 24px));
    box-sizing: border-box;
  }
  .app-modal-footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    flex-wrap: wrap;
    box-sizing: border-box;
  }
  .btn-copy-path {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }
  .btn-copy-cmd {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.3);
    color: #a78bfa;
  }
  @media (max-width: 768px) {
    .app-modal-footer {
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
    }
    .app-modal-footer .app-modal-btn {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
    }
  }
</style>

