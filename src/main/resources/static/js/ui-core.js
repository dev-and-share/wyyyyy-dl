/* ==========================================================================
   🎵 NetEase Music Downloader - UI Core & Common Utilities (ui-core.js)
   ========================================================================== */

/**
 * 🍞 全局通用现代化 Toast 提示组件
 * @param {string} message 提示信息文本
 * @param {'info'|'warning'|'warn'|'success'|'error'} [type='info'] 提示类型
 * @param {number} [duration=3500] 显示时长 (ms)
 */
function showToast(message, type = 'info', duration = 3500) {
    if (!message) return;
    let container = document.getElementById("globalToastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "globalToastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type}`;
    
    let icon = "ℹ️";
    if (type === "warning" || type === "warn") icon = "⚠️";
    else if (type === "error") icon = "❌";
    else if (type === "success") icon = "✅";

    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("toast-out");
        toast.addEventListener("animationend", () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }, duration);
}
window.showToast = showToast;

/**
 * 🖼️ 全局现代化通用 Modal 弹窗系统（纯异步非阻塞，绝不中断正在播放的音频）
 */
function showAppModal(options = {}) {
    return new Promise((resolve) => {
        const {
            title = '提示',
            icon = 'ℹ️',
            content = '',
            confirmText = '确定',
            cancelText = '取消',
            showCancel = false,
            danger = false,
            copyText = null,
            cmdText = null,
            cmdLabel = null
        } = options;

        const backdrop = document.createElement('div');
        backdrop.className = 'app-modal-backdrop';

        const card = document.createElement('div');
        card.className = 'app-modal-card';

        const confirmBtnClass = danger ? 'app-modal-btn app-modal-btn-danger' : 'app-modal-btn app-modal-btn-confirm';

        card.innerHTML = `
            <div class="app-modal-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span>${icon}</span>
                    <span>${title}</span>
                </div>
                <button class="app-modal-close-btn" id="modalCloseBtn">✕</button>
            </div>
            <div class="app-modal-body">
                <div>${content}</div>
                ${copyText && !content.includes('modalPathBox') ? `
                    <div class="app-modal-path-box" id="modalPathBox">${escapeHtml(copyText)}</div>
                ` : ''}
            </div>
            <div class="app-modal-footer">
                ${copyText ? `
                    <button class="app-modal-btn app-modal-btn-copy" id="modalCopyBtn">📋 复制路径</button>
                ` : ''}
                ${cmdText ? `
                    <button class="app-modal-btn app-modal-btn-cmd" id="modalCmdBtn">${cmdLabel || '💻 复制终端命令'}</button>
                ` : ''}
                ${showCancel ? `
                    <button class="app-modal-btn app-modal-btn-cancel" id="modalCancelBtn">${cancelText}</button>
                ` : ''}
                <button class="${confirmBtnClass}" id="modalConfirmBtn">${confirmText}</button>
            </div>
        `;

        backdrop.appendChild(card);
        document.body.appendChild(backdrop);

        const closeModal = (result) => {
            backdrop.style.opacity = '0';
            backdrop.style.transition = 'opacity 0.15s ease';
            card.style.transform = 'scale(0.95) translateY(10px)';
            card.style.transition = 'transform 0.15s ease';
            setTimeout(() => {
                if (backdrop.parentNode) {
                    backdrop.parentNode.removeChild(backdrop);
                }
                resolve(result);
            }, 150);
        };

        const closeBtn = card.querySelector('#modalCloseBtn');
        const confirmBtn = card.querySelector('#modalConfirmBtn');
        const cancelBtn = card.querySelector('#modalCancelBtn');
        const copyBtn = card.querySelector('#modalCopyBtn');
        const cmdBtn = card.querySelector('#modalCmdBtn');

        if (closeBtn) closeBtn.onclick = () => closeModal(false);
        if (confirmBtn) confirmBtn.onclick = () => closeModal(true);
        if (cancelBtn) cancelBtn.onclick = () => closeModal(false);

        const executeCopy = (text, successMsg) => {
            const doClose = () => closeModal(true);
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => {
                        showToast(successMsg, 'success', 2000);
                        doClose();
                    })
                    .catch(() => {
                        fallbackCopy(text, successMsg);
                        doClose();
                    });
            } else {
                fallbackCopy(text, successMsg);
                doClose();
            }
        };

        if (copyBtn && copyText) {
            copyBtn.onclick = () => executeCopy(copyText, '📋 路径已成功复制到剪贴板！');
        }

        if (cmdBtn && cmdText) {
            cmdBtn.onclick = () => executeCopy(cmdText, '💻 终端命令已成功复制！');
        }

        function fallbackCopy(text, successMsg) {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.opacity = "0";
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showToast(successMsg || '📋 已成功复制到剪贴板！', 'success', 2000);
            } catch (err) {
                showToast('复制失败，请手动选择复制', 'warning');
            }
        }

        // 点击遮罩空白处关闭
        backdrop.onclick = (e) => {
            if (e.target === backdrop) closeModal(false);
        };

        // 按 ESC 键关闭
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', onKeyDown);
                closeModal(false);
            }
        };
        document.addEventListener('keydown', onKeyDown);
    });
}

function showAlert(message, title = '提示', icon = 'ℹ️') {
    return showAppModal({ title, content: message, icon, showCancel: false });
}

function showConfirm(message, title = '确认操作', options = {}) {
    return showAppModal({
        title,
        content: message,
        icon: options.icon || '⚠️',
        showCancel: true,
        danger: options.danger || false,
        confirmText: options.confirmText || '确定',
        cancelText: options.cancelText || '取消'
    });
}

/**
 * 💻 根据当前客户端操作系统生成终端直达定位命令
 */
function getSystemOpenCommand(filePath) {
    if (!filePath) return { os: 'Mac', cmd: '', tip: '' };
    const userAgent = (navigator.userAgent || '').toLowerCase();
    const platform = (navigator.platform || '').toLowerCase();

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
window.getSystemOpenCommand = getSystemOpenCommand;

function showRevealModal(hostPath, containerPath, msg) {
    const targetPath = hostPath || containerPath;
    const isSuccess = msg && msg.includes('成功');
    const icon = isSuccess ? '🚀' : '📂';
    const statusHtml = msg ? `<div style="margin-bottom:8px; font-weight:600; color:${isSuccess ? '#4ade80' : '#38bdf8'};">${msg}</div>` : '';
    
    const sysCmdInfo = getSystemOpenCommand(targetPath);

    return showAppModal({
        title: '文件物理定位',
        icon: icon,
        content: `
            ${statusHtml}
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:4px;">📁 文件物理路径：</div>
            <div class="app-modal-path-box" id="modalPathBox">${escapeHtml(targetPath)}</div>
            <div style="font-size:12px; color:var(--text-secondary); margin:10px 0 4px 0;">💻 终端直达命令 (${sysCmdInfo.os})：</div>
            <div class="app-modal-path-box" style="background:rgba(0,0,0,0.35); color:#a7f3d0; font-family:monospace; border-color:rgba(168,85,247,0.3); font-size:12px;">${escapeHtml(sysCmdInfo.cmd)}</div>
            <div class="app-modal-tip" style="margin-top:10px;">
                💡 <b>终端秒开提示</b>：点击下方「⚡ 复制 ${sysCmdInfo.os} 命令」，在终端中直接粘贴回车，即可秒级打开并高亮选中该文件！
            </div>
        `,
        copyText: targetPath,
        cmdText: sysCmdInfo.cmd,
        cmdLabel: `⚡ 复制 ${sysCmdInfo.os} 命令`,
        confirmText: '我知道了'
    });
}

window.showAppModal = showAppModal;
window.showAlert = showAlert;
window.showConfirm = showConfirm;
window.showRevealModal = showRevealModal;

/* ==========================================================================
   🌓 现代主题管理引擎 (Theme Engine: Dark / Light / Auto)
   ========================================================================== */

const THEME_STORAGE_KEY = 'theme_mode';

function getPreferredThemeMode() {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
}

function applyTheme(mode) {
    const root = document.documentElement;
    let effectiveTheme = mode;
    
    if (mode === 'auto') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        effectiveTheme = prefersDark ? 'dark' : 'light';
    }

    if (effectiveTheme === 'light') {
        root.setAttribute('data-theme', 'light');
    } else {
        root.removeAttribute('data-theme');
    }

    updateThemeToggleUI(mode);
}

function setThemeMode(mode) {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    applyTheme(mode);
    const modeNames = { 'dark': '🌙 深色模式', 'light': '☀️ 浅色模式', 'auto': '🌓 跟随系统' };
    showToast(`已切换至 ${modeNames[mode] || mode}`, 'info', 1800);
}

function toggleTheme() {
    const current = getPreferredThemeMode();
    let next = 'dark';
    if (current === 'dark') next = 'light';
    else if (current === 'light') next = 'auto';
    else next = 'dark';
    setThemeMode(next);
}

function updateThemeToggleUI(mode) {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    const icons = { 'dark': '🌙', 'light': '☀️', 'auto': '🌓' };
    const titles = { 'dark': '当前: 深色模式 (点击切换)', 'light': '当前: 浅色模式 (点击切换)', 'auto': '当前: 跟随系统 (点击切换)' };
    btn.innerHTML = icons[mode] || '🌓';
    btn.title = titles[mode] || '切换主题外观';
}

function initThemeEngine() {
    const mode = getPreferredThemeMode();
    applyTheme(mode);

    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (getPreferredThemeMode() === 'auto') {
                applyTheme('auto');
            }
        });
    }
}
window.initThemeEngine = initThemeEngine;
window.setThemeMode = setThemeMode;
window.toggleTheme = toggleTheme;
window.toggleThemeMode = toggleTheme;

/* ==========================================================================
   🔧 通用格式化与工具函数
   ========================================================================== */

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
window.formatBytes = formatBytes;

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return (mins < 10 ? "0" + mins : mins) + ":" + (secs < 10 ? "0" + secs : secs);
}
window.formatTime = formatTime;

/* ==========================================================================
   📂 手风琴 (Accordion) 折叠逻辑
   ========================================================================== */

function openAccordionCard(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    
    const parent = card.parentElement;
    if (parent) {
        const siblingCards = parent.querySelectorAll(".accordion-card");
        siblingCards.forEach(item => {
            if (item !== card) {
                item.classList.remove("active");
            }
        });
    }
    
    card.classList.add("active");
}

function toggleAccordionCard(headerElement) {
    const card = headerElement.closest(".accordion-card");
    if (card) {
        card.classList.toggle("active");
    }
}
window.openAccordionCard = openAccordionCard;
window.toggleAccordionCard = toggleAccordionCard;

/* ==========================================================================
   🔗 联动跳转逻辑 (Link Jump Helpers)
   ========================================================================== */

function jumpToPlaylistDetail(playlistId) {
    if (!playlistId) return;
    if (typeof switchTab === 'function') switchTab('playlist');

    const input = document.getElementById("playlistId");
    if (input) input.value = playlistId;
    
    openAccordionCard("card-playlist-detail");
    if (typeof loadPlaylistDetail === 'function') loadPlaylistDetail();
}

function jumpToSongDetail(songId) {
    if (typeof switchTab === 'function') switchTab('playlist');

    const input = document.getElementById("songId");
    if (input) input.value = songId;
    
    openAccordionCard("card-song-detail");
    if (typeof loadSongInfo === 'function') loadSongInfo();
}

function jumpToArtistDetail(artistId) {
    if (!artistId) return;
    if (typeof switchTab === 'function') switchTab('search');

    const input = document.getElementById("artistId");
    if (input) input.value = artistId;

    openAccordionCard("card-artist-detail");
    if (typeof loadArtistInfo === 'function') loadArtistInfo();
}
window.jumpToArtistDetail = jumpToArtistDetail;

function loadSongInfo() {
    const id = document.getElementById("songId").value;
    const level = document.getElementById("songLevel").value;
    if (!id) {
        showToast("请输入歌曲 ID", "warning");
        return;
    }

    axios.post('/Song_V1', new URLSearchParams({ id: id, level: level, type: 'json' }))
        .then(resp => {
            const song = resp.data.data;
            if (!song) {
                showToast("获取歌曲信息失败：无可用歌曲数据", "warning");
                return;
            }
            const infoDiv = document.getElementById("song-info");
            const arText = song.ar_name || '群星 / 未知';
            const alText = song.al_name || '暂无专辑';
            const sizeText = song.size || '未知大小';
            const levelText = song.level || level;
            const imgSrc = song.pic || song.picUrl || '';
            const imgHtml = imgSrc ? `<img src="${imgSrc}" style="width:100px; height:100px; border-radius:8px; object-fit:cover; border:1px solid var(--border-color);">` : '';
            const albumBtn = song.al_id ? `<button class="btn-primary" style="background:linear-gradient(135deg, #8b5cf6, #7c3aed); margin-right:6px;" onclick="jumpToAlbumDetail('${song.al_id}')">💽 查看专辑</button>` : '';

            infoDiv.innerHTML = `
                <div class="detail-header-card" style="margin-top:10px;">
                    ${imgHtml}
                    <div style="flex:1; min-width:0;">
                        <h4 style="margin:0 0 6px 0; color:var(--text-main); font-size:16px;">${song.name}</h4>
                        <div style="font-size:13px; color:var(--text-secondary);">歌手：${arText} | 专辑：${alText}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">大小：${sizeText} | 音质：${levelText}</div>
                        <div class="detail-btn-group">
                            <button class="btn-primary" style="background:linear-gradient(135deg, #10b981, #059669); margin-right:6px;" onclick="playAudioOnline('${song.url}', '${(song.name||'').replace(/'/g, "\\'")}', '${(arText||'').replace(/'/g, "\\'")}', '${imgSrc}', '${(song.lyric||'').replace(/'/g, "\\'")}')">▶️ 在线试听</button>
                            ${albumBtn}
                            <button class="btn-primary" onclick="downloadSingle('${song.id}')">📥 下载单曲</button>
                        </div>
                    </div>
                </div>
                <div style="margin-top:10px;">
                    <details style="border: 1px solid var(--border-color); border-radius: 6px; padding: 6px 10px; background: var(--tag-btn-bg);">
                        <summary style="font-size:12px; color:var(--primary-color); cursor:pointer; font-weight:600; outline:none;">📄 查看 Raw JSON 响应数据</summary>
                        <pre style="background:#0f172a; color:#38bdf8; padding:10px; border-radius:6px; font-size:11px; max-height:200px; overflow-y:auto; margin-top:6px; font-family:Consolas, monospace; border:1px solid rgba(255,255,255,0.06);">${JSON.stringify(song.rawData || song, null, 2)}</pre>
                    </details>
                </div>
                <div style="margin-top:10px; font-size:12px; color:var(--text-secondary); max-height:150px; overflow-y:auto; background:var(--tag-btn-bg); padding:8px 12px; border-radius:6px; border:1px solid var(--border-subtle);">
                    <pre style="margin:0; font-family:inherit; white-space:pre-wrap;">${song.lyric || '暂无歌词'}</pre>
                </div>
            `;
        })
        .catch(err => showToast("获取歌曲信息失败：" + err, "warning"));
}

function toggleRepeat() {
    const repeatSwitch = document.getElementById('repeatSwitch');
    if (!repeatSwitch) return;
    const isChecked = repeatSwitch.checked;
    axios.get(`/v2/setRepeat?repeat=${isChecked}`)
        .then(resp => {
            if (resp.data.code === "000000") {
                console.log("设置 repeat 成功:", isChecked);
            }
        })
        .catch(err => console.error("设置 repeat 失败:", err));
}
window.jumpToPlaylistDetail = jumpToPlaylistDetail;
window.jumpToSongDetail = jumpToSongDetail;
window.loadSongInfo = loadSongInfo;
window.toggleRepeat = toggleRepeat;

/* ==========================================================================
   📥 悬浮卡片下载监视器 (Floating Download Monitor Widget)
   ========================================================================== */

let monitorInterval = null;
let isMonitorMinimized = false;

function downloadSingle(id) {
    axios.get(`/v2/single?id=${id}`)
        .then(() => {
            fetchDownloadTasks();
            if (!monitorInterval) {
                monitorInterval = setInterval(fetchDownloadTasks, 1500);
            }
        })
        .catch(err => showToast("单曲下载失败：" + err, "error"));
}

function fetchDownloadTasks() {
    axios.get('/v2/tasks')
        .then(resp => {
            if (resp.data.code === '000000') {
                const tasks = resp.data.data || [];
                const widget = document.getElementById('floatingMonitor');
                const listContainer = document.getElementById('monitorTaskList');

                if (!widget || !listContainer) return;

                if (tasks.length === 0) {
                    widget.style.display = 'none';
                    return;
                }

                widget.style.display = 'block';
                listContainer.innerHTML = '';

                let hasActiveTask = false;

                tasks.forEach(task => {
                    const item = document.createElement('div');
                    item.className = 'monitor-task-item';

                    const taskInfo = document.createElement('div');
                    taskInfo.className = 'task-info';

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'task-name';
                    nameSpan.textContent = task.name || `未知歌曲 (${task.id})`;
                    taskInfo.appendChild(nameSpan);

                    if (task.status === 'FAILED' && task.errorMsg) {
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'task-error';
                        errorDiv.textContent = `❌ ${task.errorMsg}`;
                        taskInfo.appendChild(errorDiv);
                    }

                    item.appendChild(taskInfo);

                    const rightActions = document.createElement('div');
                    rightActions.className = 'task-actions-right';

                    const badge = document.createElement('span');
                    badge.className = `badge badge-${task.status.toLowerCase()}`;
                    
                    let statusText = task.status;
                    if (task.status === 'PENDING') statusText = '排队中';
                    if (task.status === 'DOWNLOADING') {
                        statusText = '下载中';
                        hasActiveTask = true;
                    }
                    if (task.status === 'SUCCESS') statusText = '成功';
                    if (task.status === 'SKIP') statusText = '跳过';
                    if (task.status === 'FAILED') statusText = '失败';

                    badge.textContent = statusText;
                    rightActions.appendChild(badge);

                    if (task.status === 'SUCCESS' || task.status === 'SKIP') {
                        const revealBtn = document.createElement('button');
                        revealBtn.className = 'task-locate-btn';
                        revealBtn.title = '在 Finder / 资源管理器中高亮定位此文件';
                        revealBtn.textContent = '📂 定位';
                        revealBtn.onclick = (e) => {
                            e.stopPropagation();
                            if (typeof revealSong === 'function') revealSong(task.id, task.name, '', task.filePath || '', task.id);
                        };
                        rightActions.appendChild(revealBtn);
                    }

                    item.appendChild(rightActions);
                    listContainer.appendChild(item);
                });

                const activeCount = tasks.filter(t => t.status === 'DOWNLOADING' || t.status === 'PENDING').length;
                const titleText = activeCount > 0 ? `📥 下载中 (${activeCount})` : `📥 下载完成 (${tasks.length})`;
                const headerTitle = document.getElementById('monitorHeaderTitle');
                if (headerTitle) headerTitle.textContent = titleText;

                if (!hasActiveTask && monitorInterval) {
                    const hasPending = tasks.some(t => t.status === 'PENDING');
                    if (!hasPending) {
                        clearInterval(monitorInterval);
                        monitorInterval = null;
                    }
                }
            }
        })
        .catch(err => console.error("获取下载进度失败:", err));
}

function toggleMinimizeMonitor() {
    const widget = document.getElementById('floatingMonitor');
    if (widget) {
        widget.classList.toggle('minimized');
        isMonitorMinimized = widget.classList.contains('minimized');
    }
}

function clearMonitorTasks() {
    axios.post('/v2/tasks/clear')
        .then(() => fetchDownloadTasks())
        .catch(err => showToast("清空失败：" + err, "error"));
}

function hideMonitor() {
    const widget = document.getElementById('floatingMonitor');
    if (widget) widget.style.display = 'none';
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
    }
}
window.downloadSingle = downloadSingle;
window.fetchDownloadTasks = fetchDownloadTasks;
window.toggleMinimizeMonitor = toggleMinimizeMonitor;
window.clearMonitorTasks = clearMonitorTasks;
window.hideMonitor = hideMonitor;

/* ==========================================================================
   ⚡ SWR (Stale-While-Revalidate) 本地 API 缓存引擎
   ========================================================================== */

const API_CACHE_PREFIX = 'pwa_api_cache_';

function getApiCache(key) {
    try {
        const raw = localStorage.getItem(API_CACHE_PREFIX + key);
        return raw ? JSON.parse(raw) : null;
    } catch(e) {
        return null;
    }
}

function setApiCache(key, data) {
    try {
        localStorage.setItem(API_CACHE_PREFIX + key, JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
    } catch(e) {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(API_CACHE_PREFIX)) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.slice(0, Math.ceil(keysToRemove.length / 2)).forEach(k => localStorage.removeItem(k));
            localStorage.setItem(API_CACHE_PREFIX + key, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch(err) {
            console.warn("[SWR] 写入缓存失败:", err);
        }
    }
}

function isFastDataEqual(oldObj, newObj) {
    if (!oldObj || !newObj) return false;
    if (oldObj.id !== newObj.id) return false;
    if (oldObj.trackCount !== newObj.trackCount) return false;
    if (oldObj.coverImgUrl !== newObj.coverImgUrl) return false;
    if (oldObj.name !== newObj.name) return false;
    
    const oldTracks = oldObj.tracks || oldObj.songs || [];
    const newTracks = newObj.tracks || newObj.songs || [];
    if (oldTracks.length !== newTracks.length) return false;
    
    for (let i = 0; i < oldTracks.length; i++) {
        if (oldTracks[i].id !== newTracks[i].id || oldTracks[i].isLocal !== newTracks[i].isLocal) {
            return false;
        }
    }
    return true;
}
window.getApiCache = getApiCache;
window.setApiCache = setApiCache;
window.isFastDataEqual = isFastDataEqual;

/* ==========================================================================
   ❤️ 网易云音乐红心 (Like / Unlike) Cache-First SWR 引擎
   ========================================================================== */

window.likedSongIdsSet = new Set();

/**
 * ⚡ 初始化红心歌曲 SWR 缓存（0ms 秒开读取本地持久化缓存 + 后台静默热更新）
 */
function initLikedSongsCache() {
    // 1. 0ms 本地优先秒级恢复
    const cached = getApiCache('liked_song_ids');
    if (cached && Array.isArray(cached.data)) {
        window.likedSongIdsSet = new Set(cached.data.map(id => Number(id)));
        console.log(`[Like] ⚡ 0ms 恢复本地红心缓存: ${window.likedSongIdsSet.size} 首`);
        updateAllLikeButtonsUI();
    }

    // 2. 后台静默发起 API 请求
    axios.get('/v2/like/list')
        .then(resp => {
            if (resp.data && resp.data.code === '000000' && Array.isArray(resp.data.data)) {
                const freshIds = resp.data.data.map(id => Number(id));
                const oldIds = cached && Array.isArray(cached.data) ? cached.data.map(id => Number(id)) : [];
                
                const isChanged = freshIds.length !== oldIds.length || JSON.stringify(freshIds) !== JSON.stringify(oldIds);
                if (isChanged || !cached) {
                    window.likedSongIdsSet = new Set(freshIds);
                    setApiCache('liked_song_ids', freshIds);
                    console.log(`[Like] 🔄 红心列表已后台平滑热更新: ${freshIds.length} 首`);
                    updateAllLikeButtonsUI();
                }
            }
        })
        .catch(err => {
            console.warn('[Like] 后台拉取红心列表失败 (使用本地离线缓存):', err);
        });
}

/**
 * 判断指定歌曲是否已添加红心
 */
function isSongLiked(songId) {
    if (!songId || !window.likedSongIdsSet) return false;
    return window.likedSongIdsSet.has(Number(songId));
}

/**
 * 切换红心状态（乐观更新 UI + 本地缓存同步 + 后台异步请求）
 */
function toggleLikeTrack(songId, songName) {
    if (!songId) {
        showToast("无可用歌曲 ID", "warning");
        return;
    }
    const numId = Number(songId);
    const wasLiked = window.likedSongIdsSet.has(numId);
    const willLike = !wasLiked;

    // 🚀 Step 1: 乐观更新内存 Set 与本地缓存
    if (willLike) {
        window.likedSongIdsSet.add(numId);
    } else {
        window.likedSongIdsSet.delete(numId);
    }
    setApiCache('liked_song_ids', Array.from(window.likedSongIdsSet));

    // 🎨 Step 2: 瞬间刷新全界面红心按钮 UI
    updateAllLikeButtonsUI(numId);

    const displayName = songName ? `《${songName}》` : '';
    if (willLike) {
        showToast(`❤️ 已将 ${displayName} 添加到我喜欢的音乐`, 'success', 2000);
    } else {
        showToast(`🤍 已将 ${displayName} 从我喜欢的音乐中移除`, 'info', 2000);
    }

    // 🌐 Step 3: 后台异步请求网易云 EAPI
    axios.post('/v2/like', new URLSearchParams({ id: numId, like: willLike }))
        .then(resp => {
            if (!resp.data || resp.data.code !== '000000') {
                throw new Error((resp.data && resp.data.msg) || "操作失败");
            }
        })
        .catch(err => {
            console.error('[Like] 同步红心失败，自动回滚:', err);
            // 回滚状态
            if (willLike) {
                window.likedSongIdsSet.delete(numId);
            } else {
                window.likedSongIdsSet.add(numId);
            }
            setApiCache('liked_song_ids', Array.from(window.likedSongIdsSet));
            updateAllLikeButtonsUI(numId);
            showToast(`⚠️ 红心同步失败：${err.message || err}`, 'error', 3000);
        });
}

/**
 * 🎨 生成标准精美矢量 SVG 红心图标 (兼容 Apple Music / Spotify 现代质感，彻底消除系统 Emoji 差异与白底)
 */
function getHeartSvgHtml(isLiked, size = 16) {
    if (isLiked) {
        return `<svg class="heart-icon filled" viewBox="0 0 24 24" width="${size}" height="${size}" fill="#ff3a3a" stroke="#ff3a3a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    } else {
        return `<svg class="heart-icon outline" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    }
}

/**
 * 刷新全界面红心按钮图标与样式（底栏、全屏黑胶、曲目列表）
 */
function updateAllLikeButtonsUI(targetSongId) {
    // 1. 刷新底栏播放器红心按钮
    const barBtn = document.getElementById('audioBarLikeBtn');
    const currentTrack = (typeof globalPlaylistQueue !== 'undefined' && typeof currentQueueIndex !== 'undefined' && currentQueueIndex >= 0) 
        ? globalPlaylistQueue[currentQueueIndex] 
        : null;

    if (barBtn && currentTrack && currentTrack.id) {
        const liked = isSongLiked(currentTrack.id);
        barBtn.innerHTML = getHeartSvgHtml(liked, 18);
        barBtn.className = 'ctrl-btn like-btn' + (liked ? ' active' : '');
        barBtn.title = liked ? '已喜欢 (点击取消红心)' : '喜欢 (点击添加红心)';
    }

    // 2. 刷新全屏黑胶播放器红心按钮
    const fullBtn = document.getElementById('fullscreenLikeBtn');
    if (fullBtn && currentTrack && currentTrack.id) {
        const liked = isSongLiked(currentTrack.id);
        fullBtn.innerHTML = getHeartSvgHtml(liked, 22);
        fullBtn.className = 'ctrl-btn sub-btn full-like-btn' + (liked ? ' active' : '');
        fullBtn.title = liked ? '已喜欢 (点击取消红心)' : '喜欢 (点击添加红心)';
    }

    // 3. 刷新列表与抽屉中的红心标记
    const listLikeBtns = document.querySelectorAll('.track-like-btn, .drawer-like-btn, .track-like-icon-btn');
    listLikeBtns.forEach(btn => {
        const sid = btn.getAttribute('data-song-id');
        if (sid && (!targetSongId || Number(sid) === Number(targetSongId))) {
            const liked = isSongLiked(sid);
            const isDrawer = btn.classList.contains('drawer-like-btn');
            btn.innerHTML = getHeartSvgHtml(liked, isDrawer ? 14 : 16);
            btn.classList.toggle('active', liked);
            btn.title = liked ? '已喜欢 (点击取消红心)' : '喜欢 (点击添加红心)';
        }
    });
}

window.getHeartSvgHtml = getHeartSvgHtml;
window.initLikedSongsCache = initLikedSongsCache;
window.isSongLiked = isSongLiked;
window.toggleLikeTrack = toggleLikeTrack;
window.updateAllLikeButtonsUI = updateAllLikeButtonsUI;

/**
 * ➕ 全局「添加到歌单」弹窗
 * @param {string|number} songId 歌曲 ID
 * @param {string} songName 歌名
 * @param {string} artistName 歌手
 */
async function showAddToPlaylistModal(songId, songName = '', artistName = '') {
    if (!songId) {
        showToast("歌曲 ID 缺失，无法添加到歌单", "error");
        return;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'app-modal-backdrop';

    const card = document.createElement('div');
    card.className = 'app-modal-card playlist-picker-modal';

    const cleanName = escapeHtml(songName || '未知歌曲');
    const cleanArtist = escapeHtml(artistName || '');

    card.innerHTML = `
        <div class="app-modal-header">
            <div style="display:flex; align-items:center; gap:8px;">
                <span>📂</span>
                <span>添加歌曲到歌单</span>
            </div>
            <button class="app-modal-close-btn" id="modalCloseBtn">✕</button>
        </div>
        <div class="app-modal-body" style="padding:14px 16px;">
            <div style="font-size:13px; color:var(--text-secondary); margin-bottom:12px; display:flex; align-items:center; gap:6px; background:var(--bg-glass-card); padding:8px 12px; border-radius:10px; border:1px solid var(--border-subtle);">
                <span style="font-size:16px;">🎵</span>
                <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <strong style="color:var(--text-main);">${cleanName}</strong>
                    ${cleanArtist ? `<span style="color:var(--text-muted); font-size:12px;"> - ${cleanArtist}</span>` : ''}
                </div>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:12px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">选择自建歌单</span>
                <button class="btn-primary" id="btnQuickCreatePl" style="margin:0; padding:4px 10px; font-size:11px; background:linear-gradient(135deg, #10b981, #059669); border-radius:12px; box-shadow:none;">➕ 新建歌单</button>
            </div>

            <div id="playlistPickerContainer" style="max-height:260px; overflow-y:auto; border-radius:12px; display:flex; flex-direction:column; gap:6px;">
                <div style="padding:24px 0; text-align:center; color:var(--text-muted); font-size:13px;">
                    <span style="display:inline-block; animation:spin 1s linear infinite; margin-right:6px;">🔄</span>正在读取我的歌单...
                </div>
            </div>
        </div>
        <div class="app-modal-footer">
            <button class="app-modal-btn app-modal-btn-cancel" id="modalCancelBtn" style="flex:1;">取消</button>
        </div>
    `;

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    const closeModal = () => {
        card.style.transform = 'scale(0.95)';
        card.style.opacity = '0';
        backdrop.style.opacity = '0';
        setTimeout(() => {
            if (backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
        }, 200);
    };

    const closeBtn = card.querySelector('#modalCloseBtn');
    const cancelBtn = card.querySelector('#modalCancelBtn');
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;
    backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };

    const quickCreateBtn = card.querySelector('#btnQuickCreatePl');
    if (quickCreateBtn) {
        quickCreateBtn.onclick = () => {
            closeModal();
            showCreatePlaylistModal((newPlId) => {
                showAddToPlaylistModal(songId, songName, artistName);
            });
        };
    }

    // 渲染歌单项列表
    const renderPickers = (playlists) => {
        const container = card.querySelector('#playlistPickerContainer');
        if (!container) return;
        
        // 过滤出用户创建的歌单
        const createdList = (playlists || []).filter(p => p.subscribed === false || p.subscribed === null || p.subscribed === undefined);
        
        if (createdList.length === 0) {
            container.innerHTML = `
                <div style="padding:30px 10px; text-align:center; color:var(--text-muted); font-size:13px;">
                    未找到创建的歌单，请先点击右上角「新建歌单」
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        createdList.forEach(pl => {
            const row = document.createElement('div');
            row.className = 'playlist-picker-item';
            const cover = pl.coverImgUrl ? pl.coverImgUrl : '/favicon.png';
            row.innerHTML = `
                <img src="${cover}" class="playlist-picker-cover" alt="封面">
                <div style="flex:1; min-width:0; overflow:hidden;">
                    <div class="playlist-picker-name">${escapeHtml(pl.name)}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${pl.trackCount || 0} 首歌曲</div>
                </div>
                <button class="playlist-picker-add-btn">➕ 加入</button>
            `;
            row.onclick = () => {
                row.style.pointerEvents = 'none';
                row.style.opacity = '0.6';
                const addBtn = row.querySelector('.playlist-picker-add-btn');
                if (addBtn) addBtn.textContent = '⏳ 添加中...';

                axios.post('/v2/playlist/tracks/add', new URLSearchParams({
                    playlistId: pl.id,
                    trackIds: String(songId)
                }))
                .then(resp => {
                    if (resp.data && resp.data.code === '000000') {
                        showToast(`已成功将《${cleanName}》添加到歌单「${pl.name}」`, 'success', 3500);
                        // 清理该歌单详情 SWR 缓存与我的歌单缓存
                        if (typeof deleteApiCache === 'function') {
                            deleteApiCache('playlist_' + pl.id);
                            deleteApiCache('my_playlists');
                        }
                        closeModal();
                    } else {
                        const errMsg = (resp.data && resp.data.msg) || '添加失败，歌曲可能已存在于该歌单中';
                        showToast(errMsg, 'warn');
                        row.style.pointerEvents = 'auto';
                        row.style.opacity = '1';
                        if (addBtn) addBtn.textContent = '➕ 加入';
                    }
                })
                .catch(err => {
                    showToast('添加失败：' + err, 'error');
                    row.style.pointerEvents = 'auto';
                    row.style.opacity = '1';
                    if (addBtn) addBtn.textContent = '➕ 加入';
                });
            };
            container.appendChild(row);
        });
    };

    // 先读 SWR 缓存秒开
    const cached = typeof getApiCache === 'function' ? getApiCache('my_playlists') : null;
    if (cached && cached.data && cached.data.playlists) {
        renderPickers(cached.data.playlists);
    }

    // 后台拉取最新
    axios.post('/MyPlaylist?limit=100')
        .then(resp => {
            const list = (resp.data && resp.data.data && resp.data.data.playlists) || [];
            if (typeof setApiCache === 'function') {
                setApiCache('my_playlists', resp.data.data);
            }
            renderPickers(list);
        })
        .catch(err => {
            if (!cached) {
                const container = card.querySelector('#playlistPickerContainer');
                if (container) {
                    container.innerHTML = `<div style="padding:20px; text-align:center; color:#ef4444; font-size:13px;">加载歌单失败，请确保已登录账号</div>`;
                }
            }
        });
}

