/* ==========================================================================
   🎵 NetEase Music Downloader - Main App Dispatcher & Entry (app.js)
   ========================================================================== */

/**
 * 切换顶部导航 Tab 标签页
 */
function switchTab(tabName, updateHash = true) {
    if (!tabName) return;

    // 兼容历史专辑 Tab 跳转至搜索 Tab 下的专辑解析卡片
    if (tabName === 'album') {
        switchTab('search', updateHash);
        if (typeof openAccordionCard === 'function') {
            openAccordionCard('card-album-detail');
        }
        return;
    }

    const targetTabId = tabName.startsWith('tab-') ? tabName : ('tab-' + tabName);
    const pureName = targetTabId.replace('tab-', '');

    // 1. 同步顶部 Tab 按钮 active 状态
    const tabLinks = document.querySelectorAll(".nav-tab-btn, .tab-btn");
    tabLinks.forEach(button => {
        const btnTabId = button.getAttribute("data-tab");
        if (btnTabId === targetTabId || btnTabId === pureName || button.id === 'tab-btn-' + pureName) {
            button.classList.add("active");
        } else {
            button.classList.remove("active");
        }
    });

    // 2. 同步 Tab 内容面板显隐与 active 类
    document.querySelectorAll(".tab-content").forEach(content => {
        if (content.id === targetTabId) {
            content.style.display = "block";
            content.classList.add("active");
        } else {
            content.style.display = "none";
            content.classList.remove("active");
        }
    });

    // 3. 更新浏览器地址栏 Hash
    if (updateHash && location.hash !== '#' + pureName) {
        history.pushState(null, null, '#' + pureName);
    }

    // 4. 触发对应 Tab 的数据预加载
    if (pureName === 'playlist' && typeof loadMyPlaylists === 'function') {
        loadMyPlaylists();
    }

    if (pureName === 'download-mgr') {
        if (typeof initFolderExplorerRoots === 'function') {
            initFolderExplorerRoots();
        }
        if (typeof loadDownloadHistory === 'function') {
            loadDownloadHistory(1);
        }
        if (typeof loadHistoryStats === 'function') {
            loadHistoryStats();
        }
    }
}
window.switchTab = switchTab;

/**
 * 设置 / 刷新 Cookie
 */
function handleSetCookie() {
    const cookie = document.getElementById("cookieInput").value.trim();
    if (!cookie) {
        showToast("请输入 Cookie", "warning");
        return;
    }
    axios.post('/setCookie', new URLSearchParams({ cookie: cookie }))
        .then(resp => {
            if (resp.data.code === "000000") {
                showToast("✅ 设置 Cookie 成功！", "success");
                if (typeof loadMyPlaylists === 'function') loadMyPlaylists();
            } else {
                showToast("设置 Cookie 失败：" + resp.data.msg, "error");
            }
        })
        .catch(err => showToast("请求失败：" + err, "error"));
}
window.handleSetCookie = handleSetCookie;

/**
 * 检查当前登录状态
 */
function checkLoginStatus() {
    axios.get('/login/status')
        .then(resp => {
            if (resp.data.code === "000000" && resp.data.data) {
                console.log("[Auth] 当前用户已登录, UID:", resp.data.data.uid || resp.data.data);
            }
        })
        .catch(() => {});
}
window.checkLoginStatus = checkLoginStatus;

/**
 * 🚀 应用 DOM 就绪全局挂载与核心事件监听
 */
