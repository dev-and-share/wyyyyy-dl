/* ==========================================================================
   🔍 NetEase Music Downloader - Search Module (search.js)
   ========================================================================== */

let searchResultsData = [];

function searchSongs() {
    const keyword = document.getElementById("searchKeyword").value;
    const type = document.getElementById("searchType").value;
    const limit = document.getElementById("searchLimit").value || 10;

    if (!keyword) {
        alert("请输入搜索关键词");
        return;
    }

    axios.post('/Search', new URLSearchParams({ keyword, type, limit }))
        .then(resp => {
            searchResultsData = resp.data.data || [];
            searchPage = 1;
            renderSearchPage(searchPage);
        })
        .catch(err => alert("搜索失败：" + err));
}

function renderSearchPage(page) {
    const list = document.getElementById("search-results");
    list.innerHTML = "";

    const type = document.getElementById("searchType").value;

    searchResultsData.forEach((item, index) => {
        const li = document.createElement("li");

        if (type === "1") {
            // 单曲
            const artistDisplay = getValidArtistNames(item);
            const artistHtml = artistDisplay ? ` - ${artistDisplay}` : '';
            const albumHtml = item.album ? ` <span style="color:#888; font-size:12px;">[专辑: ${item.album}]</span>` : '';

            li.innerHTML = `
                <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:10px;">
                    <strong>${index + 1}. ${item.name}</strong>${artistHtml}${albumHtml}
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button class="jump-link-btn" onclick="playOnline('${item.id}')" title="在线试听">▶️ 试听</button>
                    <button class="jump-link-btn" onclick="jumpToSongDetail('${item.id}')">🔍 查看</button>
                    <button class="btn-primary" style="padding:4px 8px; font-size:12px;" onclick="downloadSingle('${item.id}')">📥 下载</button>
                </div>
            `;
        } else if (type === "1000") {
            // 歌单
            li.innerHTML = `
                <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <strong>${item.name}</strong> <span style="color:#888; font-size:12px;">(ID: ${item.id})</span>
                </div>
                <div>
                    <button class="jump-link-btn" onclick="jumpToPlaylistDetail('${item.id}')">👉 查看歌单详情</button>
                </div>
            `;
        } else if (type === "10") {
            // 专辑
            li.innerHTML = `
                <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <strong>${item.name}</strong> - ${item.artist || ''} <span style="color:#888; font-size:12px;">(ID: ${item.id})</span>
                </div>
                <div>
                    <button class="jump-link-btn" onclick="jumpToAlbumDetail('${item.id}')">👉 查看专辑详情</button>
                </div>
            `;
        } else {
            // 歌手
            li.innerHTML = `
                <div>
                    <strong>${item.name}</strong> <span style="color:#888; font-size:12px;">(ID: ${item.id})</span>
                </div>
            `;
        }

        list.appendChild(li);
    });

    document.getElementById("search-page-indicator").textContent = `共搜索到 ${searchResultsData.length} 条数据`;
    document.getElementById("search-prev").disabled = true;
    document.getElementById("search-next").disabled = true;
}

function changeSearchPage(delta) {
    // 基础搜索暂按服务端 Limit 分页展示
}
