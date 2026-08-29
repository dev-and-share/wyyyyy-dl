/* ==========================================================================
   🔍 NetEase Music Downloader - Search Module (search.js)
   ========================================================================== */

let searchPage = 1;
let searchResultsData = [];

function searchSongs() {
    const keywords = document.getElementById("searchKeyword").value;
    const type = document.getElementById("searchType").value;
    const limit = document.getElementById("searchLimit").value || 10;

    if (!keywords) {
        showToast("请输入搜索关键词", "warning");
        return;
    }

    const list = document.getElementById("search-results");
    if (list) {
        list.innerHTML = `<li style="color:#666; padding:16px; justify-content:center;">🔍 正在搜索《${keywords}》，请稍候...</li>`;
    }

    axios.post('/Search', new URLSearchParams({ keywords, type, limit }))
        .then(resp => {
            let rawData = resp.data ? resp.data.data : [];
            
            if (Array.isArray(rawData)) {
                searchResultsData = rawData;
            } else if (rawData && typeof rawData === 'object') {
                searchResultsData = rawData.result || rawData.songs || rawData.playlists || rawData.albums || rawData.artists || [];
            } else {
                searchResultsData = [];
            }

            searchPage = 1;
            renderSearchPage(searchPage);
        })
        .catch(err => {
            showToast("搜索失败：" + err, "error");
            if (list) list.innerHTML = `<li style="color:#ef4444; padding:16px; justify-content:center;">⚠️ 搜索失败，请稍后重试</li>`;
        });
}

function renderSearchPage(page) {
    const list = document.getElementById("search-results");
    if (!list) return;
    list.innerHTML = "";

    const type = document.getElementById("searchType").value;

    if (!Array.isArray(searchResultsData) || searchResultsData.length === 0) {
        list.innerHTML = `<li style="color:var(--text-muted); font-size:13px; padding:16px; justify-content:center;">未查找到相关的搜索结果，请尝试更换关键词</li>`;
        const indicator = document.getElementById("search-page-indicator");
        if (indicator) indicator.textContent = `共 0 条结果`;
        return;
    }

    searchResultsData.forEach((item, index) => {
        const li = document.createElement("li");

        if (type === "1") {
            // 单曲
            li.className = "track-item-card";
            const artistDisplay = getValidArtistNames(item);
            const artistHtml = artistDisplay ? ` - ${artistDisplay}` : '';
            const albumHtml = item.album ? ` <span style="color:var(--text-muted); font-size:12px;">[专辑: ${item.album}]</span>` : '';

            const localBadge = `<span id="badge-sr-${item.id}" class="status-badge icon-only" style="margin-left:6px; display:none;"></span>`;
            const slotsHtml = renderTrackCapsuleSlotsHtml(item, 'sr-');

            li.innerHTML = `
                <div class="track-title-row" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:10px; display:flex; align-items:center;">
                    <strong class="clickable-track-title" onclick="jumpToSongDetail('${item.id}')" title="点击查看单曲详细信息" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${index + 1}. ${item.name}</strong>${artistHtml}${albumHtml}${localBadge}
                </div>
                ${slotsHtml}
            `;
        } else if (type === "1000") {
            // 歌单
            const creatorName = (item.creator && typeof item.creator === 'object') ? (item.creator.nickname || '') : (typeof item.creator === 'string' ? item.creator : '');
            const creatorHtml = creatorName ? ` - <span style="color:var(--text-secondary);">${creatorName}</span>` : '';
            const trackCountHtml = item.trackCount ? ` <span style="color:var(--text-muted); font-size:12px;">(${item.trackCount} 首)</span>` : '';

            li.innerHTML = `
                <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:8px;">
                    <strong>${index + 1}. ${item.name}</strong>${creatorHtml}${trackCountHtml} <span style="color:var(--text-muted); font-size:12px;">(ID: ${item.id})</span>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button class="jump-link-btn" style="background:rgba(245,158,11,0.12); color:#fbbf24; border-color:rgba(245,158,11,0.3);" onclick="subscribePlaylistFromSearch('${item.id}', '${(item.name || '').replace(/'/g, "\\'")}', this)">⭐ 收藏</button>
                    <button class="jump-link-btn" onclick="jumpToPlaylistDetail('${item.id}')">👉 查看详情</button>
                </div>
            `;
        } else if (type === "10") {
            // 专辑
            const artistName = (item.artist && typeof item.artist === 'object') ? (item.artist.name || '') : (typeof item.artist === 'string' ? item.artist : '');
            const artistHtml = artistName ? ` - <span style="color:var(--text-secondary);">${artistName}</span>` : '';
            const sizeHtml = item.size ? ` <span style="color:var(--text-muted); font-size:12px;">(${item.size} 首歌)</span>` : '';

            li.innerHTML = `
                <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <strong>${index + 1}. ${item.name}</strong>${artistHtml}${sizeHtml} <span style="color:var(--text-muted); font-size:12px;">(ID: ${item.id})</span>
                </div>
                <div>
                    <button class="jump-link-btn" onclick="jumpToAlbumDetail('${item.id}')">👉 查看专辑详情</button>
                </div>
            `;
        } else {
            // 歌手 (type === '100')
            li.className = "track-item-card";
            const artistPic = item.picUrl ? `<img src="${item.picUrl}?param=60y60" style="width:36px; height:36px; border-radius:50%; object-fit:cover; margin-right:8px; flex-shrink:0;">` : `<span style="font-size:20px; margin-right:8px; flex-shrink:0;">🎤</span>`;
            li.innerHTML = `
                <div class="track-title-row" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:8px; display:flex; align-items:center; cursor:pointer;" onclick="jumpToArtistDetail('${item.id}')">
                    ${artistPic}
                    <strong class="clickable-track-title" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px;">${index + 1}. ${escapeHtml(item.name)}</strong>
                    <span style="color:var(--text-muted); font-size:12px; margin-left:6px;">(ID: ${item.id})</span>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button class="jump-link-btn" style="background:linear-gradient(135deg, #ec4899, #db2777); color:#fff; border:none; padding:4px 10px;" onclick="jumpToArtistDetail('${item.id}')">👉 查看热门 50 首</button>
                </div>
            `;
        }

        list.appendChild(li);
    });

    if (type === "1") {
        asyncUpdateListBadges(searchResultsData, 'sr-');
    }

    document.getElementById("search-page-indicator").textContent = `共搜索到 ${searchResultsData.length} 条数据`;
    document.getElementById("search-prev").disabled = true;
    document.getElementById("search-next").disabled = true;
}

