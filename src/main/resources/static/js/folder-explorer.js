/* ==========================================================================
   📁 NetEase Music Downloader - Local Folder Tree View & Player (folder-explorer.js)
   ========================================================================== */

// 全局树形状态管理
let folderTreeRoots = [];
let currentActiveRoot = null;
const folderNodeCache = new Map(); // path -> { loaded: bool, expanded: bool, children: [], data: item }
let folderFilterKeyword = '';

/**
 * 初始化本地曲库与文件夹树形浏览器
 */
async function initFolderExplorer() {
    try {
        const resp = await axios.get('/v2/folder/roots');
        if (resp.data && resp.data.code === '000000') {
            folderTreeRoots = resp.data.data || [];
            renderFolderRootsBar();
            if (folderTreeRoots.length > 0) {
                // 优先选择外部曲库，其次选择第一个根目录
                const defaultRoot = folderTreeRoots.find(r => r.name.includes('外部')) || folderTreeRoots[0];
                selectFolderRoot(defaultRoot.path, defaultRoot.name);
            } else {
                renderTreeEmptyState('未检测到可用的本地曲库根目录');
            }
        }
    } catch (e) {
        console.warn("[FolderExplorer] 初始化根目录失败:", e);
    }
}

/**
 * 渲染根目录选择 Tab
 */
function renderFolderRootsBar() {
    const rootSelector = document.getElementById("folder-root-selector");
    if (!rootSelector) return;

    rootSelector.innerHTML = folderTreeRoots.map(r => `
        <button class="folder-root-tab ${currentActiveRoot?.path === r.path ? 'active' : ''}" 
                onclick="selectFolderRoot('${escapeJsString(r.path)}', '${escapeJsString(r.name)}')">
            ${escapeHtml(r.name)}
        </button>
    `).join('');
}

/**
 * 切换根目录并构建顶级树节点
 */
function selectFolderRoot(rootPath, rootName) {
    currentActiveRoot = { path: rootPath, name: rootName };
    folderNodeCache.clear();
    renderFolderRootsBar();

    const rootDomId = getNodeDomId(rootPath);

    // 初始化根节点容器
    const treeContainer = document.getElementById("folder-explorer-list");
    if (!treeContainer) return;

    treeContainer.innerHTML = `
        <div class="tree-root-wrapper" id="tree-root-container">
            <div class="tree-node-row tree-node-root" id="node-row-${rootDomId}">
                <div class="tree-row-content">
                    <div class="tree-left-section" onclick="toggleTreeNode('${escapeJsString(rootPath)}', 0, event)">
                        <span class="tree-expander expanded" id="expander-of-${rootDomId}">▼</span>
                        <span class="tree-node-name tree-root-name">${escapeHtml(rootName)}</span>
                        <span class="tree-badge-count" id="root-meta-badge">正在扫描...</span>
                    </div>
                    <div class="tree-actions-group">
                        <button class="tree-btn tree-btn-play" onclick="playFolderTracks('${escapeJsString(rootPath)}', '${escapeJsString(rootName)}', true)" title="连播整库全部 MP3">
                            ▶ 连播整库
                        </button>
                        <button class="tree-btn tree-btn-queue sp-hide" onclick="appendFolderTracksToQueue('${escapeJsString(rootPath)}', '${escapeJsString(rootName)}', true)" title="追加整库到播放列表">
                            ➕ 追加
                        </button>
                        <button class="tree-btn tree-btn-refresh sp-hide" onclick="refreshTreeNode('${escapeJsString(rootPath)}', 0)" title="重新扫描此目录">
                            🔄
                        </button>
                        <button class="tree-btn tree-btn-more sp-show" onclick="event.stopPropagation(); showFolderActionMenu('${escapeJsString(rootPath)}', '${escapeJsString(rootName)}', 0, '', 0, 'tree-root-container')" title="更多操作">
                            ···
                        </button>
                    </div>
                </div>
            </div>
            <div class="tree-children-container" id="children-of-${rootDomId}" style="display: block;">
                <div style="padding: 15px 25px; color: var(--text-muted); font-size: 13px;">
                    <span class="loading-spinner"></span> 正在扫描读取目录结构...
                </div>
            </div>
        </div>
    `;

    // 自动加载并展开根目录子节点
    loadAndRenderNodeChildren(rootPath, 0, document.getElementById(`children-of-${rootDomId}`), rootName);
}

