/* ==========================================================================
   📁 NetEase Music Downloader - Playlist Module (playlist.js)
   ========================================================================== */

let currentPage = 1;
let currentPlaylist = null;
let allTracks = [];
const pageSize = 10;

// 歌单管理模式状态
let isManageMode = false;
let selectedTrackIds = new Set();

function getValidArtistNames(track) {
    if (!track) return '';
    let arNames = track.artists || (track.ar ? track.ar.map(a => a.name).join('/') : '');
    if (!arNames || arNames === 'null' || arNames === 'undefined' || arNames.trim() === '') {
        return '';
    }
    return arNames;
}

function renderMyPlaylistsDOM(playlists, filterType) {
    const list = document.getElementById("playlist-list");
    if (!list) return;
    list.innerHTML = "";
    
    let filtered = playlists || [];
    if (filterType === 'created') {
        filtered = filtered.filter(pl => pl.subscribed === false || pl.subscribed === null || pl.subscribed === undefined);
    } else if (filterType === 'subscribed') {
        filtered = filtered.filter(pl => pl.subscribed === true);
    }

    if (filtered.length === 0) {
        const labelMap = { 'created': '创建的', 'subscribed': '收藏的', 'all': '' };
        list.innerHTML = `<li style="color:var(--text-muted); font-size:13px; padding:16px; justify-content:center;">暂无${labelMap[filterType] || ''}歌单记录</li>`;
        return;
    }
    
    filtered.forEach((pl, idx) => {
        const li = document.createElement("li");
        const isSubscribed = (pl.subscribed === true);
        const tag = isSubscribed 
            ? '<span class="status-badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.25); font-weight:600; margin-right:6px;">收藏</span>' 
            : '<span class="status-badge" style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.25); font-weight:600; margin-right:6px;">创建</span>';
        
        const safeName = (pl.name || '').replace(/'/g, "\\'");
        
        // 收藏歌单提供「💔 取消收藏」；非第一个自建歌单提供「🗑️ 删除」
        let actionBtnHtml = '';
        if (isSubscribed) {
            actionBtnHtml = `<button class="jump-link-btn" style="background:rgba(239,68,68,0.1); color:#f87171; border-color:rgba(239,68,68,0.25); font-size:11px; margin-right:4px;" onclick="event.stopPropagation(); togglePlaylistSubscribe('${pl.id}', '${safeName}', true)" title="取消收藏该歌单">💔 取消收藏</button>`;
        } else if (idx > 0) {
            actionBtnHtml = `<button class="jump-link-btn" style="background:rgba(239,68,68,0.08); color:#f87171; border-color:rgba(239,68,68,0.2); font-size:11px; margin-right:4px;" onclick="event.stopPropagation(); deleteMyCreatedPlaylist('${pl.id}', '${safeName}')" title="删除该自建歌单">🗑️ 删除</button>`;
        }

        li.innerHTML = `
            <div style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; margin-right:6px;">
                ${tag}
                <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-main); cursor:pointer;" onclick="jumpToPlaylistDetail('${pl.id}')" title="查看歌单详情">${pl.name}</strong> 
                <span style="color:var(--text-muted); font-size:11px; margin-left:4px; flex-shrink:0;">(${pl.trackCount || 0}首)</span>
            </div>
            <div style="display:flex; align-items:center; flex-shrink:0;">
                ${actionBtnHtml}
                <button class="jump-link-btn" onclick="jumpToPlaylistDetail('${pl.id}')">👉 查看详情</button>
            </div>
        `;
        list.appendChild(li);
    });
}

function loadMyPlaylists(filterType) {
    filterType = filterType || 'created';
    
    // ⚡ 1. SWR 优先从本地缓存秒开渲染
    const cached = typeof getApiCache === 'function' ? getApiCache('my_playlists') : null;
    if (cached && cached.data && cached.data.playlists) {
        renderMyPlaylistsDOM(cached.data.playlists, filterType);
    }

    // 🔄 2. 并行后台请求最新数据
    axios.post('/MyPlaylist')
        .then(resp => {
            const newPlaylists = (resp.data && resp.data.data && resp.data.data.playlists) || [];
            const oldPlaylists = (cached && cached.data && cached.data.playlists) || [];
            
            const isChanged = !cached || JSON.stringify(newPlaylists.map(p => p.id + '_' + p.trackCount)) !== JSON.stringify(oldPlaylists.map(p => p.id + '_' + p.trackCount));
            
            if (isChanged) {
                if (typeof setApiCache === 'function') {
                    setApiCache('my_playlists', resp.data.data);
                }
                renderMyPlaylistsDOM(newPlaylists, filterType);
            }
        })
        .catch(err => {
            if (!cached) {
                showToast("加载歌单失败：" + err, "error");
            }
        });
}

function renderPlaylistDetailUI(playlist) {
    if (!playlist) return;
    currentPlaylist = playlist;
    allTracks = playlist.tracks || [];
    currentPage = 1;
    isManageMode = false;
    selectedTrackIds.clear();

    const infoDiv = document.getElementById("playlist-info");
    if (!infoDiv) return;

    const isSubscribed = (playlist.subscribed === true);
    const isCreator = (playlist.isCreator === true);
    const safeName = (playlist.name || '').replace(/'/g, "\\'");

    // 操作按钮：自建歌单显示「管理曲目」；别人的歌单显示「📦 转存为自建歌单」、「✏️ 挑选曲目」以及「⭐ 收藏 / 💔 取消收藏」
    let manageBtnHtml = '';
    if (isCreator) {
        manageBtnHtml = `<button class="btn-primary flex-1-btn" id="btnManageTracks" style="background:linear-gradient(135deg, #6366f1, #4f46e5);" onclick="togglePlaylistManageMode()">✏️ 管理曲目</button>`;
    } else {
        const subBtn = isSubscribed
            ? `<button class="btn-primary flex-1-btn" id="btnSubscribeToggle" style="background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3);" onclick="togglePlaylistSubscribe('${playlist.id}', '${safeName}', true)">💔 取消收藏</button>`
            : `<button class="btn-primary flex-1-btn" id="btnSubscribeToggle" style="background:linear-gradient(135deg, #f59e0b, #d97706); box-shadow:0 2px 8px rgba(245,158,11,0.3);" onclick="togglePlaylistSubscribe('${playlist.id}', '${safeName}', false)">⭐ 收藏歌单</button>`;

        manageBtnHtml = `
            <button class="btn-primary flex-1-btn" style="background:linear-gradient(135deg, #8b5cf6, #7c3aed); box-shadow:0 2px 8px rgba(139,92,246,0.3);" onclick="showForkPlaylistModal()" title="新建为自己的自建歌单">📦 转存为自建歌单</button>
            <button class="btn-primary flex-1-btn" id="btnManageTracks" style="background:linear-gradient(135deg, #6366f1, #4f46e5);" onclick="togglePlaylistManageMode()">✏️ 挑选曲目</button>
            ${subBtn}
        `;
    }

    infoDiv.innerHTML = `
        <div class="detail-header-card">
            <img src="${playlist.coverImgUrl || '/favicon.png'}" alt="封面" class="detail-cover-img">
            <div class="detail-header-info">
                <h4 class="detail-header-title">${playlist.name || '未知歌单'}</h4>
                <div class="detail-header-sub">创建人：${playlist.creator || '未知'} | 共 ${playlist.trackCount || allTracks.length} 首歌</div>
                <div class="detail-btn-group" style="flex-wrap:wrap; gap:8px;">
                    <button class="btn-primary flex-1-btn" onclick="downloadPlaylist('${playlist.id}')">🖥️ 下载到电脑</button>
                    <button class="btn-primary flex-1-btn" id="playlist-cache-btn" style="background:#0284c7;" onclick="cacheTracksToPhoneBatch(allTracks, 'playlist-cache-btn', '📲 缓存到浏览器')">📲 缓存到浏览器 (计算中...)</button>
                    <button class="btn-primary flex-1-btn" style="background:#22c55e;" onclick="playFullCurrentPlaylist()">▶️ 播放歌单</button>
                    ${manageBtnHtml}
                </div>
            </div>
        </div>
        <div id="playlistManageActionBar" class="manage-action-bar" style="display:none;"></div>
    `;
    renderPage(currentPage);
    refreshPhoneCacheBtn(allTracks, 'playlist-cache-btn', '📲 缓存到浏览器');
    const pagination = document.getElementById("playlist-pagination");
    if (pagination) pagination.style.display = allTracks.length > 0 ? "flex" : "none";
}

function loadPlaylistDetail() {
    const id = document.getElementById("playlistId").value;
    if (!id) {
        showToast("请输入歌单 ID", "warning");
        return;
    }

    const infoDiv = document.getElementById("playlist-info");
    const tracksList = document.getElementById("playlist-tracks");
    const pagination = document.getElementById("playlist-pagination");

    // ⚡ 1. SWR 优先从本地缓存秒开渲染
    const cacheKey = 'playlist_' + id;
    const cached = typeof getApiCache === 'function' ? getApiCache(cacheKey) : null;
    let hasRenderedCache = false;

    if (cached && cached.data && cached.data.playlist && cached.data.playlist.tracks && cached.data.playlist.tracks.length > 0) {
        renderPlaylistDetailUI(cached.data.playlist);
        hasRenderedCache = true;
    } else {
        if (infoDiv) {
            infoDiv.innerHTML = `<div style="padding:30px; text-align:center; color:var(--text-secondary); font-size:14px;"><span style="display:inline-block; animation:spin 1s linear infinite; margin-right:8px;">🔄</span>正在连接网易云服务器解析歌单曲目，请稍候...</div>`;
        }
        if (tracksList) tracksList.innerHTML = "";
        if (pagination) pagination.style.display = "none";
    }
    
    // 🔄 2. 并行后台请求最新数据
    axios.post('/Playlist', new URLSearchParams({ id }))
        .then(resp => {
            const playlist = resp.data && resp.data.data ? resp.data.data.playlist : null;
            if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
                if (!hasRenderedCache && infoDiv) {
                    infoDiv.innerHTML = `<div style="padding:20px; text-align:center; color:#ef4444;">未找到歌单数据或歌单为空（ID: ${id}）</div>`;
                }
                return;
            }

            const oldPlaylist = cached ? cached.data.playlist : null;
            const isChanged = !hasRenderedCache || !isFastDataEqual(oldPlaylist, playlist);

            if (isChanged) {
                if (typeof setApiCache === 'function') {
                    setApiCache(cacheKey, resp.data.data);
                }
                renderPlaylistDetailUI(playlist);
            }
        })
        .catch(err => {
            if (!hasRenderedCache) {
                if (infoDiv) {
                    infoDiv.innerHTML = `<div style="padding:20px; text-align:center; color:#ef4444;">获取歌单详情失败：${err}</div>`;
                }
                showToast("获取歌单详情失败：" + err, "error");
            }
        });
}

function renderPage(page) {
    const list = document.getElementById("playlist-tracks");
    list.innerHTML = "";
    
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, allTracks.length);
    const pageTracks = allTracks.slice(start, end);

    pageTracks.forEach((track, index) => {
        const li = document.createElement("li");
        const trackId = track.id || track.songId;
        const isSelected = selectedTrackIds.has(String(trackId));
        li.className = "track-item-card" + (isManageMode ? " manage-mode" : "") + (isSelected ? " selected" : "");
        const trackIndex = start + index + 1;
        const artistDisplay = getValidArtistNames(track);
        const artistHtml = artistDisplay ? ` - ${artistDisplay}` : '';

        const localBadge = `<span id="badge-pl-${trackId}" class="status-badge icon-only" style="margin-left:6px; display:none;"></span>`;
        const slotsHtml = renderTrackCapsuleSlotsHtml(track, 'pl-');

        const checkboxHtml = isManageMode
            ? `<input type="checkbox" class="track-select-checkbox" data-id="${trackId}" ${isSelected ? "checked" : ""} onclick="event.stopPropagation(); toggleTrackSelection('${trackId}')" style="margin-right:10px; cursor:pointer; width:16px; height:16px;">`
            : '';

        const manageDeleteBtn = isManageMode
            ? `<button class="jump-link-btn" style="background:rgba(239,68,68,0.12); color:#ef4444; border-color:rgba(239,68,68,0.25); margin-left:6px; font-size:11px; padding:4px 8px;" onclick="event.stopPropagation(); removeSingleTrackFromCurrentPlaylist('${trackId}', '${(track.name || '').replace(/'/g, "\\'")}')" title="从歌单移除该歌曲">🗑️ 移除</button>`
            : '';

        li.innerHTML = `
            <div class="track-title-row" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:10px; display:flex; align-items:center;">
                ${checkboxHtml}
                <strong class="clickable-track-title" onclick="jumpToSongDetail('${trackId}')" title="点击查看单曲详细信息" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${trackIndex}. ${track.name}</strong>${artistHtml}${localBadge}
            </div>
            <div style="display:flex; align-items:center;">
                ${slotsHtml}
                ${manageDeleteBtn}
            </div>
        `;

        if (isManageMode) {
            li.onclick = () => toggleTrackSelection(trackId);
        }

        list.appendChild(li);
    });

    const totalPages = Math.ceil(allTracks.length / pageSize) || 1;
    document.getElementById("page-indicator").textContent = `第 ${page} 页 / 共 ${totalPages} 页 (共 ${allTracks.length} 首)`;
    document.getElementById("prev-page").disabled = (page <= 1);
    document.getElementById("next-page").disabled = (page >= totalPages);

    asyncUpdateListBadges(pageTracks, 'pl-');
    updateManageActionBar();
}

