/* ==========================================================================
   🎵 NetEase Music Downloader Modern JavaScript Core
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
    const tabLinks = document.querySelectorAll(".tab-btn");
    tabLinks.forEach(button => {
        button.addEventListener("click", () => {
            tabLinks.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");

            const targetTabId = button.getAttribute("data-tab");
            document.querySelectorAll(".tab-content").forEach(content => {
                content.style.display = (content.id === targetTabId) ? "block" : "none";
            });
        });
    });

    // 自动触发一次后台任务轮询（如果有未完成任务）
    fetchDownloadTasks();
});

/* ==========================================================================
   📂 手风琴 (Accordion) 折叠逻辑
   ========================================================================== */

function openAccordionCard(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    
    // 如果想要只保留一个展开（Accordion模式），折叠同一父级的其他Cards
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
    
    // 展开 Section 2 (歌单详情)，折叠 Section 1
    openAccordionCard("card-playlist-detail");
    
    // 自动请求详情
    loadPlaylistDetail();
}

function jumpToSongDetail(songId) {
    const input = document.getElementById("songId");
    if (input) input.value = songId;
    
    // 展开 Section 3 (查看歌曲信息)
    openAccordionCard("card-song-detail");
    
    // 自动请求单曲信息
    loadSongInfo();
}

/* ==========================================================================
   🎵 歌单 & 专辑 & 搜索业务数据加载
   ========================================================================== */

function loadMyPlaylists() {
    axios.post('/MyPlaylist')
        .then(resp => {
            const list = document.getElementById("playlist-list");
            list.innerHTML = "";
            const playlists = resp.data.data.playlists;
            
            playlists.forEach(pl => {
                const li = document.createElement("li");
                li.innerHTML = `
                    <div>
                        <strong>${pl.name}</strong> 
                        <span style="color:#888; font-size:12px; margin-left:6px;">(ID: ${pl.id})</span>
                    </div>
                    <div>
                        <button class="jump-link-btn" onclick="jumpToPlaylistDetail('${pl.id}')">👉 查看详情</button>
                    </div>
                `;
                list.appendChild(li);
            });
        })
        .catch(err => alert("加载歌单失败：" + err));
}

function loadPlaylistDetail() {
    const id = document.getElementById("playlistId").value;
    if (!id) {
        alert("请输入歌单 ID");
        return;
    }
    
    axios.post('/Playlist', new URLSearchParams({ id }))
        .then(resp => {
            const playlist = resp.data.data.playlist;
            currentPlaylist = playlist;
            allTracks = playlist.tracks || [];
            currentPage = 1;

            const infoDiv = document.getElementById("playlist-info");
            infoDiv.innerHTML = `
                <div style="display:flex; gap:15px; margin-top:10px;">
                    <img src="${playlist.coverImgUrl}" alt="封面" style="width:120px; height:120px; border-radius:8px; object-fit:cover;">
                    <div>
                        <h4 style="margin:0 0 6px 0;">${playlist.name}</h4>
                        <div style="font-size:13px; color:#555; margin-bottom:8px;">创建人：${playlist.creator} | 共 ${playlist.trackCount} 首歌</div>
                        <button class="btn-primary" onclick="downloadPlaylist('${playlist.id}')">📥 下载整个歌单</button>
                    </div>
                </div>
            `;
            renderPage(currentPage);
        })
        .catch(err => alert("获取歌单详情失败：" + err));
}

function getValidArtistNames(track) {
    if (!track) return '';
    let arNames = track.artists || (track.ar ? track.ar.map(a => a.name).join('/') : '');
    if (!arNames || arNames === 'null' || arNames === 'undefined' || arNames.trim() === '') {
        return '';
    }
    return arNames;
}

function renderPage(page) {
    const list = document.getElementById("playlist-tracks");
    list.innerHTML = "";

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageTracks = allTracks.slice(start, end);

    pageTracks.forEach(track => {
        const li = document.createElement("li");
        const arNames = getValidArtistNames(track);
        const artistText = arNames ? ` - <span style="color:#666;">${arNames}</span>` : '';
        li.innerHTML = `
            <div>
                <strong>${track.name}</strong>${artistText}
            </div>
            <div>
                <button class="jump-link-btn" style="background:#e8f0fe; color:#1a73e8; border-color:#d2e3fc;" onclick="playSongById('${track.id}', '${(track.name||'').replace(/'/g, "\\'")}', '${(arNames||'').replace(/'/g, "\\'")}')">▶️ 试听</button>
                <button class="jump-link-btn" onclick="jumpToSongDetail('${track.id}')">🎵 详情</button>
                <button class="jump-link-btn" style="background:#e6f4ea; color:#137333; border-color:#ceead6;" onclick="downloadSingle('${track.id}')">📥 下载</button>
            </div>
        `;
        list.appendChild(li);
    });

    document.getElementById("page-indicator").textContent = `第 ${page} 页 / 共 ${Math.ceil(allTracks.length / pageSize)} 页`;
    document.getElementById("prev-page").disabled = (page === 1);
    document.getElementById("next-page").disabled = (end >= allTracks.length);
}