// 全局路径与 DOM ID 映射，安全支持中文与任意特殊字符
const pathDomIdMap = new Map();
let domIdCounter = 0;
function getNodeDomId(path) {
    if (!path) return 'root';
    if (!pathDomIdMap.has(path)) {
        domIdCounter++;
        pathDomIdMap.set(path, 'tree_node_' + domIdCounter);
    }
    return pathDomIdMap.get(path);
}

/**
 * 展开 / 折叠指定节点
 */
async function toggleTreeNode(dirPath, level, event) {
    if (event) event.stopPropagation();

    const safeId = getNodeDomId(dirPath);
    const childrenContainer = document.getElementById(`children-of-${safeId}`);
    const expander = document.getElementById(`expander-of-${safeId}`);
    const folderIcon = document.getElementById(`icon-of-${safeId}`);

    if (!childrenContainer) return;

    const isExpanded = childrenContainer.style.display !== 'none';

    if (isExpanded) {
        // 折叠
        childrenContainer.style.display = 'none';
        if (expander) {
            expander.textContent = '▶';
            expander.classList.remove('expanded');
        }
        if (folderIcon) folderIcon.textContent = '📁';
        if (folderNodeCache.has(dirPath)) {
            folderNodeCache.get(dirPath).expanded = false;
        }
    } else {
        // 展开
        childrenContainer.style.display = 'block';
        if (expander) {
            expander.textContent = '▼';
            expander.classList.add('expanded');
        }
        if (folderIcon) folderIcon.textContent = '📂';

        // 检查是否已经加载过
        const cached = folderNodeCache.get(dirPath);
        if (!cached || !cached.loaded) {
            await loadAndRenderNodeChildren(dirPath, level, childrenContainer);
        } else {
            cached.expanded = true;
        }
    }
}

/**
 * 局部刷新某个树节点
 */
async function refreshTreeNode(dirPath, level) {
    folderNodeCache.delete(dirPath);
    const safeId = getNodeDomId(dirPath);
    const containerId = (currentActiveRoot?.path === dirPath) ? 'children-of-root' : `children-of-${safeId}`;
    const childrenContainer = document.getElementById(containerId);
    if (childrenContainer) {
        childrenContainer.innerHTML = '<div style="padding: 8px 20px; color: var(--text-muted); font-size: 12px;"><span class="loading-spinner"></span> 正在刷新...</div>';
        await loadAndRenderNodeChildren(dirPath, level, childrenContainer);
    }
}

/**
 * 异步拉取并渲染子节点（文件夹 + MP3 文件）
 */
async function loadAndRenderNodeChildren(dirPath, level, containerElement, customName = '') {
    try {
        const resp = await axios.get(`/v2/folder/browse?path=${encodeURIComponent(dirPath)}`);
        if (resp.data && resp.data.code === '000000') {
            const items = resp.data.data || [];
            
            // 缓存节点数据
            folderNodeCache.set(dirPath, {
                loaded: true,
                expanded: true,
                children: items
            });

            // 更新父节点徽章（如根目录）
            if (currentActiveRoot?.path === dirPath) {
                const rootBadge = document.getElementById("root-meta-badge");
                if (rootBadge) {
                    const dirCount = items.filter(i => i.directory).length;
                    const mp3Count = items.filter(i => !i.directory).length;
                    rootBadge.textContent = `含 ${dirCount} 文件夹 · ${mp3Count} 根歌曲`;
                }
            }

            renderNodeItemsHTML(items, level + 1, containerElement);
        } else {
            containerElement.innerHTML = `<div style="padding: 8px 20px; color: #ef4444; font-size: 12px;">读取失败: ${resp.data.msg || '未知错误'}</div>`;
        }
    } catch (err) {
        containerElement.innerHTML = `<div style="padding: 8px 20px; color: #ef4444; font-size: 12px;">请求异常: ${err}</div>`;
    }
}