function playFullCurrentPlaylist() {
    if (!allTracks || allTracks.length === 0) {
        showToast("暂无歌单歌曲数据！", "warning");
        return;
    }
    const formattedQueue = allTracks.map(t => ({
        id: t.id,
        name: t.name,
        artist: getValidArtistNames(t),
        cover: (t.al && t.al.picUrl) ? t.al.picUrl : '/favicon.png',
        isLocal: (t.isLocal === true)
    }));
    if (typeof setGlobalPlaylistQueue === 'function') {
        setGlobalPlaylistQueue(formattedQueue, 0);
    }
}

function changePage(delta) {
    const totalPages = Math.ceil(allTracks.length / pageSize) || 1;
    const targetPage = currentPage + delta;
    if (targetPage >= 1 && targetPage <= totalPages) {
        currentPage = targetPage;
        renderPage(currentPage);
    }
}

function downloadPlaylist(id) {
    axios.get(`/v2/playlist?id=${id}`)
        .then(resp => {
            showToast("已提交歌单下载任务！已在右下角开启监控面板...", "success", 3000);
            fetchDownloadTasks();
        })
        .catch(err => showToast("提交歌单下载失败：" + err, "error"));
}

/* ==========================================================================
   ✨ 歌单管理与曲目增删交互功能 (Playlist Management Features)
   ========================================================================== */

