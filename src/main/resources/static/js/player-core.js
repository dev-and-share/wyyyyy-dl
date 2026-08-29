/* ==========================================================================
   🎵 NetEase Music Downloader - Audio Player Core Engine (player-core.js)
   ========================================================================== */

const STORAGE_QUEUE_KEY = "wyyyy_player_queue";
const STORAGE_INDEX_KEY = "wyyyy_player_index";
const STORAGE_MODE_KEY = "wyyyy_player_mode";
const STORAGE_TIME_KEY = "wyyyy_player_time";
const STORAGE_AUTO_SKIP_KEY = "wyyyy_player_auto_skip_trial";
const STORAGE_OFFLINE_ONLY_KEY = "wyyyy_player_offline_only";

/* 全局播放队列与模式控制 ENGINE */
let globalPlaylistQueue = [];
let currentQueueIndex = -1;
let playMode = 'loop'; // 'loop' (列表) | 'single' (单曲) | 'random' (随机)
let autoSkipTrial = localStorage.getItem(STORAGE_AUTO_SKIP_KEY) === 'true';
let offlineOnlyMode = localStorage.getItem(STORAGE_OFFLINE_ONLY_KEY) === 'true';
let isAudioPlayerMinimized = false;

function savePlayerStateToStorage() {
    try {
        localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(globalPlaylistQueue || []));
        localStorage.setItem(STORAGE_INDEX_KEY, currentQueueIndex.toString());
        localStorage.setItem(STORAGE_MODE_KEY, playMode || 'loop');
        const player = document.getElementById("globalAudioPlayer");
        if (player && !isNaN(player.currentTime)) {
            localStorage.setItem(STORAGE_TIME_KEY, player.currentTime.toString());
        }
    } catch (e) {
        console.error("保存播放状态失败:", e);
    }
}

function restorePlayerStateFromStorage() {
    try {
        const savedQueue = localStorage.getItem(STORAGE_QUEUE_KEY);
        const savedIndex = localStorage.getItem(STORAGE_INDEX_KEY);
        const savedMode = localStorage.getItem(STORAGE_MODE_KEY);
        const savedTime = localStorage.getItem(STORAGE_TIME_KEY);

        if (savedMode) {
            playMode = savedMode;
            updatePlayModeBtnUI();
        }

        if (savedQueue) {
            globalPlaylistQueue = JSON.parse(savedQueue) || [];
            if (typeof updatePlaylistCountUI === 'function') {
                updatePlaylistCountUI();
            }
        }

        if (savedIndex !== null && savedIndex !== undefined && globalPlaylistQueue.length > 0) {
            const idx = parseInt(savedIndex, 10);
            if (!isNaN(idx) && idx >= 0 && idx < globalPlaylistQueue.length) {
                currentQueueIndex = idx;
                const track = globalPlaylistQueue[idx];
                const lastTime = parseFloat(savedTime) || 0;
                prepareTrackInUI(track, lastTime);
            }
        }
    } catch (e) {
        console.error("恢复播放状态失败:", e);
    }
}

function updatePlayModeBtnUI() {
    const btn = document.getElementById("playModeBtn");
    const fullBtn = document.getElementById("fullscreenPlayModeBtn");
    let icon = '🔁';
    let title = '当前模式: 列表循环';
    if (playMode === 'single') {
        icon = '🔂';
        title = '当前模式: 单曲循环';
    } else if (playMode === 'random') {
        icon = '🔀';
        title = '当前模式: 随机播放';
    }
    if (btn) {
        btn.innerHTML = icon;
        btn.title = title;
    }
    if (fullBtn) {
        fullBtn.innerHTML = icon;
        fullBtn.title = title;
    }
}

function togglePlayMode() {
    if (playMode === 'loop') {
        playMode = 'single';
    } else if (playMode === 'single') {
        playMode = 'random';
    } else {
        playMode = 'loop';
    }
    updatePlayModeBtnUI();
    savePlayerStateToStorage();
}