/**
 * 渲染子节点列表 HTML
 */
function renderNodeItemsHTML(items, level, containerElement) {
    if (!items || items.length === 0) {
        containerElement.innerHTML = `<div class="tree-empty-leaf" style="padding-left: ${level * 22 + 26}px;">(文件夹为空)</div>`;
        return;
    }

    let html = '';

    items.forEach(item => {
        const safeId = getNodeDomId(item.path);
        const indentPadding = level * 20;

        if (item.directory) {
            html += `
                <div class="tree-node-wrapper" id="wrapper-of-${safeId}">
                    <div class="tree-node-row tree-node-dir" 
                         style="--tree-level: ${level};" 
                         id="row-of-${safeId}">
                        <div class="tree-row-content">
                            <div class="tree-left-section" onclick="toggleTreeNode('${escapeJsString(item.path)}', ${level}, event)">
                                <span class="tree-expander" id="expander-of-${safeId}">▶</span>
                                <span class="tree-icon" id="icon-of-${safeId}">📁</span>
                                <span class="tree-node-name tree-dir-name">${escapeHtml(item.name)}</span>
                                ${item.trackCount > 0 ? `<span class="tree-badge-count">含 ${item.trackCount} 首</span>` : ''}
                            </div>
                            <div class="tree-actions-group">
                                ${item.trackCount > 0 ? `
                                    <button class="tree-btn tree-btn-play" onclick="playFolderTracks('${escapeJsString(item.path)}', '${escapeJsString(item.name)}', true)" title="连播此文件夹下所有 MP3">
                                        ▶ 连播
                                    </button>
                                    <button class="tree-btn tree-btn-queue sp-hide" onclick="appendFolderTracksToQueue('${escapeJsString(item.path)}', '${escapeJsString(item.name)}', true)" title="追加到播放列表">
                                        ➕ 追加
                                    </button>
                                ` : ''}
                                ${item.hostPath ? `
                                    <button class="tree-btn tree-btn-locate sp-hide" onclick="revealFile('${escapeJsString(item.hostPath)}')" title="在文件管理器/服务器中定位">
                                        📂 定位
                                    </button>
                                ` : ''}
                                <button class="tree-btn tree-btn-refresh sp-hide" onclick="refreshTreeNode('${escapeJsString(item.path)}', ${level})" title="刷新此目录">
                                    🔄
                                </button>
                                <button class="tree-btn tree-btn-ignore sp-hide" onclick="confirmIgnoreFolder('${escapeJsString(item.path)}', '${escapeJsString(item.name)}', 'wrapper-of-${safeId}')" title="忽略此文件夹 (创建 .musicignore 并不再扫描)">
                                    🚫
                                </button>
                                <button class="tree-btn tree-btn-delete sp-hide" onclick="confirmDeleteFolder('${escapeJsString(item.path)}', '${escapeJsString(item.name)}', 'wrapper-of-${safeId}')" title="彻底删除此文件夹 (物理删除磁盘文件)">
                                    🗑️
                                </button>
                                <!-- SP 模式专属更多操作 -->
                                <button class="tree-btn tree-btn-more sp-show" onclick="event.stopPropagation(); showFolderActionMenu('${escapeJsString(item.path)}', '${escapeJsString(item.name)}', ${item.trackCount || 0}, '${escapeJsString(item.hostPath || '')}', ${level}, 'wrapper-of-${safeId}')" title="更多文件夹操作">
                                    ···
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="tree-children-container" id="children-of-${safeId}" style="display: none;"></div>
                </div>
            `;
        } else {
            // MP3 文件节点
            const sizeStr = item.size > 0 ? formatBytes(item.size) : '';
            const artistStr = item.artist ? escapeHtml(item.artist) : '未知歌手';
            const hostPath = item.hostPath || item.path || '';

            html += `
                <div class="tree-node-row tree-node-file" style="--tree-level: ${level};" id="row-of-${safeId}">
                    <div class="tree-row-content">
                        <div class="tree-left-section" onclick="playSingleLocalFile('${escapeJsString(item.streamUrl || item.path)}', '${escapeJsString(item.songName || item.name)}', '${escapeJsString(item.artist || '')}', '${escapeJsString(item.album || '')}')">
                            <span class="tree-file-indent"></span>
                            <span class="tree-icon tree-file-icon">🎵</span>
                            <span class="tree-node-name tree-song-name">${escapeHtml(item.songName || item.name)}</span>
                            <div class="tree-song-meta">
                                <span class="tree-meta-artist">${artistStr}</span>
                                ${item.album ? `<span class="tree-meta-album">· 《${escapeHtml(item.album)}》</span>` : ''}
                                ${sizeStr ? `<span class="tree-meta-size">${sizeStr}</span>` : ''}
                            </div>
                        </div>
                        <div class="tree-actions-group">
                            <button class="tree-btn tree-btn-play" onclick="playSingleLocalFile('${escapeJsString(item.streamUrl || item.path)}', '${escapeJsString(item.songName || item.name)}', '${escapeJsString(item.artist || '')}', '${escapeJsString(item.album || '')}')" title="立即播放">
                                ▶ 播放
                            </button>
                            <button class="tree-btn tree-btn-queue sp-hide" onclick="appendSingleTrackToQueue('${escapeJsString(item.streamUrl || item.path)}', '${escapeJsString(item.songName || item.name)}', '${escapeJsString(item.artist || '')}', '${escapeJsString(item.album || '')}')" title="追加到队列末尾">
                                ➕
                            </button>
                            ${hostPath ? `
                                <button class="tree-btn tree-btn-locate sp-hide" onclick="revealFile('${escapeJsString(hostPath)}')" title="在文件管理器/服务器中定位">
                                    📂
                                </button>
                            ` : ''}
                            <button class="tree-btn tree-btn-more sp-show" onclick="event.stopPropagation(); showSingleFileActionMenu('${escapeJsString(item.streamUrl || item.path)}', '${escapeJsString(item.songName || item.name)}', '${escapeJsString(item.artist || '')}', '${escapeJsString(item.album || '')}', '${escapeJsString(hostPath)}')" title="更多操作">
                                ···
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    });

    containerElement.innerHTML = html;
}

/**
 * 全部展开 / 全部折叠树
 */
function expandAllTreeNodes() {
    const expanders = document.querySelectorAll('.tree-node-row .tree-expander:not(.expanded)');
    expanders.forEach(btn => btn.click());
}

function collapseAllTreeNodes() {
    const rootDomId = currentActiveRoot ? getNodeDomId(currentActiveRoot.path) : null;
    const rootContainerId = rootDomId ? `children-of-${rootDomId}` : 'children-of-root';
    const rootRowId = rootDomId ? `node-row-${rootDomId}` : 'node-row-root';

    const containers = document.querySelectorAll('.tree-children-container');
    containers.forEach(c => {
        if (c.id !== rootContainerId) {
            c.style.display = 'none';
        }
    });
    const expanders = document.querySelectorAll('.tree-expander.expanded');
    expanders.forEach(exp => {
        if (!exp.closest(`#${rootRowId}`)) {
            exp.textContent = '▶';
            exp.classList.remove('expanded');
        }
    });
    const icons = document.querySelectorAll('.tree-node-dir .tree-icon');
    icons.forEach(ic => ic.textContent = '📁');
}

