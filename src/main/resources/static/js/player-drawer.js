/* ==========================================================================
   🎵 NetEase Music Downloader - Playlist Drawer & Floating Window (player-drawer.js)
   ========================================================================== */

let drawerFilterType = 'all'; // 'all', 'ready', 'server', 'browser'
let drawerSearchQuery = '';
let lastCachedUrlsForDrawer = [];
let currentDrawerMainTab = 'queue'; // 'queue', 'tasks'

const STORAGE_DRAWER_BOUNDS_KEY = "wyyyy_drawer_bounds";

function scrollToCurrentPlayingDrawerItem(smooth = true) {
    const list = document.getElementById("playlistDrawerList");
    if (!list) return;
    const activeEl = list.querySelector(".drawer-item.active");
    if (activeEl) {
        activeEl.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    }
}

function switchDrawerMainTab(tab) {
    currentDrawerMainTab = tab || 'queue';
    const tabQueue = document.getElementById("drawerTabQueue");
    const tabTasks = document.getElementById("drawerTabTasks");
    const viewQueue = document.getElementById("drawerQueueView");
    const viewTasks = document.getElementById("drawerTasksView");
    const trimBtn = document.getElementById("btnQueueTrim");
    const clearBtn = document.getElementById("drawerClearBtn");

    if (tabQueue) tabQueue.classList.toggle("active", currentDrawerMainTab === 'queue');
    if (tabTasks) tabTasks.classList.toggle("active", currentDrawerMainTab === 'tasks');

    if (viewQueue) viewQueue.style.display = (currentDrawerMainTab === 'queue') ? 'flex' : 'none';
    if (viewTasks) viewTasks.style.display = (currentDrawerMainTab === 'tasks') ? 'flex' : 'none';

    if (clearBtn) {
        clearBtn.title = (currentDrawerMainTab === 'queue') ? '清空播放列表' : '清空下载任务列表';
    }

    if (currentDrawerMainTab === 'queue') {
        renderPlaylistDrawer();
    } else {
        if (trimBtn) trimBtn.style.display = 'none';
        if (typeof fetchDownloadTasks === 'function') fetchDownloadTasks();
    }
}

function handleDrawerClear() {
    if (currentDrawerMainTab === 'queue') {
        clearPlaylistQueue();
    } else {
        if (typeof clearMonitorTasks === 'function') clearMonitorTasks();
    }
}

function openDrawerWithTab(tab) {
    const drawer = document.getElementById("playlistDrawer");
    if (drawer) {
        drawer.style.display = 'flex';
        switchDrawerMainTab(tab || 'queue');
        initDraggablePlaylistDrawer();
    }
}

function togglePlaylistDrawer() {
    const drawer = document.getElementById("playlistDrawer");
    if (drawer) {
        if (drawer.style.display === 'none' || !drawer.style.display) {
            drawer.style.display = 'flex';
            switchDrawerMainTab(currentDrawerMainTab);
            if (currentDrawerMainTab === 'queue') {
                renderPlaylistDrawer().then(() => {
                    setTimeout(() => scrollToCurrentPlayingDrawerItem(true), 50);
                });
            }
            initDraggablePlaylistDrawer();
        } else {
            drawer.style.display = 'none';
        }
    }
}

function updatePlaylistCountUI() {
    const c1 = document.getElementById("playlistCount");
    const c2 = document.getElementById("playlistDrawerCount");
    const len = typeof globalPlaylistQueue !== 'undefined' ? globalPlaylistQueue.length : 0;
    if (c1) c1.textContent = len;
    if (c2) c2.textContent = len;
    renderPlaylistDrawer();
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
    if (typeof savePlayerStateToStorage === 'function') savePlayerStateToStorage();
    renderPlaylistDrawer();
    showToast(`✂️ 裁剪完成，当前队列剩余 ${globalPlaylistQueue.length} 首`, "success");
}

