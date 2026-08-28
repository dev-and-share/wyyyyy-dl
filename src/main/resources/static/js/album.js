/* ==========================================================================
   💽 NetEase Music Downloader - Album Module (album.js)
   ========================================================================== */

let currentAlbum = null;
let currentAlbumSongs = [];
let currentAlbumCover = '/favicon.png';

function quickLoadAlbum(albumId) {
    const input = document.getElementById("albumId");
    if (input) input.value = albumId;
    loadAlbumInfo();
}

function renderAlbumDetailUI(album) {
    if (!album) return;
    currentAlbum = album;
    currentAlbumSongs = album.songs || [];
    currentAlbumCover = album.coverImgUrl || '/favicon.png';
    const albumSongs = currentAlbumSongs;

    const infoDiv = document.getElementById("album-info");
    if (!infoDiv) return;

    let songsHtml = '';
    album.songs.forEach((song, idx) => {
        const artistDisplay = getValidArtistNames(song);
        const artistHtml = artistDisplay ? ` - ${artistDisplay}` : '';
        const localBadge = `<span id="badge-al-${song.id}" class="status-badge icon-only" style="margin-left:6px; display:none;"></span>`;
        const slotsHtml = renderTrackCapsuleSlotsHtml(song, 'al-');

        songsHtml += `
            <li class="track-item-card">
                <div class="track-title-row" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:10px; display:flex; align-items:center;">
                    <strong class="clickable-track-title" onclick="jumpToSongDetail('${song.id}')" title="点击查看单曲详细信息" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${idx + 1}. ${song.name}</strong>${artistHtml}${localBadge}
                </div>
                ${slotsHtml}
            </li>
        `;
    });

    infoDiv.innerHTML = `
        <div class="detail-header-card" style="margin-bottom:15px;">
            <img src="${album.coverImgUrl || '/favicon.png'}" alt="封面" class="detail-cover-img">
            <div class="detail-header-info">
                <h4 class="detail-header-title">${album.name || '未知专辑'}</h4>
                <div class="detail-header-sub">歌手：${album.artist || '未知歌手'} | 发行：${album.publishTime || '未知'}</div>
                <div class="detail-btn-group">
                    <button class="btn-primary flex-1-btn" onclick="downloadAlbum('${album.id}')">🖥️ 下载到电脑</button>
                    <button class="btn-primary flex-1-btn" id="album-cache-btn" style="background:#0284c7;" onclick="cacheTracksToPhoneBatch(currentAlbum ? currentAlbum.songs : [], 'album-cache-btn', '📲 缓存到浏览器')">📲 缓存到浏览器 (计算中...)</button>
                    <button class="btn-primary flex-1-btn" style="background:#22c55e;" onclick="playFullCurrentAlbum()">▶️ 播放专辑</button>
                </div>
            </div>
        </div>
        <h4 style="margin:15px 0 8px 0; color:var(--text-main); font-size:15px; font-weight:600;">专辑曲目列表 (${album.songs ? album.songs.length : 0} 首)：</h4>
        <ul class="data-list scrollable-list" id="album-tracks">
            ${songsHtml}
        </ul>
    `;
    refreshPhoneCacheBtn(albumSongs, 'album-cache-btn', '📲 缓存到浏览器');
    asyncUpdateListBadges(albumSongs, 'al-');
}

function loadAlbumInfo() {
    const id = document.getElementById("albumId").value;
    if (!id) {
        showToast("请输入专辑 ID", "warning");
        return;
    }

    const infoDiv = document.getElementById("album-info");

    // ⚡ 1. SWR 优先从本地缓存秒开渲染
    const cacheKey = 'album_' + id;
    const cached = typeof getApiCache === 'function' ? getApiCache(cacheKey) : null;
    let hasRenderedCache = false;

    if (cached && cached.data && cached.data.album) {
        renderAlbumDetailUI(cached.data.album);
        hasRenderedCache = true;
    } else {
        if (infoDiv) {
            infoDiv.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-secondary);">🔄 正在解析专辑数据，请稍候...</div>`;
        }
    }

    // 🔄 2. 并行后台请求最新数据
    axios.post('/Album', new URLSearchParams({ id }))
        .then(resp => {
            if (!resp.data || !resp.data.data || !resp.data.data.album) {
                if (!hasRenderedCache) throw new Error("未查找到对应专辑数据或该专辑 ID 不存在");
                return;
            }
            const album = resp.data.data.album;
            const oldAlbum = cached ? cached.data.album : null;
            const isChanged = !hasRenderedCache || !isFastDataEqual(oldAlbum, album);

            if (isChanged) {
                if (typeof setApiCache === 'function') {
                    setApiCache(cacheKey, resp.data.data);
                }
                renderAlbumDetailUI(album);
            }
        })
        .catch(err => {
            if (!hasRenderedCache && infoDiv) {
                const errorText = err.message || err;
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
            showToast("已提交专辑下载任务！已在右下角开启监控面板...", "success", 3000);
            fetchDownloadTasks();
        })
        .catch(err => showToast("提交专辑下载失败：" + err, "error"));
}

function jumpToAlbumDetail(albumId) {
    if (!albumId) return;

    switchTab('search');

    const input = document.getElementById('albumId');
    if (input) input.value = albumId;

    if (typeof openAccordionCard === 'function') {
        openAccordionCard('card-album-detail');
    }

    loadAlbumInfo();
}


function playFullCurrentAlbum() {
    if (!currentAlbumSongs || currentAlbumSongs.length === 0) {
        showToast("暂无专辑歌曲数据！", "warning");
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