function prepareTrackInUI(track, seekTime) {
    if (!track) return;
    seekTime = seekTime || 0;
    const bar = document.getElementById("globalAudioBar");
    const player = document.getElementById("globalAudioPlayer");
    
    const titleEl = document.getElementById("audioBarTitle");
    const artistEl = document.getElementById("audioBarArtist");
    const coverEl = document.getElementById("audioBarCover");

    if (titleEl) titleEl.textContent = track.name || "未知歌曲";
    if (artistEl) artistEl.textContent = track.artist || "未知歌手";
    if (coverEl) coverEl.src = track.cover || "/favicon.png";

    if (bar) bar.style.display = "flex";

    // 1. 本地歌曲或已有流地址：直接加载并恢复进度，绝不发线上解析
    const directUrl = track.resolvedUrl || (track.isLocal ? track.url : null);
    if (directUrl && player) {
        player.src = directUrl;
        if (typeof updatePlayerBadges === 'function') {
            updatePlayerBadges(directUrl);
        }
        if (typeof parseLrc === 'function') {
            currentPlayingLyric = track.lyric || "";
            parsedLrcList = parseLrc(currentPlayingLyric);
        }
        if (typeof renderPlaylistDrawer === 'function') {
            renderPlaylistDrawer();
        }
        if (seekTime > 0) {
            player.addEventListener('loadedmetadata', function onMeta() {
                try {
                    player.currentTime = seekTime;
                } catch (e) {}
                player.removeEventListener('loadedmetadata', onMeta);
            });
            if (player.duration) {
                try { player.currentTime = seekTime; } catch (e) {}
            }
        }
        return;
    }

    // 2. 线上未解析歌曲：异步请求解析
    axios.post('/Song_V1', new URLSearchParams({ id: track.id, name: track.name || '', artist: track.artist || '', level: 'lossless', type: 'json' }))
        .then(resp => {
            const song = resp.data.data;
            if (song && song.url && player) {
                track.resolvedUrl = song.url;
                track.resolvedAt = Date.now();
                player.src = song.url;
                
                if (typeof updatePlayerBadges === 'function') {
                    updatePlayerBadges(song.url);
                }

                if (typeof parseLrc === 'function') {
                    currentPlayingLyric = song.lyric || "";
                    parsedLrcList = parseLrc(currentPlayingLyric);
                }
                if (typeof renderPlaylistDrawer === 'function') {
                    renderPlaylistDrawer();
                }
                
                if (seekTime > 0) {
                    player.addEventListener('loadedmetadata', function onMeta() {
                        try { player.currentTime = seekTime; } catch (e) {}
                        player.removeEventListener('loadedmetadata', onMeta);
                    });
                    if (player.duration) {
                        try { player.currentTime = seekTime; } catch (e) {}
                    }
                }
            }
        })
        .catch(err => console.log("预载音频状态失败", err));
}

function setGlobalPlaylistQueue(queue, startIndex) {
    startIndex = startIndex || 0;
    if (!queue || queue.length === 0) return;
    globalPlaylistQueue = queue;
    if (typeof updatePlaylistCountUI === 'function') {
        updatePlaylistCountUI();
    }
    playTrackInQueue(startIndex);
    // 预载下一首播放地址
    preloadNextSongAfter(startIndex);
}

/**
 * 🚀 静默预载指定曲目的播放 URL (Pre-fetch / Pre-resolve Next Track)
 */
