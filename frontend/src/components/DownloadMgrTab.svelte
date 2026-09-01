<script lang="ts">
  import { onMount } from 'svelte';
  import FolderExplorer from './FolderExplorer.svelte';
  import { api } from '../lib/api';
  import { formatBytes, formatArtist, DEFAULT_VINYL_COVER, getApiCache, setApiCache } from '../lib/utils';
  import type { Track } from '../lib/types';

  let {
    curTrack = null,
    playing = false,
    onPlayQueue,
    onReveal,
    showToast
  } = $props<{
    curTrack?: Track | null;
    playing?: boolean;
    onPlayQueue: (tracks: any[], idx?: number) => void;
    onReveal: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let accFolder = $state(true);
  let accHistory = $state(true);

  let histKw = $state('');
  let histPage = $state(1);
  let histList: any[] = $state([]);
  let histStats: any = $state(null);
  let histTotal = $state(0);

  // 扫描结果面板状态
  let scanBoxVisible = $state(false);
  let scanType: 'external' | 'disk' | null = $state(null);
  let scanLoading = $state(false);
  let externalResult: any = $state(null);
  let diskResult: any = $state(null);

  // 弹窗状态 (缺失文件清单 / 非MP3清单)
  let modalType: 'missing' | 'non_mp3' | null = $state(null);
  let modalList: any[] = $state([]);
  let modalLoading = $state(false);

  async function loadHistory(p = 1) {
    histPage = p;
    if (p === 1 && !histKw.trim()) {
      const cachedList = getApiCache('history_list_1');
      if (cachedList?.data && Array.isArray(cachedList.data)) {
        histList = cachedList.data;
        histTotal = cachedList.total || cachedList.data.length;
      }
      const cachedStats = getApiCache('history_stats');
      if (cachedStats?.data) {
        histStats = cachedStats.data;
      }
    }
    try {
      const j = await api.historyList(histKw, p);
      const list = j?.data?.list || [];
      const total = j?.data?.total || 0;
      histList = list;
      histTotal = total;
      if (p === 1 && !histKw.trim()) {
        setApiCache('history_list_1', list);
      }
      const s = await api.historyStats();
      const stats = s?.data || null;
      histStats = stats;
      if (stats) setApiCache('history_stats', stats);
    } catch (e: any) {
      showToast('加载历史失败: ' + (e.message || e), 'error');
    }
  }

  let histTotalPages = $derived(Math.max(1, Math.ceil(histTotal / 10)));

  // 📁 1. 扫描外部曲库
  async function scanExternalLibraries() {
    scanBoxVisible = true;
    scanType = 'external';
    scanLoading = true;
    externalResult = null;
    try {
      const j = await api.historyScanExternal();
      scanLoading = false;
      if (j?.code === '000000') {
        externalResult = j.data || {};
        showToast('外部曲库扫描完成！', 'success');
        loadHistory(1);
      } else {
        showToast(j?.msg || '扫描失败', 'warning');
      }
    } catch (e: any) {
      scanLoading = false;
      showToast('请求扫描接口异常: ' + (e.message || e), 'error');
    }
  }

  // 🔍 2. 对齐磁盘
  async function scanDiskFiles() {
    scanBoxVisible = true;
    scanType = 'disk';
    scanLoading = true;
    diskResult = null;
    try {
      const j = await api.historyScan();
      scanLoading = false;
      if (j?.code === '000000') {
        diskResult = j.data || {};
        showToast('磁盘对齐扫描完成！', 'success');
        loadHistory(histPage);
      } else {
        showToast(j?.msg || '扫描失败', 'warning');
      }
    } catch (e: any) {
      scanLoading = false;
      showToast('磁盘扫描异常: ' + (e.message || e), 'error');
    }
  }

  // 📥 导入未录入物理音频
  async function importUntrackedFiles() {
    try {
      const j = await api.historyImportUntracked();
      if (j?.code === '000000') {
        showToast(`🎉 成功将 ${j.data} 首物理音频导入至历史数据库！`, 'success');
        scanBoxVisible = false;
        loadHistory(1);
      } else {
        showToast(j?.msg || '导入失败', 'warning');
      }
    } catch (e: any) {
      showToast('导入异常: ' + (e.message || e), 'error');
    }
  }

  // 🧹 3. 清理失效记录
  async function cleanMissingRecords() {
    try {
      const j = await api.historyCleanMissing();
      if (j?.code === '000000') {
        showToast(`✅ 已成功清理 ${j.data} 条失效记录！`, 'success');
        scanBoxVisible = false;
        modalType = null;
        loadHistory(1);
      } else {
        showToast(j?.msg || '清理失败', 'warning');
      }
    } catch (e: any) {
      showToast('清理异常: ' + (e.message || e), 'error');
    }
  }

  // 🧹 清理非 MP3 记录
  async function cleanNonMp3Records() {
    try {
      const j = await api.historyCleanNonMp3();
      if (j?.code === '000000') {
        showToast(`✅ 已成功清理 ${j.data} 条非 MP3 记录！`, 'success');
        modalType = null;
        loadHistory(1);
      } else {
        showToast(j?.msg || '清理失败', 'warning');
      }
    } catch (e: any) {
      showToast('清理异常: ' + (e.message || e), 'error');
    }
  }

  // 🗑️ 删除单条历史记录
  async function deleteItem(id: number) {
    try {
      const j = await api.historyDelete(id);
      if (j?.code === '000000') {
        showToast('已删除该条记录', 'info');
        loadHistory(histPage);
      } else {
        showToast(j?.msg || '删除失败', 'warning');
      }
    } catch (e: any) {
      showToast('删除异常: ' + (e.message || e), 'error');
    }
  }

  // 打开缺失记录清单弹窗
  async function openMissingModal() {
    modalType = 'missing';
    modalLoading = true;
    modalList = [];
    try {
      const j = await api.historyMissing();
      modalLoading = false;
      modalList = j?.data || [];
    } catch (e: any) {
      modalLoading = false;
      showToast('加载缺失列表失败: ' + (e.message || e), 'error');
    }
  }

  // 打开非 MP3 清单弹窗
  async function openNonMp3Modal() {
    modalType = 'non_mp3';
    modalLoading = true;
    modalList = [];
    try {
      const j = await api.historyNonMp3();
      modalLoading = false;
      modalList = j?.data || [];
    } catch (e: any) {
      modalLoading = false;
      showToast('加载非MP3列表失败: ' + (e.message || e), 'error');
    }
  }

  onMount(() => {
    loadHistory(1);
  });
</script>

<!-- Section 1: 本地曲库与文件夹树连播 -->
<div class="accordion-card" class:active={accFolder}>
  <div class="accordion-header" onclick={() => accFolder = !accFolder}>
    <h3 class="accordion-title">📁 1. 本地曲库与文件夹树连播</h3>
    <span class="accordion-icon">▼</span>
  </div>
  <div class="accordion-body">
    <FolderExplorer />
  </div>
</div>

<!-- Section 2: 本地下载历史与文件管理 -->
<div class="accordion-card" class:active={accHistory}>
  <div class="accordion-header" onclick={() => accHistory = !accHistory}>
    <h3 class="accordion-title">📥 2. 本地下载历史与文件管理</h3>
    <span class="accordion-icon">▼</span>
  </div>
  <div class="accordion-body">
    <!-- 统计数据条 -->
    <div style="display:flex; flex-wrap:wrap; gap:8px; background:var(--stat-bar-bg); border:1px solid var(--border-subtle); padding:10px 12px; border-radius:8px; margin-bottom:10px; align-items:center; font-size:13px;">
      <span>已记录下载：<strong>{histStats?.totalCount ?? histTotal ?? 0}</strong> 首</span>
      <span>占用空间：<strong>{histStats?.totalSize ? formatBytes(histStats.totalSize) : '-'}</strong></span>
      {#if (histStats?.missingCount ?? 0) > 0}
        <span style="color:#ef4444; cursor:pointer;" onclick={openMissingModal} title="点击查看所有缺失文件清单">
          ⚠️ 文件缺失：{histStats.missingCount} 首 <span style="font-size:10px; border:1px solid rgba(239,68,68,0.3); padding:1px 4px; border-radius:6px;">查看 ↗</span>
        </span>
      {/if}
      {#if (histStats?.nonMp3Count ?? 0) > 0}
        <span style="color:#f59e0b; cursor:pointer;" onclick={openNonMp3Modal} title="点击查看所有非 MP3 音频清单">
          📁 非 MP3 格式：{histStats.nonMp3Count} 首 <span style="font-size:10px; border:1px solid rgba(245,158,11,0.3); padding:1px 4px; border-radius:6px;">查看 ↗</span>
        </span>
      {/if}
      <div style="margin-left:auto; display:flex; gap:6px; flex-wrap:wrap;">
        <button class="btn-secondary" style="padding:5px 10px; font-size:12px;" onclick={scanExternalLibraries}>📁 外部曲库</button>
        <button class="btn-secondary" style="padding:5px 10px; font-size:12px;" onclick={scanDiskFiles}>🔍 对齐磁盘</button>
        <button class="btn-secondary" style="padding:5px 10px; font-size:12px;" onclick={cleanMissingRecords}>🧹 清理失效</button>
        <button class="btn-secondary" style="padding:5px 10px; font-size:12px;" onclick={() => loadHistory(1)}>🔄 刷新</button>
      </div>
    </div>

    <!-- 📊 扫描结果可折叠展示面板 -->
    {#if scanBoxVisible}
      <div style="background:var(--card-bg-solid); border:1px solid var(--border-color); border-radius:8px; padding:14px; margin-bottom:12px; position:relative;">
        <button style="position:absolute; right:10px; top:10px; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:14px;" onclick={() => scanBoxVisible = false}>✕</button>
        
        {#if scanLoading}
          <div style="color:var(--text-secondary); font-size:13px; text-align:center; padding:10px;">🔄 正在执行扫描，请稍候...</div>
        {:else if scanType === 'external' && externalResult}
          <div style="font-size:13px; line-height:1.7;">
            <div style="color:var(--text-main); font-weight:bold; margin-bottom:6px; font-size:14px;">✅ 多目录外部曲库扫描同步完成！</div>
            <div style="color:var(--text-main);">• 配置扫描目录列表: <code style="background:var(--tag-btn-bg); padding:2px 6px; border-radius:4px; border:1px solid var(--border-color); font-size:12px;">{(externalResult.configuredDirs || []).join(' ; ') || '未配置'}</code></div>
            <div style="color:var(--text-main);">• 累计扫描物理音频文件: <strong>{externalResult.scannedFiles || 0}</strong> 首</div>
            <div style="color:var(--text-main);">• 本次成功新录入索引: <strong style="color:var(--primary-color);">{externalResult.addedCount || 0}</strong> 首</div>
            <div style="margin-top:6px; font-size:12px; color:var(--text-secondary);">💡 提示：现在在线搜索或播放歌单时，凡在上述目录中的音乐，系统均会自动 0 延迟秒播本地文件！</div>
          </div>
        {:else if scanType === 'disk' && diskResult}
          <div style="font-size:13px; line-height:1.7;">
            <div style="margin-bottom:8px;">
              <strong>数据库记录：</strong>{diskResult.totalRecords || 0} | 
              <strong>物理文件正常：</strong><span>{diskResult.validRecordsCount || 0}</span> | 
              <strong>缺失记录：</strong><span style="color:#ef4444; font-weight:600;">{diskResult.missingCount || 0}</span> | 
              <strong>未录入物理音频：</strong><span style="color:var(--primary-color); font-weight:600;">{diskResult.untrackedCount || 0}</span>
            </div>

            {#if diskResult.untrackedFiles && diskResult.untrackedFiles.length > 0}
              <div style="margin:10px 0; padding:10px 12px; background:var(--stat-bar-bg); border:1px solid var(--border-color); border-radius:6px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                <span style="color:var(--text-main); font-size:13px;">💡 搜寻到 <strong>{diskResult.untrackedCount}</strong> 首本地已有物理音频未记录在数据库中：</span>
                <button class="btn-primary" style="padding:4px 12px; font-size:12px;" onclick={importUntrackedFiles}>
                  📥 导入至数据库
                </button>
              </div>
              <ul style="padding-left:18px; margin:6px 0; color:var(--text-secondary); font-size:12px; max-height:140px; overflow-y:auto;">
                {#each diskResult.untrackedFiles.slice(0, 10) as u}
                  <li>{u.fileName} ({formatBytes(u.fileSize)}) - <code style="font-size:11px; background:var(--tag-btn-bg); padding:1px 4px; border-radius:3px;">{u.filePath}</code></li>
                {/each}
                {#if diskResult.untrackedFiles.length > 10}
                  <li>...及更多共 {diskResult.untrackedFiles.length} 项</li>
                {/if}
              </ul>
            {:else}
              <div style="color:var(--text-main); font-weight:600;">✅ 所有磁盘物理音频文件均已与数据库完全映射对齐！</div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- 搜索筛选行 -->
    <div class="form-row flex-input-row" style="display:flex; gap:6px; margin-bottom:10px;">
      <input type="text" placeholder="🔍 检索本地已下载歌曲名 / 歌手 / 物理文件名" style="flex:1;" bind:value={histKw} onkeydown={(e) => e.key === 'Enter' && loadHistory(1)} />
      <button class="btn-primary" onclick={() => loadHistory(1)}>检索</button>
    </div>

    <!-- 历史曲目列表 -->
    <ul class="data-list scrollable-list">
      {#each histList as h, idx}
        {@const artistName = formatArtist(h.artist)}
        {@const isPlayingThis = !!(curTrack && (String(curTrack.id) === String(h.songId || h.id) || (curTrack.name && (curTrack.name === h.songName || curTrack.name === h.name))))}
        <li class="track-item-card" class:is-active-playing={isPlayingThis} style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; gap:8px;">
          <div class="track-title-row" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; gap:6px;">
            <strong class="clickable-track-title" style="cursor:pointer;" onclick={() => onPlayQueue([{ id: h.songId || h.id, name: h.songName || h.name, artist: artistName, cover: DEFAULT_VINYL_COVER, url: `/v2/history/stream?path=${encodeURIComponent(h.relativePath || h.filePath)}`, isLocal: true }])}>
              {(histPage - 1) * 10 + idx + 1}. {h.songName || h.name || '未知歌曲'}
            </strong>
            {#if artistName}<span style="color:var(--text-secondary); font-size:12px;"> - {artistName}</span>{/if}
            <span class="audio-source-badge icon-only badge-server" title="🖥️ 本地已下载">🖥️</span>
            {#if h.fileExists === false}
              <span style="font-size:10px; background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3); padding:1px 4px; border-radius:4px;">⚠️ 失效</span>
            {/if}
          </div>
          <div class="track-action-group" style="display:flex; gap:6px; flex-shrink:0;">
            {#if h.fileExists !== false}
              <button
                class="jump-link-btn"
                class:is-playing-btn={isPlayingThis}
                onclick={() => onPlayQueue([{ id: h.songId || h.id, name: h.songName || h.name, artist: artistName, cover: DEFAULT_VINYL_COVER, url: `/v2/history/stream?path=${encodeURIComponent(h.relativePath || h.filePath)}`, isLocal: true }])}
              >
                {isPlayingThis && playing ? '⏸ 播放中' : '▶️ 播放'}
              </button>
              <button class="jump-link-btn" onclick={() => onReveal(h)}>
                📂 定位
              </button>
            {/if}
            <button class="jump-link-btn" onclick={() => deleteItem(h.id)} title="从数据库删除此条历史记录">
              🗑️ 删除
            </button>
          </div>
        </li>
      {:else}
        <li style="padding:20px; text-align:center; color:var(--text-muted);">暂无下载历史记录</li>
      {/each}
    </ul>

    <!-- 分页 -->
    <div class="pagination-container" style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
      <button class="btn-secondary" disabled={histPage <= 1} onclick={() => loadHistory(histPage - 1)}>上一页</button>
      <span style="font-size:12px; color:var(--text-secondary);">第 {histPage} / {histTotalPages} 页 (共 {histTotal} 首)</span>
      <button class="btn-secondary" disabled={histPage >= histTotalPages} onclick={() => loadHistory(histPage + 1)}>下一页</button>
    </div>
  </div>
</div>

<!-- 📋 缺失文件 / 非MP3 格式 清单弹窗 (对齐旧版) -->
{#if modalType}
  <div class="app-modal-backdrop" style="opacity:1;" onclick={(e) => e.target === e.currentTarget && (modalType = null)}>
    <div class="app-modal-card" style="transform:scale(1); max-width:620px;">
      <div class="app-modal-header">
        <span>{modalType === 'missing' ? '⚠️ 文件已缺失的历史记录' : '📁 非 MP3 格式音频记录'} ({modalList.length} 项)</span>
        <button class="app-modal-close-btn" onclick={() => modalType = null}>✕</button>
      </div>
      <div class="app-modal-body" style="max-height:60vh; overflow-y:auto;">
        {#if modalLoading}
          <div style="padding:20px; text-align:center; color:var(--text-muted);">🔄 正在加载清单...</div>
        {:else if modalList.length > 0}
          <div style="margin-bottom:10px; font-size:12px; color:var(--text-secondary);">
            {modalType === 'missing' ? '以下数据库记录在物理磁盘上已不存在对应文件：' : '以下音频为 FLAC / WAV / M4A / AAC 等高解析格式文件：'}
          </div>
          <ul class="data-list scrollable-list" style="margin:0; padding:0;">
            {#each modalList as item, i}
              {@const mArtist = formatArtist(item.artist)}
              <li style="padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:12px;">
                <div style="font-weight:600; color:var(--text-main);">{i + 1}. {item.songName}{mArtist ? ' - ' + mArtist : ''}</div>
                <div style="color:var(--text-muted); font-size:11px; font-family:monospace; word-break:break-all;">{item.filePath}</div>
              </li>
            {/each}
          </ul>
        {:else}
          <div style="padding:30px; text-align:center; color:#22c55e;">✅ 没有找到相关异常记录！</div>
        {/if}
      </div>
      <div class="app-modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
        {#if modalType === 'missing' && modalList.length > 0}
          <button class="btn-primary" style="background:linear-gradient(135deg,#ef4444,#dc2626); font-size:12px;" onclick={cleanMissingRecords}>
            🧹 一键清理全部失效记录
          </button>
        {:else if modalType === 'non_mp3' && modalList.length > 0}
          <button class="btn-primary" style="background:linear-gradient(135deg,#f59e0b,#d97706); font-size:12px;" onclick={cleanNonMp3Records}>
            🧹 批量清理非 MP3 记录
          </button>
        {:else}
          <div></div>
        {/if}
        <button class="app-modal-btn app-modal-btn-confirm" onclick={() => modalType = null}>关闭</button>
      </div>
    </div>
  </div>
{/if}
