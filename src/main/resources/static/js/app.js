/* ==========================================================================
   🎵 NetEase Music Downloader - App Core Engine (app.js)
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
            copyText = null
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
                ${copyText ? `
                    <div class="app-modal-path-box" id="modalPathBox">${escapeHtml(copyText)}</div>
                ` : ''}
            </div>
            <div class="app-modal-footer">
                ${copyText ? `
                    <button class="app-modal-btn app-modal-btn-copy" id="modalCopyBtn">📋 复制路径</button>
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

        if (closeBtn) closeBtn.onclick = () => closeModal(false);
        if (confirmBtn) confirmBtn.onclick = () => closeModal(true);
        if (cancelBtn) cancelBtn.onclick = () => closeModal(false);

        if (copyBtn && copyText) {
            copyBtn.onclick = () => {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(copyText)
                        .then(() => {
                            copyBtn.innerHTML = '✅ 已复制！';
                            showToast('📋 路径已成功复制到剪贴板！', 'success', 2000);
                            setTimeout(() => { copyBtn.innerHTML = '📋 复制路径'; }, 2500);
                        })
                        .catch(() => {
                            showToast('已复制（若未成功请长按选择）', 'info');
                        });
                }
            };
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

function showRevealModal(hostPath, containerPath, msg) {
    const targetPath = hostPath || containerPath;
    const isSuccess = msg && msg.includes('成功');
    const icon = isSuccess ? '🚀' : '📂';
    const statusHtml = msg ? `<div style="margin-bottom:8px; font-weight:600; color:${isSuccess ? '#4ade80' : '#38bdf8'};">${msg}</div>` : '';
    
    return showAppModal({
        title: '文件物理定位',
        icon: icon,
        content: `
            ${statusHtml}
            <div style="font-size:12.5px; color:var(--text-secondary);">文件已在磁盘就绪：</div>
            <div class="app-modal-tip">
                💡 <b>快速跳转提示</b>：在 Mac 桌面或 Finder 中按下快捷键 <code>Cmd + Shift + G</code>，直接粘贴即可秒级直达该音频文件！
            </div>
        `,
        copyText: targetPath,
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

function applyTheme(mode, persist = true) {
    if (!mode) mode = 'dark';
    if (persist) {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
    }
    
    let activeTheme = mode;
    if (mode === 'auto') {
        const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        activeTheme = isSystemDark ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', activeTheme);
    document.documentElement.setAttribute('data-theme-mode', mode);

    // 同步更新顶栏 theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', activeTheme === 'dark' ? '#0a0e1a' : '#f1f5f9');
    }

    // 更新按钮 UI
    updateThemeBtnUI(mode);
}

function updateThemeBtnUI(mode) {
    const iconEl = document.getElementById('themeIcon');
    const textEl = document.getElementById('themeText');
    const btn = document.getElementById('themeToggleBtn');
    if (!iconEl || !textEl) return;

    if (mode === 'dark') {
        iconEl.textContent = '🌙';
        textEl.textContent = '深色';
        if (btn) btn.title = '当前模式: 深色 (点击切换为 浅色)';
    } else if (mode === 'light') {
        iconEl.textContent = '☀️';
        textEl.textContent = '浅色';
        if (btn) btn.title = '当前模式: 浅色 (点击切换为 自动)';
    } else if (mode === 'auto') {
        iconEl.textContent = '💻';
        textEl.textContent = '自动';
        if (btn) btn.title = '当前模式: 跟随系统 (点击切换为 深色)';
    }
}

function toggleThemeMode() {
    const currentMode = getPreferredThemeMode();
    let nextMode = 'dark';
    if (currentMode === 'dark') {
        nextMode = 'light';
    } else if (currentMode === 'light') {
        nextMode = 'auto';
    } else {
        nextMode = 'dark';
    }
    applyTheme(nextMode);
    
    const labelMap = { 'dark': '🌙 已切换为深色模式', 'light': '☀️ 已切换为浅色模式', 'auto': '💻 已切换为跟随系统模式' };
    showToast(labelMap[nextMode], 'info', 2000);
}
window.toggleThemeMode = toggleThemeMode;
window.applyTheme = applyTheme;

let currentPage = 1;
let currentPlaylist = null;
let allTracks = [];
const pageSize = 10;
let searchPage = 1;

let monitorInterval = null;
let isMonitorMinimized = false;

document.addEventListener("DOMContentLoaded", () => {
    // 0. 初始化主题状态与系统监听
    applyTheme(getPreferredThemeMode(), false);
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            const currentMode = getPreferredThemeMode();
            if (currentMode === 'auto') {
                applyTheme('auto', false);
            }
        });
    }

    // 1. 初始化切换“重复下载”开关
    axios.get('/v2/getRepeat')
        .then(resp => {
            if (resp.data.code === "000000") {
                const switchEl = document.getElementById('repeatSwitch');
                if (switchEl) switchEl.checked = resp.data.data === true;
            }
        })
        .catch(err => console.error("获取 repeat 标志失败:", err));

    // 2. 绑定 Tab 导航切换
    const tabLinks = document.querySelectorAll(".nav-tab-btn, .tab-btn");
    tabLinks.forEach(button => {
        button.addEventListener("click", () => {
            const targetTabId = button.getAttribute("data-tab");
            const tabName = targetTabId.replace('tab-', '');
            switchTab(tabName);
        });
    });

    // 3. 读取 URL Hash 自动定位到指定 Tab
    const initialHash = location.hash ? location.hash.replace('#', '') : '';
    if (initialHash && document.getElementById('tab-' + initialHash)) {
        switchTab(initialHash, false);
    }

    // 4. 监听 URL Hash 变化
    window.addEventListener('hashchange', () => {
        const hash = location.hash ? location.hash.replace('#', '') : '';
        if (hash && document.getElementById('tab-' + hash)) {
            switchTab(hash, false);
        }
    });

    // 5. 注册 Service Worker (PWA 离线支持) 与申请永久存储配额
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('[PWA] ServiceWorker 注册成功, scope:', reg.scope))
            .catch(err => console.error('[PWA] ServiceWorker 注册失败:', err));
    }
    if ('storage' in navigator && 'persist' in navigator.storage) {
        navigator.storage.persist().then(persistent => {
            console.log('[Storage] 浏览器持久化存储状态:', persistent ? '✅ 已持久化 (Chrome不会自动清理)' : '⚠️ 临时配额 (系统存储紧张时可能被清理)');
        });
    }

    // 自动触发一次后台任务轮询（如果有未完成任务）
    fetchDownloadTasks();

    // 绑定在线播放器 timeupdate 事件实现全屏 LRC 逐行高亮平滑滚动
    const player = document.getElementById("globalAudioPlayer");
    if (player) {
        player.addEventListener("timeupdate", () => {
            if (!parsedLrcList || parsedLrcList.length === 0) return;
            const currentTime = player.currentTime;
            let activeIndex = -1;
            for (let i = 0; i < parsedLrcList.length; i++) {
                if (parsedLrcList[i].time <= currentTime) {
                    activeIndex = i;
                } else {
                    break;
                }
            }
            if (activeIndex !== -1 && activeIndex !== currentLrcIndex) {
                currentLrcIndex = activeIndex;
                updateLrcHighlight(activeIndex);
            }
        });
    }
});

function switchTab(tabName, updateHash = true) {
    if (tabName === 'album') {
        switchTab('search', updateHash);
        openAccordionCard('card-album-detail');
        return;
    }
    const targetTabId = 'tab-' + tabName;
    const tabLinks = document.querySelectorAll(".nav-tab-btn, .tab-btn");
    tabLinks.forEach(button => {
        if (button.getAttribute("data-tab") === targetTabId) {
            button.classList.add("active");
        } else {
            button.classList.remove("active");
        }
    });

    document.querySelectorAll(".tab-content").forEach(content => {
        content.style.display = (content.id === targetTabId) ? "block" : "none";
    });

    if (updateHash && location.hash !== '#' + tabName) {
        history.pushState(null, null, '#' + tabName);
    }

    if (tabName === 'download-mgr' && typeof loadDownloadHistory === 'function') {
        loadDownloadHistory(1);
        loadHistoryStats();
    }
}

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

/* ==========================================================================
   🔗 联动跳转逻辑 (Link Jump Helpers)
   ========================================================================== */

function jumpToPlaylistDetail(playlistId) {
    const input = document.getElementById("playlistId");
    if (input) input.value = playlistId;
    
    openAccordionCard("card-playlist-detail");
    if (typeof loadPlaylistDetail === 'function') loadPlaylistDetail();
}

function jumpToSongDetail(songId) {
    switchTab('playlist');

    const input = document.getElementById("songId");
    if (input) input.value = songId;
    
    openAccordionCard("card-song-detail");
    if (typeof loadSongInfo === 'function') loadSongInfo();
}

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
    const isChecked = repeatSwitch.checked;
    axios.get(`/v2/setRepeat?repeat=${isChecked}`)
        .then(resp => {
            if (resp.data.code === "000000") {
                console.log("设置 repeat 成功:", isChecked);
            }
        })
        .catch(err => console.error("设置 repeat 失败:", err));
}

/* ==========================================================================
   📥 悬浮卡片下载监视器 (Floating Download Monitor Widget)
   ========================================================================== */