function clearPlaylistQueue() {
    globalPlaylistQueue = [];
    currentQueueIndex = -1;
    updatePlaylistCountUI();
    if (typeof savePlayerStateToStorage === 'function') savePlayerStateToStorage();
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

    globalPlaylistQueue.splice(index, 1);

    if (index < currentQueueIndex) {
        currentQueueIndex--;
    } else if (isCurrentPlaying) {
        if (currentQueueIndex >= globalPlaylistQueue.length) {
            currentQueueIndex = 0;
        }
        if (typeof playTrackInQueue === 'function') {
            playTrackInQueue(currentQueueIndex);
        }
        return;
    }

    updatePlaylistCountUI();
    if (typeof savePlayerStateToStorage === 'function') savePlayerStateToStorage();
    renderPlaylistDrawer();
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
    const cachedUrls = typeof getAllCacheKeys === 'function' ? await getAllCacheKeys() : [];
    lastCachedUrlsForDrawer = cachedUrls;

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
        li.onclick = () => {
            if (typeof playTrackInQueue === 'function') playTrackInQueue(originalIndex);
        };
        
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

        const isLiked = (typeof isSongLiked === 'function') ? isSongLiked(trackIdSafe) : false;
        const heartSvg = (typeof getHeartSvgHtml === 'function') ? getHeartSvgHtml(isLiked, 14) : (isLiked ? '❤️' : '🤍');
        const heartClass = 'drawer-like-btn' + (isLiked ? ' active' : '');
        const heartTitle = isLiked ? '已喜欢 (点击取消红心)' : '喜欢 (点击添加红心)';

        li.innerHTML = `
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:8px; display:flex; align-items:center;" title="${trackTitle} - ${trackArtist}">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${isCurrent ? '🎵 ' : ''}<strong>${originalIndex + 1}. ${trackTitle}</strong> - <span style="font-size:12px; color:#888;">${trackArtist}</span>
                </span>
                ${badgeHtml}
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                <button class="${heartClass}" data-song-id="${trackIdSafe}" onclick="event.stopPropagation(); toggleLikeTrack('${trackIdSafe}', '${trackNameSafe}')" title="${heartTitle}">${heartSvg}</button>
                ${isCurrent ? '<span style="color:#22c55e; font-size:12px; font-weight:600;">播放中</span>' : ''}
                <button class="drawer-item-del-btn" onclick="removeFromPlaylistQueue(${originalIndex}, event)" title="从列表中移除">✕</button>
            </div>
        `;
        list.appendChild(li);
    });

    const drawer = document.getElementById("playlistDrawer");
    if (drawer && drawer.style.display !== 'none') {
        setTimeout(() => scrollToCurrentPlayingDrawerItem(true), 40);
    }
}

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

    restoreDrawerBoundsFromStorage();

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

window.togglePlaylistDrawer = togglePlaylistDrawer;
window.switchDrawerMainTab = switchDrawerMainTab;
window.handleDrawerClear = handleDrawerClear;
window.openDrawerWithTab = openDrawerWithTab;
window.updatePlaylistCountUI = updatePlaylistCountUI;
window.setDrawerFilter = setDrawerFilter;
window.onDrawerFilterChange = onDrawerFilterChange;
window.clearDrawerSearch = clearDrawerSearch;
window.getFilteredDrawerQueue = getFilteredDrawerQueue;
window.applyQueueTrim = applyQueueTrim;
window.clearPlaylistQueue = clearPlaylistQueue;
window.removeFromPlaylistQueue = removeFromPlaylistQueue;
window.renderPlaylistDrawer = renderPlaylistDrawer;
window.saveDrawerBoundsToStorage = saveDrawerBoundsToStorage;
window.restoreDrawerBoundsFromStorage = restoreDrawerBoundsFromStorage;
window.initDraggablePlaylistDrawer = initDraggablePlaylistDrawer;
window.toggleAutoSkipTrial = toggleAutoSkipTrial;
window.toggleOfflineOnlyMode = toggleOfflineOnlyMode;
