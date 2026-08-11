/* ==========================================================================
   🎵 NetEase Music Downloader - App Core Engine (app.js)
   ========================================================================== */

let currentPage = 1;
let currentPlaylist = null;
let allTracks = [];
const pageSize = 10;
let searchPage = 1;

let monitorInterval = null;
let isMonitorMinimized = false;

document.addEventListener("DOMContentLoaded", () => {
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
        alert("请输入歌曲 ID");
        return;
    }

    axios.post('/Song_V1', new URLSearchParams({ id: id, level: level, type: 'json' }))
        .then(resp => {
            const song = resp.data.data;
            const infoDiv = document.getElementById("song-info");
            const arText = song.ar_name || '群星 / 未知';
            const alText = song.al_name || '暂无专辑';
            const sizeText = song.size || '未知大小';
            const levelText = song.level || level;
            const imgSrc = song.pic || song.picUrl || '';
            const imgHtml = imgSrc ? `<img src="${imgSrc}" style="width:100px; height:100px; border-radius:8px; object-fit:cover;">` : '';
            const albumBtn = song.al_id ? `<button class="btn-primary" style="background:#8b5cf6; margin-right:6px;" onclick="jumpToAlbumDetail('${song.al_id}')">💽 查看专辑</button>` : '';

            infoDiv.innerHTML = `
                <div style="display:flex; gap:15px; margin-top:10px;">
                    ${imgHtml}
                    <div>
                        <h4 style="margin:0 0 6px 0;">${song.name}</h4>
                        <div style="font-size:13px; color:#555;">歌手：${arText} | 专辑：${alText}</div>
                        <div style="font-size:12px; color:#777; margin-bottom:8px;">大小：${sizeText} | 音质：${levelText}</div>
                        <button class="btn-primary" style="background:#10b981; margin-right:6px;" onclick="playAudioOnline('${song.url}', '${(song.name||'').replace(/'/g, "\\'")}', '${(arText||'').replace(/'/g, "\\'")}', '${imgSrc}', '${(song.lyric||'').replace(/'/g, "\\'")}')">▶️ 在线试听</button>
                        ${albumBtn}
                        <button class="btn-primary" onclick="downloadSingle('${song.id}')">📥 下载单曲</button>
                    </div>
                </div>
                <div style="margin-top:10px;">
                    <details style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; background: #f8fafc;">
                        <summary style="font-size:12px; color:#007bff; cursor:pointer; font-weight:600; outline:none;">📄 查看 Raw JSON 响应数据</summary>
                        <pre style="background:#1e293b; color:#38bdf8; padding:10px; border-radius:6px; font-size:11px; max-height:200px; overflow-y:auto; margin-top:6px; font-family:Consolas, monospace;">${JSON.stringify(song.rawData || song, null, 2)}</pre>
                    </details>
                </div>
                <div style="margin-top:10px; font-size:12px; color:#444; max-height:150px; overflow-y:auto; background:#f8f9fa; padding:8px; border-radius:4px;">
                    <pre style="margin:0; font-family:inherit;">${song.lyric || '暂无歌词'}</pre>
                </div>
            `;
        })
        .catch(err => alert("获取歌曲信息失败：" + err));
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
        .catch(err => alert("单曲下载失败：" + err));
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
                        revealBtn.style.cssText = 'margin-left:6px; font-size:12px; padding:2px 6px; background:rgba(255,255,255,0.75); border:1px solid #ccc; border-radius:4px; cursor:pointer; color:#333;';
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
        .catch(err => alert("清空失败：" + err));
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

let currentPlayingLyric = "";
let parsedLrcList = [];
let currentLrcIndex = -1;
let isAudioPlayerMinimized = false;

/* 全局播放队列与模式控制 ENGINE */
let globalPlaylistQueue = [];
let currentQueueIndex = -1;
let playMode = 'loop'; // 'loop' (列表) | 'single' (单曲) | 'random' (随机)

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
    if (!btn) return;
    if (playMode === 'single') {
        btn.innerHTML = '🔂';
        btn.title = '当前模式: 单曲循环';
    } else if (playMode === 'random') {
        btn.innerHTML = '🔀';
        btn.title = '当前模式: 随机播放';
    } else {
        btn.innerHTML = '🔁';
        btn.title = '当前模式: 列表循环';
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
                
                const sourceBadge = document.getElementById("audioSourceBadge");
                if (sourceBadge) {
                    if (song.url.includes("/v2/stream") || song.url.includes("/v2/history/stream") || song.url.includes("/history/stream")) {
                        sourceBadge.className = "audio-source-badge badge-local";
                        sourceBadge.innerHTML = "⚡ 本地";
                        sourceBadge.title = "⚡ 当前播放的是本地音轨";
                        sourceBadge.style.display = "inline-flex";
                    } else {
                        sourceBadge.className = "audio-source-badge badge-online";
                        sourceBadge.innerHTML = "🌐 线上";
                        sourceBadge.title = "🌐 当前播放的是网络解析音频";
                        sourceBadge.style.display = "inline-flex";
                    }
                }

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
}

function updatePlaylistCountUI() {
    const c1 = document.getElementById("playlistCount");
    const c2 = document.getElementById("playlistDrawerCount");
    const len = globalPlaylistQueue.length;
    if (c1) c1.textContent = len;
    if (c2) c2.textContent = len;
    renderPlaylistDrawer();
}

function playTrackInQueue(index) {
    if (index < 0 || index >= globalPlaylistQueue.length) return;
    currentQueueIndex = index;
    const track = globalPlaylistQueue[index];
    savePlayerStateToStorage();
    
    axios.post('/Song_V1', new URLSearchParams({ id: track.id, name: track.name || '', artist: track.artist || '', level: 'lossless', type: 'json' }))
        .then(resp => {
            const song = resp.data.data;
            if (song && song.url) {
                const cover = track.cover || song.pic || '/favicon.png';
                playAudioOnline(song.url, track.name || song.name, track.artist || song.ar_name, cover, song.lyric);
                renderPlaylistDrawer();
            } else {
                alert(`无法播放《${track.name}》：获取播放地址失败`);
                playNextTrack();
            }
        })
        .catch(err => {
            console.error("播放曲目失败:", err);
            playNextTrack();
        });
}

function playNextTrack() {
    if (globalPlaylistQueue.length === 0) return;
    if (playMode === 'random') {
        let randIdx = Math.floor(Math.random() * globalPlaylistQueue.length);
        if (globalPlaylistQueue.length > 1 && randIdx === currentQueueIndex) {
            randIdx = (currentQueueIndex + 1) % globalPlaylistQueue.length;
        }
        playTrackInQueue(randIdx);
    } else {
        let nextIdx = (currentQueueIndex + 1) % globalPlaylistQueue.length;
        playTrackInQueue(nextIdx);
    }
}

function playPrevTrack() {
    if (globalPlaylistQueue.length === 0) return;
    if (playMode === 'random') {
        let randIdx = Math.floor(Math.random() * globalPlaylistQueue.length);
        playTrackInQueue(randIdx);
    } else {
        let prevIdx = (currentQueueIndex - 1 + globalPlaylistQueue.length) % globalPlaylistQueue.length;
        playTrackInQueue(prevIdx);
    }
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
        } else {
            drawer.style.display = 'none';
        }
    }
}