function downloadSingle(id) {
    axios.get(`/v2/single?id=${id}`)
        .then(() => fetchDownloadTasks())
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
                    item.appendChild(badge);

                    if (task.status === 'SUCCESS' || task.status === 'SKIP') {
                        const revealBtn = document.createElement('button');
                        revealBtn.className = 'btn-icon';
                        revealBtn.style.cssText = 'margin-left:6px; font-size:12px; padding:2px 6px; background:rgba(255,255,255,0.75); border:1px solid #ccc; border-radius:4px; cursor:pointer; color:#333; white-space:nowrap; flex-shrink:0;';
                        revealBtn.title = '在 Finder / 资源管理器中高亮选中此文件';
                        revealBtn.textContent = '📂 定位';
                        revealBtn.onclick = (e) => {
                            e.stopPropagation();
                            if (typeof revealFile === 'function') revealFile(task.filePath || '', task.id);
                        };
                        item.appendChild(revealBtn);
                    }

                    listContainer.appendChild(item);
                });

                const activeCount = tasks.filter(t => t.status === 'DOWNLOADING' || t.status === 'PENDING').length;
                const titleText = activeCount > 0 ? `📥 下载中 (${activeCount})` : `📥 下载完成 (${tasks.length})`;
                document.getElementById('monitorHeaderTitle').textContent = titleText;

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

/* ==========================================================================
   🎧 现代暗黑极简三段式播放器控制与 LocalStorage 记忆引擎
   ========================================================================== */

const STORAGE_QUEUE_KEY = "wyyyy_player_queue";
const STORAGE_INDEX_KEY = "wyyyy_player_index";
const STORAGE_MODE_KEY = "wyyyy_player_mode";
const STORAGE_TIME_KEY = "wyyyy_player_time";
const STORAGE_AUTO_SKIP_KEY = "wyyyy_player_auto_skip_trial";
const STORAGE_OFFLINE_ONLY_KEY = "wyyyy_player_offline_only";

let currentPlayingLyric = "";
let parsedLrcList = [];
let currentLrcIndex = -1;
let isAudioPlayerMinimized = false;

/* 全局播放队列与模式控制 ENGINE */
let globalPlaylistQueue = [];
let currentQueueIndex = -1;
let playMode = 'loop'; // 'loop' (列表) | 'single' (单曲) | 'random' (随机)
let autoSkipTrial = localStorage.getItem(STORAGE_AUTO_SKIP_KEY) === 'true';
let offlineOnlyMode = localStorage.getItem(STORAGE_OFFLINE_ONLY_KEY) === 'true';
let drawerFilterType = 'all'; // 'all', 'ready', 'server', 'browser'
let drawerSearchQuery = '';
let lastCachedUrlsForDrawer = [];

function savePlayerStateToStorage() {
    try {
        localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(globalPlaylistQueue || []));
        localStorage.setItem(STORAGE_INDEX_KEY, currentQueueIndex.toString());
        localStorage.setItem(STORAGE_MODE_KEY, playMode || 'loop');
        const player = document.getElementById("globalAudioPlayer");
        if (player && !isNaN(player.currentTime)) {
            localStorage.setItem(STORAGE_TIME_KEY, player.currentTime.toString());
        }
    } catch (e) {
        console.error("保存播放状态失败:", e);
    }
}

function restorePlayerStateFromStorage() {
    try {
        const savedQueue = localStorage.getItem(STORAGE_QUEUE_KEY);
        const savedIndex = localStorage.getItem(STORAGE_INDEX_KEY);
        const savedMode = localStorage.getItem(STORAGE_MODE_KEY);
        const savedTime = localStorage.getItem(STORAGE_TIME_KEY);

        if (savedMode) {
            playMode = savedMode;
            updatePlayModeBtnUI();
        }

        if (savedQueue) {
            globalPlaylistQueue = JSON.parse(savedQueue) || [];
            updatePlaylistCountUI();
        }

        if (savedIndex !== null && savedIndex !== undefined && globalPlaylistQueue.length > 0) {
            const idx = parseInt(savedIndex, 10);
            if (!isNaN(idx) && idx >= 0 && idx < globalPlaylistQueue.length) {
                currentQueueIndex = idx;
                const track = globalPlaylistQueue[idx];
                const lastTime = parseFloat(savedTime) || 0;
                prepareTrackInUI(track, lastTime);
            }
        }
    } catch (e) {
        console.error("恢复播放状态失败:", e);
    }
}

function updatePlayModeBtnUI() {
    const btn = document.getElementById("playModeBtn");
    const fullBtn = document.getElementById("fullscreenPlayModeBtn");
    let icon = '🔁';
    let title = '当前模式: 列表循环';
    if (playMode === 'single') {
        icon = '🔂';
        title = '当前模式: 单曲循环';
    } else if (playMode === 'random') {
        icon = '🔀';
        title = '当前模式: 随机播放';
    }
    if (btn) {
        btn.innerHTML = icon;
        btn.title = title;
    }
    if (fullBtn) {
        fullBtn.innerHTML = icon;
        fullBtn.title = title;
    }
}

function prepareTrackInUI(track, seekTime) {
    if (!track) return;
    seekTime = seekTime || 0;
    const bar = document.getElementById("globalAudioBar");
    const player = document.getElementById("globalAudioPlayer");
    
    document.getElementById("audioBarTitle").textContent = track.name || "未知歌曲";
    document.getElementById("audioBarArtist").textContent = track.artist || "未知歌手";
    document.getElementById("audioBarCover").src = track.cover || "/favicon.png";

    if (bar) bar.style.display = "flex";

    axios.post('/Song_V1', new URLSearchParams({ id: track.id, level: 'lossless', type: 'json' }))
        .then(resp => {
            const song = resp.data.data;
            if (song && song.url && player) {
                player.src = song.url;
                
                updatePlayerBadges(song.url);

                currentPlayingLyric = song.lyric || "";
                parsedLrcList = parseLrc(currentPlayingLyric);
                renderPlaylistDrawer();
                
                if (seekTime > 0) {
                    player.currentTime = seekTime;
                }
            }
        })
        .catch(err => console.log("预载音频状态失败", err));
}

function setGlobalPlaylistQueue(queue, startIndex) {
    startIndex = startIndex || 0;
    if (!queue || queue.length === 0) return;
    globalPlaylistQueue = queue;
    updatePlaylistCountUI();
    playTrackInQueue(startIndex);
    // 预载下一首播放地址
    preloadNextSongAfter(startIndex);
}

function updatePlaylistCountUI() {
    const c1 = document.getElementById("playlistCount");
    const c2 = document.getElementById("playlistDrawerCount");
    const len = globalPlaylistQueue.length;
    if (c1) c1.textContent = len;
    if (c2) c2.textContent = len;
    renderPlaylistDrawer();
}

/**
 * 🚀 静默预载指定曲目的播放 URL (Pre-fetch / Pre-resolve Next Track)
 */
function preloadTrackStreamUrl(index) {
    if (!globalPlaylistQueue || globalPlaylistQueue.length === 0) return;
    if (index < 0 || index >= globalPlaylistQueue.length) return;
    const track = globalPlaylistQueue[index];
    if (!track || (track.resolvedUrl && Date.now() - (track.resolvedAt || 0) < 1200000)) return; // 20分钟内有效则跳过

    axios.post('/Song_V1', new URLSearchParams({ id: track.id, name: track.name || '', artist: track.artist || '', level: 'lossless', type: 'json' }))
        .then(resp => {
            if (resp.data && resp.data.data && resp.data.data.url) {
                track.resolvedUrl = resp.data.data.url;
                track.resolvedAt = Date.now(); // 记录解析时间戳
                track.lyric = resp.data.data.lyric || '';
                track.freeTrial = resp.data.data.freeTrial === true;
                track.freeTrialDuration = resp.data.data.freeTrialDuration;
                if (resp.data.data.isLocal === true || (resp.data.data.url && resp.data.data.url.includes('/v2/stream'))) {
                    track.isLocal = true;
                }
                renderPlaylistDrawer();
            }
        })
        .catch(() => {});
}

function preloadNextSongAfter(index) {
    if (!globalPlaylistQueue || globalPlaylistQueue.length === 0) return;
    let nextIdx = (index + 1) % globalPlaylistQueue.length;
    preloadTrackStreamUrl(nextIdx);
}