/**
 * 收藏 / 取消收藏歌单
 */
function togglePlaylistSubscribe(plId, plName, isCurrentlySubscribed) {
    if (!plId) return;

    const actionText = isCurrentlySubscribed ? '取消收藏' : '收藏';
    const modalIcon = isCurrentlySubscribed ? '💔' : '⭐';
    const noteHtml = !isCurrentlySubscribed 
        ? `<div style="margin-top:10px; padding:8px 12px; background:rgba(245,158,11,0.08); border-left:3px solid #f59e0b; border-radius:4px; font-size:12px; color:var(--text-secondary);">
             💡 <strong>提示</strong>：网易云官方近期对第三方客户端收藏他人歌单有设备安全风控。如遇限制，亦可在官方 App 收藏后在此同步加载。
           </div>
           <div style="margin-top:12px; padding-top:10px; border-top:1px dashed var(--border-subtle);">
             <button class="btn-primary" type="button" style="margin:0; width:100%; padding:9px 12px; font-size:13px; background:linear-gradient(135deg, #8b5cf6, #7c3aed); box-shadow:0 2px 8px rgba(139,92,246,0.3);" onclick="document.querySelector('#modalCloseBtn')?.click(); jumpToPlaylistDetail('${plId}')">
               👉 前往查看歌单详情（可一键转存为自建歌单）
             </button>
           </div>`
        : '';

    showAppModal({
        title: `${actionText}歌单`,
        icon: modalIcon,
        content: `<div style="line-height:1.6; color:var(--text-secondary); text-align:left;">
                    确定要${actionText}歌单「<strong>${escapeHtml(plName || plId)}</strong>」吗？
                    ${noteHtml}
                  </div>`,
        confirmText: `确定${actionText}`,
        cancelText: '取消',
        showCancel: true,
        danger: isCurrentlySubscribed
    }).then(confirmed => {
        if (!confirmed) return;
        
        axios.post('/v2/playlist/subscribe', new URLSearchParams({
            id: plId,
            subscribe: String(!isCurrentlySubscribed)
        }))
        .then(resp => {
            if (resp.data && resp.data.code === '000000') {
                showToast(`已成功${actionText}歌单「${plName}」！`, 'success');
                if (typeof deleteApiCache === 'function') {
                    deleteApiCache('my_playlists');
                    deleteApiCache('playlist_' + plId);
                }
                if (typeof loadMyPlaylists === 'function') {
                    loadMyPlaylists('subscribed');
                }
                // 如果当前正在查看该歌单详情，刷新按钮状态
                if (currentPlaylist && String(currentPlaylist.id) === String(plId)) {
                    currentPlaylist.subscribed = !isCurrentlySubscribed;
                    renderPlaylistDetailUI(currentPlaylist);
                }
            } else {
                const errMsg = (resp.data && resp.data.msg) || `${actionText}失败`;
                showToast(errMsg, 'error');
            }
        })
        .catch(err => showToast(`${actionText}失败：` + err, 'error'));
    });
}