function preloadTrackStreamUrl(index) {
    if (!globalPlaylistQueue || globalPlaylistQueue.length === 0) return;
    if (index < 0 || index >= globalPlaylistQueue.length) return;
    const track = globalPlaylistQueue[index];
    if (!track) return;
    if (track.isLocal && track.url) {
        track.resolvedUrl = track.url;
        track.resolvedAt = Date.now();
        return;
    }
    if (track.resolvedUrl && Date.now() - (track.resolvedAt || 0) < 1200000) return; // 20分钟内有效则跳过

    axios.post('/Song_V1', new URLSearchParams({ id: track.id, name: track.name || '', artist: track.artist || '', level: 'lossless', type: 'json' }))
        .then(resp => {
            if (resp.data && resp.data.data && resp.data.data.url) {
                track.resolvedUrl = resp.data.data.url;
                track.resolvedAt = Date.now(); // 记录解析时间戳
                track.lyric = resp.data.data.lyric || '';
                track.freeTrial = resp.data.data.freeTrial === true;
                track.freeTrialDuration = resp.data.data.freeTrialDuration;
                if (resp.data.data.isLocal === true || (resp.data.data.url && resp.data.data.url.includes('/v2/stream'))) {
                    track.isLocal = true;
                }
                if (typeof renderPlaylistDrawer === 'function') {
                    renderPlaylistDrawer();
                }
            }
        })
        .catch(() => {});
}

function preloadNextSongAfter(index) {
    if (!globalPlaylistQueue || globalPlaylistQueue.length === 0) return;
    let nextIdx = (index + 1) % globalPlaylistQueue.length;
    preloadTrackStreamUrl(nextIdx);
}

function playTrackInQueue(index) {
    if (index < 0 || index >= globalPlaylistQueue.length) return;
    currentQueueIndex = index;
    const track = globalPlaylistQueue[index];
    savePlayerStateToStorage();

    // 0. 本地音频优先直接播放（无需向网易云线上发网络解析）
    if (track.isLocal && (track.url || track.resolvedUrl)) {
        const localUrl = track.resolvedUrl || track.url;
        track.resolvedUrl = localUrl;
        track.resolvedAt = Date.now();
        const cover = track.cover || '/favicon.png';
        playAudioOnline(localUrl, track.name, track.artist, cover, track.album || track.lyric || '');
        if (typeof renderPlaylistDrawer === 'function') {
            renderPlaylistDrawer();
        }
        preloadNextSongAfter(currentQueueIndex);
        return;
    }

    // 📴 纯离线模式：只播放本地/浏览器缓存曲目，遇到线上未缓存歌曲自动寻找下一首
    if (offlineOnlyMode) {
        const id = track.id || track.songId;
        const isServer = track.isLocal === true;
        const isBrowser = typeof lastCachedUrlsForDrawer !== 'undefined' && lastCachedUrlsForDrawer && lastCachedUrlsForDrawer.some(u => u.includes(`id=${id}`) || u.includes(`songId=${id}`));
        if (!isServer && !isBrowser) {
            showToast(`📴 纯离线模式：跳过未缓存曲目《${track.name}》`, "info", 1500);
            playNextTrackSync();
            return;
        }
    }

    // 优先纯同步播已经预载好且未过期（20分钟内有效）的链接
    const isResolved = track.resolvedUrl && Date.now() - (track.resolvedAt || 0) < 1200000;
    if (isResolved) {
        // 🛡️ 自动跳过试听
        if (autoSkipTrial && track.freeTrial) {
            showToast(`🛡️ 《${track.name}》为试听曲目，已根据设置自动跳过`, 'info', 1800);
            playNextTrackSync();
            return;
        }
        const cover = track.cover || '/favicon.png';
        playAudioOnline(track.resolvedUrl, track.name, track.artist, cover, track.lyric || '');
        if (track.freeTrial) {
            const durText = track.freeTrialDuration ? `（${track.freeTrialDuration}秒）` : '';
            showToast(`🎵 正在播放《${track.name}》试听版本${durText}`, 'info', 4000);
        }
        if (typeof renderPlaylistDrawer === 'function') {
            renderPlaylistDrawer();
        }
        preloadNextSongAfter(currentQueueIndex);
        return;
    }
    
    axios.post('/Song_V1', new URLSearchParams({ id: track.id, name: track.name || '', artist: track.artist || '', level: 'lossless', type: 'json' }))
        .then(resp => {
            const song = resp.data.data;
            if (song && song.url) {
                track.resolvedUrl = song.url;
                track.resolvedAt = Date.now();
                track.lyric = song.lyric || '';
                track.freeTrial = song.freeTrial === true;
                track.freeTrialDuration = song.freeTrialDuration;
                const realPic = song.pic || song.picUrl || (song.al && song.al.picUrl);
                if (realPic) track.cover = realPic;
                const cover = track.cover || '/favicon.png';
                if (song.isLocal === true || (song.url && (song.url.includes('/v2/stream') || song.url.includes('/history/stream')))) {
                    track.isLocal = true;
                }

                // 🛡️ 自动跳过试听
                if (autoSkipTrial && track.freeTrial) {
                    showToast(`🛡️ 《${track.name || song.name}》为试听曲目，已根据设置自动跳过`, 'info', 1800);
                    playNextTrackSync();
                    return;
                }

                playAudioOnline(song.url, track.name || song.name, track.artist || song.ar_name, cover, song.lyric);
                if (song.freeTrial) {
                    const durText = song.freeTrialDuration ? `（${song.freeTrialDuration}秒）` : '';
                    showToast(`🎵 正在播放《${track.name || song.name}》试听版本${durText}`, 'info', 4000);
                }
                if (typeof renderPlaylistDrawer === 'function') {
                    renderPlaylistDrawer();
                }
                preloadNextSongAfter(currentQueueIndex);
            } else {
                const reason = (song && song.unplayableReason) ? song.unplayableReason : "获取播放地址失败";
                showToast(`无法播放《${track.name}》：${reason}`, 'warning', 4500);
                playNextTrack();
            }
        })
        .catch(err => {
            console.error("播放曲目失败:", err);
            showToast(`无法播放《${track.name}》：网络或解析异常`, 'warning');
            playNextTrack();
        });
}