/**
 * ➕ 全局「创建新歌单」弹窗
 * @param {Function} [onSuccess] 成功创建后的回调函数 (接收 newPlaylistId)
 */
function showCreatePlaylistModal(onSuccess = null) {
    const backdrop = document.createElement('div');
    backdrop.className = 'app-modal-backdrop';

    const card = document.createElement('div');
    card.className = 'app-modal-card';

    card.innerHTML = `
        <div class="app-modal-header">
            <div style="display:flex; align-items:center; gap:8px;">
                <span>✨</span>
                <span>创建新歌单</span>
            </div>
            <button class="app-modal-close-btn" id="createPlCloseBtn">✕</button>
        </div>
        <div class="app-modal-body" style="padding:16px;">
            <div style="margin-bottom:14px;">
                <label style="display:block; font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:6px;">歌单标题</label>
                <input type="text" id="newPlTitleInput" class="app-modal-input" placeholder="输入歌单名称 (例如: 我的心动精选)" maxlength="40" style="width:100%; box-sizing:border-box;">
            </div>
            
            <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-glass-card); padding:10px 14px; border-radius:12px; border:1px solid var(--border-subtle);">
                <div>
                    <div style="font-size:13px; font-weight:600; color:var(--text-main);">设置为私密歌单</div>
                    <div style="font-size:11px; color:var(--text-muted);">仅自己可见该歌单</div>
                </div>
                <label class="compact-switch-label" style="margin:0;">
                    <input type="checkbox" id="newPlPrivateSwitch">
                    <span>私密</span>
                </label>
            </div>
        </div>
        <div class="app-modal-footer">
            <button class="app-modal-btn app-modal-btn-cancel" id="createPlCancelBtn">取消</button>
            <button class="app-modal-btn app-modal-btn-confirm" id="createPlConfirmBtn">立即创建</button>
        </div>
    `;

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    const input = card.querySelector('#newPlTitleInput');
    if (input) setTimeout(() => input.focus(), 150);

    const closeModal = () => {
        card.style.transform = 'scale(0.95)';
        card.style.opacity = '0';
        backdrop.style.opacity = '0';
        setTimeout(() => {
            if (backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
        }, 200);
    };

    const closeBtn = card.querySelector('#createPlCloseBtn');
    const cancelBtn = card.querySelector('#createPlCancelBtn');
    const confirmBtn = card.querySelector('#createPlConfirmBtn');

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;
    backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };

    const handleCreate = () => {
        const title = (input ? input.value : '').trim();
        if (!title) {
            showToast("请输入歌单名称", "warning");
            if (input) input.focus();
            return;
        }

        const isPrivate = !!(card.querySelector('#newPlPrivateSwitch') && card.querySelector('#newPlPrivateSwitch').checked);

        confirmBtn.disabled = true;
        confirmBtn.textContent = "创建中...";

        axios.post('/v2/playlist/create', new URLSearchParams({
            name: title,
            isPrivate: String(isPrivate)
        }))
        .then(resp => {
            if (resp.data && resp.data.code === '000000') {
                showToast(`歌单「${title}」创建成功！`, 'success');
                if (typeof deleteApiCache === 'function') {
                    deleteApiCache('my_playlists');
                }
                if (typeof loadMyPlaylists === 'function') {
                    loadMyPlaylists('created');
                }
                closeModal();
                const newId = resp.data.data && resp.data.data.id;
                if (typeof onSuccess === 'function') {
                    onSuccess(newId);
                }
            } else {
                const errMsg = (resp.data && resp.data.msg) || '创建失败';
                showToast(errMsg, 'error');
                confirmBtn.disabled = false;
                confirmBtn.textContent = "立即创建";
            }
        })
        .catch(err => {
            showToast('创建歌单失败：' + err, 'error');
            confirmBtn.disabled = false;
            confirmBtn.textContent = "立即创建";
        });
    };

    if (confirmBtn) confirmBtn.onclick = handleCreate;
    if (input) {
        input.onkeyup = (e) => {
            if (e.key === 'Enter') handleCreate();
        };
    }
}

