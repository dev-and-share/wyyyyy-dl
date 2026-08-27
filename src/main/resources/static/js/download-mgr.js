/* ==========================================================================
   📥 NetEase Music Downloader - Download Manager Core (download-mgr.js)
   ========================================================================== */

let historyCurrentPage = 1;
let historyTotalPages = 1;

function formatBytes(bytes) {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function safeDecode(str) {
    if (!str) return '';
    if (str.includes('%')) {
        try {
            return decodeURIComponent(str);
        } catch (e) {
            return str;
        }
    }
    return str;
}

function revealFile(path, taskId) {
    if (!path && !taskId) {
        showToast('无法定位：缺少路径参数', 'warning');
        return;
    }
    
    let rawPath = path ? safeDecode(path) : '';
    let url = '/v2/reveal?';
    if (rawPath) {
        url += 'path=' + encodeURIComponent(rawPath);
    } else if (taskId) {
        url += 'taskId=' + encodeURIComponent(taskId);
    }

    if (rawPath && navigator.clipboard) {
        navigator.clipboard.writeText(rawPath).catch(() => {});
    }

    axios.get(url)
        .then(resp => {
            const fpath = resp.data.data || rawPath;
            if (fpath && navigator.clipboard) {
                navigator.clipboard.writeText(fpath).catch(() => {});
            }
            if (resp.data.code === '000000') {
                showRevealModal(fpath, rawPath, '📂 已为您复制 Mac 宿主机真实物理路径到剪贴板！');
            } else {
                showRevealModal(fpath, rawPath, '定位提示：' + (resp.data.msg || resp.data.message));
            }
        })
        .catch(err => {
            if (rawPath) {
                showRevealModal(rawPath, rawPath, '📂 已复制物理路径到剪贴板！');
            } else {
                showToast('请求定位接口失败：' + err, 'error');
            }
        });
}

function playLocalFile(path, songName, artist, cover) {
    if (!path) return;
    const rawPath = safeDecode(path);
    const streamUrl = '/v2/history/stream?path=' + encodeURIComponent(rawPath);
    const coverUrl = (cover && cover !== '/favicon.png') ? cover : '';
    if (typeof playAudioOnline === 'function') {
        playAudioOnline(streamUrl, songName, artist, coverUrl, '本地下载音乐');
    } else {
        const player = document.getElementById("globalAudioPlayer");
        if (player) {
            player.src = streamUrl;
            player.play();
        }
    }
}

function loadHistoryStats() {
    axios.get('/v2/history/stats')
        .then(resp => {
            if (resp.data.code === '000000') {
                const s = resp.data.data || {};
                document.getElementById('mgr-stat-total').textContent = s.totalCount || 0;
                document.getElementById('mgr-stat-size').textContent = formatBytes(s.totalSize || 0);
                document.getElementById('mgr-stat-missing').textContent = s.missingCount || 0;
                
                const missingBox = document.getElementById('mgr-stat-missing-box');
                if (missingBox) {
                    missingBox.style.display = (s.missingCount > 0) ? 'inline-block' : 'none';
                }
            }
        })
        .catch(err => console.error("获取统计失败:", err));
}

function loadDownloadHistory(page) {
    if (page) historyCurrentPage = page;
    const kw = document.getElementById('mgrSearchKeyword') ? document.getElementById('mgrSearchKeyword').value : '';

    axios.get(`/v2/history/list?keyword=${encodeURIComponent(kw)}&page=${historyCurrentPage}&pageSize=10`)
        .then(resp => {
            if (resp.data.code === '000000') {
                const data = resp.data.data || {};
                const list = data.list || [];
                const total = data.total || 0;

                historyTotalPages = Math.ceil(total / 10) || 1;
                document.getElementById('history-page-indicator').textContent = `第 ${historyCurrentPage} 页 / 共 ${historyTotalPages} 页 (共 ${total} 条)`;
                document.getElementById('history-prev').disabled = (historyCurrentPage <= 1);
                document.getElementById('history-next').disabled = (historyCurrentPage >= historyTotalPages);

                const ul = document.getElementById('download-history-list');
                ul.innerHTML = '';

                if (list.length === 0) {
                    ul.innerHTML = '<li style="padding:15px; text-align:center; color:#888;">暂无下载记录</li>';
                    return;
                }

                list.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'history-item-card' + (item.fileExists ? '' : ' item-missing');
                    
                    const fileStatusTag = item.fileExists 
                        ? '<span class="status-badge status-ok">正常</span>'
                        : '<span class="status-badge status-err">⚠️ 失效</span>';

                    const hostPath = item.hostFilePath || item.filePath || '';

                    li.innerHTML = `
                        <!-- 📌 第一排：歌名/文件名 100% 满宽全显 -->
                        <div class="card-title-row">
                            <strong class="card-song-name">${item.songName || '未知歌曲'}</strong>
                        </div>
                        <!-- 📌 第二排：左侧歌手大小状态 + 右侧按钮 -->
                        <div class="card-sub-row">
                            <div class="sub-left">
                                <span class="card-artist">${item.artist || '未知歌手'}</span>
                                <span class="card-size">${formatBytes(item.fileSize)}</span>
                                ${fileStatusTag}
                            </div>
                            <div class="sub-right">
                                ${item.fileExists ? `<button class="action-btn btn-play" onclick="playLocalFile('${encodeURIComponent(item.relativePath || item.filePath)}', '${(item.songName||'').replace(/'/g, "\\'")}', '${(item.artist||'').replace(/'/g, "\\'")}', '${item.cover || ''}')">▶ 播放</button>` : ''}
                                ${item.fileExists ? `<button class="action-btn btn-locate" onclick="revealFile('${encodeURIComponent(hostPath)}')">📂 定位</button>` : ''}
                                <button class="action-btn btn-del" onclick="deleteHistoryItem(${item.id})">🗑 删除</button>
                            </div>
                        </div>
                    `;
                    ul.appendChild(li);
                });
            }
        })
        .catch(err => alert("加载下载历史失败: " + err));
}

function changeHistoryPage(delta) {
    const target = historyCurrentPage + delta;
    if (target >= 1 && target <= historyTotalPages) {
        loadDownloadHistory(target);
    }
}

function scanExternalLibrariesUI() {
    const box = document.getElementById("scanResultBox");
    const content = document.getElementById("scanResultContent");
    if (box) box.style.display = 'block';
    if (content) content.innerHTML = '<div style="color:var(--text-secondary);">🔄 正在扫描并同步 `.env` 中配置的所有外部本地曲库目录，请稍候...</div>';

    axios.post('/v2/history/scan_external')
        .then(resp => {
            if (resp.data.code === '000000') {
                const res = resp.data.data || {};
                const dirs = res.configuredDirs || [];
                content.innerHTML = `
                    <div style="color:#22c55e; font-weight:bold; margin-bottom:6px;">✅ 多目录外部曲库扫描同步完成！</div>
                    <div style="color:var(--text-main);">• 配置扫描目录列表: <code style="background:var(--tag-btn-bg); padding:2px 6px; border-radius:4px; border:1px solid var(--border-color);">${dirs.join(' ; ')}</code></div>
                    <div style="color:var(--text-main);">• 累计扫描物理音频文件: <strong>${res.scannedFiles || 0}</strong> 首</div>
                    <div style="color:var(--text-main);">• 本次成功新录入索引: <strong style="color:#38bdf8;">${res.addedCount || 0}</strong> 首</div>
                    <div style="margin-top:8px; font-size:12px; color:var(--text-secondary);">💡 提示：现在在线搜索或播放歌单时，凡在上述目录中的音乐，系统均会自动 0 延迟秒播本地文件！</div>
                `;
                loadHistoryStats();
                loadDownloadHistory(1);
            } else {
                if (content) content.innerHTML = `<div style="color:#ef4444;">⚠️ 扫描失败: ${resp.data.msg}</div>`;
            }
        })
        .catch(err => {
            if (content) content.innerHTML = `<div style="color:#ef4444;">⚠️ 请求扫描接口异常: ${err}</div>`;
        });
}

function scanDiskFiles() {
    axios.post('/v2/history/scan')
        .then(resp => {
            if (resp.data.code === '000000') {
                const d = resp.data.data || {};
                const box = document.getElementById('scanResultBox');
                const content = document.getElementById('scanResultContent');
                
                let html = `<p style="color:var(--text-main);"><strong>数据库记录总数：</strong>${d.totalRecords} | <strong>物理文件存在记录：</strong>${d.validRecordsCount} | <strong>文件缺失记录：</strong><span style="color:#ef4444; font-weight:600;">${d.missingCount}</span> | <strong>未录入音频文件 (含子目录)：</strong><span style="color:#38bdf8; font-weight:600;">${d.untrackedCount}</span></p>`;

                if (d.missingRecords && d.missingRecords.length > 0) {
                    html += `<p style="color:#ef4444; margin-bottom:4px; font-weight:600;"><strong>以下记录文件已不存在：</strong></p><ul style="padding-left:20px; margin:0 0 10px 0; color:var(--text-secondary); font-size:12px;">`;
                    d.missingRecords.slice(0, 5).forEach(m => {
                        html += `<li>${m.songName} (${m.artist}) - <code style="background:var(--tag-btn-bg); padding:1px 4px; border-radius:3px;">${m.filePath}</code></li>`;
                    });
                    if (d.missingRecords.length > 5) html += `<li>...及更多共 ${d.missingRecords.length} 项</li>`;
                    html += `</ul>`;
                }

                if (d.untrackedFiles && d.untrackedFiles.length > 0) {
                    html += `<div style="margin:10px 0; padding:10px; background:var(--untracked-box-bg); border:1px solid var(--untracked-box-border); border-radius:6px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                        <span style="color:var(--text-main); font-size:13px;">💡 搜寻到 <strong>${d.untrackedCount}</strong> 首本地已有物理音频文件未记录在数据库中，是否一键导入？</span>
                        <button class="btn-primary" style="background:linear-gradient(135deg, #10b981, #059669); padding:4px 12px; font-size:12px;" onclick="importUntrackedToDB()">📥 一键导入这 ${d.untrackedCount} 首音频至数据库</button>
                    </div>`;
                    html += `<p style="color:var(--text-main); margin-bottom:4px; font-weight:600;"><strong>磁盘物理存在但未录入数据库的音频文件 (全深度搜寻预览)：</strong></p><ul style="padding-left:20px; margin:0; color:var(--text-secondary); font-size:12px;">`;
                    d.untrackedFiles.slice(0, 10).forEach(u => {
                        html += `<li>${u.fileName} (${formatBytes(u.fileSize)}) - <code style="font-size:11px; background:var(--tag-btn-bg); padding:1px 4px; border-radius:3px;">${u.filePath}</code></li>`;
                    });
                    if (d.untrackedFiles.length > 10) html += `<li>...及更多共 ${d.untrackedFiles.length} 项</li>`;
                    html += `</ul>`;
                } else {
                    html += `<p style="color:#22c55e; font-weight:600;">✅ 所有磁盘物理音频文件均已与数据库完全映射对齐！</p>`;
                }

                content.innerHTML = html;
                box.style.display = 'block';

                loadHistoryStats();
                loadDownloadHistory(historyCurrentPage);
            }
        })
        .catch(err => alert("扫描失败: " + err));
}

async function importUntrackedToDB() {
    const ok = await showConfirm('确定要将所有扫描出的本地物理音频文件同步导入至数据库吗？', '导入未录入音频', { icon: '📥' });
    if (!ok) return;

    const box = document.getElementById('scanResultBox');
    if (box) box.style.opacity = '0.5';

    axios.post('/v2/history/importUntracked')
        .then(resp => {
            if (resp.data.code === '000000') {
                showToast(`🎉 成功将 ${resp.data.data} 首本地物理音频文件导入至数据库历史列表！`, 'success', 4000);
                document.getElementById('scanResultBox').style.display = 'none';
                loadHistoryStats();
                loadDownloadHistory(1);
            } else {
                showAlert('导入失败：' + resp.data.msg, '导入异常', '⚠️');
            }
        })
        .catch(err => showToast("批量导入失败: " + err, 'error'))
        .finally(() => {
            if (box) box.style.opacity = '1';
        });
}

async function cleanMissingHistory() {
    const ok = await showConfirm('确定要从数据库中清理所有文件已不存在的失效记录吗？', '清理失效记录', { icon: '🧹', danger: true, confirmText: '立即清理' });
    if (!ok) return;

    axios.post('/v2/history/cleanMissing')
        .then(resp => {
            if (resp.data.code === '000000') {
                showToast(`✅ 已清理 ${resp.data.data} 条失效记录！`, 'success', 3500);
                document.getElementById('scanResultBox').style.display = 'none';
                loadHistoryStats();
                loadDownloadHistory(1);
            }
        })
        .catch(err => showToast("清理失败: " + err, 'error'));
}

async function deleteHistoryItem(id) {
    const ok = await showConfirm('确定要删除此条下载历史记录吗？', '删除历史记录', { icon: '🗑️', danger: true, confirmText: '删除' });
    if (!ok) return;

    axios.delete(`/v2/history/delete?id=${id}`)
        .then(resp => {
            if (resp.data.code === '000000') {
                showToast('已删除该条历史记录', 'info', 2000);
                loadHistoryStats();
                loadDownloadHistory(historyCurrentPage);
            }
        })
        .catch(err => showToast("删除失败: " + err, 'error'));
}

/* ==========================================================================
   📱 浏览器离线缓存管理 (Browser Cache API Management)
   ========================================================================== */

async function loadBrowserCacheList() {
    if (!('caches' in window)) {
        alert('当前浏览器不支持 Cache API 或未在 HTTPS/PWA 环境下运行');
        return;
    }
    
    const list = document.getElementById("browser-cache-list");
    if (list) list.innerHTML = '<li style="padding:15px; text-align:center; color:#888;">正在扫描浏览器缓存...</li>';
    
    try {
        const cacheNames = await caches.keys();
        let allRequests = [];
        for (const cName of cacheNames) {
            const cache = await caches.open(cName);
            const reqs = await cache.keys();
            allRequests.push(...reqs);
        }
        
        // 过滤仅提取音频流缓存
        const rawUrls = allRequests.map(r => r.url).filter(url => 
            url.includes('/v2/stream') || url.includes('/history/stream') || url.includes('/v2/history/stream')
        );

        // 统一转为相对路径并去重，同时智能合并别名（优先保留含 historyId 或更长参数的真实流地址）
        const urlMap = new Map();
        for (const fullUrl of rawUrls) {
            const relUrl = fullUrl.replace(window.location.origin, '');
            const idMatch = relUrl.match(/[?&]id=(\d+)/);
            const historyIdMatch = relUrl.match(/[?&]historyId=(\d+)/);
            
            const historyId = historyIdMatch ? parseInt(historyIdMatch[1], 10) : null;
            const songId = idMatch ? parseInt(idMatch[1], 10) : null;

            // 构造去重唯一标识：优先使用 historyId，其次 songId，最后 fallback 为完整 relUrl
            let dedupeKey = relUrl;
            if (historyId && historyId > 0) {
                dedupeKey = `history_${historyId}`;
            } else if (songId && songId > 0) {
                dedupeKey = `song_${songId}`;
            }

            if (!urlMap.has(dedupeKey) || relUrl.length > urlMap.get(dedupeKey).relUrl.length) {
                urlMap.set(dedupeKey, {
                    fullUrl: fullUrl,
                    relUrl: relUrl,
                    songId: songId,
                    historyId: historyId
                });
            }
        }

        const uniqueItems = Array.from(urlMap.values());
        document.getElementById('cache-stat-total').textContent = uniqueItems.length;

        if (uniqueItems.length === 0) {
            if (list) list.innerHTML = '<li style="padding:15px; text-align:center; color:#888;">当前设备浏览器暂无离线音乐缓存</li>';
            estimateBrowserCacheSize();
            return;
        }

        // 读取本地元数据
        const metaMap = typeof getCachedTrackMetaMap === 'function' ? getCachedTrackMetaMap() : {};

        // 收集需要从后端数据库异步批量补充元数据的 historyIds 与 songIds
        const needHistoryIds = [];
        const needSongIds = [];

        uniqueItems.forEach(item => {
            const meta = metaMap[item.relUrl] || metaMap[item.fullUrl] || {};
            if (!meta.songName || meta.songName === '未知歌曲') {
                if (item.historyId && item.historyId > 0) {
                    needHistoryIds.push(item.historyId);
                } else if (item.songId && item.songId > 0) {
                    needSongIds.push(item.songId);
                }
            }
        });

        // 如果有缺失信息，批量调用后端 API 补全
        if (needHistoryIds.length > 0 || needSongIds.length > 0) {
            try {
                const batchResp = await axios.post('/v2/history/batch_detail', {
                    historyIds: [...new Set(needHistoryIds)],
                    songIds: [...new Set(needSongIds)]
                });

                if (batchResp.data && batchResp.data.code === '000000' && batchResp.data.data) {
                    const byHistory = batchResp.data.data.byHistoryId || [];
                    const bySong = batchResp.data.data.bySongId || [];

                    byHistory.forEach(record => {
                        const recHistoryId = record.id;
                        uniqueItems.forEach(it => {
                            if (it.historyId === recHistoryId) {
                                const newMeta = {
                                    id: record.songId || it.songId,
                                    songName: record.songName,
                                    artist: record.artist,
                                    album: record.album,
                                    fileSize: record.fileSize
                                };
                                if (typeof saveCachedTrackMeta === 'function') {
                                    saveCachedTrackMeta(it.relUrl, newMeta);
                                }
                                metaMap[it.relUrl] = { ...(metaMap[it.relUrl] || {}), ...newMeta };
                            }
                        });
                    });

                    bySong.forEach(record => {
                        const recSongId = record.songId;
                        uniqueItems.forEach(it => {
                            if (it.songId === recSongId && !metaMap[it.relUrl]?.songName) {
                                const newMeta = {
                                    id: record.songId,
                                    songName: record.songName,
                                    artist: record.artist,
                                    album: record.album,
                                    fileSize: record.fileSize
                                };
                                if (typeof saveCachedTrackMeta === 'function') {
                                    saveCachedTrackMeta(it.relUrl, newMeta);
                                }
                                metaMap[it.relUrl] = { ...(metaMap[it.relUrl] || {}), ...newMeta };
                            }
                        });
                    });
                }
            } catch (err) {
                console.warn("[PWA] 批量获取缓存曲目信息失败:", err);
            }
        }

        // 渲染列表
        let html = '';
        uniqueItems.forEach(item => {
            const meta = metaMap[item.relUrl] || metaMap[item.fullUrl] || {};
            let songName = meta.songName;
            let artist = meta.artist;
            let fileSize = meta.fileSize || 0;
            let cover = meta.cover || '/favicon.png';
            let album = meta.album || '';

            // 兜底智能降级：从 URL 文件名中提炼歌名
            if (!songName || songName === '未知歌曲') {
                if (item.historyId) {
                    songName = `离线音轨 #${item.historyId}`;
                } else if (item.songId && item.songId > 0) {
                    songName = `离线单曲 #${item.songId}`;
                } else {
                    songName = item.relUrl.split('/').pop().split('?')[0] || '本地缓存音频';
                }
            }

            if (!artist) {
                artist = '浏览器已离线';
            }

            const sizeText = fileSize > 0 ? formatBytes(fileSize) : '离线存储';
            const safeName = (songName || '').replace(/'/g, "\\'");
            const safeArtist = (artist || '').replace(/'/g, "\\'");
            const safeCover = (cover || '').replace(/'/g, "\\'");
            const safeAlbum = (album || '').replace(/'/g, "\\'");

            html += `
                <li class="history-item-card">
                    <!-- 📌 第一排：歌名 100% 满宽全显 -->
                    <div class="card-title-row">
                        <strong class="card-song-name">${typeof escapeHtml === 'function' ? escapeHtml(songName) : songName}</strong>
                    </div>
                    <!-- 📌 第二排：左侧歌手大小状态 + 右侧按钮 -->
                    <div class="card-sub-row">
                        <div class="sub-left">
                            <span class="card-artist">${typeof escapeHtml === 'function' ? escapeHtml(artist) : artist}</span>
                            <span class="card-size">${sizeText}</span>
                            <span class="status-badge status-browser" title="已存储在当前设备浏览器，支持断网秒播">📲 离线</span>
                        </div>
                        <div class="sub-right">
                            <button class="action-btn btn-play" onclick="playAudioOnline('${encodeURI(item.relUrl)}', '${safeName}', '${safeArtist}', '${safeCover}', '${safeAlbum}')">▶ 播放</button>
                            <button class="action-btn btn-del" onclick="deleteBrowserCacheItem('${encodeURI(item.relUrl)}')">🗑 删除</button>
                        </div>
                    </div>
                </li>
            `;
        });

        if (list) list.innerHTML = html;
        estimateBrowserCacheSize();
        
    } catch(e) {
        if (list) list.innerHTML = `<li style="padding:15px; text-align:center; color:#ef4444;">扫描缓存失败: ${e.message}</li>`;
    }
}

async function deleteBrowserCacheItem(url) {
    const ok = await showConfirm('确定要从当前浏览器的离线缓存中删除此首歌曲吗？（删除后断网将无法播放）', '删除离线缓存', { icon: '📲', danger: true, confirmText: '删除缓存' });
    if (!ok) return;
    try {
        const decodedUrl = decodeURI(url);
        const cacheNames = await caches.keys();
        for (const cName of cacheNames) {
            const cache = await caches.open(cName);
            await cache.delete(decodedUrl);
            if (decodedUrl.startsWith('/')) {
                await cache.delete(window.location.origin + decodedUrl);
            } else {
                await cache.delete(decodedUrl.replace(window.location.origin, ''));
            }
        }
        if (typeof removeCachedTrackMeta === 'function') {
            removeCachedTrackMeta(decodedUrl);
        }
        loadBrowserCacheList();
        showToast("已删除该首离线歌曲缓存", "info", 2000);
    } catch(e) {
        showToast("删除缓存失败: " + e.message, "error");
    }
}

async function clearAllBrowserCache() {
    const ok = await showConfirm('确定要清空本浏览器的所有离线音乐吗？\n\n⚠️ 此操作仅删除您当前设备上的缓存，不会影响服务器端的文件。', '清空离线音乐', { icon: '🗑️', danger: true, confirmText: '清空所有缓存' });
    if (!ok) return;
    try {
        const cacheNames = await caches.keys();
        for (const cName of cacheNames) {
            const cache = await caches.open(cName);
            const reqs = await cache.keys();
            for (const req of reqs) {
                if (req.url.includes('/v2/stream') || req.url.includes('/history/stream')) {
                    await cache.delete(req);
                }
            }
        }
        localStorage.removeItem('pwa_cached_tracks_meta_v1');
        loadBrowserCacheList();
        showToast("✅ 已清空当前浏览器的所有离线音乐缓存！", "success", 3000);
    } catch(e) {
        showToast("清空失败: " + e.message, "error");
    }
}

async function estimateBrowserCacheSize() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
            const estimate = await navigator.storage.estimate();
            const usage = estimate.usage || 0;
            document.getElementById('cache-stat-size').textContent = formatBytes(usage);
        } catch(e) {
            console.warn("估算存储空间失败", e);
        }
    } else {
        document.getElementById('cache-stat-size').textContent = "当前浏览器不支持估算";
    }
}