function playTrackInQueue(index) {
    if (index < 0 || index >= globalPlaylistQueue.length) return;
    currentQueueIndex = index;
    const track = globalPlaylistQueue[index];
    savePlayerStateToStorage();

    // 📴 纯离线模式：只播放本地/浏览器缓存曲目，遇到线上未缓存歌曲自动寻找下一首
    if (offlineOnlyMode) {
        const id = track.id || track.songId;
        const isServer = track.isLocal === true;
        const isBrowser = lastCachedUrlsForDrawer && lastCachedUrlsForDrawer.some(u => u.includes(`id=${id}`) || u.includes(`songId=${id}`));
        if (!isServer && !isBrowser) {
            showToast(`📴 纯离线模式：跳过未缓存曲目《${track.name}》`, "info", 1500);
            playNextTrackSync();
            return;
        }
    }

    // 优先纯同步播已经预载好且未过期（20分钟内有效）的链接
    const isResolved = track.resolvedUrl && Date.now() - (track.resolvedAt || 0) < 1200000;
    if (isResolved) {
        // 🛡️ 自动跳过试听
        if (autoSkipTrial && track.freeTrial) {
            showToast(`🛡️ 《${track.name}》为试听曲目，已根据设置自动跳过`, 'info', 1800);
            playNextTrackSync();
            return;
        }
        const cover = track.cover || '/favicon.png';
        playAudioOnline(track.resolvedUrl, track.name, track.artist, cover, track.lyric || '');
        if (track.freeTrial) {
            const durText = track.freeTrialDuration ? `（${track.freeTrialDuration}秒）` : '';
            showToast(`🎵 正在播放《${track.name}》试听版本${durText}`, 'info', 4000);
        }
        renderPlaylistDrawer();
        preloadNextSongAfter(currentQueueIndex);
        return;
    }
    
    axios.post('/Song_V1', new URLSearchParams({ id: track.id, name: track.name || '', artist: track.artist || '', level: 'lossless', type: 'json' }))
        .then(resp => {
            const song = resp.data.data;
            if (song && song.url) {
                track.resolvedUrl = song.url;
                track.resolvedAt = Date.now();
                track.lyric = song.lyric || '';
                track.freeTrial = song.freeTrial === true;
                track.freeTrialDuration = song.freeTrialDuration;
                const realPic = song.pic || song.picUrl || (song.al && song.al.picUrl);
                if (realPic) track.cover = realPic;
                const cover = track.cover || '/favicon.png';
                if (song.isLocal === true || (song.url && (song.url.includes('/v2/stream') || song.url.includes('/history/stream')))) {
                    track.isLocal = true;
                }

                // 🛡️ 自动跳过试听
                if (autoSkipTrial && track.freeTrial) {
                    showToast(`🛡️ 《${track.name || song.name}》为试听曲目，已根据设置自动跳过`, 'info', 1800);
                    playNextTrackSync();
                    return;
                }

                playAudioOnline(song.url, track.name || song.name, track.artist || song.ar_name, cover, song.lyric);
                if (song.freeTrial) {
                    const durText = song.freeTrialDuration ? `（${song.freeTrialDuration}秒）` : '';
                    showToast(`🎵 正在播放《${track.name || song.name}》试听版本${durText}`, 'info', 4000);
                }
                renderPlaylistDrawer();
                preloadNextSongAfter(currentQueueIndex);
            } else {
                const reason = (song && song.unplayableReason) ? song.unplayableReason : "获取播放地址失败";
                showToast(`无法播放《${track.name}》：${reason}`, 'warning', 4500);
                playNextTrack();
            }
        })
        .catch(err => {
            console.error("播放曲目失败:", err);
            showToast(`无法播放《${track.name}》：网络或解析异常`, 'warning');
            playNextTrack();
        });
}

/**
 * ⚡ iOS 锁屏纯同步无缝切歌引擎（消除异步网络请求延迟，防止 iOS 系统封锁后台 play）
 */
function playNextTrackSync() {
    if (globalPlaylistQueue.length === 0) return;
    let nextIdx;
    if (playMode === 'random') {
        nextIdx = Math.floor(Math.random() * globalPlaylistQueue.length);
        if (globalPlaylistQueue.length > 1 && nextIdx === currentQueueIndex) {
            nextIdx = (currentQueueIndex + 1) % globalPlaylistQueue.length;
        }
    } else {
        nextIdx = (currentQueueIndex + 1) % globalPlaylistQueue.length;
    }
    playTrackInQueue(nextIdx);
}

function playNextTrack() {
    playNextTrackSync();
}

function playPrevTrack() {
    if (globalPlaylistQueue.length === 0) return;
    let prevIdx;
    if (playMode === 'random') {
        prevIdx = Math.floor(Math.random() * globalPlaylistQueue.length);
    } else {
        prevIdx = (currentQueueIndex - 1 + globalPlaylistQueue.length) % globalPlaylistQueue.length;
    }
    playTrackInQueue(prevIdx);
}

function togglePlayMode() {
    if (playMode === 'loop') {
        playMode = 'single';
    } else if (playMode === 'single') {
        playMode = 'random';
    } else {
        playMode = 'loop';
    }
    updatePlayModeBtnUI();
    savePlayerStateToStorage();
}

function togglePlaylistDrawer() {
    const drawer = document.getElementById("playlistDrawer");
    if (drawer) {
        if (drawer.style.display === 'none' || !drawer.style.display) {
            drawer.style.display = 'flex';
            renderPlaylistDrawer();
            initDraggablePlaylistDrawer();
        } else {
            drawer.style.display = 'none';
        }
    }
}

const STORAGE_DRAWER_BOUNDS_KEY = "wyyyy_drawer_bounds";

function saveDrawerBoundsToStorage() {
    const drawer = document.getElementById("playlistDrawer");
    if (!drawer) return;
    try {
        const rect = drawer.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            const bounds = {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
            };
            localStorage.setItem(STORAGE_DRAWER_BOUNDS_KEY, JSON.stringify(bounds));
        }
    } catch (e) {
        console.warn("保存播放列表窗口位置尺寸失败:", e);
    }
}

function restoreDrawerBoundsFromStorage() {
    const drawer = document.getElementById("playlistDrawer");
    if (!drawer) return;
    try {
        const saved = localStorage.getItem(STORAGE_DRAWER_BOUNDS_KEY);
        if (!saved) return;
        const bounds = JSON.parse(saved);
        if (bounds && typeof bounds.left === 'number' && typeof bounds.top === 'number') {
            const minLeft = 10;
            const maxLeft = Math.max(10, window.innerWidth - (bounds.width || 320) - 10);
            const minTop = 10;
            const maxTop = Math.max(10, window.innerHeight - 60);

            const clampedLeft = Math.max(minLeft, Math.min(bounds.left, maxLeft));
            const clampedTop = Math.max(minTop, Math.min(bounds.top, maxTop));

            drawer.style.bottom = 'auto';
            drawer.style.right = 'auto';
            drawer.style.left = clampedLeft + 'px';
            drawer.style.top = clampedTop + 'px';

            if (bounds.width && bounds.width >= 280) {
                drawer.style.width = Math.min(bounds.width, window.innerWidth - 20) + 'px';
            }
            if (bounds.height && bounds.height >= 200) {
                drawer.style.height = Math.min(bounds.height, window.innerHeight - 80) + 'px';
            }
        }
    } catch (e) {
        console.warn("恢复播放列表窗口位置尺寸失败:", e);
    }
}

/**
 * 🖐️ 为播放列表 Drawer 绑定平滑拖拽移动与位置/尺寸 LocalStorage 记忆引擎
 */
function initDraggablePlaylistDrawer() {
    const drawer = document.getElementById("playlistDrawer");
    if (!drawer) return;

    // 恢复历史位置与尺寸
    restoreDrawerBoundsFromStorage();

    // 监听拖拽缩放并自动记忆尺寸
    if (window.ResizeObserver && !drawer._resizeObserved) {
        drawer._resizeObserved = true;
        let resizeTimer = null;
        const ro = new ResizeObserver(() => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                saveDrawerBoundsToStorage();
            }, 300);
        });
        ro.observe(drawer);
    }

    const header = drawer.querySelector(".playlist-drawer-header");
    if (!header || header._dragBound) return;
    header._dragBound = true;

    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    header.addEventListener('pointerdown', (e) => {
        // 排除按钮和输入框点击
        if (e.target.closest('button') || e.target.closest('input')) return;
        
        isDragging = true;
        try {
            header.setPointerCapture(e.pointerId);
        } catch (err) {}

        const rect = drawer.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        startX = e.clientX;
        startY = e.clientY;

        // 切换为基于 top/left 定位
        drawer.style.bottom = 'auto';
        drawer.style.right = 'auto';
        drawer.style.left = startLeft + 'px';
        drawer.style.top = startTop + 'px';
    });

    header.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newLeft = startLeft + deltaX;
        let newTop = startTop + deltaY;

        // 视口边界保护
        const minLeft = 10;
        const maxLeft = Math.max(10, window.innerWidth - drawer.offsetWidth - 10);
        const minTop = 10;
        const maxTop = Math.max(10, window.innerHeight - 60);

        newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
        newTop = Math.max(minTop, Math.min(newTop, maxTop));

        drawer.style.left = newLeft + 'px';
        drawer.style.top = newTop + 'px';
    });

    const stopDrag = (e) => {
        if (isDragging) {
            isDragging = false;
            try {
                if (e && e.pointerId !== undefined) {
                    header.releasePointerCapture(e.pointerId);
                }
            } catch (err) {}
            // 拖拽完成后持久化记录位置
            saveDrawerBoundsToStorage();
        }
    };

    header.addEventListener('pointerup', stopDrag);
    header.addEventListener('pointercancel', stopDrag);
}

function toggleAutoSkipTrial(checked) {
    autoSkipTrial = checked;
    localStorage.setItem(STORAGE_AUTO_SKIP_KEY, checked ? 'true' : 'false');
    showToast(checked ? "🛡️ 已开启自动跳过试听曲目" : "已关闭自动跳过试听", "info", 2000);
}

function toggleOfflineOnlyMode(checked) {
    offlineOnlyMode = checked;
    localStorage.setItem(STORAGE_OFFLINE_ONLY_KEY, checked ? 'true' : 'false');
    showToast(checked ? "📴 已开启纯离线模式 (仅播放本地/已缓存音频)" : "已退出纯离线模式", "info", 2000);
    renderPlaylistDrawer();
}