/**
 * 树形过滤搜索
 */
function filterFolderTree(keyword) {
    folderFilterKeyword = (keyword || '').trim().toLowerCase();
    const rows = document.querySelectorAll('.tree-node-row:not(.tree-node-root)');
    
    if (!folderFilterKeyword) {
        rows.forEach(r => r.style.display = '');
        return;
    }

    rows.forEach(r => {
        const text = r.textContent.toLowerCase();
        if (text.includes(folderFilterKeyword)) {
            r.style.display = '';
            // 向上展开父容器
            let parent = r.closest('.tree-children-container');
            while (parent) {
                parent.style.display = 'block';
                const wrapper = parent.closest('.tree-node-wrapper');
                if (wrapper) {
                    const exp = wrapper.querySelector('.tree-expander');
                    if (exp) {
                        exp.textContent = '▼';
                        exp.classList.add('expanded');
                    }
                    const ic = wrapper.querySelector('.tree-icon');
                    if (ic) ic.textContent = '📂';
                }
                parent = wrapper ? wrapper.parentElement.closest('.tree-children-container') : null;
            }
        } else {
            // 如果是文件夹且其子孙有匹配则保留
            const childContainer = r.nextElementSibling;
            if (childContainer && childContainer.classList.contains('tree-children-container') && childContainer.textContent.toLowerCase().includes(folderFilterKeyword)) {
                r.style.display = '';
            } else {
                r.style.display = 'none';
            }
        }
    });
}

