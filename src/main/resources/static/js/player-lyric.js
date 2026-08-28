/* ==========================================================================
   🎵 NetEase Music Downloader - Player Lyric Engine (player-lyric.js)
   ========================================================================== */

let currentPlayingLyric = "";
let parsedLrcList = [];
let currentLrcIndex = -1;

function parseLrc(lrcText) {
    if (!lrcText) return [];
    const lines = lrcText.split(/\r?\n/);
    const result = [];
    const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    
    lines.forEach(line => {
        const matches = timeReg.exec(line);
        if (matches) {
            const min = parseInt(matches[1], 10);
            const sec = parseInt(matches[2], 10);
            const ms = parseInt(matches[3], 10);
            const time = min * 60 + sec + (ms > 99 ? ms / 1000 : ms / 100);
            const text = line.replace(timeReg, '').trim();
            if (text) {
                result.push({ time, text });
            }
        }
    });
    return result;
}

function updateLrcHighlight(index) {
    const modalContent = document.getElementById("lyricModalContent");
    if (!modalContent) return;

    const lines = modalContent.querySelectorAll(".lrc-line");
    lines.forEach((line, idx) => {
        if (idx === index) {
            line.classList.add("active");
            line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            line.classList.remove("active");
        }
    });
}

/**
 * 🎵 渲染歌词行 DOM 节点并重置滚动位置
 */
function renderLyricLinesDOM() {
    const content = document.getElementById("lyricModalContent");
    if (!content) return;

    parsedLrcList = parseLrc(currentPlayingLyric);
    currentLrcIndex = -1;
    content.innerHTML = "";
    content.scrollTop = 0;

    const validTimeLrcs = parsedLrcList.filter(item => item.time >= 0);

    if (validTimeLrcs && validTimeLrcs.length > 0) {
        validTimeLrcs.forEach((item, idx) => {
            const div = document.createElement("div");
            div.className = "lrc-line" + (idx === 0 ? " active" : "");
            div.textContent = item.text;
            div.onclick = () => {
                const player = document.getElementById("globalAudioPlayer");
                if (player) {
                    player.currentTime = item.time;
                }
            };
            content.appendChild(div);
        });
    } else {
        const lines = (currentPlayingLyric || "暂无歌词").split(/\r?\n/);
        lines.forEach(lineStr => {
            if (lineStr.trim()) {
                const p = document.createElement("p");
                p.className = "lrc-fallback";
                p.textContent = lineStr;
                content.appendChild(p);
            }
        });
    }
}

function openLyricModal() {
    const modal = document.getElementById("lyricModal");
    if (!modal) return;
    
    const playerTitle = document.getElementById("audioBarTitle") ? document.getElementById("audioBarTitle").textContent : "";
    const playerArtist = document.getElementById("audioBarArtist") ? document.getElementById("audioBarArtist").textContent : "";
    const coverSrc = document.getElementById("audioBarCover") ? document.getElementById("audioBarCover").src : "/favicon.png";
    const sourceBadge = document.getElementById("audioSourceBadge");

    const fullTitle = document.getElementById("fullscreenTitle");
    const fullArtist = document.getElementById("fullscreenArtist");
    const fullCover = document.getElementById("fullscreenVinylCover");
    const fullBadge = document.getElementById("fullscreenBadge");

    if (fullTitle) fullTitle.textContent = playerTitle || "未在播放";
    if (fullArtist) fullArtist.textContent = playerArtist || "未知歌手";
    if (fullCover) {
        fullCover.src = coverSrc || "/favicon.png";
        const player = document.getElementById("globalAudioPlayer");
        if (player && !player.paused) {
            fullCover.classList.add("playing");
        } else {
            fullCover.classList.remove("playing");
        }
    }
    if (fullBadge && sourceBadge) {
        fullBadge.className = sourceBadge.className;
        fullBadge.innerHTML = sourceBadge.innerHTML;
        fullBadge.title = sourceBadge.title;
        fullBadge.style.display = sourceBadge.style.display;
    }

    if (typeof updatePlayModeBtnUI === 'function') updatePlayModeBtnUI();
    renderLyricLinesDOM();

    modal.style.display = "flex";
}

function closeLyricModal() {
    const modal = document.getElementById("lyricModal");
    if (modal) modal.style.display = "none";
}

function toggleLyricModal() {
    const modal = document.getElementById("lyricModal");
    if (modal) {
        if (modal.style.display === "none" || !modal.style.display) {
            openLyricModal();
        } else {
            closeLyricModal();
        }
    }
}

window.parseLrc = parseLrc;
window.updateLrcHighlight = updateLrcHighlight;
window.renderLyricLinesDOM = renderLyricLinesDOM;
window.openLyricModal = openLyricModal;
window.closeLyricModal = closeLyricModal;
window.toggleLyricModal = toggleLyricModal;