function changePage(offset) {
    currentPage += offset;
    renderPage(currentPage);
}

function loadAlbumInfo() {
    const id = document.getElementById("albumId").value;
    if (!id) {
        alert("请输入专辑 ID");
        return;
    }
    axios.post('/Album', new URLSearchParams({ id }))
        .then(resp => {
            const album = resp.data.data.album;
            document.getElementById("album-name").textContent = album.name;
            document.getElementById("album-artist").textContent = album.artist;
            document.getElementById("album-publish-time").textContent = album.publishTime;
            document.getElementById("album-cover").src = album.picUrl;
            document.getElementById("album-download").innerHTML = `
                <button class="btn-primary" onclick="downloadAlbum('${album.id}')">📥 下载专辑</button>
            `;

            const list = document.getElementById("album-tracks");
            list.innerHTML = "";
            (album.songs || []).forEach(song => {
                const li = document.createElement("li");
                const arNames = getValidArtistNames(song);
                const artistText = arNames ? ` - <span style="color:#666;">${arNames}</span>` : '';
                li.innerHTML = `
                    <div><strong>${song.name}</strong>${artistText}</div>
                    <div>
                        <button class="jump-link-btn" style="background:#e8f0fe; color:#1a73e8; border-color:#d2e3fc;" onclick="playSongById('${song.id}', '${(song.name||'').replace(/'/g, "\\'")}', '${(arNames||'').replace(/'/g, "\\'")}')">▶️ 试听</button>
                        <button class="jump-link-btn" onclick="jumpToSongDetail('${song.id}')">🎵 详情</button>
                        <button class="jump-link-btn" style="background:#e6f4ea; color:#137333; border-color:#ceead6;" onclick="downloadSingle('${song.id}')">📥 下载</button>
                    </div>
                `;
                list.appendChild(li);
            });
        })
        .catch(err => alert("获取专辑信息失败：" + err));
}

