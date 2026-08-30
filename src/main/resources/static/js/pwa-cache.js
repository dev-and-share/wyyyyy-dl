/* ==========================================================================
   📱 NetEase Music Downloader - Mobile PWA & Cache API Engine (pwa-cache.js)
   ========================================================================== */

const PWA_CACHE_NAME = 'netease-music-audio-v1';
const PWA_TRACK_META_KEY = 'pwa_cached_tracks_meta_v1';

/**
 * 🎯 静默解构音频 Blob 的真实播放时长 (Duration) 秒数
 */
function getAudioBlobDuration(blob) {
    return new Promise((resolve) => {
        if (!blob) return resolve(0);
        try {
            const audio = new Audio();
            const url = URL.createObjectURL(blob);
            audio.src = url;
            audio.onloadedmetadata = () => {
                const duration = audio.duration;
                URL.revokeObjectURL(url);
                resolve(duration || 0);
            };
            audio.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(0);
            };
            setTimeout(() => {
                URL.revokeObjectURL(url);
                resolve(audio.duration || 0);
            }, 1000);
        } catch (e) {
            resolve(0);
        }
    });
}

async function isUrlInCache(url) {
    if (!('caches' in window) || !url) return false;
    try {
        const cache = await caches.open(PWA_CACHE_NAME);
        const match = await cache.match(url);
        return !!match;
    } catch (e) {
        return false;
    }
}

async function countCachedTracks(tracks) {
    if (!tracks || tracks.length === 0 || !('caches' in window)) return 0;
    let count = 0;
    try {
        const cache = await caches.open(PWA_CACHE_NAME);
        const keys = await cache.keys();
        const cachedUrls = keys.map(req => req.url);

        for (const track of tracks) {
            const id = track.id || track.songId;
            if (!id) continue;
            const isMatch = cachedUrls.some(url => url.includes(`id=${id}`) || url.includes(`songId=${id}`));
            if (isMatch) count++;
        }
    } catch (e) {
        console.warn("[PWA] 统计已缓存数失败:", e);
    }
    return count;
}

async function refreshPhoneCacheBtn(tracks, btnId, baseText = '📲 缓存到浏览器') {
    const btn = document.getElementById(btnId);
    if (!btn || !tracks || tracks.length === 0) return;
    const total = tracks.length;
    const cached = await countCachedTracks(tracks);
    btn.textContent = `${baseText} (${cached}/${total})`;
    if (cached === total && total > 0) {
        btn.style.background = '#0284c7';
    }
}

function getCachedTrackMetaMap() {
    try {
        return JSON.parse(localStorage.getItem(PWA_TRACK_META_KEY) || '{}');
    } catch(e) {
        return {};
    }
}

function saveCachedTrackMeta(url, meta) {
    if (!url || !meta) return;
    try {
        const map = getCachedTrackMetaMap();
        const cleanUrl = url.replace(window.location.origin, '');
        map[cleanUrl] = { ...(map[cleanUrl] || {}), ...meta, updatedAt: Date.now() };
        localStorage.setItem(PWA_TRACK_META_KEY, JSON.stringify(map));
    } catch(e) {
        console.warn("[PWA] 保存歌曲缓存元数据失败", e);
    }
}

function removeCachedTrackMeta(url) {
    if (!url) return;
    try {
        const map = getCachedTrackMetaMap();
        const cleanUrl = url.replace(window.location.origin, '');
        delete map[cleanUrl];
        delete map[url];
        localStorage.setItem(PWA_TRACK_META_KEY, JSON.stringify(map));
    } catch(e) {}
}