document.addEventListener("DOMContentLoaded", function() {
    // 1. 初始化主题管理系统
    if (typeof initThemeEngine === 'function') {
        initThemeEngine();
    }

    // 2. 绑定顶部 Tab 导航按钮点击切换
    const tabLinks = document.querySelectorAll(".nav-tab-btn, .tab-btn");
    tabLinks.forEach(button => {
        button.addEventListener("click", () => {
            const targetTabId = button.getAttribute("data-tab");
            const tabName = targetTabId ? targetTabId.replace('tab-', '') : '';
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

    // 5. 尝试恢复播放器历史记忆
    if (typeof restorePlayerStateFromStorage === 'function') {
        restorePlayerStateFromStorage();
    }

    // 5.1 初始化红心歌曲 SWR 缓存 (Cache-First)
    if (typeof initLikedSongsCache === 'function') {
        initLikedSongsCache();
    }

    // 6. 初始化播放列表窗口拖拽移动能力
    if (typeof initDraggablePlaylistDrawer === 'function') {
        initDraggablePlaylistDrawer();
    }

    // 6.1 初始化本地曲库文件夹浏览器
    if (typeof initFolderExplorer === 'function') {
        initFolderExplorer();
    }

    // 7. 注册 Service Worker (PWA 离线支持) 与申请永久存储配额
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('[PWA] ServiceWorker 注册成功, scope:', reg.scope))
            .catch(err => console.warn('[PWA] ServiceWorker 注册受阻 (若处于非 HTTPS 环境属正常):', err));
    }
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(granted => {
            if (granted) {
                console.log("[PWA] 存储空间已成功获得永久持久化权限 (Storage Persisted)");
            }
        }).catch(() => {});
    }

    // 8. 检查登录状态
    checkLoginStatus();

    // 9. 获取重复下载 repeat 开关状态
    axios.get('/v2/getRepeat')
        .then(resp => {
            if (resp.data.code === "000000") {
                const switchEl = document.getElementById('repeatSwitch');
                if (switchEl) switchEl.checked = resp.data.data === true;
            }
        })
        .catch(() => {});

    // 10. 自动触发一次后台任务轮询（如果有未完成任务）
    if (typeof fetchDownloadTasks === 'function') {
        fetchDownloadTasks();
    }

    // 11. 绑定全局音频元素播放事件
    const player = document.getElementById("globalAudioPlayer");
    const fill = document.getElementById("progressBarFill");
    const handle = document.getElementById("progressBarHandle");
    const curTime = document.getElementById("audioCurrentTime");
    const totTime = document.getElementById("audioTotalTime");
    const playBtn = document.getElementById("audioPlayPauseBtn");
    const coverImg = document.getElementById("audioBarCover");
    const fullPlayBtn = document.getElementById("fullscreenPlayPauseBtn");
    const fullCover = document.getElementById("fullscreenVinylCover");
    const fullCurTime = document.getElementById("fullscreenCurrentTime");
    const fullTotTime = document.getElementById("fullscreenTotalTime");
    const fullFill = document.getElementById("fullscreenProgressBarFill");
    const fullHandle = document.getElementById("fullscreenProgressBarHandle");

    if (player) {
        player.onerror = function() {
            if (player.src && player.src !== window.location.href && player.src !== 'about:blank') {
                const track = (typeof globalPlaylistQueue !== 'undefined' && typeof currentQueueIndex !== 'undefined') ? globalPlaylistQueue[currentQueueIndex] : null;
                const songTitle = track ? track.name : (document.getElementById("audioBarTitle") ? document.getElementById("audioBarTitle").textContent : '音频');
                showToast(`《${songTitle}》音频加载异常，尝试播放下一首`, 'warning');
                if (typeof playNextTrack === 'function') playNextTrack();
            }
        };

        player.onplay = function() {
            if (playBtn) playBtn.innerHTML = "⏸";
            if (coverImg) coverImg.classList.add("playing");
            if (fullPlayBtn) fullPlayBtn.innerHTML = "⏸";
            if (fullCover) fullCover.classList.add("playing");
        };

        player.onpause = function() {
            if (playBtn) playBtn.innerHTML = "▶";
            if (coverImg) coverImg.classList.remove("playing");
            if (fullPlayBtn) fullPlayBtn.innerHTML = "▶";
            if (fullCover) fullCover.classList.remove("playing");
            if (typeof savePlayerStateToStorage === 'function') savePlayerStateToStorage();
        };

        player.onloadedmetadata = function() {
            const formatted = formatTime(player.duration);
            if (totTime) totTime.textContent = formatted;
            if (fullTotTime) fullTotTime.textContent = formatted;
        };

        let lastSaveProgressTs = 0;
        player.ontimeupdate = function() {
            if (typeof isSeekingAudio !== 'undefined' && isSeekingAudio) return;
            if (!player.duration || isNaN(player.duration) || !isFinite(player.duration)) return;
            const current = player.currentTime;
            const duration = player.duration;
            const percentage = (current / duration) * 100;
            const curFormatted = formatTime(current);

            if (fill) fill.style.width = percentage + "%";
            if (handle) handle.style.left = percentage + "%";
            if (curTime) curTime.textContent = curFormatted;

            if (fullFill) fullFill.style.width = percentage + "%";
            if (fullHandle) fullHandle.style.left = percentage + "%";
            if (fullCurTime) fullCurTime.textContent = curFormatted;

            // 💾 定期 (每 2 秒) 自动持久化播放进度到 localStorage，保障刷新恢复
            const now = Date.now();
            if (now - lastSaveProgressTs > 2000) {
                lastSaveProgressTs = now;
                if (typeof savePlayerStateToStorage === 'function') {
                    savePlayerStateToStorage();
                }
            }

            // 歌词同步滚动
            if (typeof parsedLrcList !== 'undefined' && parsedLrcList && parsedLrcList.length > 0) {
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
                    if (typeof updateLrcHighlight === 'function') {
                        updateLrcHighlight(currentLrcIndex);
                    }
                }
            }
        };

        player.onended = function() {
            if (typeof playMode !== 'undefined' && playMode === 'single') {
                player.currentTime = 0;
                player.play().catch(e => console.warn('单曲循环 play failed:', e));
            } else {
                // ⚡ 纯同步切歌：防止后台播放中断
                if (typeof playNextTrackSync === 'function') {
                    playNextTrackSync();
                } else if (typeof playNextTrack === 'function') {
                    playNextTrack();
                }
            }
        };
    }

    // 12. 初始化音频进度条平滑拖拽监听
    if (typeof initProgressBarDragging === 'function') {
        initProgressBarDragging();
    }

    // 13. 全局键盘快捷键监听
    document.addEventListener("keydown", function(e) {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
            return;
        }

        // 空格键：播放 / 暂停
        if (e.code === "Space") {
            e.preventDefault();
            if (typeof togglePlayPause === 'function') togglePlayPause();
        }
        // 左方向键：快退 5 秒
        else if (e.code === "ArrowLeft") {
            if (player && player.duration) {
                e.preventDefault();
                player.currentTime = Math.max(0, player.currentTime - 5);
            }
        }
        // 右方向键：快进 5 秒
        else if (e.code === "ArrowRight") {
            if (player && player.duration) {
                e.preventDefault();
                player.currentTime = Math.min(player.duration, player.currentTime + 5);
            }
        }
    });

    // 14. 📱 初始化 iOS PWA 独立模式全局下拉刷新手势 (Pull-to-Refresh)
    initPullToRefresh();
});