function setDrawerFilter(type) {
    drawerFilterType = type || 'all';
    document.querySelectorAll('.drawer-tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeTab = document.getElementById('tab-q-' + type);
    if (activeTab) activeTab.classList.add('active');
    renderPlaylistDrawer();
}

function onDrawerFilterChange() {
    const input = document.getElementById("drawerSearchInput");
    const clearBtn = document.getElementById("drawerSearchClear");
    drawerSearchQuery = input ? input.value.trim().toLowerCase() : '';
    if (clearBtn) clearBtn.style.display = drawerSearchQuery ? 'block' : 'none';
    renderPlaylistDrawer();
}

function clearDrawerSearch() {
    const input = document.getElementById("drawerSearchInput");
    const clearBtn = document.getElementById("drawerSearchClear");
    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    drawerSearchQuery = '';
    renderPlaylistDrawer();
}

function getFilteredDrawerQueue() {
    if (!globalPlaylistQueue || globalPlaylistQueue.length === 0) return [];
    return globalPlaylistQueue.filter(track => {
        const id = track.id || track.songId;
        const isServer = track.isLocal === true;
        const isBrowser = lastCachedUrlsForDrawer && lastCachedUrlsForDrawer.some(u => u.includes(`id=${id}`) || u.includes(`songId=${id}`));
        const isReady = isServer || isBrowser;

        if (drawerFilterType === 'ready' && !isReady) return false;
        if (drawerFilterType === 'server' && !isServer) return false;
        if (drawerFilterType === 'browser' && !isBrowser) return false;

        if (drawerSearchQuery) {
            const name = (track.name || '').toLowerCase();
            const artist = (track.artist || '').toLowerCase();
            if (!name.includes(drawerSearchQuery) && !artist.includes(drawerSearchQuery)) {
                return false;
            }
        }
        return true;
    });
}

async function applyQueueTrim() {
    if (!globalPlaylistQueue || globalPlaylistQueue.length === 0) {
        showToast("当前播放队列为空，无需裁剪", "warning");
        return;
    }
    
    const filteredTracks = getFilteredDrawerQueue();
    if (filteredTracks.length === 0) {
        showToast("当前筛选条件未匹配到任何歌曲", "warning");
        return;
    }
    
    if (filteredTracks.length === globalPlaylistQueue.length) {
        showToast("当前已是全部曲目，无需裁剪", "info");
        return;
    }

    const ok = await showConfirm(
        `确定将当前筛选出的 <b>${filteredTracks.length}</b> 首曲目保留为唯一播放列表吗？<br><span style="font-size:12px; color:var(--text-muted);">（其余 ${globalPlaylistQueue.length - filteredTracks.length} 首将被移出当前队列）</span>`,
        '裁剪播放列表',
        { icon: '✂️', confirmText: '确认保留' }
    );
    if (!ok) return;

    const currentPlayingTrack = globalPlaylistQueue[currentQueueIndex];
    globalPlaylistQueue = filteredTracks;
    
    if (currentPlayingTrack) {
        const newIdx = globalPlaylistQueue.findIndex(t => t.id === currentPlayingTrack.id);
        currentQueueIndex = newIdx >= 0 ? newIdx : 0;
    } else {
        currentQueueIndex = 0;
    }
    
    clearDrawerSearch();
    setDrawerFilter('all');
    updatePlaylistCountUI();
    savePlayerStateToStorage();
    renderPlaylistDrawer();
    showToast(`✂️ 裁剪完成，当前队列剩余 ${globalPlaylistQueue.length} 首`, "success");
}

function clearPlaylistQueue() {
    globalPlaylistQueue = [];
    currentQueueIndex = -1;
    updatePlaylistCountUI();
    savePlayerStateToStorage();
    const drawer = document.getElementById("playlistDrawer");
    if (drawer) drawer.style.display = 'none';
}

function removeFromPlaylistQueue(index, event) {
    if (event) event.stopPropagation();
    if (!globalPlaylistQueue || index < 0 || index >= globalPlaylistQueue.length) return;

    if (globalPlaylistQueue.length === 1) {
        clearPlaylistQueue();
        return;
    }

    const isCurrentPlaying = (index === currentQueueIndex);

    // 从队列中移除指定曲目
    globalPlaylistQueue.splice(index, 1);

    if (index < currentQueueIndex) {
        // 若删除的是当前播放曲目之前的项，索引减 1
        currentQueueIndex--;
    } else if (isCurrentPlaying) {
        // 若删除的是当前正在播放的曲目
        if (currentQueueIndex >= globalPlaylistQueue.length) {
            currentQueueIndex = 0;
        }
        // 自动播放新索引对应的曲目
        playTrackInQueue(currentQueueIndex);
        return;
    }

    updatePlaylistCountUI();
    savePlayerStateToStorage();
    renderPlaylistDrawer();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function updateDrawerCounts(all, ready, server, browser) {
    const elAll = document.getElementById("qCountAll");
    const elReady = document.getElementById("qCountReady");
    const elServer = document.getElementById("qCountServer");
    const elBrowser = document.getElementById("qCountBrowser");
    if (elAll) elAll.textContent = all;
    if (elReady) elReady.textContent = ready;
    if (elServer) elServer.textContent = server;
    if (elBrowser) elBrowser.textContent = browser;
}

async function renderPlaylistDrawer() {
    const list = document.getElementById("playlistDrawerList");
    if (!list) return;
    
    const countEl = document.getElementById("playlistDrawerCount");
    if (countEl) countEl.textContent = globalPlaylistQueue ? globalPlaylistQueue.length : 0;

    // 确保 switches 状态同步
    const chkTrial = document.getElementById("chkAutoSkipTrial");
    if (chkTrial) chkTrial.checked = autoSkipTrial;
    const chkOffline = document.getElementById("chkOfflineOnly");
    if (chkOffline) chkOffline.checked = offlineOnlyMode;

    if (!globalPlaylistQueue || globalPlaylistQueue.length === 0) {
        list.innerHTML = `<li style="padding: 24px; text-align: center; color: #94a3b8; font-size: 13px;">播放队列为空</li>`;
        updateDrawerCounts(0, 0, 0, 0);
        return;
    }

    // 异步查询浏览器缓存中的 URL
    const cachedUrls = await getAllCacheKeys();
    lastCachedUrlsForDrawer = cachedUrls;

    // 计算统计数据
    let countServer = 0;
    let countBrowser = 0;
    let countReady = 0;

    globalPlaylistQueue.forEach(track => {
        const id = track.id || track.songId;
        const isServer = track.isLocal === true;
        const isBrowser = cachedUrls.some(u => u.includes(`id=${id}`) || u.includes(`songId=${id}`));
        if (isServer) countServer++;
        if (isBrowser) countBrowser++;
        if (isServer || isBrowser) countReady++;
    });

    updateDrawerCounts(globalPlaylistQueue.length, countReady, countServer, countBrowser);

    // 过滤列表
    const filteredItems = [];
    globalPlaylistQueue.forEach((track, originalIndex) => {
        const id = track.id || track.songId;
        const isServer = track.isLocal === true;
        const isBrowser = cachedUrls.some(u => u.includes(`id=${id}`) || u.includes(`songId=${id}`));
        const isReady = isServer || isBrowser;

        if (drawerFilterType === 'ready' && !isReady) return;
        if (drawerFilterType === 'server' && !isServer) return;
        if (drawerFilterType === 'browser' && !isBrowser) return;

        if (drawerSearchQuery) {
            const name = (track.name || '').toLowerCase();
            const artist = (track.artist || '').toLowerCase();
            if (!name.includes(drawerSearchQuery) && !artist.includes(drawerSearchQuery)) {
                return;
            }
        }

        filteredItems.push({ track, originalIndex, isServer, isBrowser, isReady });
    });

    // 控制【✂️ 仅保留筛选曲目】按钮的显隐：只有在处于非全部筛选/搜索且筛选出部分曲目时才动态显示
    const trimBtn = document.getElementById("btnQueueTrim");
    const hasActiveFilter = (drawerFilterType !== 'all') || (drawerSearchQuery !== '');
    if (trimBtn) {
        if (hasActiveFilter && filteredItems.length > 0 && filteredItems.length < globalPlaylistQueue.length) {
            trimBtn.style.display = 'inline-flex';
            trimBtn.innerHTML = `✂️ 仅保留这 ${filteredItems.length} 首`;
        } else {
            trimBtn.style.display = 'none';
        }
    }

    list.innerHTML = "";
    if (filteredItems.length === 0) {
        list.innerHTML = `
            <li style="padding: 24px; text-align: center; color: #94a3b8; font-size: 13px;">
                未找到符合当前条件的曲目<br>
                <button class="drawer-header-btn" style="margin-top:8px;" onclick="clearDrawerSearch(); setDrawerFilter('all');">重置筛选</button>
            </li>
        `;
        return;
    }

    filteredItems.forEach(item => {
        const { track, originalIndex, isServer, isBrowser } = item;
        const li = document.createElement("li");
        const isCurrent = (originalIndex === currentQueueIndex);
        li.className = isCurrent ? "drawer-item active" : "drawer-item";
        li.onclick = () => playTrackInQueue(originalIndex);
        
        const trackTitle = escapeHtml(track.name || '未知歌曲');
        const trackArtist = escapeHtml(track.artist || '未知歌手');

        let badgeHtml = '';
        const trackIdSafe = track.id || track.songId || '';
        const trackNameSafe = (track.name || '').replace(/'/g, "\\'");
        const trackArtistSafe = (track.artist || '').replace(/'/g, "\\'");

        if (isServer && isBrowser) {
            badgeHtml = `<span class="status-badge status-both icon-only" title="✨ 服务器与本机浏览器均有缓存 (点击查看物理路径)" style="margin-left:4px; cursor:pointer;" onclick="handleStatusBadgeClick(event, '${trackIdSafe}', '${trackNameSafe}', '${trackArtistSafe}', true, true)">✨</span>`;
        } else if (isServer) {
            badgeHtml = `<span class="status-badge status-server icon-only" title="🖥️ 已在服务器磁盘 (点击查看物理路径)" style="margin-left:4px; cursor:pointer;" onclick="handleStatusBadgeClick(event, '${trackIdSafe}', '${trackNameSafe}', '${trackArtistSafe}', true, false)">🖥️</span>`;
        } else if (isBrowser) {
            badgeHtml = `<span class="status-badge status-browser icon-only" title="📲 已在当前设备浏览器缓存 (点击查看详情)" style="margin-left:4px; cursor:pointer;" onclick="handleStatusBadgeClick(event, '${trackIdSafe}', '${trackNameSafe}', '${trackArtistSafe}', false, true)">📲</span>`;
        }

        li.innerHTML = `
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:8px; display:flex; align-items:center;" title="${trackTitle} - ${trackArtist}">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${isCurrent ? '🎵 ' : ''}<strong>${originalIndex + 1}. ${trackTitle}</strong> - <span style="font-size:12px; color:#888;">${trackArtist}</span>
                </span>
                ${badgeHtml}
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                ${isCurrent ? '<span style="color:#22c55e; font-size:12px; font-weight:600;">播放中</span>' : ''}
                <button class="drawer-item-del-btn" onclick="removeFromPlaylistQueue(${originalIndex}, event)" title="从列表中移除">✕</button>
            </div>
        `;
        list.appendChild(li);
    });
}

function toggleMinimizeAudioPlayer() {
    const bar = document.getElementById("globalAudioBar");
    if (bar) {
        bar.classList.toggle("minimized");
    }
}

function closeAudioPlayer() {
    const bar = document.getElementById("globalAudioBar");
    const player = document.getElementById("globalAudioPlayer");
    if (player) {
        player.pause();
    }
    if (bar) {
        bar.style.display = "none";
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return (mins < 10 ? "0" + mins : mins) + ":" + (secs < 10 ? "0" + secs : secs);
}

function togglePlayPause() {
    const player = document.getElementById("globalAudioPlayer");
    const btn = document.getElementById("audioPlayPauseBtn");
    const cover = document.getElementById("audioBarCover");

    if (!player || !player.src) return;

    if (player.paused) {
        player.play();
        if (btn) btn.innerHTML = "⏸";
        if (cover) cover.classList.add("playing");
    } else {
        player.pause();
        if (btn) btn.innerHTML = "▶";
        if (cover) cover.classList.remove("playing");
        if (fullBtn) fullBtn.innerHTML = "▶";
        if (fullCover) fullCover.classList.remove("playing");
    }
}

function seekAudio(e) {
    const player = document.getElementById("globalAudioPlayer");
    const wrapper = document.getElementById("progressBarWrapper");
    if (!player || !player.duration || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    
    player.currentTime = percentage * player.duration;
    savePlayerStateToStorage();
}

function changeVolume(val) {
    const player = document.getElementById("globalAudioPlayer");
    const icon = document.getElementById("volIcon");
    if (player) {
        player.volume = val;
        player.muted = false;
    }
    if (icon) {
        icon.textContent = val == 0 ? "🔇" : (val < 0.5 ? "🔉" : "🔊");
    }
}

function toggleMute() {
    const player = document.getElementById("globalAudioPlayer");
    const icon = document.getElementById("volIcon");
    const slider = document.getElementById("volumeSlider");
    if (!player) return;

    player.muted = !player.muted;
    if (icon) {
        icon.textContent = player.muted ? "🔇" : (player.volume < 0.5 ? "🔉" : "🔊");
    }
    if (slider) {
        slider.value = player.muted ? 0 : player.volume;
    }
}

function playAudioOnline(url, name, artist, cover, lyric, album) {
    if (!url) {
        showToast("暂无直接播放链接，请切换音质重试或点击下载", "warning");
        return;
    }
    const bar = document.getElementById("globalAudioBar");
    const player = document.getElementById("globalAudioPlayer");
    const playBtn = document.getElementById("audioPlayPauseBtn");
    const coverImg = document.getElementById("audioBarCover");
    
    const fullTitle = document.getElementById("fullscreenTitle");
    const fullArtist = document.getElementById("fullscreenArtist");
    const fullCover = document.getElementById("fullscreenVinylCover");
    const fullPlayBtn = document.getElementById("fullscreenPlayPauseBtn");

    const fill = document.getElementById("progressBarFill");
    const handle = document.getElementById("progressBarHandle");
    const curTime = document.getElementById("audioCurrentTime");
    
    if (bar && player) {
        const titleText = name || "未知歌曲";
        const artistText = artist || "未知歌手";
        const coverSrc = cover && cover !== '/favicon.png' ? cover : '/favicon.png';

        document.getElementById("audioBarTitle").textContent = titleText;
        document.getElementById("audioBarArtist").textContent = artistText;
        if (fullTitle) fullTitle.textContent = titleText;
        if (fullArtist) fullArtist.textContent = artistText;

        if (coverImg) {
            coverImg.src = coverSrc;
            coverImg.classList.add("playing");
        }
        if (fullCover) {
            fullCover.src = coverSrc;
            fullCover.classList.add("playing");
        }
        
        updatePlayerBadges(url);

        if (url && name && typeof saveCachedTrackMeta === 'function') {
            saveCachedTrackMeta(url, {
                songName: titleText,
                artist: artistText,
                cover: coverSrc,
                album: album || ''
            });
        }

        currentPlayingLyric = lyric || "";
        parsedLrcList = parseLrc(currentPlayingLyric);
        currentLrcIndex = -1;

        // 🎯 核心修复：强制切歌从 0 秒开始播放，并重置进度条 UI
        if (fill) fill.style.width = "0%";
        if (handle) handle.style.left = "0%";
        if (curTime) curTime.textContent = "00:00";

        player.src = url;
        player.currentTime = 0;
        bar.style.display = "flex";
        if (playBtn) playBtn.innerHTML = "⏸";
        if (fullPlayBtn) fullPlayBtn.innerHTML = "⏸";

        const playPromise = player.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                player.currentTime = 0;
            }).catch(e => {
                console.warn("自动播放受阻或中断:", e);
                if (playBtn) playBtn.innerHTML = "▶";
                if (fullPlayBtn) fullPlayBtn.innerHTML = "▶";
            });
        }
        savePlayerStateToStorage();

        // 📱 绑定原生 Media Session API（实现 iOS/Android 锁屏界面遥控、显示封面与连续后台切歌）
        updateMediaSessionMetadata(name, artist, cover, album);
    }
}

/**
 * 📱 硬件级 Media Session 锁屏组件更新函数
 */
function updateMediaSessionMetadata(name, artist, cover, album) {
    if (!('mediaSession' in navigator)) return;
    try {
        const coverUrl = cover || '/favicon.png';
        navigator.mediaSession.metadata = new MediaMetadata({
            title: name || '网易云音乐',
            artist: artist || '未知歌手',
            album: album || '网易云下载器',
            artwork: [
                { src: coverUrl, sizes: '96x96', type: 'image/png' },
                { src: coverUrl, sizes: '128x128', type: 'image/png' },
                { src: coverUrl, sizes: '192x192', type: 'image/png' },
                { src: coverUrl, sizes: '256x256', type: 'image/png' },
                { src: coverUrl, sizes: '512x512', type: 'image/png' }
            ]
        });
        
        // 绑定 iOS / Android 锁屏与耳机遥控系统事件
        navigator.mediaSession.setActionHandler('play', () => {
            const player = document.getElementById("globalAudioPlayer");
            if (player) player.play();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            const player = document.getElementById("globalAudioPlayer");
            if (player) player.pause();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrevTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrack());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            const player = document.getElementById("globalAudioPlayer");
            if (player && details.seekTime !== undefined) {
                player.currentTime = details.seekTime;
            }
        });
    } catch (e) {
        console.warn("[MediaSession] 注册锁屏元数据失败:", e);
    }
}

function playOnline(songId, name, artist) {
    playSongById(songId, name, artist);
}

function playSongById(songId, name, artist) {
    // 智能定位或更新全局队列
    if (typeof allTracks !== 'undefined' && Array.isArray(allTracks) && allTracks.length > 0) {
        const foundIdx = allTracks.findIndex(t => String(t.id) === String(songId));
        if (foundIdx >= 0) {
            globalPlaylistQueue = allTracks.map(t => ({
                id: t.id,
                name: t.name,
                artist: typeof getValidArtistNames === 'function' ? getValidArtistNames(t) : t.artist,
                cover: (t.al && t.al.picUrl) ? t.al.picUrl : '/favicon.png',
                isLocal: (t.isLocal === true)
            }));
            currentQueueIndex = foundIdx;
            updatePlaylistCountUI();
        }
    } else if (typeof currentAlbumSongs !== 'undefined' && Array.isArray(currentAlbumSongs) && currentAlbumSongs.length > 0) {
        const foundIdx = currentAlbumSongs.findIndex(t => String(t.id) === String(songId));
        if (foundIdx >= 0) {
            globalPlaylistQueue = currentAlbumSongs.map(t => ({
                id: t.id,
                name: t.name,
                artist: typeof getValidArtistNames === 'function' ? getValidArtistNames(t) : t.artist,
                cover: (t.al && t.al.picUrl) ? t.al.picUrl : (typeof currentAlbumCover !== 'undefined' ? currentAlbumCover : '/favicon.png'),
                isLocal: (t.isLocal === true)
            }));
            currentQueueIndex = foundIdx;
            updatePlaylistCountUI();
        }
    } else if (globalPlaylistQueue.length === 0) {
        globalPlaylistQueue = [{ id: songId, name: name, artist: artist, cover: '/favicon.png' }];
        currentQueueIndex = 0;
        updatePlaylistCountUI();
    }

    axios.post('/Song_V1', new URLSearchParams({ id: songId, name: name || '', artist: artist || '', level: 'lossless', type: 'json' }))
        .then(resp => {
            const song = resp.data.data;
            if (song && song.url) {
                playAudioOnline(song.url, name || song.name, artist || song.ar_name, song.pic, song.lyric, song.al_name);
                if (song.freeTrial) {
                    const durText = song.freeTrialDuration ? `（${song.freeTrialDuration}秒）` : '';
                    showToast(`🎵 正在播放《${name || song.name}》试听版本${durText}`, 'info', 4000);
                }
            } else {
                const reason = (song && song.unplayableReason) ? song.unplayableReason : "获取播放地址失败";
                showToast(`无法播放《${name || (song ? song.name : '当前歌曲')}》：${reason}`, 'warning', 4500);
            }
        })
        .catch(err => showToast(`播放获取失败：${err}`, 'warning'));
}

document.addEventListener("DOMContentLoaded", function() {
    const player = document.getElementById("globalAudioPlayer");
    const fill = document.getElementById("progressBarFill");
    const handle = document.getElementById("progressBarHandle");
    const curTime = document.getElementById("audioCurrentTime");
    const totTime = document.getElementById("audioTotalTime");
    const playBtn = document.getElementById("audioPlayPauseBtn");
    const coverImg = document.getElementById("audioBarCover");

    // 尝试恢复 LocalStorage 记忆
    restorePlayerStateFromStorage();

    // 初始化播放列表窗口拖拽移动能力
    initDraggablePlaylistDrawer();

    if (player) {
        player.onerror = function() {
            if (player.src && player.src !== window.location.href && player.src !== 'about:blank') {
                const track = globalPlaylistQueue[currentQueueIndex];
                const songTitle = track ? track.name : (document.getElementById("audioBarTitle") ? document.getElementById("audioBarTitle").textContent : '音频');
                showToast(`《${songTitle}》音频加载异常，尝试播放下一首`, 'warning');
                playNextTrack();
            }
        };

        player.onplay = function() {
            if (playBtn) playBtn.innerHTML = "⏸";
            if (coverImg) coverImg.classList.add("playing");
        };

        player.onpause = function() {
            if (playBtn) playBtn.innerHTML = "▶";
            if (coverImg) coverImg.classList.remove("playing");
            savePlayerStateToStorage();
        };

        player.onloadedmetadata = function() {
            if (totTime) totTime.textContent = formatTime(player.duration);
        };

        player.ontimeupdate = function() {
            if (!player.duration) return;
            const current = player.currentTime;
            const duration = player.duration;
            const percentage = (current / duration) * 100;

            if (fill) fill.style.width = percentage + "%";
            if (handle) handle.style.left = percentage + "%";
            if (curTime) curTime.textContent = formatTime(current);

            // 歌词同步滚动
            if (parsedLrcList && parsedLrcList.length > 0) {
                let activeIdx = -1;
                for (let i = 0; i < parsedLrcList.length; i++) {
                    if (current >= parsedLrcList[i].time) {
                        activeIdx = i;
                    } else {
                        break;
                    }
                }
                if (activeIdx !== currentLrcIndex) {
                    currentLrcIndex = activeIdx;
                    updateLrcHighlight(currentLrcIndex);
                }
            }
        };

        player.onended = function() {
            if (playMode === 'single') {
                player.currentTime = 0;
                player.play().catch(e => console.warn('单曲循环 play failed:', e));
            } else {
                // ⚡ 纯同步切歌：绝不在此处发起任何异步网络请求，防止 iOS 锁屏检测到"无音频空白期"而封锁后台播放
                playNextTrackSync();
            }
        };
    }
});

function parseLrc(lrcText) {
    if (!lrcText) return [];
    const lines = lrcText.split(/\r?\n/);
    const result = [];
    const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    
    lines.forEach(line => {
        const matches = timeReg.exec(line);
        if (matches) {
            const min = parseInt(matches[1], 10);
            const sec = parseInt(matches[2], 10);
            const ms = parseInt(matches[3], 10);
            const time = min * 60 + sec + (ms > 99 ? ms / 1000 : ms / 100);
            const text = line.replace(timeReg, '').trim();
            if (text) {
                result.push({ time, text });
            }
        }
    });
    return result;
}

function updateLrcHighlight(index) {
    const modalContent = document.getElementById("lyricModalContent");
    if (!modalContent) return;

    const lines = modalContent.querySelectorAll(".lrc-line");
    lines.forEach((line, idx) => {
        if (idx === index) {
            line.classList.add("active");
            line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            line.classList.remove("active");
        }
    });
}

function openLyricModal() {
    const modal = document.getElementById("lyricModal");
    const content = document.getElementById("lyricModalContent");
    
    const playerTitle = document.getElementById("audioBarTitle").textContent;
    const playerArtist = document.getElementById("audioBarArtist").textContent;
    const coverSrc = document.getElementById("audioBarCover").src;
    const sourceBadge = document.getElementById("audioSourceBadge");

    const fullTitle = document.getElementById("fullscreenTitle");
    const fullArtist = document.getElementById("fullscreenArtist");
    const fullCover = document.getElementById("fullscreenVinylCover");
    const fullBadge = document.getElementById("fullscreenBadge");

    if (fullTitle) fullTitle.textContent = playerTitle || "未在播放";
    if (fullArtist) fullArtist.textContent = playerArtist || "未知歌手";
    if (fullCover) {
        fullCover.src = coverSrc || "/favicon.png";
        const player = document.getElementById("globalAudioPlayer");
        if (player && !player.paused) {
            fullCover.classList.add("playing");
        } else {
            fullCover.classList.remove("playing");
        }
    }
    if (fullBadge && sourceBadge) {
        fullBadge.className = sourceBadge.className;
        fullBadge.innerHTML = sourceBadge.innerHTML;
        fullBadge.title = sourceBadge.title;
        fullBadge.style.display = sourceBadge.style.display;
    }

    updatePlayModeBtnUI();

    if (modal && content) {
        parsedLrcList = parseLrc(currentPlayingLyric);
        content.innerHTML = "";

        const validTimeLrcs = parsedLrcList.filter(item => item.time >= 0);

        if (validTimeLrcs && validTimeLrcs.length > 0) {
            validTimeLrcs.forEach((item, idx) => {
                const div = document.createElement("div");
                div.className = "lrc-line" + (idx === currentLrcIndex ? " active" : "");
                div.textContent = item.text;
                div.onclick = () => {
                    const player = document.getElementById("globalAudioPlayer");
                    if (player) {
                        player.currentTime = item.time;
                    }
                };
                content.appendChild(div);
            });
        } else {
            const lines = (currentPlayingLyric || "暂无歌词").split(/\r?\n/);
            lines.forEach(lineStr => {
                if (lineStr.trim()) {
                    const p = document.createElement("p");
                    p.className = "lrc-fallback";
                    p.textContent = lineStr;
                    content.appendChild(p);
                }
            });
        }

        modal.style.display = "flex";
    }
}

function closeLyricModal() {
    const modal = document.getElementById("lyricModal");
    if (modal) modal.style.display = "none";
}

/* ==========================================================================
   📱 📱 手机端 Cache API 离线预取引擎 (Mobile PWA Cache Engine)
   ========================================================================== */

const PWA_CACHE_NAME = 'netease-music-audio-v1';

/**
 * 🎯 静默解构音频 Blob 的真实播放时长 (Duration) 秒数
 */
function getAudioBlobDuration(blob) {
    return new Promise((resolve) => {
        if (!blob) return resolve(0);
        try {
            const audio = new Audio();
            const url = URL.createObjectURL(blob);
            audio.src = url;
            audio.onloadedmetadata = () => {
                const duration = audio.duration;
                URL.revokeObjectURL(url);
                resolve(duration || 0);
            };
            audio.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(0);
            };
            // 超时保险：1 秒未解构出元数据则回退
            setTimeout(() => {
                URL.revokeObjectURL(url);
                resolve(audio.duration || 0);
            }, 1000);
        } catch (e) {
            resolve(0);
        }
    });
}

/**
 * 检查单个音频 URL 或曲目 ID 是否已存储在客户端 Cache API
 */
async function isUrlInCache(url) {
    if (!('caches' in window) || !url) return false;
    try {
        const cache = await caches.open(PWA_CACHE_NAME);
        const match = await cache.match(url);
        return !!match;
    } catch (e) {
        return false;
    }
}

/**
 * 批量获取曲目列表中在 Cache API 中已缓存的曲目数
 */
async function countCachedTracks(tracks) {
    if (!tracks || tracks.length === 0 || !('caches' in window)) return 0;
    let count = 0;
    try {
        const cache = await caches.open(PWA_CACHE_NAME);
        const keys = await cache.keys();
        const cachedUrls = keys.map(req => req.url);

        for (const track of tracks) {
            const id = track.id || track.songId;
            if (!id) continue;
            // 检查 Cache API 是否匹配该 id 的 stream 地址或被存入的缓存 key
            const isMatch = cachedUrls.some(url => url.includes(`id=${id}`) || url.includes(`songId=${id}`));
            if (isMatch) count++;
        }
    } catch (e) {
        console.warn("[PWA] 统计已缓存数失败:", e);
    }
    return count;
}

/**
 * 刷新某个「📲 缓存到浏览器」按钮的缓存计数状态
 */
async function refreshPhoneCacheBtn(tracks, btnId, baseText = '📲 缓存到浏览器') {
    const btn = document.getElementById(btnId);
    if (!btn || !tracks || tracks.length === 0) return;
    const total = tracks.length;
    const cached = await countCachedTracks(tracks);
    btn.textContent = `${baseText} (${cached}/${total})`;
    if (cached === total && total > 0) {
        btn.style.background = '#0284c7'; // 亮青蓝色表示全量已缓
    }
}

const PWA_TRACK_META_KEY = 'pwa_cached_tracks_meta_v1';

/**
 * 📱 获取已存储在本地的缓存曲目元数据映射
 */
function getCachedTrackMetaMap() {
    try {
        return JSON.parse(localStorage.getItem(PWA_TRACK_META_KEY) || '{}');
    } catch(e) {
        return {};
    }
}

/**
 * 📱 保存单首歌曲的离线缓存元数据
 */
function saveCachedTrackMeta(url, meta) {
    if (!url || !meta) return;
    try {
        const map = getCachedTrackMetaMap();
        const cleanUrl = url.replace(window.location.origin, '');
        map[cleanUrl] = { ...(map[cleanUrl] || {}), ...meta, updatedAt: Date.now() };
        localStorage.setItem(PWA_TRACK_META_KEY, JSON.stringify(map));
    } catch(e) {
        console.warn("[PWA] 保存歌曲缓存元数据失败", e);
    }
}

/**
 * 📱 删除单首歌曲的离线缓存元数据
 */
function removeCachedTrackMeta(url) {
    if (!url) return;
    try {
        const map = getCachedTrackMetaMap();
        const cleanUrl = url.replace(window.location.origin, '');
        delete map[cleanUrl];
        delete map[url];
        localStorage.setItem(PWA_TRACK_META_KEY, JSON.stringify(map));
    } catch(e) {}
}

/**
 * 📱 智能双轨预取引擎：支持后端落盘与手机 Cache API 写入
 */
async function cacheTracksToPhoneBatch(tracks, btnId, baseText = '📲 缓存到浏览器') {
    const btn = document.getElementById(btnId);
    if (!('caches' in window)) {
        showToast("当前浏览器不支持 Cache API 或未以 HTTPS/PWA 模式运行", "warning");
        return;
    }
    if (!tracks || tracks.length === 0) {
        showToast("暂无要缓存的曲目", "warning");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.75';
    }

    let cachedCount = await countCachedTracks(tracks);
    const total = tracks.length;

    try {
        const cache = await caches.open(PWA_CACHE_NAME);
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const id = track.id || track.songId;
            if (!id) continue;

            if (btn) btn.textContent = `⏳ 正在解析 (${i + 1}/${total})...`;

            try {
                // 1. 调用 /Song_V1 获取后端本地无损流或网易云线上音频 URL
                const resp = await axios.post('/Song_V1', new URLSearchParams({ id: id, level: 'lossless', type: 'json' }));
                let audioUrl = resp.data && resp.data.data ? resp.data.data.url : null;
                const songData = resp.data && resp.data.data ? resp.data.data : {};

                // 2. 如果后端本地尚无物理文件且也未解析出 URL，主动触发服务端下载落盘
                if (!audioUrl) {
                    if (btn) btn.textContent = `⚡ 触发服务器落盘 (${i + 1}/${total})...`;
                    await axios.get(`/v2/single?id=${id}`).catch(() => {});
                    // 重试获取流
                    const retryResp = await axios.post('/Song_V1', new URLSearchParams({ id: id, level: 'lossless', type: 'json' }));
                    audioUrl = retryResp.data && retryResp.data.data ? retryResp.data.data.url : null;
                }

                if (audioUrl) {
                    const isCached = await isUrlInCache(audioUrl);
                    if (!isCached) {
                        if (btn) btn.textContent = `📥 正在校验与下载 (${i + 1}/${total})...`;
                        const streamResp = await fetch(audioUrl);
                        if (streamResp.ok) {
                            const blob = await streamResp.blob();
                            
                            // 🎯 核心精准过滤：双校验（文件大小 < 1.2MB 或 播放时长 < 45秒 均视为 30s VIP 试听片段，拦截不存手机 Cache）
                            const duration = await getAudioBlobDuration(blob);
                            if (blob.size < 1250000 || (duration > 0 && duration < 45)) {
                                console.warn(`[PWA Filter] 🚫 自动跳过 30s 试听片段 songId:${id}, 大小:${Math.round(blob.size / 1024)}KB, 时长:${Math.round(duration)}秒`);
                                if (btn) btn.textContent = `⚠️ 已跳过 30s 试听 (${i + 1}/${total})...`;
                                continue;
                            }

                            const validResponse = new Response(blob, {
                                status: streamResp.status,
                                statusText: streamResp.statusText,
                                headers: streamResp.headers
                            });
                            await cache.put(audioUrl, validResponse);
                            
                            const sName = songData.name || track.name || '未知歌曲';
                            const sArtist = songData.ar_name || (typeof getValidArtistNames === 'function' ? getValidArtistNames(track) : track.artist) || '未知歌手';
                            const sCover = songData.al_pic_url || track.cover || '/favicon.png';
                            const sAlbum = songData.al_name || track.album || '';

                            const trackMeta = {
                                id: id,
                                songName: sName,
                                artist: sArtist,
                                cover: sCover,
                                album: sAlbum,
                                fileSize: blob.size,
                                duration: duration
                            };
                            saveCachedTrackMeta(audioUrl, trackMeta);

                            // 同时关联一个别名键方便匹配 (注意避免 id=0 冲突)
                            if (id && String(id) !== '0') {
                                const aliasUrl = `/v2/stream?id=${id}`;
                                if (audioUrl !== aliasUrl) {
                                    const aliasResponse = new Response(blob, {
                                        status: streamResp.status,
                                        statusText: streamResp.statusText,
                                        headers: streamResp.headers
                                    });
                                    await cache.put(aliasUrl, aliasResponse);
                                    saveCachedTrackMeta(aliasUrl, trackMeta);
                                }
                            }
                            cachedCount++;
                        }
                    }
                }
            } catch (err) {
                console.warn(`[PWA] 预取失败 songId:${id}`, err);
            }

            if (btn) btn.textContent = `${baseText} (${cachedCount}/${total})`;
        }
    } catch (e) {
        console.error("[PWA] 批量缓存操作异常:", e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.textContent = `${baseText} (${cachedCount}/${total})`;
            if (cachedCount === total && total > 0) {
                btn.style.background = '#0284c7';
            }
        }
    }
}


