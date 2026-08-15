/* ==========================================================================
   📁 NetEase Music Downloader - Playlist Module (playlist.js)
   ========================================================================== */

function getValidArtistNames(track) {
    if (!track) return '';
    let arNames = track.artists || (track.ar ? track.ar.map(a => a.name).join('/') : '');
    if (!arNames || arNames === 'null' || arNames === 'undefined' || arNames.trim() === '') {
        return '';
    }
    return arNames;
}

function loadMyPlaylists(filterType) {
    filterType = filterType || 'created';
    axios.post('/MyPlaylist?limit=100')
        .then(resp => {
            const list = document.getElementById("playlist-list");
            list.innerHTML = "";
            let playlists = resp.data.data.playlists || [];

            if (filterType === 'created') {
                playlists = playlists.filter(pl => pl.subscribed === false || pl.subscribed === null || pl.subscribed === undefined);
            } else if (filterType === 'subscribed') {
                playlists = playlists.filter(pl => pl.subscribed === true);
            }

            if (playlists.length === 0) {
                const labelMap = { 'created': '创建的', 'subscribed': '收藏的', 'all': '' };
                list.innerHTML = `<li style="color:var(--text-muted); font-size:13px; padding:16px; justify-content:center;">暂无${labelMap[filterType] || ''}歌单记录</li>`;
                return;
            }
            
            playlists.forEach(pl => {
                const li = document.createElement("li");
                const isSubscribed = (pl.subscribed === true);
                const tag = isSubscribed 
                    ? '<span class="status-badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.25); font-weight:600; margin-right:6px;">收藏</span>' 
                    : '<span class="status-badge" style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.25); font-weight:600; margin-right:6px;">创建</span>';
                
                li.innerHTML = `
                    <div style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center;">
                        ${tag}
                        <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-main);">${pl.name}</strong> 
                        <span style="color:var(--text-muted); font-size:11px; margin-left:4px; flex-shrink:0;">(${pl.trackCount || 0}首)</span>
                    </div>
                    <div style="flex-shrink:0;">
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
                <div class="detail-header-card">
                    <img src="${playlist.coverImgUrl}" alt="封面" class="detail-cover-img">
                    <div class="detail-header-info">
                        <h4 class="detail-header-title">${playlist.name}</h4>
                        <div class="detail-header-sub">创建人：${playlist.creator} | 共 ${playlist.trackCount} 首歌</div>
                        <div class="detail-btn-group">
                            <button class="btn-primary flex-1-btn" onclick="downloadPlaylist('${playlist.id}')">🖥️ 下载到电脑</button>
                            <button class="btn-primary flex-1-btn" id="playlist-cache-btn" style="background:#0284c7;" onclick="cacheTracksToPhoneBatch(allTracks, 'playlist-cache-btn', '📱 缓存到手机')">📱 缓存到手机 (计算中...)</button>
                            <button class="btn-primary flex-1-btn" style="background:#22c55e;" onclick="playFullCurrentPlaylist()">▶️ 播放歌单</button>
                        </div>
                    </div>
                </div>
            `;
            renderPage(currentPage);
            refreshPhoneCacheBtn(allTracks, 'playlist-cache-btn', '📱 缓存到手机');
        })
        .catch(err => alert("获取歌单详情失败：" + err));
}

function renderPage(page) {
    const list = document.getElementById("playlist-tracks");
    list.innerHTML = "";
    
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, allTracks.length);
    const pageTracks = allTracks.slice(start, end);

    pageTracks.forEach((track, index) => {
        const li = document.createElement("li");
        const trackIndex = start + index + 1;
        const artistDisplay = getValidArtistNames(track);
        const artistHtml = artistDisplay ? ` - ${artistDisplay}` : '';
        const isLocalTrack = (track.isLocal === true);

        const localBadge = isLocalTrack 
            ? '<span class="status-badge status-ok" style="font-size:9.5px; padding:1px 5px; margin-left:6px; flex-shrink:0;">⚡ 本地</span>' 
            : '';

        const playBtnHtml = isLocalTrack
            ? `<button class="jump-link-btn" style="background:rgba(34,197,94,0.18); color:#4ade80; border-color:rgba(34,197,94,0.35);" onclick="playSongById('${track.id}', '${(track.name||'').replace(/'/g, "\\'")}', '${(artistDisplay||'').replace(/'/g, "\\'")}')" title="本地无损秒播">▶️ 播放</button>`
            : `<button class="jump-link-btn" onclick="playSongById('${track.id}', '${(track.name||'').replace(/'/g, "\\'")}', '${(artistDisplay||'').replace(/'/g, "\\'")}')" title="在线试听">▶️ 试听</button>`;

        li.innerHTML = `
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:10px; display:flex; align-items:center;">
                <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${trackIndex}. ${track.name}</strong>${artistHtml}${localBadge}
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
                ${playBtnHtml}
                <button class="jump-link-btn" onclick="jumpToSongDetail('${track.id}')">🔍 查看</button>
                <button class="btn-primary" style="padding:4px 8px; font-size:12px;" onclick="downloadSingle('${track.id}')">📥 下载</button>
            </div>
        `;
        list.appendChild(li);
    });

    const totalPages = Math.ceil(allTracks.length / pageSize) || 1;
    document.getElementById("page-indicator").textContent = `第 ${page} 页 / 共 ${totalPages} 页 (共 ${allTracks.length} 首)`;
    document.getElementById("prev-page").disabled = (page <= 1);
    document.getElementById("next-page").disabled = (page >= totalPages);
}

function playFullCurrentPlaylist() {
    if (!allTracks || allTracks.length === 0) {
        alert("暂无歌单歌曲数据！");
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
            alert("已提交歌单下载任务！已在右下角开启监控面板...");
            fetchDownloadTasks();
        })
        .catch(err => alert("提交歌单下载失败：" + err));
}