function renderTreeEmptyState(message) {
    const container = document.getElementById("folder-explorer-list");
    if (container) {
        container.innerHTML = `<div style="padding:35px 20px; text-align:center; color:var(--text-muted); font-size:13px;">${message}</div>`;
    }
}

/**
 * ▶ 连播指定文件夹全部 MP3（构造临时歌单并启动播放）
 */
async function playFolderTracks(folderPath, folderName, recursive = true) {
    const targetPath = folderPath || currentActiveRoot?.path;
    const targetName = folderName || currentActiveRoot?.name || '本地文件夹';

    if (!targetPath) {
        showToast("请先选择要播放的文件夹", "warning");
        return;
    }

    showToast(`⏳ 正在准备连播《${targetName}》...`, "info", 1500);

    try {
        const resp = await axios.get(`/v2/folder/tracks?path=${encodeURIComponent(targetPath)}&recursive=${recursive}`);
        if (resp.data && resp.data.code === '000000') {
            const tracks = resp.data.data || [];
            if (tracks.length === 0) {
                showToast(`该文件夹中未找到任何 .mp3 音乐文件`, "warning", 3000);
                return;
            }

            const formattedQueue = tracks.map((t, idx) => {
                const playPath = t.relativePath || t.filePath;
                return {
                    id: t.songId && t.songId > 0 ? t.songId : (t.id && t.id > 0 ? t.id : `local_${Date.now()}_${idx}`),
                    name: t.songName || '未知歌曲',
                    artist: t.artist || '未知歌手',
                    album: t.album || targetName,
                    cover: '/favicon.png',
                    url: `/v2/history/stream?path=${encodeURIComponent(playPath)}`,
                    isLocal: true
                };
            });

            if (typeof setGlobalPlaylistQueue === 'function') {
                setGlobalPlaylistQueue(formattedQueue, 0);
                showToast(`🎉 已加载《${targetName}》共 ${formattedQueue.length} 首歌曲到播放列表！`, "success", 3500);
            }
        } else {
            showToast("读取文件夹音频失败: " + (resp.data.msg || '未知错误'), "error");
        }
    } catch (err) {
        showToast("请求文件夹音频失败: " + err, "error");
    }
}

/**
 * ➕ 追加文件夹全部 MP3 到现有播放列表
 */