function closeLyricModal() {
    const modal = document.getElementById("lyricModal");
    if (modal) {
        modal.style.display = "none";
    }
}

/**
 * 异步更新播放器底部及全屏界面的缓存状态 Badge
 */
async function updatePlayerBadges(url) {
    const sourceBadge = document.getElementById("audioSourceBadge");
    const fullBadge = document.getElementById("fullscreenBadge");
    
    if (!sourceBadge) return;
    
    const isServer = url && (url.includes("/v2/stream") || url.includes("/v2/history/stream") || url.includes("/history/stream"));
    const isBrowser = await isUrlInCache(url);
    
    let className = "audio-source-badge icon-only";
    let icon = "";
    let title = "";
    
    if (isServer && isBrowser) {
        className += " badge-both";
        icon = "✨";
        title = "✨ 服务器与本机浏览器均有缓存";
    } else if (isServer) {
        className += " badge-server";
        icon = "🖥️";
        title = "🖥️ 已存在服务器磁盘";
    } else if (isBrowser) {
        className += " badge-browser";
        icon = "📲";
        title = "📲 已缓存于当前设备浏览器";
    } else {
        className += " badge-online";
        icon = "🌐";
        title = "🌐 当前通过网络流式获取";
    }
    
    sourceBadge.className = className;
    sourceBadge.innerHTML = icon;
    sourceBadge.title = title;
    sourceBadge.style.display = "inline-flex";
    
    if (fullBadge) {
        fullBadge.className = className;
        fullBadge.innerHTML = icon;
        fullBadge.title = title;
        fullBadge.style.display = "inline-flex";
    }
}