async function cacheTracksToPhoneBatch(tracks, btnId, baseText = '📲 缓存到浏览器') {
    const btn = document.getElementById(btnId);
    if (!('caches' in window)) {
        showToast("当前浏览器不支持 Cache API 或未以 HTTPS/PWA 模式运行", "warning");
        return;
    }
    if (!tracks || tracks.length === 0) {
        showToast("暂无要缓存的曲目", "warning");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.75';
    }

    let cachedCount = await countCachedTracks(tracks);
    const total = tracks.length;

    try {
        const cache = await caches.open(PWA_CACHE_NAME);
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const id = track.id || track.songId;
            if (!id) continue;

            if (btn) btn.textContent = `⏳ 正在解析 (${i + 1}/${total})...`;

            try {
                const resp = await axios.post('/Song_V1', new URLSearchParams({ id: id, level: 'lossless', type: 'json' }));
                let audioUrl = resp.data && resp.data.data ? resp.data.data.url : null;
                const songData = resp.data && resp.data.data ? resp.data.data : {};

                if (!audioUrl) {
                    if (btn) btn.textContent = `⚡ 触发服务器落盘 (${i + 1}/${total})...`;
                    await axios.get(`/v2/single?id=${id}`).catch(() => {});
                    const retryResp = await axios.post('/Song_V1', new URLSearchParams({ id: id, level: 'lossless', type: 'json' }));
                    audioUrl = retryResp.data && retryResp.data.data ? retryResp.data.data.url : null;
                }

                if (audioUrl) {
                    const isCached = await isUrlInCache(audioUrl);
                    if (!isCached) {
                        if (btn) btn.textContent = `📥 正在校验与下载 (${i + 1}/${total})...`;
                        const streamResp = await fetch(audioUrl);
                        if (streamResp.ok) {
                            const blob = await streamResp.blob();
                            
                            const duration = await getAudioBlobDuration(blob);
                            if (blob.size < 1250000 || (duration > 0 && duration < 45)) {
                                console.warn(`[PWA Filter] 🚫 自动跳过 30s 试听片段 songId:${id}, 大小:${Math.round(blob.size / 1024)}KB, 时长:${Math.round(duration)}秒`);
                                if (btn) btn.textContent = `⚠️ 已跳过 30s 试听 (${i + 1}/${total})...`;
                                continue;
                            }

                            const validResponse = new Response(blob, {
                                status: streamResp.status,
                                statusText: streamResp.statusText,
                                headers: streamResp.headers
                            });
                            await cache.put(audioUrl, validResponse);
                            
                            const sName = songData.name || track.name || '未知歌曲';
                            const sArtist = songData.ar_name || (typeof getValidArtistNames === 'function' ? getValidArtistNames(track) : track.artist) || '未知歌手';
                            const sCover = songData.al_pic_url || track.cover || '/favicon.png';
                            const sAlbum = songData.al_name || track.album || '';

                            const trackMeta = {
                                id: id,
                                songName: sName,
                                artist: sArtist,
                                cover: sCover,
                                album: sAlbum,
                                fileSize: blob.size,
                                duration: duration
                            };
                            saveCachedTrackMeta(audioUrl, trackMeta);

                            if (id && String(id) !== '0') {
                                const aliasUrl = `/v2/stream?id=${id}`;
                                if (audioUrl !== aliasUrl) {
                                    const aliasResponse = new Response(blob, {
                                        status: streamResp.status,
                                        statusText: streamResp.statusText,
                                        headers: streamResp.headers
                                    });
                                    await cache.put(aliasUrl, aliasResponse);
                                    saveCachedTrackMeta(aliasUrl, trackMeta);
                                }
                            }
                            cachedCount++;
                        }
                    }
                }
            } catch (err) {
                console.warn(`[PWA] 预取失败 songId:${id}`, err);
            }

            if (btn) btn.textContent = `${baseText} (${cachedCount}/${total})`;
        }
    } catch (e) {
        console.error("[PWA] 批量缓存操作异常:", e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.textContent = `${baseText} (${cachedCount}/${total})`;
            if (cachedCount === total && total > 0) {
                btn.style.background = '#0284c7';
            }
        }
    }
}

async function updatePlayerBadges(url) {
    const sourceBadge = document.getElementById("audioSourceBadge");
    const fullBadge = document.getElementById("fullscreenBadge");
    
    if (!sourceBadge) return;
    
    const isServer = url && (url.includes("/v2/stream") || url.includes("/v2/history/stream") || url.includes("/history/stream"));
    const isBrowser = await isUrlInCache(url);
    
    let className = "audio-source-badge icon-only";
    let icon = "";
    let title = "";
    
    if (isServer && isBrowser) {
        className += " badge-both";
        icon = "✨";
        title = "✨ 服务器与本机浏览器均有缓存";
    } else if (isServer) {
        className += " badge-server";
        icon = "🖥️";
        title = "🖥️ 已存在服务器磁盘";
    } else if (isBrowser) {
        className += " badge-browser";
        icon = "📲";
        title = "📲 已缓存于当前设备浏览器";
    } else {
        className += " badge-online";
        icon = "🌐";
        title = "🌐 当前通过网络流式获取";
    }
    
    sourceBadge.className = className;
    sourceBadge.innerHTML = icon;
    sourceBadge.title = title;
    sourceBadge.style.display = "inline-flex";
    
    if (fullBadge) {
        fullBadge.className = className;
        fullBadge.innerHTML = icon;
        fullBadge.title = title;
        fullBadge.style.display = "inline-flex";
    }
}

