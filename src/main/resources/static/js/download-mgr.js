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
        alert('无法定位：缺少路径参数');
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
                alert(`📂 已为您复制 Mac 宿主机真实物理路径到剪贴板！\n\n物理路径：\n${fpath}\n\n💡 提示：在 Mac 桌面或 Finder 中按 Cmd + Shift + G，直接粘贴即可跳转！`);
            } else {
                alert('定位提示：' + (resp.data.msg || resp.data.message));
            }
        })
        .catch(err => {
            if (rawPath) {
                alert(`📂 已复制物理路径到剪贴板！\n\n${rawPath}`);
            } else {
                alert('请求定位接口失败：' + err);
            }
        });
}

function playLocalFile(path, songName, artist) {
    if (!path) return;
    const streamUrl = '/v2/history/stream?path=' + encodeURIComponent(path);
    if (typeof playAudioOnline === 'function') {
        playAudioOnline(streamUrl, songName, artist, '/favicon.png', '本地下载音乐 (支持 HTML5 试听播放)');
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
                    li.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid #eee; background:' + (item.fileExists ? '#fff' : '#fff0f0') + ';';
                    
                    const fileStatusTag = item.fileExists 
                        ? '<span style="background:#e6f7ff; color:#1890ff; padding:2px 6px; border-radius:4px; font-size:12px; margin-left:6px;">文件正常</span>'
                        : '<span style="background:#fff2f0; color:#ff4d4f; padding:2px 6px; border-radius:4px; font-size:12px; margin-left:6px; font-weight:bold;">⚠️ 文件已删除或移走</span>';

                    const hostPath = item.hostFilePath || item.filePath || '';

                    li.innerHTML = `
                        <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:15px;">
                            <strong style="font-size:14px;">${item.songName || '未知歌曲'}</strong>
                            <span style="color:#666; font-size:13px; margin-left:8px;">${item.artist ? ' - ' + item.artist : ''}</span>
                            <span style="color:#999; font-size:12px; margin-left:8px;">[${item.album || '专辑'}]</span>
                            ${fileStatusTag}
                            <div style="font-size:12px; color:#888; margin-top:3px;">
                                大小：${formatBytes(item.fileSize)} | 时间：${item.createdAt || ''}
                                <span style="margin-left:10px; color:#555; font-family:monospace;" title="${hostPath}">宿主机物理路径: ${hostPath}</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:6px; flex-shrink:0;">
                            ${item.fileExists ? `<button class="jump-link-btn" style="background:#e8f0fe; color:#1a73e8; border-color:#d2e3fc;" onclick="playLocalFile('${encodeURIComponent(item.relativePath || item.filePath)}', '${(item.songName||'').replace(/'/g, "\\'")}', '${(item.artist||'').replace(/'/g, "\\'")}')">▶️ 播放</button>` : ''}
                            ${item.fileExists ? `<button class="jump-link-btn" onclick="revealFile('${encodeURIComponent(hostPath)}')">📂 定位/复制路径</button>` : ''}
                            <button class="jump-link-btn" style="color:#d9534f;" onclick="deleteHistoryItem(${item.id})">🗑 删除记录</button>
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