window.showAddToPlaylistModal = showAddToPlaylistModal;
window.showCreatePlaylistModal = showCreatePlaylistModal;

/**
 * 📱 移动端 / 桌面端通用暗黑毛玻璃 ActionSheet 菜单抽屉
 * @param {Object} options
 * @param {string} [options.title] 菜单标题
 * @param {string} [options.subtitle] 副标题
 * @param {string} [options.coverUrl] 可选封面图
 * @param {Array<{icon: string, text: string, subtext?: string, danger?: boolean, onClick: Function}>} options.items 操作项
 */
function showActionSheet(options = {}) {
    const { title = '', subtitle = '', coverUrl = '', items = [] } = options;
    if (!items || items.length === 0) return;

    // 移除已存在的 action sheet
    const existing = document.getElementById("globalActionSheetBackdrop");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "globalActionSheetBackdrop";
    backdrop.className = "action-sheet-backdrop";

    const sheet = document.createElement("div");
    sheet.className = "action-sheet-card";

    let headerHtml = '';
    if (title || subtitle || coverUrl) {
        headerHtml = `
            <div class="action-sheet-header">
                ${coverUrl ? `<img src="${coverUrl}" class="action-sheet-cover" alt="封面">` : ''}
                <div class="action-sheet-info">
                    ${title ? `<div class="action-sheet-title">${escapeHtml(title)}</div>` : ''}
                    ${subtitle ? `<div class="action-sheet-subtitle">${escapeHtml(subtitle)}</div>` : ''}
                </div>
                <button class="action-sheet-close-btn" id="actionSheetCloseX">✕</button>
            </div>
        `;
    }

    let itemsHtml = '';
    items.forEach((item, index) => {
        const dangerClass = item.danger ? ' danger' : '';
        itemsHtml += `
            <button class="action-sheet-item${dangerClass}" data-index="${index}">
                <span class="action-sheet-item-icon">${item.icon || '📌'}</span>
                <div class="action-sheet-item-content">
                    <span class="action-sheet-item-text">${item.text}</span>
                    ${item.subtext ? `<span class="action-sheet-item-sub">${item.subtext}</span>` : ''}
                </div>
            </button>
        `;
    });

    sheet.innerHTML = `
        <div class="action-sheet-handle-bar"></div>
        ${headerHtml}
        <div class="action-sheet-body">
            ${itemsHtml}
        </div>
        <div class="action-sheet-footer">
            <button class="action-sheet-cancel-btn" id="actionSheetCancelBtn">取消</button>
        </div>
    `;

    backdrop.appendChild(sheet);
    document.body.appendChild(backdrop);

    const closeSheet = () => {
        sheet.classList.add("action-sheet-closing");
        backdrop.classList.add("action-sheet-closing");
        setTimeout(() => {
            if (backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
        }, 220);
    };

    backdrop.onclick = (e) => {
        if (e.target === backdrop) closeSheet();
    };
    const closeBtn = sheet.querySelector("#actionSheetCancelBtn");
    if (closeBtn) closeBtn.onclick = closeSheet;
    const closeX = sheet.querySelector("#actionSheetCloseX");
    if (closeX) closeX.onclick = closeSheet;

    // 绑定 item 点击事件
    const btnElements = sheet.querySelectorAll(".action-sheet-item");
    btnElements.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute("data-index"), 10);
            const item = items[idx];
            closeSheet();
            if (item && typeof item.onClick === 'function') {
                item.onClick();
            }
        };
    });
}
window.showActionSheet = showActionSheet;