/**
 * ⚡ iOS 锁屏纯同步无缝切歌引擎（消除异步网络请求延迟，防止 iOS 系统封锁后台 play）
 */
function playNextTrackSync() {
    if (globalPlaylistQueue.length === 0) return;
    let nextIdx;
    if (playMode === 'random') {
        nextIdx = Math.floor(Math.random() * globalPlaylistQueue.length);
        if (globalPlaylistQueue.length > 1 && nextIdx === currentQueueIndex) {
            nextIdx = (currentQueueIndex + 1) % globalPlaylistQueue.length;
        }
    } else {
        nextIdx = (currentQueueIndex + 1) % globalPlaylistQueue.length;
    }
    playTrackInQueue(nextIdx);
}

function playNextTrack() {
    playNextTrackSync();
}

function playPrevTrack() {
    if (globalPlaylistQueue.length === 0) return;
    let prevIdx;
    if (playMode === 'random') {
        prevIdx = Math.floor(Math.random() * globalPlaylistQueue.length);
    } else {
        prevIdx = (currentQueueIndex - 1 + globalPlaylistQueue.length) % globalPlaylistQueue.length;
    }
    playTrackInQueue(prevIdx);
}

function toggleMinimizeAudioPlayer() {
    const bar = document.getElementById("globalAudioBar");
    if (bar) {
        bar.classList.toggle("minimized");
    }
}

function closeAudioPlayer() {
    const bar = document.getElementById("globalAudioBar");
    const player = document.getElementById("globalAudioPlayer");
    if (player) {
        player.pause();
    }
    if (bar) {
        bar.style.display = "none";
    }
}