async function getAllCacheKeys() {
    if (!('caches' in window)) return [];
    try {
        const cacheNames = await caches.keys();
        let allRequests = [];
        for (const cName of cacheNames) {
            const cache = await caches.open(cName);
            const reqs = await cache.keys();
            allRequests.push(...reqs);
        }
        return allRequests.map(r => r.url);
    } catch (e) {
        return [];
    }
}

function revealSong(id, name = '', artist = '', path = '', taskId = null) {
    let url = '/v2/reveal?';
    const params = [];
    if (path) params.push('path=' + encodeURIComponent(path));
    if (taskId) params.push('taskId=' + encodeURIComponent(taskId));
    if (id) params.push('id=' + encodeURIComponent(id));
    if (name) params.push('name=' + encodeURIComponent(name));
    if (artist) params.push('artist=' + encodeURIComponent(artist));
    url += params.join('&');

    axios.get(url)
        .then(resp => {
            if (resp.data.code === '000000') {
                const hostPath = resp.data.data;
                showRevealModal(hostPath, path, '📂 已为您定位宿主机真实物理路径！');
            } else {
                showRevealModal(path || resp.data.data, path, resp.data.msg || '定位提示');
            }
        })
        .catch(err => {
            if (path) {
                showRevealModal(path, path, '📂 物理路径');
            } else {
                showToast('定位文件失败: ' + err, 'error');
            }
        });
}

function handleStatusBadgeClick(e, trackId, trackName, trackArtist, isServer, isBrowser) {
    if (e && e.stopPropagation) e.stopPropagation();
    
    if (isServer) {
        revealSong(trackId, trackName, trackArtist);
    } else if (isBrowser) {
        showAppModal({
            title: '手机/浏览器离线缓存',
            icon: '📲',
            content: `
                <div style="font-weight:600; font-size:14px; margin-bottom:8px; color:var(--text-main);">${escapeHtml(trackName || '该曲目')}</div>
                <div style="font-size:13px; color:var(--text-secondary); line-height:1.6;">
                    该歌曲已通过 <b>PWA Cache API</b> 完整缓存在当前设备的本地存储空间中。<br><br>
                    💡 <b>离线畅听提示</b>：无论是在地铁、飞行模式还是断网无信号环境，您均可随时 0 流量秒开播放！
                </div>
            `,
            confirmText: '我知道了'
        });
    }
}

