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
                <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <strong>${index + 1}. ${item.name}</strong>${creatorHtml}${trackCountHtml} <span style="color:var(--text-muted); font-size:12px;">(ID: ${item.id})</span>
                </div>
                <div>
                    <button class="jump-link-btn" onclick="jumpToPlaylistDetail('${item.id}')">👉 查看歌单详情</button>
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
            // 歌手
            li.innerHTML = `
                <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <strong>${index + 1}. ${item.name}</strong> <span style="color:var(--text-muted); font-size:12px;">(ID: ${item.id})</span>
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

function changeSearchPage(delta) {
    // 基础搜索暂按服务端 Limit 分页展示
}