/* ==========================================================================
   🎤 歌手热门 50 首与详情解析逻辑 (Section 3 Tab 模块)
   ========================================================================== */

let currentArtist = null;
let currentArtistSongs = [];

function quickLoadArtist(artistId) {
    const input = document.getElementById("artistId");
    if (input) input.value = artistId;
    loadArtistInfo();
}

function renderArtistDetailUI(artist) {
    if (!artist) return;
    currentArtist = artist;
    currentArtistSongs = artist.songs || [];
    const artistSongs = currentArtistSongs;

    const infoDiv = document.getElementById("artist-info");
    if (!infoDiv) return;

    let songsHtml = '';
    artistSongs.forEach((song, idx) => {
        const artistDisplay = getValidArtistNames(song) || artist.name;
        const artistHtml = artistDisplay ? ` - ${artistDisplay}` : '';
        const albumHtml = song.album ? ` <span style="color:var(--text-muted); font-size:12px;">[专辑: ${escapeHtml(song.album)}]</span>` : '';
        const localBadge = `<span id="badge-art-${song.id}" class="status-badge icon-only" style="margin-left:6px; display:none;"></span>`;
        const slotsHtml = renderTrackCapsuleSlotsHtml(song, 'art-');

        songsHtml += `
            <li class="track-item-card">
                <div class="track-title-row" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:10px; display:flex; align-items:center;">
                    <strong class="clickable-track-title" onclick="jumpToSongDetail('${song.id}')" title="点击查看单曲详细信息" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${idx + 1}. ${escapeHtml(song.name)}</strong>${artistHtml}${albumHtml}${localBadge}
                </div>
                ${slotsHtml}
            </li>
        `;
    });

    infoDiv.innerHTML = `
        <div class="detail-header-card" style="margin-bottom:15px;">
            <img src="${artist.coverImgUrl ? artist.coverImgUrl + '?param=140y140' : '/favicon.png'}" alt="歌手头像" class="detail-cover-img" style="border-radius:50%; width:80px; height:80px; object-fit:cover;">
            <div class="detail-header-info">
                <h4 class="detail-header-title">${escapeHtml(artist.name || '未知歌手')}</h4>
                <div class="detail-header-sub">
                    ${artist.musicSize ? `单曲：${artist.musicSize} 首 | ` : ''}
                    ${artist.albumSize ? `专辑：${artist.albumSize} 张 | ` : ''}
                    <span>🔥 热门 Top ${artistSongs.length}</span>
                </div>
                <div class="detail-btn-group">
                    <button class="btn-primary flex-1-btn" style="background:#22c55e;" onclick="playFullCurrentArtist()">▶️ 连播热门</button>
                    <button class="btn-primary flex-1-btn" style="background:linear-gradient(135deg, #8b5cf6, #7c3aed);" onclick="appendFullCurrentArtist()">➕ 追加全部</button>
                    <button class="btn-primary flex-1-btn" id="artist-cache-btn" style="background:#0284c7;" onclick="cacheTracksToPhoneBatch(currentArtist ? currentArtist.songs : [], 'artist-cache-btn', '📲 缓存全榜')">📲 缓存全榜 (计算中...)</button>
                </div>
            </div>
        </div>
        ${artist.briefDesc ? `<div style="font-size:12px; color:var(--text-muted); line-height:1.5; margin-bottom:12px; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:6px; max-height:65px; overflow-y:auto;">${escapeHtml(artist.briefDesc)}</div>` : ''}
        <h4 style="margin:15px 0 8px 0; color:var(--text-main); font-size:15px; font-weight:600;">🔥 热门 50 首曲目列表 (${artistSongs.length} 首)：</h4>
        <ul class="data-list scrollable-list" id="artist-tracks">
            ${songsHtml}
        </ul>
    `;
    refreshPhoneCacheBtn(artistSongs, 'artist-cache-btn', '📲 缓存全榜');
    asyncUpdateListBadges(artistSongs, 'art-');
}