/**
 * 获取所有已缓存的 URL 列表
 */
async function getAllCacheKeys() {
    if (!('caches' in window)) return [];
    try {
        const cacheNames = await caches.keys();
        let allRequests = [];
        for (const cName of cacheNames) {
            const cache = await caches.open(cName);
            const reqs = await cache.keys();
            allRequests.push(...reqs);
        }
        return allRequests.map(r => r.url);
    } catch (e) {
        return [];
    }
}

/**
 * 📂 定位歌曲物理文件并弹出非阻塞 Modal
 */
function revealSong(id, name = '', artist = '', path = '', taskId = null) {
    let url = '/v2/reveal?';
    const params = [];
    if (path) params.push('path=' + encodeURIComponent(path));
    if (taskId) params.push('taskId=' + encodeURIComponent(taskId));
    if (id) params.push('id=' + encodeURIComponent(id));
    if (name) params.push('name=' + encodeURIComponent(name));
    if (artist) params.push('artist=' + encodeURIComponent(artist));
    url += params.join('&');

    axios.get(url)
        .then(resp => {
            if (resp.data.code === '000000') {
                const hostPath = resp.data.data;
                showRevealModal(hostPath, path, '📂 已为您定位宿主机真实物理路径！');
            } else {
                showRevealModal(path || resp.data.data, path, resp.data.msg || '定位提示');
            }
        })
        .catch(err => {
            if (path) {
                showRevealModal(path, path, '📂 物理路径');
            } else {
                showToast('定位文件失败: ' + err, 'error');
            }
        });
}
window.revealSong = revealSong;

