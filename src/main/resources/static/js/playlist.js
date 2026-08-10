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

        li.innerHTML = `
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:10px;">
                <strong>${trackIndex}. ${track.name}</strong>${artistHtml}
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                <button class="jump-link-btn" onclick="playOnline('${track.id}')" title="在线试听">▶️ 试听</button>
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