function togglePlayPause() {
    const player = document.getElementById("globalAudioPlayer");
    const btn = document.getElementById("audioPlayPauseBtn");
    const cover = document.getElementById("audioBarCover");
    const fullBtn = document.getElementById("fullscreenPlayPauseBtn");
    const fullCover = document.getElementById("fullscreenVinylCover");

    if (!player) return;

    // 🛡️ 如果刷新后 player.src 尚未载入，自动触发当前队列项播放
    if (!player.src || player.src === '' || player.src.endsWith('/')) {
        if (currentQueueIndex >= 0 && globalPlaylistQueue && globalPlaylistQueue.length > currentQueueIndex) {
            playTrackInQueue(currentQueueIndex);
            return;
        }
    }

    if (!player.src) return;

    if (player.paused) {
        player.play().catch(e => {
            console.warn("播放失败，尝试重新调度队列曲目:", e);
            if (currentQueueIndex >= 0 && globalPlaylistQueue && globalPlaylistQueue.length > currentQueueIndex) {
                playTrackInQueue(currentQueueIndex);
            }
        });
        if (btn) btn.innerHTML = "⏸";
        if (cover) cover.classList.add("playing");
        if (fullBtn) fullBtn.innerHTML = "⏸";
        if (fullCover) fullCover.classList.add("playing");
    } else {
        player.pause();
        if (btn) btn.innerHTML = "▶";
        if (cover) cover.classList.remove("playing");
        if (fullBtn) fullBtn.innerHTML = "▶";
        if (fullCover) fullCover.classList.remove("playing");
        savePlayerStateToStorage();
    }
}

function seekAudio(e) {
    const player = document.getElementById("globalAudioPlayer");
    const wrapper = document.getElementById("progressBarWrapper") || (e.currentTarget ? e.currentTarget : null);
    if (!player || !player.duration || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    
    player.currentTime = percentage * player.duration;
    savePlayerStateToStorage();
}

function changeVolume(val) {
    const player = document.getElementById("globalAudioPlayer");
    const icon = document.getElementById("volIcon");
    if (player) {
        player.volume = val;
        player.muted = false;
    }
    if (icon) {
        icon.textContent = val == 0 ? "🔇" : (val < 0.5 ? "🔉" : "🔊");
    }
}

function toggleMute() {
    const player = document.getElementById("globalAudioPlayer");
    const icon = document.getElementById("volIcon");
    const slider = document.getElementById("volumeSlider");
    if (!player) return;

    player.muted = !player.muted;
    if (icon) {
        icon.textContent = player.muted ? "🔇" : (player.volume < 0.5 ? "🔉" : "🔊");
    }
    if (slider) {
        slider.value = player.muted ? 0 : player.volume;
    }
}

function playAudioOnline(url, name, artist, cover, lyric, album) {
    if (!url) {
        showToast("暂无直接播放链接，请切换音质重试或点击下载", "warning");
        return;
    }
    const bar = document.getElementById("globalAudioBar");
    const player = document.getElementById("globalAudioPlayer");
    const playBtn = document.getElementById("audioPlayPauseBtn");
    const coverImg = document.getElementById("audioBarCover");
    
    const fullTitle = document.getElementById("fullscreenTitle");
    const fullArtist = document.getElementById("fullscreenArtist");
    const fullCover = document.getElementById("fullscreenVinylCover");
    const fullPlayBtn = document.getElementById("fullscreenPlayPauseBtn");

    const fill = document.getElementById("progressBarFill");
    const handle = document.getElementById("progressBarHandle");
    const curTime = document.getElementById("audioCurrentTime");
    
    if (bar && player) {
        const titleText = name || "未知歌曲";
        const artistText = artist || "未知歌手";
        const coverSrc = cover && cover !== '/favicon.png' ? cover : '/favicon.png';

        const barTitle = document.getElementById("audioBarTitle");
        const barArtist = document.getElementById("audioBarArtist");
        if (barTitle) barTitle.textContent = titleText;
        if (barArtist) barArtist.textContent = artistText;
        if (fullTitle) fullTitle.textContent = titleText;
        if (fullArtist) fullArtist.textContent = artistText;

        if (coverImg) {
            coverImg.src = coverSrc;
            coverImg.classList.add("playing");
        }
        if (fullCover) {
            fullCover.src = coverSrc;
            fullCover.classList.add("playing");
        }
        
        if (typeof updatePlayerBadges === 'function') {
            updatePlayerBadges(url);
        }

        if (url && name && typeof saveCachedTrackMeta === 'function') {
            saveCachedTrackMeta(url, {
                songName: titleText,
                artist: artistText,
                cover: coverSrc,
                album: album || ''
            });
        }

        if (typeof renderLyricLinesDOM === 'function') {
            currentPlayingLyric = lyric || "";
            parsedLrcList = parseLrc(currentPlayingLyric);
            currentLrcIndex = -1;
            renderLyricLinesDOM();
        }

        // 🎯 核心修复：强制切歌从 0 秒开始播放，并重置进度条 UI
        if (fill) fill.style.width = "0%";
        if (handle) handle.style.left = "0%";
        if (curTime) curTime.textContent = "00:00";

        player.src = url;
        player.currentTime = 0;
        bar.style.display = "flex";
        if (playBtn) playBtn.innerHTML = "⏸";
        if (fullPlayBtn) fullPlayBtn.innerHTML = "⏸";

        const playPromise = player.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                player.currentTime = 0;
            }).catch(e => {
                console.warn("自动播放受阻或中断:", e);
                if (playBtn) playBtn.innerHTML = "▶";
                if (fullPlayBtn) fullPlayBtn.innerHTML = "▶";
            });
        if (typeof initPeqAudioContext === 'function') {
            initPeqAudioContext();
        }
        savePlayerStateToStorage();

        // 📱 绑定原生 Media Session API（实现 iOS/Android 锁屏界面遥控、显示封面与连续后台切歌）
        updateMediaSessionMetadata(name, artist, cover, album);

        // ❤️ 刷新红心按钮状态
        if (typeof updateAllLikeButtonsUI === 'function') {
            updateAllLikeButtonsUI();
        }
    }
}