/**
 * 💡 点击状态 Badge 触发交互
 */
function handleStatusBadgeClick(e, trackId, trackName, trackArtist, isServer, isBrowser) {
    if (e && e.stopPropagation) e.stopPropagation();
    
    if (isServer) {
        revealSong(trackId, trackName, trackArtist);
    } else if (isBrowser) {
        showAppModal({
            title: '手机/浏览器离线缓存',
            icon: '📲',
            content: `
                <div style="font-weight:600; font-size:14px; margin-bottom:8px; color:var(--text-main);">${escapeHtml(trackName || '该曲目')}</div>
                <div style="font-size:13px; color:var(--text-secondary); line-height:1.6;">
                    该歌曲已通过 <b>PWA Cache API</b> 完整缓存在当前设备的本地存储空间中。<br><br>
                    💡 <b>离线畅听提示</b>：无论是在地铁、飞行模式还是断网无信号环境，您均可随时 0 流量秒开播放！
                </div>
            `,
            confirmText: '我知道了'
        });
    }
}
window.handleStatusBadgeClick = handleStatusBadgeClick;

/**
 * 🎵 生成标准固定三槽位操作胶囊 HTML（播放/试听 | 下载/定位 | 离线缓存/已离线）
 * @param {object} track 歌曲对象
 * @param {string} [prefix='track-'] 标识前缀 (pl- / al- / sr-)
 */