/**
 * 📱 初始化 iOS PWA 独立全屏模式下拉刷新 (Pull-to-Refresh)
 */
function initPullToRefresh() {
    let startY = 0;
    let isDragging = false;
    let isRefreshing = false;
    const THRESHOLD = 65;

    // 动态创建极简下拉提示胶囊 DOM
    const pill = document.createElement('div');
    pill.id = 'legacy-pull-refresh';
    pill.style.cssText = 'position:fixed; top:-50px; left:0; right:0; display:flex; justify-content:center; align-items:center; z-index:99999; pointer-events:none; transition:transform 0.15s ease-out, opacity 0.15s ease-out;';
    pill.innerHTML = `
        <div style="background:rgba(17,24,39,0.92); border:1px solid rgba(255,255,255,0.15); backdrop-filter:blur(16px); color:#fff; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:6px; box-shadow:0 6px 20px rgba(0,0,0,0.3);">
            <span id="legacy-pull-icon" style="display:inline-block; font-size:13px; transition:transform 0.05s linear;">🔄</span>
            <span id="legacy-pull-text">下拉刷新</span>
        </div>
    `;
    document.body.appendChild(pill);

    const icon = pill.querySelector('#legacy-pull-icon');
    const text = pill.querySelector('#legacy-pull-text');

    window.addEventListener('touchstart', function(e) {
        if (window.scrollY > 5 || isRefreshing) return;
        if (e.touches.length === 1) {
            startY = e.touches[0].clientY;
            isDragging = true;
        }
    }, { passive: true });

    window.addEventListener('touchmove', function(e) {
        if (!isDragging || isRefreshing) return;
        if (window.scrollY > 0) {
            isDragging = false;
            pill.style.transform = 'translateY(0px)';
            pill.style.opacity = '0';
            return;
        }
        const diff = e.touches[0].clientY - startY;
        if (diff > 0) {
            const pullDistance = Math.min(85, Math.pow(diff, 0.84));
            pill.style.transform = `translateY(${pullDistance}px)`;
            pill.style.opacity = Math.min(1, pullDistance / 25).toString();
            if (icon) icon.style.transform = `rotate(${pullDistance * 4}deg)`;
            if (text) text.textContent = pullDistance >= THRESHOLD ? '释放立即刷新' : '下拉刷新';
        }
    }, { passive: true });

    window.addEventListener('touchend', async function() {
        if (!isDragging || isRefreshing) return;
        isDragging = false;
        const currentTransform = pill.style.transform;
        const match = currentTransform.match(/translateY\(([^p]+)px\)/);
        const dist = match ? parseFloat(match[1]) : 0;

        if (dist >= THRESHOLD) {
            isRefreshing = true;
            pill.style.transform = 'translateY(54px)';
            if (text) text.textContent = '正在刷新...';
            if (icon) icon.style.animation = 'refreshSpin 0.7s linear infinite';
            try {
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
            } catch (e) {}

            // 执行刷新：优先重新加载当前 Tab 数据，或刷新页面
            setTimeout(function() {
                const activeTab = document.querySelector('.tab-content.active');
                const tabId = activeTab ? activeTab.id : '';
                if (tabId === 'tab-playlist' && typeof loadMyPlaylists === 'function') {
                    loadMyPlaylists();
                } else if (tabId === 'tab-download-mgr' && typeof loadDownloadHistory === 'function') {
                    loadDownloadHistory(1);
                } else {
                    window.location.reload();
                }
                setTimeout(function() {
                    isRefreshing = false;
                    pill.style.transform = 'translateY(0px)';
                    pill.style.opacity = '0';
                    if (icon) icon.style.animation = 'none';
                }, 400);
            }, 600);
        } else {
            pill.style.transform = 'translateY(0px)';
            pill.style.opacity = '0';
        }
    }, { passive: true });
}