function loadArtistInfo() {
    const id = document.getElementById("artistId")?.value;
    if (!id) {
        showToast("请输入歌手 ID", "warning");
        return;
    }

    const infoDiv = document.getElementById("artist-info");

    // ⚡ 1. SWR 优先从本地缓存秒开渲染
    const cacheKey = 'artist_' + id;
    const cached = typeof getApiCache === 'function' ? getApiCache(cacheKey) : null;
    let hasRenderedCache = false;

    if (cached && cached.data && cached.data.artist) {
        renderArtistDetailUI(cached.data.artist);
        hasRenderedCache = true;
    } else {
        if (infoDiv) {
            infoDiv.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-secondary);"><span class="loading-spinner"></span> 正在解析歌手热门歌曲，请稍候...</div>`;
        }
    }

    // 🔄 2. 并行后台请求最新数据
    axios.get(`/Artist?id=${id}`)
        .then(resp => {
            if (!resp.data || !resp.data.data || !resp.data.data.artist) {
                if (!hasRenderedCache) throw new Error("未查找到对应歌手数据或该歌手 ID 不存在");
                return;
            }
            const artist = resp.data.data.artist;
            const oldArtist = cached ? cached.data.artist : null;
            const isChanged = !hasRenderedCache || !isFastDataEqual(oldArtist, artist);

            if (isChanged) {
                if (typeof setApiCache === 'function') {
                    setApiCache(cacheKey, resp.data.data);
                }
                renderArtistDetailUI(artist);
            }
        })
        .catch(err => {
            if (!hasRenderedCache) {
                showToast("解析歌手信息失败：" + (err.message || err), "error");
                if (infoDiv) {
                    infoDiv.innerHTML = `<div style="padding:20px; text-align:center; color:#ef4444;">⚠️ 解析歌手信息失败，请检查歌手 ID</div>`;
                }
            }
        });
}

function playFullCurrentArtist() {
    if (!currentArtistSongs || currentArtistSongs.length === 0) {
        showToast("歌手曲目列表为空", "warning");
        return;
    }
    const formattedQueue = currentArtistSongs.map(s => ({
        id: s.id,
        name: s.name,
        artist: getValidArtistNames(s) || currentArtist?.name || '未知歌手',
        album: s.album || '',
        cover: s.picUrl || currentArtist?.coverImgUrl || '/favicon.png',
        isLocal: (s.isLocal === true)
    }));
    if (typeof setGlobalPlaylistQueue === 'function') {
        setGlobalPlaylistQueue(formattedQueue, 0);
        showToast(`开始连播歌手「${currentArtist?.name || ''}」热门曲目（共 ${formattedQueue.length} 首）`, 'success');
    }
}