/**
 * 删除自建歌单
 */
function deleteMyCreatedPlaylist(plId, plName) {
    if (!plId) return;
    showAppModal({
        title: '删除歌单',
        icon: '🗑️',
        content: `确定要删除自建歌单「${escapeHtml(plName || plId)}」吗？此操作不可恢复。`,
        confirmText: '确认删除',
        cancelText: '取消',
        showCancel: true,
        danger: true
    }).then(confirmed => {
        if (!confirmed) return;

        axios.post('/v2/playlist/delete', new URLSearchParams({ id: plId }))
        .then(resp => {
            if (resp.data && resp.data.code === '000000') {
                showToast(`歌单「${plName}」已成功删除`, 'success');
                if (typeof deleteApiCache === 'function') {
                    deleteApiCache('my_playlists');
                    deleteApiCache('playlist_' + plId);
                }
                if (typeof loadMyPlaylists === 'function') {
                    loadMyPlaylists('created');
                }
            } else {
                const errMsg = (resp.data && resp.data.msg) || '删除失败';
                showToast(errMsg, 'error');
            }
        })
        .catch(err => showToast('删除歌单异常：' + err, 'error'));
    });
}

/**
 * 切换歌单曲目管理/挑选模式
 */
function togglePlaylistManageMode() {
    if (!currentPlaylist) return;
    isManageMode = !isManageMode;
    selectedTrackIds.clear();

    const isCreator = (currentPlaylist.isCreator === true);
    const manageBtn = document.getElementById('btnManageTracks');
    if (manageBtn) {
        if (isManageMode) {
            manageBtn.textContent = isCreator ? '✕ 退出管理' : '✕ 退出挑选';
            manageBtn.style.background = 'rgba(239,68,68,0.15)';
            manageBtn.style.color = '#f87171';
            manageBtn.style.border = '1px solid rgba(239,68,68,0.3)';
        } else {
            manageBtn.textContent = isCreator ? '✏️ 管理曲目' : '✏️ 挑选曲目';
            manageBtn.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5)';
            manageBtn.style.color = '';
            manageBtn.style.border = '';
        }
    }

    renderPage(currentPage);
}