function clearPlaylistQueue() {
    globalPlaylistQueue = [];
    currentQueueIndex = -1;
    updatePlaylistCountUI();
    savePlayerStateToStorage();
    const drawer = document.getElementById("playlistDrawer");
    if (drawer) drawer.style.display = 'none';
}

function renderPlaylistDrawer() {
    const list = document.getElementById("playlistDrawerList");
    if (!list) return;
    list.innerHTML = "";
    
    globalPlaylistQueue.forEach((track, idx) => {
        const li = document.createElement("li");
        const isCurrent = (idx === currentQueueIndex);
        li.className = isCurrent ? "drawer-item active" : "drawer-item";
        li.onclick = () => playTrackInQueue(idx);
        li.innerHTML = `
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${isCurrent ? '🎵 ' : ''}<strong>${idx + 1}. ${track.name}</strong> - <span style="font-size:12px; color:#888;">${track.artist}</span>
            </div>
            ${isCurrent ? '<span style="color:#22c55e; font-size:12px; font-weight:600;">播放中</span>' : ''}
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

function playAudioOnline(url, name, artist, cover, lyric) {
    if (!url) {
        alert("暂无直接播放链接，请切换音质重试或点击下载");
        return;
    }
    const bar = document.getElementById("globalAudioBar");
    const player = document.getElementById("globalAudioPlayer");
    const playBtn = document.getElementById("audioPlayPauseBtn");
    const coverImg = document.getElementById("audioBarCover");
    
    if (bar && player) {
        document.getElementById("audioBarTitle").textContent = name || "未知歌曲";
        document.getElementById("audioBarArtist").textContent = artist || "未知歌手";
        if (coverImg) {
            coverImg.src = cover || "/favicon.png";
            coverImg.classList.add("playing");
        }
        
        const sourceBadge = document.getElementById("audioSourceBadge");
        if (sourceBadge) {
            if (url && (url.includes("/v2/stream") || url.includes("/v2/history/stream") || url.includes("/history/stream"))) {
                sourceBadge.className = "audio-source-badge badge-local";
                sourceBadge.innerHTML = "⚡ 本地";
                sourceBadge.title = "⚡ 当前播放的是本地音轨";
                sourceBadge.style.display = "inline-flex";
            } else {
                sourceBadge.className = "audio-source-badge badge-online";
                sourceBadge.innerHTML = "🌐 线上";
                sourceBadge.title = "🌐 当前播放的是网络解析音频";
                sourceBadge.style.display = "inline-flex";
            }
        }

        currentPlayingLyric = lyric || "";
        parsedLrcList = parseLrc(currentPlayingLyric);
        currentLrcIndex = -1;

        player.src = url;
        bar.style.display = "flex";
        if (playBtn) playBtn.innerHTML = "⏸";
        player.play().catch(e => console.error("播放中断:", e));
        savePlayerStateToStorage();
    }
}

function playOnline(songId, name, artist) {
    playSongById(songId, name, artist);
}

function playSongById(songId, name, artist) {
    if (globalPlaylistQueue.length === 0) {
        globalPlaylistQueue = [{ id: songId, name: name, artist: artist, cover: '/favicon.png' }];
        currentQueueIndex = 0;
        updatePlaylistCountUI();
    }
    axios.post('/Song_V1', new URLSearchParams({ id: songId, name: name || '', artist: artist || '', level: 'lossless', type: 'json' }))
        .then(resp => {
            const song = resp.data.data;
            if (song && song.url) {
                playAudioOnline(song.url, name || song.name, artist || song.ar_name, song.pic, song.lyric);
            } else {
                alert("获取播放链接失败");
            }
        })
        .catch(err => alert("播放获取失败：" + err));
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

    if (player) {
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
                player.play();
            } else {
                playNextTrack();
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
    const title = document.getElementById("lyricModalTitle");
    const playerTitle = document.getElementById("audioBarTitle").textContent;
    const playerArtist = document.getElementById("audioBarArtist").textContent;

    if (modal && content) {
        title.textContent = `${playerTitle} - ${playerArtist}`;
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
    if (modal) {
        modal.style.display = "none";
    }
}