function renderTrackCapsuleSlotsHtml(track, prefix = 'track-') {
    const id = track.id || track.songId;
    const nameSafe = (track.name || '').replace(/'/g, "\\'");
    const artistSafe = (getValidArtistNames(track) || '').replace(/'/g, "\\'");
    const isLocal = (track.isLocal === true);

    const playBtnText = isLocal ? '▶️ 播放' : '▶️ 试听';
    const playBtnClass = isLocal ? 'track-btn-slot slot-play-ready' : 'track-btn-slot slot-play-preview';
    const playBtnTitle = isLocal ? '0延迟本地无损秒播' : '在线试听';

    const serverBtnText = isLocal ? '📂 定位' : '📥 下载';
    const serverBtnClass = isLocal ? 'track-btn-slot slot-server-locate' : 'track-btn-slot slot-server-download';
    const serverBtnTitle = isLocal ? '定位 Mac 宿主机物理音频文件' : '下载到电脑磁盘';
    const serverBtnAction = isLocal
        ? `revealSong('${id}', '${nameSafe}', '${artistSafe}')`
        : `downloadSingle('${id}')`;

    return `
        <div class="track-action-group">
            <button id="${prefix}play-btn-${id}" class="${playBtnClass}" onclick="playSongById('${id}', '${nameSafe}', '${artistSafe}')" title="${playBtnTitle}">${playBtnText}</button>
            <button id="${prefix}server-btn-${id}" class="${serverBtnClass}" onclick="${serverBtnAction}" title="${serverBtnTitle}">${serverBtnText}</button>
            <button id="${prefix}cache-btn-${id}" class="track-btn-slot slot-browser-cache" onclick="cacheTracksToPhoneBatch([{id: '${id}', songId: '${id}'}], '${prefix}cache-btn-${id}', '📲 缓存')" title="缓存至手机/浏览器离线播放">📲 缓存</button>
        </div>
    `;
}
window.renderTrackCapsuleSlotsHtml = renderTrackCapsuleSlotsHtml;

/**
 * 异步批量更新歌曲列表的缓存状态 Badge 以及固定三槽位按钮状态
 */
async function asyncUpdateListBadges(pageTracks, prefix = 'track-') {
    if (!pageTracks || pageTracks.length === 0) return;
    
    // 异步查询所有 cache URLs
    const cachedUrls = await getAllCacheKeys();
    
    pageTracks.forEach(track => {
        const id = track.id || track.songId;
        if (!id) return;
        
        const trackName = track.name || '';
        const trackArtist = getValidArtistNames(track) || '';
        const isServer = track.isLocal === true;
        const isBrowser = cachedUrls.some(url => url.includes(`id=${id}`) || url.includes(`songId=${id}`));

        // 1. 更新 Badge 图标
        const badgeEl = document.getElementById(`badge-${prefix}${id}`) || document.getElementById(`badge-track-${id}`);
        if (badgeEl) {
            if (isServer && isBrowser) {
                badgeEl.className = "status-badge status-both icon-only";
                badgeEl.innerHTML = "✨";
                badgeEl.title = "✨ 服务器与本机浏览器均有缓存 (点击查看物理路径)";
                badgeEl.style.display = "inline-flex";
                badgeEl.style.cursor = "pointer";
                badgeEl.onclick = (e) => handleStatusBadgeClick(e, id, trackName, trackArtist, true, true);
            } else if (isServer) {
                badgeEl.className = "status-badge status-server icon-only";
                badgeEl.innerHTML = "🖥️";
                badgeEl.title = "🖥️ 已存在服务器磁盘 (点击查看物理路径)";
                badgeEl.style.display = "inline-flex";
                badgeEl.style.cursor = "pointer";
                badgeEl.onclick = (e) => handleStatusBadgeClick(e, id, trackName, trackArtist, true, false);
            } else if (isBrowser) {
                badgeEl.className = "status-badge status-browser icon-only";
                badgeEl.innerHTML = "📲";
                badgeEl.title = "📲 已缓存于当前设备浏览器 (点击查看详情)";
                badgeEl.style.display = "inline-flex";
                badgeEl.style.cursor = "pointer";
                badgeEl.onclick = (e) => handleStatusBadgeClick(e, id, trackName, trackArtist, false, true);
            } else {
                badgeEl.style.display = "none";
                badgeEl.onclick = null;
            }
        }

        // 2. 动态同步 槽位 1 (播放/试听)
        const playBtn = document.getElementById(`${prefix}play-btn-${id}`);
        if (playBtn) {
            if (isServer || isBrowser) {
                playBtn.className = "track-btn-slot slot-play-ready";
                playBtn.innerHTML = "▶️ 播放";
                playBtn.title = isBrowser ? "离线就绪秒播" : "本地无损秒播";
            } else {
                playBtn.className = "track-btn-slot slot-play-preview";
                playBtn.innerHTML = "▶️ 试听";
                playBtn.title = "在线试听";
            }
        }

        // 3. 动态同步 槽位 2 (下载/定位)
        const serverBtn = document.getElementById(`${prefix}server-btn-${id}`);
        if (serverBtn) {
            if (isServer) {
                serverBtn.className = "track-btn-slot slot-server-locate";
                serverBtn.innerHTML = "📂 定位";
                serverBtn.title = "定位 Mac 宿主机物理音频文件";
                serverBtn.onclick = () => revealSong(id, trackName, trackArtist);
            } else {
                serverBtn.className = "track-btn-slot slot-server-download";
                serverBtn.innerHTML = "📥 下载";
                serverBtn.title = "下载到电脑磁盘";
                serverBtn.onclick = () => downloadSingle(id);
            }
        }

        // 4. 动态同步 槽位 3 (缓存/已离线)
        const cacheBtn = document.getElementById(`${prefix}cache-btn-${id}`);
        if (cacheBtn) {
            if (isBrowser) {
                cacheBtn.className = "track-btn-slot slot-browser-cached";
                cacheBtn.innerHTML = "✅ 已离线";
                cacheBtn.title = "已存储于当前设备离线存储空间 (点击查看详情)";
                cacheBtn.onclick = (e) => handleStatusBadgeClick(e, id, trackName, trackArtist, isServer, true);
            } else {
                cacheBtn.className = "track-btn-slot slot-browser-cache";
                cacheBtn.innerHTML = "📲 缓存";
                cacheBtn.title = "缓存至手机/浏览器离线播放";
                cacheBtn.onclick = () => cacheTracksToPhoneBatch([{id: id, songId: id}], `${prefix}cache-btn-${id}`, '📲 缓存');
            }
        }
    });
}

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
        // 如果存储空间满了，清理较早的 API 缓存
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