/**
 * 勾选/反选单首曲目
 */
function toggleTrackSelection(trackId) {
    const sId = String(trackId);
    if (selectedTrackIds.has(sId)) {
        selectedTrackIds.delete(sId);
    } else {
        selectedTrackIds.add(sId);
    }
    renderPage(currentPage);
}

/**
 * 刷新底部管理/挑选工具栏
 */
function updateManageActionBar() {
    const bar = document.getElementById('playlistManageActionBar');
    if (!bar) return;

    if (!isManageMode) {
        bar.style.display = 'none';
        bar.innerHTML = '';
        return;
    }

    bar.style.display = 'flex';
    const count = selectedTrackIds.size;
    const isAllSelected = allTracks.length > 0 && selectedTrackIds.size === allTracks.length;
    const isCreator = currentPlaylist && (currentPlaylist.isCreator === true);

    let actionButtonsHtml = '';
    if (isCreator) {
        actionButtonsHtml = `
            <button class="btn-primary" style="margin:0; padding:6px 14px; font-size:12px; background:linear-gradient(135deg, #ef4444, #dc2626); box-shadow:0 2px 8px rgba(239,68,68,0.3);" onclick="batchRemoveSelectedTracks()" ${count === 0 ? 'disabled' : ''}>
                🗑️ 批量移除 (${count})
            </button>
        `;
    } else {
        actionButtonsHtml = `
            <button class="btn-primary" style="margin:0; padding:6px 14px; font-size:12px; background:linear-gradient(135deg, #8b5cf6, #7c3aed); box-shadow:0 2px 8px rgba(139,92,246,0.3);" onclick="showForkPlaylistModal(Array.from(selectedTrackIds))" ${count === 0 ? 'disabled' : ''}>
                📦 转存选中为新歌单 (${count})
            </button>
            <button class="btn-primary" style="margin:0; padding:6px 14px; font-size:12px; background:linear-gradient(135deg, #10b981, #059669); box-shadow:0 2px 8px rgba(16,185,129,0.3);" onclick="showAddToPlaylistModal(Array.from(selectedTrackIds))" ${count === 0 ? 'disabled' : ''}>
                ➕ 添加至自建歌单 (${count})
            </button>
        `;
    }

    bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <button class="btn-primary" style="margin:0; padding:6px 12px; font-size:12px; background:var(--bg-glass-card); border:1px solid var(--border-subtle); color:var(--text-main);" onclick="toggleSelectAllTracks()">
                ${isAllSelected ? '取消全选' : '全选全部 (' + allTracks.length + ')'}
            </button>
            <span style="font-size:13px; color:var(--text-secondary);">已选 <strong style="color:var(--accent-color);">${count}</strong> 首</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            ${actionButtonsHtml}
            <button class="btn-primary" style="margin:0; padding:6px 12px; font-size:12px; background:rgba(100,116,139,0.2); color:var(--text-muted);" onclick="togglePlaylistManageMode()">
                ✕ 退出
            </button>
        </div>
    `;
}

/**
 * 转存为我的自建歌单弹窗
 * @param {Array<string|number>} [customTrackIds] 自定义曲目 ID 列表，未传时默认转存当前歌单全量曲目
 */
function showForkPlaylistModal(customTrackIds) {
    if (!currentPlaylist) return;
    
    const targetIds = (Array.isArray(customTrackIds) && customTrackIds.length > 0)
        ? customTrackIds
        : allTracks.map(t => String(t.id || t.songId));

    if (targetIds.length === 0) {
        showToast("暂无可转存的歌曲！", "warning");
        return;
    }

    const defaultName = currentPlaylist.name || '我的转存歌单';
    window._forkPlaylistName = defaultName;
    window._forkIsPrivate = false;
    
    showAppModal({
        title: '转存为自建歌单',
        icon: '📦',
        content: `
            <div style="text-align:left; line-height:1.6;">
                <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">
                    将为您新建一个专属于您的账号自建歌单，并自动将 <strong style="color:var(--accent-color);">${targetIds.length}</strong> 首歌曲批量存入其中。
                </p>
                <div style="margin-bottom:14px;">
                    <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">新歌单名称：</label>
                    <input type="text" id="modalForkPlaylistName" value="${escapeHtml(defaultName)}" oninput="window._forkPlaylistName = this.value" style="width:100%; padding:9px 12px; background:var(--input-bg); border:1px solid var(--border-subtle); border-radius:8px; color:var(--text-main); font-size:14px;">
                </div>
                <div style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-secondary);">
                    <input type="checkbox" id="modalForkIsPrivate" onchange="window._forkIsPrivate = this.checked" style="cursor:pointer; width:16px; height:16px;">
                    <label for="modalForkIsPrivate" style="cursor:pointer;">设置为隐私歌单（仅自己可见）</label>
                </div>
            </div>
        `,
        confirmText: `确认转存 (${targetIds.length} 首)`,
        cancelText: '取消',
        showCancel: true
    }).then(confirmed => {
        if (!confirmed) {
            delete window._forkPlaylistName;
            delete window._forkIsPrivate;
            return;
        }

        const playlistName = (window._forkPlaylistName !== undefined ? window._forkPlaylistName : defaultName).trim();
        const isPrivate = Boolean(window._forkIsPrivate);
        delete window._forkPlaylistName;
        delete window._forkIsPrivate;

        if (!playlistName) {
            showToast("请输入新歌单名称", "warning");
            return;
        }

        showToast("正在创建歌单并批量转存歌曲...", "info", 4000);

        axios.post('/v2/playlist/fork', new URLSearchParams({
            name: playlistName,
            isPrivate: String(isPrivate),
            trackIds: targetIds.join(',')
        }))
        .then(resp => {
            if (resp.data && resp.data.code === '000000') {
                const newPl = resp.data.data;
                showToast(`🎉 成功转存 ${targetIds.length} 首歌曲至自建歌单「${playlistName}」！`, 'success', 4000);
                
                if (typeof deleteApiCache === 'function') {
                    deleteApiCache('my_playlists');
                }
                if (typeof loadMyPlaylists === 'function') {
                    loadMyPlaylists('created');
                }

                // 退出管理模式
                if (isManageMode) {
                    togglePlaylistManageMode();
                }

                // 自动载入并展示新建的自建歌单详情
                if (newPl && newPl.id) {
                    const inputEl = document.getElementById("playlistId");
                    if (inputEl) inputEl.value = newPl.id;
                    if (typeof loadPlaylistDetail === 'function') {
                        loadPlaylistDetail();
                    }
                }
            } else {
                const errMsg = (resp.data && resp.data.msg) || '转存失败';
                showToast(errMsg, 'error');
            }
        })
        .catch(err => showToast("转存歌单异常：" + err, "error"));
    });
}

/**
 * 快捷创建自建歌单弹窗
 */
function showCreatePlaylistModal() {
    window._newPlaylistName = '';
    window._newPlaylistIsPrivate = false;

    showAppModal({
        title: '新建自建歌单',
        icon: '➕',
        content: `
            <div style="text-align:left; line-height:1.6;">
                <div style="margin-bottom:14px;">
                    <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">歌单名称：</label>
                    <input type="text" id="modalCreatePlaylistName" placeholder="输入歌单名称" oninput="window._newPlaylistName = this.value" style="width:100%; padding:9px 12px; background:var(--input-bg); border:1px solid var(--border-subtle); border-radius:8px; color:var(--text-main); font-size:14px;">
                </div>
                <div style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-secondary);">
                    <input type="checkbox" id="modalCreateIsPrivate" onchange="window._newPlaylistIsPrivate = this.checked" style="cursor:pointer; width:16px; height:16px;">
                    <label for="modalCreateIsPrivate" style="cursor:pointer;">设置为隐私歌单（仅自己可见）</label>
                </div>
            </div>
        `,
        confirmText: '立即创建',
        cancelText: '取消',
        showCancel: true
    }).then(confirmed => {
        if (!confirmed) {
            delete window._newPlaylistName;
            delete window._newPlaylistIsPrivate;
            return;
        }

        const playlistName = (window._newPlaylistName || '').trim();
        const isPrivate = Boolean(window._newPlaylistIsPrivate);
        delete window._newPlaylistName;
        delete window._newPlaylistIsPrivate;

        if (!playlistName) {
            showToast("请输入歌单名称", "warning");
            return;
        }

        axios.post('/v2/playlist/create', new URLSearchParams({
            name: playlistName,
            isPrivate: String(isPrivate)
        }))
        .then(resp => {
            if (resp.data && resp.data.code === '000000') {
                showToast(`🎉 歌单「${playlistName}」创建成功！`, 'success');
                if (typeof deleteApiCache === 'function') {
                    deleteApiCache('my_playlists');
                }
                if (typeof loadMyPlaylists === 'function') {
                    loadMyPlaylists('created');
                }
            } else {
                const errMsg = (resp.data && resp.data.msg) || '创建失败';
                showToast(errMsg, 'error');
            }
        })
        .catch(err => showToast("创建歌单异常：" + err, "error"));
    });
}

/**
 * 全选 / 取消全选全部曲目
 */
function toggleSelectAllTracks() {
    if (selectedTrackIds.size === allTracks.length) {
        selectedTrackIds.clear();
    } else {
        selectedTrackIds.clear();
        allTracks.forEach(t => selectedTrackIds.add(String(t.id || t.songId)));
    }
    renderPage(currentPage);
}

/**
 * 从当前歌单移除单首歌曲
 */
function removeSingleTrackFromCurrentPlaylist(trackId, trackName) {
    if (!currentPlaylist || !trackId) return;
    showAppModal({
        title: '从歌单移除歌曲',
        icon: '🗑️',
        content: `确定将《${escapeHtml(trackName || '选定歌曲')}》从歌单「${escapeHtml(currentPlaylist.name)}」中移除吗？`,
        confirmText: '确认移除',
        cancelText: '取消',
        showCancel: true,
        danger: true
    }).then(confirmed => {
        if (!confirmed) return;

        axios.post('/v2/playlist/tracks/remove', new URLSearchParams({
            playlistId: currentPlaylist.id,
            trackIds: String(trackId)
        }))
        .then(resp => {
            if (resp.data && resp.data.code === '000000') {
                showToast(`已成功移除《${trackName}》`, 'success');
                // 内存中剔除并更新
                allTracks = allTracks.filter(t => String(t.id || t.songId) !== String(trackId));
                currentPlaylist.tracks = allTracks;
                currentPlaylist.trackCount = allTracks.length;
                selectedTrackIds.delete(String(trackId));
                
                if (typeof deleteApiCache === 'function') {
                    deleteApiCache('playlist_' + currentPlaylist.id);
                    deleteApiCache('my_playlists');
                }
                
                // 页码校准
                const totalPages = Math.ceil(allTracks.length / pageSize) || 1;
                if (currentPage > totalPages) currentPage = totalPages;
                renderPage(currentPage);
            } else {
                const errMsg = (resp.data && resp.data.msg) || '移除失败';
                showToast(errMsg, 'error');
            }
        })
        .catch(err => showToast('移除失败：' + err, 'error'));
    });
}

/**
 * 批量从当前歌单移除选中的歌曲
 */
function batchRemoveSelectedTracks() {
    if (!currentPlaylist || selectedTrackIds.size === 0) return;
    const idsArray = Array.from(selectedTrackIds);
    const count = idsArray.length;

    showAppModal({
        title: '批量移除歌曲',
        icon: '🗑️',
        content: `确定从歌单「${escapeHtml(currentPlaylist.name)}」中批量移除选中的 <strong>${count}</strong> 首歌曲吗？`,
        confirmText: `确认移除 (${count})`,
        cancelText: '取消',
        showCancel: true,
        danger: true
    }).then(confirmed => {
        if (!confirmed) return;

        axios.post('/v2/playlist/tracks/remove', new URLSearchParams({
            playlistId: currentPlaylist.id,
            trackIds: idsArray.join(',')
        }))
        .then(resp => {
            if (resp.data && resp.data.code === '000000') {
                showToast(`已成功移除 ${count} 首歌曲！`, 'success');
                const idSet = new Set(idsArray);
                allTracks = allTracks.filter(t => !idSet.has(String(t.id || t.songId)));
                currentPlaylist.tracks = allTracks;
                currentPlaylist.trackCount = allTracks.length;
                selectedTrackIds.clear();

                if (typeof deleteApiCache === 'function') {
                    deleteApiCache('playlist_' + currentPlaylist.id);
                    deleteApiCache('my_playlists');
                }

                const totalPages = Math.ceil(allTracks.length / pageSize) || 1;
                if (currentPage > totalPages) currentPage = totalPages;
                renderPage(currentPage);
            } else {
                const errMsg = (resp.data && resp.data.msg) || '批量移除失败';
                showToast(errMsg, 'error');
            }
        })
        .catch(err => showToast('批量移除失败：' + err, 'error'));
    });
}

window.togglePlaylistSubscribe = togglePlaylistSubscribe;
window.deleteMyCreatedPlaylist = deleteMyCreatedPlaylist;
window.togglePlaylistManageMode = togglePlaylistManageMode;
window.toggleTrackSelection = toggleTrackSelection;
window.toggleSelectAllTracks = toggleSelectAllTracks;
window.removeSingleTrackFromCurrentPlaylist = removeSingleTrackFromCurrentPlaylist;
window.batchRemoveSelectedTracks = batchRemoveSelectedTracks;