/**
 * ❤️ 切换当前正在播放曲目的红心状态
 */
function toggleCurrentAudioLike() {
    const currentTrack = (typeof globalPlaylistQueue !== 'undefined' && typeof currentQueueIndex !== 'undefined' && currentQueueIndex >= 0) 
        ? globalPlaylistQueue[currentQueueIndex] 
        : null;
    if (currentTrack && currentTrack.id) {
        toggleLikeTrack(currentTrack.id, currentTrack.name);
    } else {
        const titleEl = document.getElementById("audioBarTitle");
        const title = titleEl ? titleEl.textContent : "";
        showToast(title ? `正在播放《${title}》` : "暂无可操作的当前歌曲", "info");
    }
}
window.toggleCurrentAudioLike = toggleCurrentAudioLike;

/**
 * 📱 硬件级 Media Session 锁屏组件更新函数
 */
function updateMediaSessionMetadata(name, artist, cover, album) {
    if (!('mediaSession' in navigator)) return;
    try {
        const coverUrl = cover || '/favicon.png';
        navigator.mediaSession.metadata = new MediaMetadata({
            title: name || '网易云音乐',
            artist: artist || '未知歌手',
            album: album || '网易云下载器',
            artwork: [
                { src: coverUrl, sizes: '96x96', type: 'image/png' },
                { src: coverUrl, sizes: '128x128', type: 'image/png' },
                { src: coverUrl, sizes: '192x192', type: 'image/png' },
                { src: coverUrl, sizes: '256x256', type: 'image/png' },
                { src: coverUrl, sizes: '512x512', type: 'image/png' }
            ]
        });
        
        // 绑定 iOS / Android 锁屏与耳机遥控系统事件
        navigator.mediaSession.setActionHandler('play', () => {
            const player = document.getElementById("globalAudioPlayer");
            if (player) player.play();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            const player = document.getElementById("globalAudioPlayer");
            if (player) player.pause();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrevTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrack());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            const player = document.getElementById("globalAudioPlayer");
            if (player && details.seekTime !== undefined) {
                player.currentTime = details.seekTime;
            }
        });
    } catch (e) {
        console.warn("[MediaSession] 注册锁屏元数据失败:", e);
    }
}

function playOnline(songId, name, artist) {
    playSongById(songId, name, artist);
}

