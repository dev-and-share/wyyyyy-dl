/* ==========================================================================
   💽 NetEase Music Downloader - Album Module (album.js)
   ========================================================================== */

function loadAlbumInfo() {
    const id = document.getElementById("albumId").value;
    if (!id) {
        alert("请输入专辑 ID");
        return;
    }

    axios.post('/Album', new URLSearchParams({ id }))
        .then(resp => {
            const album = resp.data.data.album;
            document.getElementById("album-download").innerHTML = `<button class="btn-primary" onclick="downloadAlbum('${album.id}')">📥 下载整张专辑</button>`;
            document.getElementById("album-name").textContent = album.name;
            document.getElementById("album-artist").textContent = album.artist;
            document.getElementById("album-publish-time").textContent = album.publishTime;
            document.getElementById("album-cover").src = album.coverImgUrl;

            const tracksList = document.getElementById("album-tracks");
            tracksList.innerHTML = "";

            album.songs.forEach((song, idx) => {
                const li = document.createElement("li");
                const artistDisplay = getValidArtistNames(song);
                const artistHtml = artistDisplay ? ` - ${artistDisplay}` : '';

                li.innerHTML = `
                    <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:10px;">
                        <strong>${idx + 1}. ${song.name}</strong>${artistHtml}
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button class="jump-link-btn" onclick="playOnline('${song.id}')" title="在线试听">▶️ 试听</button>
                        <button class="jump-link-btn" onclick="jumpToSongDetail('${song.id}')">🔍 查看</button>
                        <button class="btn-primary" style="padding:4px 8px; font-size:12px;" onclick="downloadSingle('${song.id}')">📥 下载</button>
                    </div>
                `;
                tracksList.appendChild(li);
            });
        })
        .catch(err => alert("获取专辑信息失败：" + err));
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