function appendFullCurrentArtist() {
    if (!currentArtistSongs || currentArtistSongs.length === 0) {
        showToast("歌手曲目列表为空", "warning");
        return;
    }
    const formattedQueue = currentArtistSongs.map(s => ({
        id: s.id,
        name: s.name,
        artist: getValidArtistNames(s) || currentArtist?.name || '未知歌手',
        album: s.album || '',
        cover: s.picUrl || currentArtist?.coverImgUrl || '/favicon.png',
        isLocal: (s.isLocal === true)
    }));
    if (typeof globalPlaylistQueue !== 'undefined') {
        globalPlaylistQueue.push(...formattedQueue);
        if (typeof updatePlaylistCountUI === 'function') updatePlaylistCountUI();
        showToast(`已追加歌手「${currentArtist?.name || ''}」${formattedQueue.length} 首歌曲到播放列表`, 'success');
    }
}

window.loadArtistInfo = loadArtistInfo;
window.renderArtistDetailUI = renderArtistDetailUI;
window.playFullCurrentArtist = playFullCurrentArtist;
window.appendFullCurrentArtist = appendFullCurrentArtist;

function changeSearchPage(delta) {
    // 基础搜索暂按服务端 Limit 分页展示
}

function subscribePlaylistFromSearch(plId, plName, btnElement) {
    if (!plId) return;

    showAppModal({
        title: '收藏歌单',
        icon: '⭐',
        content: `<div style="line-height:1.6; color:var(--text-secondary); text-align:left;">
                    确定要收藏歌单「<strong>${escapeHtml(plName || plId)}</strong>」吗？<br><br>
                    <div style="padding:8px 12px; background:rgba(245,158,11,0.08); border-left:3px solid #f59e0b; border-radius:4px; font-size:12px;">
                      💡 <strong>提示</strong>：网易云官方近期对第三方客户端收藏他人歌单有设备安全风控。如遇限制，亦可在官方 App 收藏后在此同步加载。
                    </div>
                    <div style="margin-top:12px; padding-top:10px; border-top:1px dashed var(--border-subtle);">
                      <button class="btn-primary" type="button" style="margin:0; width:100%; padding:9px 12px; font-size:13px; background:linear-gradient(135deg, #8b5cf6, #7c3aed); box-shadow:0 2px 8px rgba(139,92,246,0.3);" onclick="document.querySelector('#modalCloseBtn')?.click(); jumpToPlaylistDetail('${plId}')">
                        👉 前往查看歌单详情（可一键转存为自建歌单）
                      </button>
                    </div>
                  </div>`,
        confirmText: '确认收藏',
        cancelText: '取消',
        showCancel: true
    }).then(confirmed => {
        if (!confirmed) return;

        if (btnElement) {
            btnElement.disabled = true;
            btnElement.textContent = "⏳ 收藏中...";
        }
        axios.post('/v2/playlist/subscribe', new URLSearchParams({
            id: plId,
            subscribe: "true"
        }))
        .then(resp => {
            if (resp.data && resp.data.code === '000000') {
                showToast(`已成功收藏歌单「${plName || plId}」！`, 'success');
                if (typeof deleteApiCache === 'function') {
                    deleteApiCache('my_playlists');
                }
                if (btnElement) {
                    btnElement.textContent = "✅ 已收藏";
                    btnElement.style.color = "#10b981";
                    btnElement.style.borderColor = "rgba(16,185,129,0.3)";
                    btnElement.style.background = "rgba(16,185,129,0.12)";
                }
            } else {
                const errMsg = (resp.data && resp.data.msg) || '收藏失败';
                showToast(errMsg, 'warn');
                if (btnElement) {
                    btnElement.disabled = false;
                    btnElement.textContent = "⭐ 收藏";
                }
            }
        })
        .catch(err => {
            showToast('收藏歌单失败：' + err, 'error');
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.textContent = "⭐ 收藏";
            }
        });
    });
}