async function appendFolderTracksToQueue(folderPath, folderName, recursive = true) {
    const targetPath = folderPath || currentActiveRoot?.path;
    const targetName = folderName || '本地文件夹';

    try {
        const resp = await axios.get(`/v2/folder/tracks?path=${encodeURIComponent(targetPath)}&recursive=${recursive}`);
        if (resp.data && resp.data.code === '000000') {
            const tracks = resp.data.data || [];
            if (tracks.length === 0) {
                showToast(`未找到可追加的 .mp3 音频`, "warning");
                return;
            }

            const newTracks = tracks.map((t, idx) => {
                const playPath = t.relativePath || t.filePath;
                return {
                    id: t.songId && t.songId > 0 ? t.songId : (t.id && t.id > 0 ? t.id : `local_${Date.now()}_${idx}`),
                    name: t.songName || '未知歌曲',
                    artist: t.artist || '未知歌手',
                    album: t.album || targetName,
                    cover: '/favicon.png',
                    url: `/v2/history/stream?path=${encodeURIComponent(playPath)}`,
                    isLocal: true
                };
            });

            if (typeof globalPlaylistQueue !== 'undefined') {
                globalPlaylistQueue.push(...newTracks);
                if (typeof updatePlaylistCountUI === 'function') updatePlaylistCountUI();
                if (typeof savePlayerStateToStorage === 'function') savePlayerStateToStorage();
                showToast(`➕ 成功追加 ${newTracks.length} 首歌曲到播放列表！`, "success", 3000);
            }
        }
    } catch (err) {
        showToast("追加失败: " + err, "error");
    }
}

/**
 * 播放单首本地音频
 */
function playSingleLocalFile(streamUrl, songName, artist, album) {
    if (!streamUrl) return;
    if (typeof playAudioOnline === 'function') {
        playAudioOnline(streamUrl, songName, artist, '/favicon.png', album || '本地曲库');
    }
}

/**
 * 单首音频追加到播放列表
 */