function scanDiskFiles() {
    axios.post('/v2/history/scan')
        .then(resp => {
            if (resp.data.code === '000000') {
                const d = resp.data.data || {};
                const box = document.getElementById('scanResultBox');
                const content = document.getElementById('scanResultContent');
                
                let html = `<p><strong>数据库记录总数：</strong>${d.totalRecords} | <strong>物理文件存在记录：</strong>${d.validRecordsCount} | <strong>文件缺失记录：</strong><span style="color:red;">${d.missingCount}</span> | <strong>未录入音频文件 (含子目录)：</strong><span style="color:#31708f;">${d.untrackedCount}</span></p>`;

                if (d.missingRecords && d.missingRecords.length > 0) {
                    html += `<p style="color:#d9534f; margin-bottom:4px;"><strong>以下记录文件已不存在：</strong></p><ul style="padding-left:20px; margin:0 0 10px 0;">`;
                    d.missingRecords.slice(0, 5).forEach(m => {
                        html += `<li>${m.songName} (${m.artist}) - <code>${m.filePath}</code></li>`;
                    });
                    if (d.missingRecords.length > 5) html += `<li>...及更多共 ${d.missingRecords.length} 项</li>`;
                    html += `</ul>`;
                }

                if (d.untrackedFiles && d.untrackedFiles.length > 0) {
                    html += `<div style="margin:10px 0; padding:10px; background:#e6f7ff; border:1px solid #91d5ff; border-radius:6px; display:flex; align-items:center; justify-content:space-between;">
                        <span>💡 搜寻到 <strong>${d.untrackedCount}</strong> 首本地已有物理音频文件未记录在数据库中，是否一键导入？</span>
                        <button class="btn-primary" style="background:#52c41a; border-color:#389e0d; padding:4px 12px;" onclick="importUntrackedToDB()">📥 一键导入这 ${d.untrackedCount} 首音频至数据库</button>
                    </div>`;
                    html += `<p style="color:#31708f; margin-bottom:4px;"><strong>磁盘物理存在但未录入数据库的音频文件 (全深度搜寻预览)：</strong></p><ul style="padding-left:20px; margin:0;">`;
                    d.untrackedFiles.slice(0, 10).forEach(u => {
                        html += `<li>${u.fileName} (${formatBytes(u.fileSize)}) - <code style="font-size:11px; color:#777;">${u.filePath}</code></li>`;
                    });
                    if (d.untrackedFiles.length > 10) html += `<li>...及更多共 ${d.untrackedFiles.length} 项</li>`;
                    html += `</ul>`;
                } else {
                    html += `<p style="color:#5cb85c;">✅ 所有磁盘物理音频文件均已与数据库完全映射对齐！</p>`;
                }

                content.innerHTML = html;
                box.style.display = 'block';

                loadHistoryStats();
                loadDownloadHistory(historyCurrentPage);
            }
        })
        .catch(err => alert("扫描失败: " + err));
}

function importUntrackedToDB() {
    if (!confirm('确定要将所有扫描出的本地物理音频文件同步导入至数据库吗？')) return;

    const box = document.getElementById('scanResultBox');
    if (box) box.style.opacity = '0.5';

    axios.post('/v2/history/importUntracked')
        .then(resp => {
            if (resp.data.code === '000000') {
                alert(`🎉 成功将 ${resp.data.data} 首本地物理音频文件导入至数据库历史列表！`);
                document.getElementById('scanResultBox').style.display = 'none';
                loadHistoryStats();
                loadDownloadHistory(1);
            } else {
                alert('导入失败：' + resp.data.msg);
            }
        })
        .catch(err => alert("批量导入失败: " + err))
        .finally(() => {
            if (box) box.style.opacity = '1';
        });
}

function cleanMissingHistory() {
    if (!confirm('确定要从数据库中清理所有文件已不存在的失效记录吗？')) return;

    axios.post('/v2/history/cleanMissing')
        .then(resp => {
            if (resp.data.code === '000000') {
                alert(`✅ 已清理 ${resp.data.data} 条失效记录！`);
                document.getElementById('scanResultBox').style.display = 'none';
                loadHistoryStats();
                loadDownloadHistory(1);
            }
        })
        .catch(err => alert("清理失败: " + err));
}

function deleteHistoryItem(id) {
    if (!confirm('确定要删除此条下载历史记录吗？')) return;

    axios.delete(`/v2/history/delete?id=${id}`)
        .then(resp => {
            if (resp.data.code === '000000') {
                loadHistoryStats();
                loadDownloadHistory(historyCurrentPage);
            }
        })
        .catch(err => alert("删除失败: " + err));
}