function renderTrackCapsuleSlotsHtml(track, prefix = 'track-') {
    const id = track.id || track.songId;
    const nameSafe = (track.name || '').replace(/'/g, "\\'");
    const artistSafe = (typeof getValidArtistNames === 'function' ? getValidArtistNames(track) : (track.artist || '')).replace(/'/g, "\\'");
    const isLocal = (track.isLocal === true);

    const playBtnText = isLocal ? '▶️ 播放' : '▶️ 试听';
    const playBtnClass = isLocal ? 'track-btn-slot slot-play-ready' : 'track-btn-slot slot-play-preview';
    const playBtnTitle = isLocal ? '0延迟本地无损秒播' : '在线试听';

    const serverBtnText = isLocal ? '📂 定位' : '📥 下载';
    const serverBtnClass = isLocal ? 'track-btn-slot slot-server-locate' : 'track-btn-slot slot-server-download';
    const serverBtnTitle = isLocal ? '在服务器/宿主机中定位物理文件' : '下载到电脑磁盘';
    const serverBtnAction = isLocal
        ? `revealSong('${id}', '${nameSafe}', '${artistSafe}')`
        : `downloadSingle('${id}')`;

    const isLiked = (typeof isSongLiked === 'function') ? isSongLiked(id) : false;
    const heartSvg = (typeof getHeartSvgHtml === 'function') ? getHeartSvgHtml(isLiked, 16) : (isLiked ? '❤️' : '🤍');
    const heartClass = 'track-like-btn' + (isLiked ? ' active' : '');
    const heartTitle = isLiked ? '已喜欢 (点击取消红心)' : '喜欢 (点击添加红心)';

    return `
        <div class="track-action-group">
            <button class="${heartClass}" data-song-id="${id}" onclick="event.stopPropagation(); toggleLikeTrack('${id}', '${nameSafe}')" title="${heartTitle}">${heartSvg}</button>
            <button id="${prefix}play-btn-${id}" class="${playBtnClass}" onclick="playSongById('${id}', '${nameSafe}', '${artistSafe}')" title="${playBtnTitle}">${playBtnText}</button>
            
            <!-- PC 模式展示完整功能胶囊，SP 模式自动隐藏 -->
            <button id="${prefix}server-btn-${id}" class="${serverBtnClass} sp-hide" onclick="${serverBtnAction}" title="${serverBtnTitle}">${serverBtnText}</button>
            <button id="${prefix}cache-btn-${id}" class="track-btn-slot slot-browser-cache sp-hide" onclick="cacheTracksToPhoneBatch([{id: '${id}', songId: '${id}'}], '${prefix}cache-btn-${id}', '📲 缓存')" title="缓存至手机/浏览器离线播放">📲 缓存</button>
            <button class="track-btn-slot slot-add-playlist sp-hide" onclick="event.stopPropagation(); showAddToPlaylistModal('${id}', '${nameSafe}', '${artistSafe}')" title="添加至我的歌单">➕ 歌单</button>
            
            <!-- SP 移动端模式专享的收纳更多操作按钮 -->
            <button class="track-btn-more sp-show" onclick="event.stopPropagation(); showTrackActionMenu('${id}', '${nameSafe}', '${artistSafe}', ${isLocal}, '${prefix}')" title="更多操作">···</button>
        </div>
    `;
}

/**
 * 📱 移动端单曲更多操作 ActionSheet
 */
function showTrackActionMenu(id, name, artist, isLocal, prefix = 'track-') {
    const isLiked = (typeof isSongLiked === 'function') ? isSongLiked(id) : false;
    const heartText = isLiked ? '💔 取消喜欢 (红心)' : '❤️ 喜欢这首歌 (红心)';

    const items = [
        {
            icon: isLocal ? '▶️' : '🎧',
            text: isLocal ? '立即播放 (本地无损秒播)' : '在线试听歌曲',
            onClick: () => playSongById(id, name, artist)
        },
        {
            icon: isLiked ? '💔' : '❤️',
            text: heartText,
            onClick: () => toggleLikeTrack(id, name)
        },
        {
            icon: isLocal ? '📂' : '📥',
            text: isLocal ? '在服务器/宿主机中定位文件' : '下载到电脑磁盘',
            subtext: isLocal ? '已落盘' : '异步高品质下载',
            onClick: () => {
                if (isLocal) {
                    revealSong(id, name, artist);
                } else {
                    downloadSingle(id);
                }
            }
        },
        {
            icon: '📲',
            text: '离线缓存至手机 / 浏览器',
            subtext: 'PWA 离线播放免流量',
            onClick: () => {
                cacheTracksToPhoneBatch([{ id: id, songId: id, name: name, artist: artist }], `${prefix}cache-btn-${id}`, '📲 缓存');
            }
        },
        {
            icon: '➕',
            text: '添加至我的自建歌单...',
            onClick: () => showAddToPlaylistModal(id, name, artist)
        }
    ];

    if (typeof showActionSheet === 'function') {
        showActionSheet({
            title: name || '未知歌曲',
            subtitle: artist || '未知歌手',
            items: items
        });
    }
}
window.showTrackActionMenu = showTrackActionMenu;

async function asyncUpdateListBadges(pageTracks, prefix = 'track-') {
    if (!pageTracks || pageTracks.length === 0) return;
    
    const cachedUrls = await getAllCacheKeys();
    
    pageTracks.forEach(track => {
        const id = track.id || track.songId;
        if (!id) return;
        
        const trackName = track.name || '';
        const trackArtist = typeof getValidArtistNames === 'function' ? getValidArtistNames(track) : (track.artist || '');
        const isServer = track.isLocal === true;
        const isBrowser = cachedUrls.some(url => url.includes(`id=${id}`) || url.includes(`songId=${id}`));

        // 1. 更新 Badge 图标
        const badgeEl = document.getElementById(`badge-${prefix}${id}`) || document.getElementById(`badge-track-${id}`);
        if (badgeEl) {
            if (isServer && isBrowser) {
                badgeEl.className = "status-badge status-both icon-only";
                badgeEl.innerHTML = "✨";
                badgeEl.title = "✨ 服务器与本机浏览器均有缓存 (点击查看物理路径)";
                badgeEl.style.display = "inline-flex";
                badgeEl.style.cursor = "pointer";
                badgeEl.onclick = (e) => handleStatusBadgeClick(e, id, trackName, trackArtist, true, true);
            } else if (isServer) {
                badgeEl.className = "status-badge status-server icon-only";
                badgeEl.innerHTML = "🖥️";
                badgeEl.title = "🖥️ 已存在服务器磁盘 (点击查看物理路径)";
                badgeEl.style.display = "inline-flex";
                badgeEl.style.cursor = "pointer";
                badgeEl.onclick = (e) => handleStatusBadgeClick(e, id, trackName, trackArtist, true, false);
            } else if (isBrowser) {
                badgeEl.className = "status-badge status-browser icon-only";
                badgeEl.innerHTML = "📲";
                badgeEl.title = "📲 已缓存于当前设备浏览器 (点击查看详情)";
                badgeEl.style.display = "inline-flex";
                badgeEl.style.cursor = "pointer";
                badgeEl.onclick = (e) => handleStatusBadgeClick(e, id, trackName, trackArtist, false, true);
            } else {
                badgeEl.style.display = "none";
                badgeEl.onclick = null;
            }
        }

        // 2. 动态同步 槽位 1 (播放/试听)
        const playBtn = document.getElementById(`${prefix}play-btn-${id}`);
        if (playBtn) {
            if (isServer || isBrowser) {
                playBtn.className = "track-btn-slot slot-play-ready";
                playBtn.innerHTML = "▶️ 播放";
                playBtn.title = isBrowser ? "离线就绪秒播" : "本地无损秒播";
            } else {
                playBtn.className = "track-btn-slot slot-play-preview";
                playBtn.innerHTML = "▶️ 试听";
                playBtn.title = "在线试听";
            }
        }

        // 3. 动态同步 槽位 2 (下载/定位)
        const serverBtn = document.getElementById(`${prefix}server-btn-${id}`);
        if (serverBtn) {
            if (isServer) {
                serverBtn.className = "track-btn-slot slot-server-locate";
                serverBtn.innerHTML = "📂 定位";
                serverBtn.title = "在服务器/宿主机中定位物理文件";
                serverBtn.onclick = () => revealSong(id, trackName, trackArtist);
            } else {
                serverBtn.className = "track-btn-slot slot-server-download";
                serverBtn.innerHTML = "📥 下载";
                serverBtn.title = "下载到电脑磁盘";
                serverBtn.onclick = () => downloadSingle(id);
            }
        }

        // 4. 动态同步 槽位 3 (缓存/已离线)
        const cacheBtn = document.getElementById(`${prefix}cache-btn-${id}`);
        if (cacheBtn) {
            if (isBrowser) {
                cacheBtn.className = "track-btn-slot slot-browser-cached";
                cacheBtn.innerHTML = "✅ 离线";
                cacheBtn.title = "已存储于当前设备离线存储空间 (点击查看详情)";
                cacheBtn.onclick = (e) => handleStatusBadgeClick(e, id, trackName, trackArtist, isServer, true);
            } else {
                cacheBtn.className = "track-btn-slot slot-browser-cache";
                cacheBtn.innerHTML = "📲 缓存";
                cacheBtn.title = "缓存至手机/浏览器离线播放";
                cacheBtn.onclick = () => cacheTracksToPhoneBatch([{id: id, songId: id}], `${prefix}cache-btn-${id}`, '📲 缓存');
            }
        }
    });
}

window.getAudioBlobDuration = getAudioBlobDuration;
window.isUrlInCache = isUrlInCache;
window.countCachedTracks = countCachedTracks;
window.refreshPhoneCacheBtn = refreshPhoneCacheBtn;
window.getCachedTrackMetaMap = getCachedTrackMetaMap;
window.saveCachedTrackMeta = saveCachedTrackMeta;
window.removeCachedTrackMeta = removeCachedTrackMeta;
window.cacheTracksToPhoneBatch = cacheTracksToPhoneBatch;
window.updatePlayerBadges = updatePlayerBadges;
window.getAllCacheKeys = getAllCacheKeys;
window.revealSong = revealSong;
window.handleStatusBadgeClick = handleStatusBadgeClick;
window.renderTrackCapsuleSlotsHtml = renderTrackCapsuleSlotsHtml;
window.asyncUpdateListBadges = asyncUpdateListBadges;