function appendSingleTrackToQueue(streamUrl, songName, artist, album) {
    if (!streamUrl) return;
    const newTrack = {
        id: `local_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: songName || '未知歌曲',
        artist: artist || '未知歌手',
        album: album || '本地曲库',
        cover: '/favicon.png',
        url: streamUrl,
        isLocal: true
    };
    if (typeof globalPlaylistQueue !== 'undefined') {
        globalPlaylistQueue.push(newTrack);
        if (typeof updatePlaylistCountUI === 'function') updatePlaylistCountUI();
        if (typeof savePlayerStateToStorage === 'function') savePlayerStateToStorage();
        showToast(`➕ 已将《${songName}》加入播放列表`, "success", 2000);
    }
}

function escapeJsString(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/**
 * 🚫 确认并忽略指定文件夹（在磁盘对应目录下创建 .musicignore 文件）
 */
async function confirmIgnoreFolder(folderPath, folderName, domWrapperId) {
    if (!folderPath) return;

    const confirmed = confirm(`确定要忽略文件夹《${folderName}》吗？\n\n确认后将在该目录下自动创建 .musicignore 标记文件，此目录将不再被扫描、入库和展示。`);
    if (!confirmed) return;

    try {
        const resp = await axios.post('/v2/folder/ignore', new URLSearchParams({ path: folderPath }));
        if (resp.data && resp.data.code === '000000' && resp.data.data === true) {
            showToast(`🚫 已成功忽略《${folderName}》，已创建 .musicignore 文件`, "success", 3500);
            
            // 从当前树中平滑移除该节点
            const wrapperNode = document.getElementById(domWrapperId);
            if (wrapperNode) {
                wrapperNode.style.transition = 'all 0.35s ease';
                wrapperNode.style.opacity = '0';
                wrapperNode.style.transform = 'translateX(20px)';
                setTimeout(() => wrapperNode.remove(), 350);
            }
            folderNodeCache.delete(folderPath);
        } else {
            showToast("忽略目录失败: " + (resp.data.msg || "未知错误"), "error");
        }
    } catch (err) {
        showToast("请求忽略目录异常: " + err, "error");
    }
}

/**
 * 🗑️ 确认并彻底删除指定文件夹（删除前深度预检物理文件总数、最多5个文件清单与 Finder 定位命令）
 */
async function confirmDeleteFolder(folderPath, folderName, domWrapperId) {
    if (!folderPath) return;

    showToast(`🔍 正在预检文件夹《${folderName}》磁盘内容...`, "info", 1200);

    try {
        const checkResp = await axios.get(`/v2/folder/check?path=${encodeURIComponent(folderPath)}`);
        if (!checkResp.data || checkResp.data.code !== '000000' || !checkResp.data.data) {
            showToast("无法获取文件夹物理信息: " + (checkResp.data?.msg || "目录不存在"), "error");
            return;
        }

        const info = checkResp.data.data;
        const hostPath = info.hostPath || folderPath;
        const openCmd = `open -R "${hostPath}"`;
        const totalFiles = info.totalFiles || 0;
        const totalDirs = info.totalDirs || 0;
        const sampleFiles = info.sampleFiles || [];

        // 构造弹窗内容
        let bodyHtml = `
            <div style="font-size:13.5px; line-height:1.6; margin-bottom:12px;">
                ⚠️ 确定要彻底物理删除文件夹 <strong>《${escapeHtml(folderName)}》</strong> 吗？
            </div>
            <div style="background:var(--stat-bar-bg, rgba(0,0,0,0.25)); border:1px solid var(--border-subtle); border-radius:8px; padding:12px 14px; margin-bottom:12px;">
                <div style="margin-bottom:6px; font-size:13px;">
                    📊 <strong>物理磁盘实际包含：</strong>
                    <span style="color:${totalFiles > 0 ? '#ef4444' : '#10b981'}; font-weight:700; font-size:14px;">
                        ${totalFiles} 个文件
                    </span>
                    ${totalDirs > 0 ? `<span style="color:var(--text-muted); font-size:12px;"> (${totalDirs} 个子文件夹)</span>` : ''}
                </div>
                <div style="color:var(--text-muted); font-size:11.5px; line-height:1.4;">
                    ℹ️ 提示：UI 树中仅展示 MP3 音频，删除将<strong>连同所有格式（FLAC/JPG/LRC 等）一并物理抹除</strong>！
                </div>
            </div>
        `;

        if (sampleFiles.length > 0) {
            bodyHtml += `
                <div style="background:rgba(239, 68, 68, 0.08); border:1px solid rgba(239, 68, 68, 0.25); border-radius:8px; padding:10px 14px; margin-bottom:12px;">
                    <div style="color:#ef4444; font-weight:600; font-size:12px; margin-bottom:6px;">
                        📁 目录内实际文件预览 (最多展示前 5 项)：
                    </div>
                    <ul style="margin:0 0 0 18px; padding:0; font-size:12px; color:var(--text-main); line-height:1.6;">
                        ${sampleFiles.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                        ${totalFiles > sampleFiles.length ? `<li style="color:var(--text-muted); list-style:none; margin-top:2px;">...等共 ${totalFiles} 个实际文件</li>` : ''}
                    </ul>
                </div>
            `;
        } else {
            bodyHtml += `
                <div style="background:rgba(16, 185, 129, 0.08); border:1px solid rgba(16, 185, 129, 0.25); border-radius:6px; padding:8px 12px; margin-bottom:12px; font-size:12px; color:#10b981;">
                    ✅ 该文件夹在物理磁盘上为空目录
                </div>
            `;
        }

        bodyHtml += `
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">
                💻 在终端中定位此目录：
            </div>
            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border-subtle); padding:8px 12px; border-radius:6px; font-family:monospace; font-size:11.5px; color:#38bdf8; word-break:break-all; user-select:all;">
                ${escapeHtml(openCmd)}
            </div>
        `;

        const confirmed = await showAppModal({
            title: `删除文件夹确认`,
            icon: '🗑️',
            content: bodyHtml,
            confirmText: totalFiles > 0 ? `彻底删除 (${totalFiles} 个文件)` : '彻底删除空目录',
            cancelText: '取消',
            showCancel: true,
            danger: true,
            cmdText: openCmd,
            cmdLabel: '💻 复制终端定位命令'
        });

        if (!confirmed) return;

        showToast(`⏳ 正在物理清理《${folderName}》...`, "info", 1500);

        const deleteResp = await axios.post('/v2/folder/delete', new URLSearchParams({ path: folderPath }));
        if (deleteResp.data && deleteResp.data.code === '000000' && deleteResp.data.data === true) {
            showToast(`🗑️ 已彻底删除文件夹《${folderName}》及内部文件`, "success", 3500);
            
            // 从当前树中平滑移除该节点
            const wrapperNode = document.getElementById(domWrapperId);
            if (wrapperNode) {
                wrapperNode.style.transition = 'all 0.35s ease';
                wrapperNode.style.opacity = '0';
                wrapperNode.style.transform = 'translateX(20px)';
                setTimeout(() => wrapperNode.remove(), 350);
            }
            folderNodeCache.delete(folderPath);
        } else {
            showToast("删除目录失败: " + (deleteResp.data.msg || "未知错误"), "error");
        }
    } catch (err) {
        showToast("删除目录请求异常: " + err, "error");
    }
}

/**
 * 📱 移动端文件夹节点更多操作 ActionSheet
 */
function showFolderActionMenu(dirPath, dirName, trackCount, hostPath, level, wrapperId) {
    const items = [];

    if (trackCount > 0) {
        items.push({
            icon: '▶️',
            text: `连播此文件夹 (${trackCount} 首)`,
            subtext: '替换当前播放队列并从头播放',
            onClick: () => playFolderTracks(dirPath, dirName, true)
        });
        items.push({
            icon: '➕',
            text: '追加到当前播放队列末尾',
            subtext: '不打断当前歌曲连播',
            onClick: () => appendFolderTracksToQueue(dirPath, dirName, true)
        });
    }

    if (hostPath) {
        items.push({
            icon: '📂',
            text: '在文件管理器/服务器中定位',
            subtext: '查看或定位服务器物理文件',
            onClick: () => revealFile(hostPath)
        });
    }

    items.push({
        icon: '🔄',
        text: '刷新此目录内容',
        subtext: '重新扫描子文件夹与 MP3 文件',
        onClick: () => refreshTreeNode(dirPath, level)
    });

    items.push({
        icon: '🚫',
        text: '忽略此文件夹 (.musicignore)',
        subtext: '在目录下创建 .musicignore 并不再扫描',
        onClick: () => confirmIgnoreFolder(dirPath, dirName, wrapperId)
    });

    items.push({
        icon: '🗑️',
        text: '彻底删除此文件夹 (物理删除)',
        subtext: '物理删除磁盘上的整个文件夹',
        danger: true,
        onClick: () => confirmDeleteFolder(dirPath, dirName, wrapperId)
    });

    if (typeof showActionSheet === 'function') {
        showActionSheet({
            title: `📁 ${dirName || '文件夹'}`,
            subtitle: trackCount > 0 ? `包含 ${trackCount} 首音乐` : (dirPath || ''),
            items: items
        });
    }
}
window.showFolderActionMenu = showFolderActionMenu;

/**
 * 📱 移动端单个本地文件更多操作 ActionSheet
 */
function showSingleFileActionMenu(streamUrl, songName, artist, album, hostPath) {
    const items = [
        {
            icon: '▶️',
            text: '立即播放此音频',
            subtext: '0 延迟本地直通解码',
            onClick: () => playSingleLocalFile(streamUrl, songName, artist, album)
        },
        {
            icon: '➕',
            text: '追加到播放列表末尾',
            onClick: () => appendSingleTrackToQueue(streamUrl, songName, artist, album)
        }
    ];

    if (hostPath) {
        items.push({
            icon: '📂',
            text: '在文件管理器/服务器中定位',
            subtext: '查看或定位服务器物理文件',
            onClick: () => revealFile(hostPath)
        });
    }

    if (typeof showActionSheet === 'function') {
        showActionSheet({
            title: `🎵 ${songName || '本地音乐'}`,
            subtitle: artist ? `${artist}${album ? ` · 《${album}》` : ''}` : '本地音频',
            items: items
        });
    }
}
window.showSingleFileActionMenu = showSingleFileActionMenu;



