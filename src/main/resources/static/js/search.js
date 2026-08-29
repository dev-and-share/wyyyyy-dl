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
            // 歌手
            li.innerHTML = `
                <div class="track-title-row" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <strong>${index + 1}. ${escapeHtml(item.name)}</strong> <span style="color:var(--text-muted); font-size:12px;">(ID: ${item.id})</span>
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

