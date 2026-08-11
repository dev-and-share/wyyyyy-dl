/* ==========================================================================
   💽 NetEase Music Downloader - Album Module (album.js)
   ========================================================================== */

function quickLoadAlbum(albumId) {
    const input = document.getElementById("albumId");
    if (input) input.value = albumId;
    loadAlbumInfo();
}

function loadAlbumInfo() {
    const id = document.getElementById("albumId").value;
    if (!id) {
        alert("请输入专辑 ID");
        return;
    }

    const infoDiv = document.getElementById("album-info");
    if (infoDiv) {
        infoDiv.innerHTML = `<div style="padding:20px; text-align:center; color:#666;">🔄 正在解析专辑数据，请稍候...</div>`;
    }

    axios.post('/Album', new URLSearchParams({ id }))
        .then(resp => {
            if (!resp.data || !resp.data.data || !resp.data.data.album) {
                throw new Error("未查找到对应专辑数据或该专辑 ID 不存在");
            }
            const album = resp.data.data.album;
            currentAlbumSongs = album.songs || [];
            currentAlbumCover = album.coverImgUrl || '/favicon.png';

            let songsHtml = '';
            album.songs.forEach((song, idx) => {
                const artistDisplay = getValidArtistNames(song);
                const artistHtml = artistDisplay ? ` - ${artistDisplay}` : '';

                songsHtml += `
                    <li>
                        <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            <strong>${idx + 1}. ${song.name}</strong>${artistHtml}
                        </div>
                        <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                            <button class="jump-link-btn" onclick="playOnline('${song.id}')" title="在线试听">▶️ 试听</button>
                            <button class="jump-link-btn" onclick="jumpToSongDetail('${song.id}')">🔍 查看</button>
                            <button class="btn-primary" style="padding:4px 8px; font-size:12px; margin:0;" onclick="downloadSingle('${song.id}')">📥 下载</button>
                        </div>
                    </li>
                `;
            });

            infoDiv.innerHTML = `
                <div class="detail-header-card" style="margin-bottom:15px;">
                    <img src="${album.coverImgUrl}" alt="封面" class="detail-cover-img">
                    <div class="detail-header-info">
                        <h4 class="detail-header-title">${album.name}</h4>
                        <div class="detail-header-sub">歌手：${album.artist} | 发行：${album.publishTime || '未知'}</div>
                        <div class="detail-btn-group">
                            <button class="btn-primary flex-1-btn" onclick="downloadAlbum('${album.id}')">📥 下载专辑</button>
                            <button class="btn-primary flex-1-btn" style="background:#22c55e;" onclick="playFullCurrentAlbum()">▶️ 播放专辑</button>
                        </div>
                    </div>
                </div>
                <h4 style="margin:15px 0 8px 0; color:#334155;">专辑曲目列表 (${album.songs.length} 首)：</h4>
                <ul class="data-list scrollable-list" id="album-tracks">
                    ${songsHtml}
                </ul>
            `;
        })
        .catch(err => {
            const errorText = err.message || err;
            if (infoDiv) {
                infoDiv.innerHTML = `
                    <div class="empty-placeholder-card">
                        <div class="empty-icon">⚠️</div>
                        <div class="empty-title">获取专辑信息失败</div>
                        <div class="empty-desc">${errorText}</div>
                    </div>
                `;
            }
        });
}

function downloadAlbum(id) {
    axios.get(`/v2/album?id=${id}`)
        .then(resp => {
            alert("已提交专辑下载任务！已在右下角开启监控面板...");
            fetchDownloadTasks();
        })
        .catch(err => alert("提交专辑下载失败：" + err));
}

function jumpToAlbumDetail(albumId) {
    if (!albumId) return;

    switchTab('album');

    const input = document.getElementById('albumId');
    if (input) input.value = albumId;

    const card = document.getElementById('card-album-detail');
    if (card && !card.classList.contains('active')) {
        const header = card.querySelector('.accordion-header');
        if (header) toggleAccordionCard(header);
    }

    loadAlbumInfo();
}

let currentAlbumSongs = [];
let currentAlbumCover = '/favicon.png';

function playFullCurrentAlbum() {
    if (!currentAlbumSongs || currentAlbumSongs.length === 0) {
        alert("暂无专辑歌曲数据！");
        return;
    }
    const formattedQueue = currentAlbumSongs.map(s => ({
        id: s.id,
        name: s.name,
        artist: getValidArtistNames(s),
        cover: currentAlbumCover
    }));
    if (typeof setGlobalPlaylistQueue === 'function') {
        setGlobalPlaylistQueue(formattedQueue, 0);
    }
}