function playSongById(songId, name, artist) {
    // 智能定位或更新全局队列
    if (typeof allTracks !== 'undefined' && Array.isArray(allTracks) && allTracks.length > 0) {
        const foundIdx = allTracks.findIndex(t => String(t.id) === String(songId));
        if (foundIdx >= 0) {
            globalPlaylistQueue = allTracks.map(t => ({
                id: t.id,
                name: t.name,
                artist: typeof getValidArtistNames === 'function' ? getValidArtistNames(t) : t.artist,
                cover: (t.al && t.al.picUrl) ? t.al.picUrl : '/favicon.png',
                isLocal: (t.isLocal === true)
            }));
            currentQueueIndex = foundIdx;
            if (typeof updatePlaylistCountUI === 'function') updatePlaylistCountUI();
        }
    } else if (typeof currentAlbumSongs !== 'undefined' && Array.isArray(currentAlbumSongs) && currentAlbumSongs.length > 0) {
        const foundIdx = currentAlbumSongs.findIndex(t => String(t.id) === String(songId));
        if (foundIdx >= 0) {
            globalPlaylistQueue = currentAlbumSongs.map(t => ({
                id: t.id,
                name: t.name,
                artist: typeof getValidArtistNames === 'function' ? getValidArtistNames(t) : t.artist,
                cover: (t.al && t.al.picUrl) ? t.al.picUrl : (typeof currentAlbumCover !== 'undefined' ? currentAlbumCover : '/favicon.png'),
                isLocal: (t.isLocal === true)
            }));
            currentQueueIndex = foundIdx;
            if (typeof updatePlaylistCountUI === 'function') updatePlaylistCountUI();
        }
    } else if (globalPlaylistQueue.length === 0) {
        globalPlaylistQueue = [{ id: songId, name: name, artist: artist, cover: '/favicon.png' }];
        currentQueueIndex = 0;
        if (typeof updatePlaylistCountUI === 'function') updatePlaylistCountUI();
    }

    axios.post('/Song_V1', new URLSearchParams({ id: songId, name: name || '', artist: artist || '', level: 'lossless', type: 'json' }))
        .then(resp => {
            const song = resp.data.data;
            if (song && song.url) {
                playAudioOnline(song.url, name || song.name, artist || song.ar_name, song.pic, song.lyric, song.al_name);
                if (song.freeTrial) {
                    const durText = song.freeTrialDuration ? `（${song.freeTrialDuration}秒）` : '';
                    showToast(`🎵 正在播放《${name || song.name}》试听版本${durText}`, 'info', 4000);
                }
            } else {
                const reason = (song && song.unplayableReason) ? song.unplayableReason : "获取播放地址失败";
                showToast(`无法播放《${name || (song ? song.name : '当前歌曲')}》：${reason}`, 'warning', 4500);
            }
        })
        .catch(err => showToast(`播放获取失败：${err}`, 'warning'));
}

window.savePlayerStateToStorage = savePlayerStateToStorage;
window.restorePlayerStateFromStorage = restorePlayerStateFromStorage;
window.updatePlayModeBtnUI = updatePlayModeBtnUI;
window.togglePlayMode = togglePlayMode;
window.setGlobalPlaylistQueue = setGlobalPlaylistQueue;
window.preloadTrackStreamUrl = preloadTrackStreamUrl;
window.preloadNextSongAfter = preloadNextSongAfter;
window.playTrackInQueue = playTrackInQueue;
window.playNextTrackSync = playNextTrackSync;
window.playNextTrack = playNextTrack;
window.playPrevTrack = playPrevTrack;
window.toggleMinimizeAudioPlayer = toggleMinimizeAudioPlayer;
window.closeAudioPlayer = closeAudioPlayer;
window.togglePlayPause = togglePlayPause;
window.seekAudio = seekAudio;
window.changeVolume = changeVolume;
window.toggleMute = toggleMute;
window.playAudioOnline = playAudioOnline;
window.updateMediaSessionMetadata = updateMediaSessionMetadata;
window.playOnline = playOnline;
window.playSongById = playSongById;