function loadSongInfo() {
    const id = document.getElementById("songId").value;
    const level = document.getElementById("songLevel").value;
    if (!id) {
        alert("请输入歌曲 ID");
        return;
    }

    // Note: AnalysisController /Song_V1 endpoint expects parameter key 'id' (not 'ids')
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

            infoDiv.innerHTML = `
                <div style="display:flex; gap:15px; margin-top:10px;">
                    ${imgHtml}
                    <div>
                        <h4 style="margin:0 0 6px 0;">${song.name}</h4>
                        <div style="font-size:13px; color:#555;">歌手：${arText} | 专辑：${alText}</div>
                        <div style="font-size:12px; color:#777; margin-bottom:8px;">大小：${sizeText} | 音质：${levelText}</div>
                        <button class="btn-primary" style="background:#10b981; margin-right:6px;" onclick="playAudioOnline('${song.url}', '${(song.name||'').replace(/'/g, "\\'")}', '${(arText||'').replace(/'/g, "\\'")}', '${imgSrc}')">▶️ 在线试听</button>
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

function searchSongs() {
    const keywords = document.getElementById("searchKeyword").value;
    const type = document.getElementById("searchType").value;
    const limit = document.getElementById("searchLimit").value;

    if (!keywords) {
        alert("请输入搜索关键词");
        return;
    }

    const offset = (searchPage - 1) * limit;

    axios.post('/Search', new URLSearchParams({ keywords, type, limit, offset }))
        .then(resp => {
            const list = document.getElementById("search-results");
            list.innerHTML = "";
            const data = resp.data.data;

            if (type === "1") { // 单曲
                (data || []).forEach(song => {
                    const li = document.createElement("li");
                    const arNames = getValidArtistNames(song);
                    const artistText = arNames ? ` - <span style="color:#666;">${arNames}</span>` : '';
                    const albumText = song.al && song.al.name ? ` (专辑: ${song.al.name})` : '';
                    li.innerHTML = `
                        <div><strong>${song.name}</strong>${artistText}${albumText}</div>
                        <div>
                            <button class="jump-link-btn" style="background:#e8f0fe; color:#1a73e8; border-color:#d2e3fc;" onclick="playSongById('${song.id}', '${(song.name||'').replace(/'/g, "\\'")}', '${(arNames||'').replace(/'/g, "\\'")}')">▶️ 试听</button>
                            <button class="jump-link-btn" onclick="jumpToSongDetail('${song.id}')">🎵 详情</button>
                            <button class="jump-link-btn" style="background:#e6f4ea; color:#137333; border-color:#ceead6;" onclick="downloadSingle('${song.id}')">📥 下载</button>
                        </div>
                    `;
                    list.appendChild(li);
                });
            } else if (type === "1000") { // 歌单
                (data || []).forEach(playlist => {
                    const li = document.createElement("li");
                    li.innerHTML = `
                        <div><strong>${playlist.name}</strong> <span style="color:#888; font-size:12px;">(共 ${playlist.trackCount || 0} 首)</span></div>
                        <div>
                            <button class="jump-link-btn" onclick="jumpToPlaylistDetail('${playlist.id}')">👉 查看详情</button>
                        </div>
                    `;
                    list.appendChild(li);
                });
            } else {
                list.innerHTML = `<li>已返回结果，请在后台查看 JSON 数据</li>`;
            }
        })
        .catch(err => alert("搜索失败：" + err));
}

function changeSearchPage(offset) {
    const newPage = searchPage + offset;
    if (newPage < 1) return;
    searchPage = newPage;
    searchSongs();
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
        .then(() => startProgressPolling())
        .catch(err => alert("单曲下载失败：" + err));
}

function downloadPlaylist(id) {
    axios.get(`/v2/playlist?id=${id}`)
        .then(() => startProgressPolling())
        .catch(err => alert("歌单下载失败：" + err));
}

function downloadAlbum(id) {
    axios.get(`/v2/album?id=${id}`)
        .then(() => startProgressPolling())
        .catch(err => alert("专辑下载失败：" + err));
}

function startProgressPolling() {
    const widget = document.getElementById('floatingMonitor');
    if (widget) {
        widget.style.display = 'block';
        widget.classList.remove('minimized');
        isMonitorMinimized = false;
    }
    fetchDownloadTasks();
    if (!monitorInterval) {
        monitorInterval = setInterval(fetchDownloadTasks, 1500);
    }
}

function fetchDownloadTasks() {
    axios.get('/v2/tasks')
        .then(resp => {
            if (resp.data.code === "000000") {
                const tasks = resp.data.data || [];
                tasks.sort((a, b) => b.timestamp - a.timestamp);

                const listContainer = document.getElementById('monitorTaskList');
                if (!listContainer) return;
                
                listContainer.innerHTML = '';

                const widget = document.getElementById('floatingMonitor');
                if (tasks.length === 0) {
                    if (widget && widget.style.display !== 'none' && !monitorInterval) {
                        listContainer.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:15px; font-size:12px;">暂无下载任务</div>';
                    }
                    return;
                }

                // 若有任务且挂件隐藏，自动显示
                if (widget && widget.style.display === 'none') {
                    widget.style.display = 'block';
                }

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

                    listContainer.appendChild(item);
                });

                // 更新挂件标题计数
                const activeCount = tasks.filter(t => t.status === 'DOWNLOADING' || t.status === 'PENDING').length;
                const titleText = activeCount > 0 ? `📥 下载中 (${activeCount})` : `📥 下载完成 (${tasks.length})`;
                document.getElementById('monitorHeaderTitle').textContent = titleText;

                // 若已全部处理完，自动暂停轮询
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
   🎧 在线试听播放器控制 (Online Audio Player Controller)
   ========================================================================== */

function playAudioOnline(url, title, artist, cover) {
    if (!url) {
        alert("未获取到在线播放链接（可能由于版权保护或下架）");
        return;
    }

    const bar = document.getElementById("globalAudioBar");
    const player = document.getElementById("globalAudioPlayer");
    const titleEl = document.getElementById("audioBarTitle");
    const artistEl = document.getElementById("audioBarArtist");
    const coverEl = document.getElementById("audioBarCover");

    if (bar && player) {
        bar.style.display = "block";
        titleEl.textContent = title || "未知歌曲";
        artistEl.textContent = artist || "未知歌手";
        coverEl.src = cover || "";

        player.src = url;
        player.play().catch(err => console.log("自动播放尝试被浏览器防护阻断，需手动点击播放按钮:", err));
    }
}

function playSongById(songId, songName, artistName, coverUrl) {
    const levelSelect = document.getElementById("songLevel");
    const level = levelSelect ? levelSelect.value : "lossless";
    
    axios.post('/Song_V1', new URLSearchParams({ id: songId, level: level, type: 'json' }))
        .then(resp => {
            const song = resp.data.data;
            if (song && song.url) {
                const title = songName || song.name;
                const artist = artistName || song.ar_name || "群星 / 未知";
                const cover = coverUrl || song.pic || song.picUrl || "";
                playAudioOnline(song.url, title, artist, cover);
            } else {
                alert("未解析到试听 URL（可能由于无版权或许可限制）");
            }
        })
        .catch(err => alert("请求试听音频失败：" + err));
}

function closeAudioPlayer() {
    const bar = document.getElementById("globalAudioBar");
    const player = document.getElementById("globalAudioPlayer");
    if (player) {
        player.pause();
        player.src = "";
    }
    if (bar) {
        bar.style.display = "none";
    }
}
