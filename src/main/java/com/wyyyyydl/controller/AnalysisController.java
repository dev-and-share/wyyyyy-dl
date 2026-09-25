package com.wyyyyydl.controller;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.wyyyyydl.enums.CommonRespInfo;
import com.wyyyyydl.models.common.RespEntity;
import com.wyyyyydl.models.dtos.AlbumAnalysisRespDTO;
import com.wyyyyydl.models.dtos.ArtistAnalysisRespDTO;
import com.wyyyyydl.models.dtos.PlaylistAnalysisRespDTO;
import com.wyyyyydl.models.dtos.SingleMusicAnalysisRespDTO;
import com.wyyyyydl.models.dtos.TrackDTO;
import com.wyyyyydl.service.AnalysisService;
import com.wyyyyydl.service.NeteaseAPIService;

import lombok.extern.slf4j.Slf4j;

/**
 * 🎵 核心解析控制器 (AnalysisController) — /v3/ 统一规范
 * @author wyyyyy-dl
 */
@RestController
@Slf4j
@RequestMapping("/v3")
public class AnalysisController {
	
	@Autowired
    private AnalysisService analysisService;

	@Autowired
    private NeteaseAPIService neteaseAPIService;

	@Autowired
    private com.wyyyyydl.dao.DownloadHistoryDAO downloadHistoryDAO;

	@Autowired
    private com.wyyyyydl.service.MusicDownloadService musicDownloadService;
	
	@RequestMapping(value = "/cookie", method = {RequestMethod.GET, RequestMethod.POST})
	public RespEntity<?> refreshCookie(@RequestParam(value = "cookie", required = true) String cookie) {
		analysisService.refreshCookie(cookie);
		return RespEntity.apply(CommonRespInfo.SUCCESS, "OK");
	}

	@RequestMapping(value = "/album", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> album(@RequestParam(required = true) Long id) {
		AlbumAnalysisRespDTO result = analysisService.analyzeAlbum(id);
		if (result != null && result.getAlbum() != null && result.getAlbum().getSongs() != null) {
			downloadHistoryDAO.markLocalStatusBatch(result.getAlbum().getSongs());
		}
        return RespEntity.apply(CommonRespInfo.SUCCESS, result);
    }

    @RequestMapping(value = "/playlist", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> playlist(@RequestParam(required = true) String id) {
        Long playlistId;
        try {
            playlistId = Long.parseLong(id.trim());
        } catch (Exception e) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "歌单 ID 无效或不合法", null);
        }
        PlaylistAnalysisRespDTO result = analysisService.analyzePlaylist(playlistId);
        if (result != null && result.getPlaylist() != null && result.getPlaylist().getTracks() != null) {
            downloadHistoryDAO.markLocalStatusBatch(result.getPlaylist().getTracks());
        }
        return RespEntity.apply(CommonRespInfo.SUCCESS, result);
    }

    @RequestMapping(value = "/artist", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> artist(@RequestParam(required = true) Long id) {
        ArtistAnalysisRespDTO result = analysisService.analyzeArtist(id);
        if (result != null && result.getArtist() != null && result.getArtist().getSongs() != null) {
            downloadHistoryDAO.markLocalStatusBatch(result.getArtist().getSongs());
        }
        return RespEntity.apply(CommonRespInfo.SUCCESS, result);
    }

    /**
     * 获取用户专属每日推荐歌曲
     */
    @RequestMapping(value = "/recommend/songs", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> recommendSongs() {
        List<TrackDTO> tracks = analysisService.getDailyRecommendSongs();
        if (tracks != null && !tracks.isEmpty()) {
            downloadHistoryDAO.markLocalStatusBatch(tracks);
        }
        return RespEntity.apply(CommonRespInfo.SUCCESS, tracks);
    }
    
    /**
     * 搜索音乐
     * @param keywords 关键词
     * @param limit 每页条数
     * @param offset 偏移量
     * @param type 搜索类型 (单曲1/歌手100/专辑10/歌单1000)
     */
    @RequestMapping(value = "/search", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> search(@RequestParam(required = false) String keywords,
                                @RequestParam(required = false) String keyword,
                                @RequestParam(required = false, defaultValue = "50") int limit,
                                @RequestParam(required = false, defaultValue = "0") int offset,
                                @RequestParam(required = false) Integer type) {
        String queryKey = (keywords != null && !keywords.trim().isEmpty()) ? keywords : keyword;
        if (queryKey == null) queryKey = "";
        List<?> result = analysisService.searchMusic(queryKey, limit, offset, type);
        if (result != null && (type == null || type == 1)) {
            try {
                downloadHistoryDAO.markLocalStatusBatch((List<TrackDTO>) result);
            } catch (Exception e) {
                log.debug("标记搜索曲目本地状态失败", e);
            }
        }
        return RespEntity.apply(CommonRespInfo.SUCCESS, result);
    }

    @RequestMapping(value = "/song", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> songV1(@RequestParam(required = true) Long id,
                                @RequestParam(required = true) String level,
                                @RequestParam(required = false) String name,
                                @RequestParam(required = false) String artist,
                                @RequestParam(required = false) String playlistName,
                                @RequestParam(required = false) String albumName,
                                @RequestParam(required = false, defaultValue = "json") String type) {
        SingleMusicAnalysisRespDTO songInfo = analysisService.analyzeSingleSong(id, level);

        String searchName = (name != null && !name.trim().isEmpty()) ? name : (songInfo != null ? songInfo.getName() : null);
        String searchArtist = (artist != null && !artist.trim().isEmpty()) ? artist : (songInfo != null ? songInfo.getAr_name() : null);

        // 🚀 智能双重比对：优先匹配 song_id，未匹配上则比对 (歌名 + 歌手名) 本地已下载音轨！
        com.wyyyyydl.dao.DownloadHistoryDAO.DownloadHistoryItem localItem = downloadHistoryDAO.findLocalFileBySongOrName(id, searchName, searchArtist);
        if (localItem != null && Boolean.TRUE.equals(localItem.getFileExists())) {
            analysisService.applyLocalTrackOverride(songInfo, localItem);
        } else {
            if (songInfo != null) {
                songInfo.setIsLocal(false);
                if (songInfo.getUrl() != null && !songInfo.getUrl().isEmpty()) {
                    String rawUrl = songInfo.getUrl();
                    boolean isTrial = Boolean.TRUE.equals(songInfo.getFreeTrial());

                    // 构造带 CORS 头与分片支持的在线代理播放地址
                    StringBuilder sb = new StringBuilder("/v3/stream/online?id=").append(id);
                    try {
                        sb.append("&url=").append(java.net.URLEncoder.encode(rawUrl, "UTF-8"));
                    } catch (Exception e) {
                        sb.append("&url=").append(rawUrl);
                    }
                    if (playlistName != null && !playlistName.trim().isEmpty()) {
                        try {
                            sb.append("&playlistName=").append(java.net.URLEncoder.encode(playlistName, "UTF-8"));
                        } catch (Exception ignored) {}
                    }
                    if (albumName != null && !albumName.trim().isEmpty()) {
                        try {
                            sb.append("&albumName=").append(java.net.URLEncoder.encode(albumName, "UTF-8"));
                        } catch (Exception ignored) {}
                    }
                    if (searchName != null && !searchName.trim().isEmpty()) {
                        try {
                            sb.append("&name=").append(java.net.URLEncoder.encode(searchName, "UTF-8"));
                        } catch (Exception ignored) {}
                    }
                    if (isTrial) {
                        sb.append("&freeTrial=true");
                    }
                    songInfo.setUrl(sb.toString());

                    // 🚀 智能边播边存触发：非试听歌曲且本地不存在，后台自动开启异步静默落盘
                    if (!isTrial && musicDownloadService != null) {
                        musicDownloadService.asyncDownloadOnPlay(id, playlistName, albumName, searchName);
                    }
                }
            }
        }

        return RespEntity.apply(CommonRespInfo.SUCCESS, songInfo);
    }

    /**
     * 📊 获取单曲红心数量与评论总数 (沉浸模式轻量统计)
     */
    @RequestMapping(value = "/song/stats", method = {RequestMethod.GET})
    public RespEntity<Map<String, Object>> getSongStats(@RequestParam Long id) {
        Map<String, Object> stats = new HashMap<>();
        stats.put("songId", id);
        Long redCount = null;
        Long commentCount = null;

        if (id != null && id > 0) {
            // 1. 获取红心数
            try {
                String redJson = neteaseAPIService.getSongRedCount(id);
                if (redJson != null) {
                    com.alibaba.fastjson.JSONObject obj = com.alibaba.fastjson.JSON.parseObject(redJson);
                    if (obj.getIntValue("code") == 200 && obj.getJSONObject("data") != null) {
                        redCount = obj.getJSONObject("data").getLong("count");
                    }
                }
            } catch (Exception e) {
                log.debug("获取歌曲红心数异常: id={}, msg={}", id, e.getMessage());
            }

            // 2. 获取评论总数 (传 limit=1 获取 total 即可)
            try {
                String commentJson = neteaseAPIService.getSongComments(id, 0, 1);
                if (commentJson != null) {
                    com.alibaba.fastjson.JSONObject obj = com.alibaba.fastjson.JSON.parseObject(commentJson);
                    if (obj.containsKey("total")) {
                        commentCount = obj.getLong("total");
                    } else if (obj.getIntValue("code") == 200 && obj.containsKey("total")) {
                        commentCount = obj.getLong("total");
                    }
                }
            } catch (Exception e) {
                log.debug("获取歌曲评论数异常: id={}, msg={}", id, e.getMessage());
            }
        }

        stats.put("redCount", redCount);
        stats.put("commentCount", commentCount);
        return RespEntity.apply(CommonRespInfo.SUCCESS, stats);
    }

    /**
     * 💬 获取歌曲评论列表与热评详情 (沉浸模式点击评论查看)
     */
    @RequestMapping(value = "/song/comments", method = {RequestMethod.GET})
    public RespEntity<?> getSongComments(@RequestParam Long id,
                                         @RequestParam(defaultValue = "0") int offset,
                                         @RequestParam(defaultValue = "20") int limit) {
        if (id == null || id <= 0) {
            return RespEntity.apply(CommonRespInfo.NOT_LEGAL_PARAM.getCode(), "歌曲 ID 不合法", null);
        }
        try {
            String jsonResp = neteaseAPIService.getSongComments(id, offset, limit);
            if (jsonResp != null) {
                com.alibaba.fastjson.JSONObject obj = com.alibaba.fastjson.JSON.parseObject(jsonResp);
                if (obj.containsKey("total") || obj.getIntValue("code") == 200) {
                    return RespEntity.apply(CommonRespInfo.SUCCESS, obj);
                } else {
                    String msg = obj.getString("message") != null ? obj.getString("message") : obj.getString("msg");
                    return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), msg != null ? msg : "获取评论失败", obj);
                }
            }
            return RespEntity.apply(CommonRespInfo.SUCCESS, null);
        } catch (Exception e) {
            log.error("获取歌曲评论列表异常: id={}", id, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), e.getMessage(), null);
        }
    }


    /**
     * 🌐 在线音频 CORS 代理流接口（解决 Web Audio API 均衡器跨域静音，并支持 Range 分片拖拽与边播边存）
     */
    @RequestMapping(value = "/stream/online", method = {RequestMethod.GET, RequestMethod.HEAD, RequestMethod.OPTIONS})
    public void streamOnlineAudio(
            @RequestParam(required = false) String url,
            @RequestParam(required = false) Long id,
            @RequestParam(required = false) String playlistName,
            @RequestParam(required = false) String albumName,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String artist,
            @RequestParam(required = false, defaultValue = "false") boolean freeTrial,
            jakarta.servlet.http.HttpServletRequest request,
            jakarta.servlet.http.HttpServletResponse response) {

        // 统一 CORS 响应头 + OPTIONS 预检（DRY：复用 AudioStreamUtil）
        com.wyyyyydl.utils.AudioStreamUtil.applyCorsHeaders(response);
        if (com.wyyyyydl.utils.AudioStreamUtil.isPreflight(request)) {
            response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_OK);
            return;
        }

        if (org.apache.commons.lang3.StringUtils.isBlank(url) && id != null && id > 0) {
            try {
                SingleMusicAnalysisRespDTO analysis = analysisService.analyzeSingleSong(id, "lossless");
                if (analysis != null && analysis.getUrl() != null) {
                    url = analysis.getUrl();
                    if (analysis.getFreeTrial() != null) {
                        freeTrial = analysis.getFreeTrial();
                    }
                    if (org.apache.commons.lang3.StringUtils.isBlank(name)) name = analysis.getName();
                    if (org.apache.commons.lang3.StringUtils.isBlank(artist)) artist = analysis.getAr_name();
                    if (org.apache.commons.lang3.StringUtils.isBlank(albumName)) albumName = analysis.getAl_name();
                }
            } catch (Exception e) {
                log.warn("动态解析在线歌曲流地址异常: id={}", id, e);
            }
        }

        if (org.apache.commons.lang3.StringUtils.isBlank(url)) {
            response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        // 边播边存异步触发（非试听歌曲双重保险）
        if (!freeTrial && id != null && id > 0 && musicDownloadService != null) {
            musicDownloadService.asyncDownloadOnPlay(id, playlistName, albumName, name);
        }

        // 统一在线代理流（DRY：复用 AudioStreamUtil）
        com.wyyyyydl.utils.AudioStreamUtil.streamOnlineUrl(url, request, response);
    }

    /**
     * 📁 本地已下载音频播放/流传输接口（支持 /v3/stream 与 /v3/stream/local 双路由别名）
     */
    @RequestMapping(value = {"/stream", "/stream/local"}, method = {RequestMethod.GET})
    public void streamAudio(@RequestParam(required = false) Long id,
                            @RequestParam(required = false) Long historyId,
                            jakarta.servlet.http.HttpServletRequest request,
                            jakarta.servlet.http.HttpServletResponse response) {
        com.wyyyyydl.dao.DownloadHistoryDAO.DownloadHistoryItem localItem = null;
        if (historyId != null && historyId > 0) {
            localItem = downloadHistoryDAO.getRecordById(historyId);
        }
        if (localItem == null && id != null) {
            localItem = downloadHistoryDAO.findLocalFileBySongId(id);
        }
        if (localItem == null || !Boolean.TRUE.equals(localItem.getFileExists())) {
            response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        java.io.File file = new java.io.File(localItem.getFilePath());
        if (!file.exists()) {
            response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        // 统一本地文件流（DRY：复用 AudioStreamUtil，支持 Range/206 分片）
        com.wyyyyydl.utils.AudioStreamUtil.streamLocalFile(file, request, response);
    }
    
    @RequestMapping(value = "/my_playlists", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> getUserPlaylists(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return RespEntity.apply(CommonRespInfo.SUCCESS, analysisService.getUserPlaylists(limit, offset));
    }

    /**
     * 获取当前登录用户喜欢的全部红心歌曲 ID 列表 (本地数据库优先保障 + 线上双向同步)
     */
    @RequestMapping(value = "/like/list", method = {RequestMethod.GET})
    public RespEntity<?> getLikedSongIds() {
        Set<Long> mergedIds = new HashSet<>();
        try {
            // 1. 读取本地 SQLite 数据库中持久化的全部红心曲目
            Set<Long> localIds = downloadHistoryDAO.getLikedSongIds();
            if (localIds != null) {
                mergedIds.addAll(localIds);
            }
        } catch (Exception e) {
            log.warn("读取本地红心数据库失败: {}", e.getMessage());
        }

        try {
            // 2. 尝试从网易云线上静默同步
            String jsonResp = neteaseAPIService.getLikedSongIds(null);
            if (jsonResp != null) {
                com.alibaba.fastjson.JSONObject obj = com.alibaba.fastjson.JSON.parseObject(jsonResp);
                if (obj.getIntValue("code") == 200) {
                    com.alibaba.fastjson.JSONArray ids = obj.getJSONArray("ids");
                    if (ids != null && !ids.isEmpty()) {
                        List<Long> onlineList = new ArrayList<>();
                        for (int i = 0; i < ids.size(); i++) {
                            Long sid = ids.getLong(i);
                            if (sid != null && sid > 0) {
                                onlineList.add(sid);
                                mergedIds.add(sid);
                            }
                        }
                        // 异步/同步将线上红心保存进本地数据库，永不丢失
                        downloadHistoryDAO.syncLikedSongIds(onlineList);
                    }
                }
            }
        } catch (Exception e) {
            log.debug("静默拉取网易云线上红心失败 (使用本地数据库): {}", e.getMessage());
        }

        return RespEntity.apply(CommonRespInfo.SUCCESS, new ArrayList<>(mergedIds));
    }

    /**
     * 添加红心 / 取消红心单曲 (本地 SQLite 强持久化落库 + 网易云线上双向同步)
     */
    @RequestMapping(value = "/like", method = {RequestMethod.POST, RequestMethod.GET})
    public RespEntity<?> toggleLikeTrack(@RequestParam Long id,
                                         @RequestParam(defaultValue = "true") boolean like,
                                         @RequestParam(required = false) String name,
                                         @RequestParam(required = false) String artist) {
        if (id == null || id <= 0) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, "歌曲ID无效");
        }

        // 1. 本地数据库强持久化落库 (无论是否登录，100% 成功落库)
        if (like) {
            downloadHistoryDAO.addLikedSong(id, name, artist);
        } else {
            downloadHistoryDAO.removeLikedSong(id);
        }

        // 2. 尝试同步至网易云线上
        try {
            neteaseAPIService.likeTrack(id, like);
        } catch (Exception e) {
            log.debug("同步网易云线上红心失败(未登录或离线): id={}, like={}, err={}", id, like, e.getMessage());
        }

        return RespEntity.apply(CommonRespInfo.SUCCESS, "ok");
    }

    /**
     * 收藏 / 取消收藏歌单
     */
    @RequestMapping(value = "/playlist/subscribe", method = {RequestMethod.POST, RequestMethod.GET})
    public RespEntity<?> subscribePlaylist(@RequestParam Long id,
                                           @RequestParam(defaultValue = "true") boolean subscribe) {
        try {
            String jsonResp = neteaseAPIService.subscribePlaylist(id, subscribe);
            if (jsonResp != null) {
                com.alibaba.fastjson.JSONObject obj = com.alibaba.fastjson.JSON.parseObject(jsonResp);
                if (obj.getIntValue("code") == 200) {
                    return RespEntity.apply(CommonRespInfo.SUCCESS, obj);
                } else {
                    String msg = obj.getString("message") != null ? obj.getString("message") : obj.getString("msg");
                    return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), msg != null ? msg : "操作失败", obj);
                }
            }
            return RespEntity.apply(CommonRespInfo.SUCCESS, null);
        } catch (Exception e) {
            log.error("收藏/取消收藏歌单失败, id={}, subscribe={}", id, subscribe, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), e.getMessage(), null);
        }
    }

    /**
     * 添加歌曲到歌单 (具备智能去重过滤、容量上限 10000 首检测与友好提示)
     */
    @RequestMapping(value = "/playlist/tracks/add", method = {RequestMethod.POST, RequestMethod.GET})
    public RespEntity<?> addTracksToPlaylist(@RequestParam Long playlistId,
                                             @RequestParam String trackIds) {
        try {
            if (playlistId == null || playlistId <= 0) {
                return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "歌单 ID 不合法", null);
            }
            List<Long> idList = parseTrackIds(trackIds);
            if (idList.isEmpty()) {
                return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "待添加歌曲列表不能为空", null);
            }

            // 1. 查询目标歌单现存歌曲 ID 集合与总曲目数，用于容量检测与去重
            Set<Long> existingTrackIds = new HashSet<>();
            int currentTrackCount = 0;
            try {
                String detailJson = neteaseAPIService.getPlaylistDetail(playlistId);
                if (detailJson != null) {
                    com.alibaba.fastjson.JSONObject detailObj = com.alibaba.fastjson.JSON.parseObject(detailJson);
                    com.alibaba.fastjson.JSONObject pl = detailObj.getJSONObject("playlist");
                    if (pl != null) {
                        currentTrackCount = pl.getIntValue("trackCount");
                        com.alibaba.fastjson.JSONArray tids = pl.getJSONArray("trackIds");
                        if (tids != null) {
                            for (int i = 0; i < tids.size(); i++) {
                                com.alibaba.fastjson.JSONObject item = tids.getJSONObject(i);
                                if (item != null && item.getLong("id") != null) {
                                    existingTrackIds.add(item.getLong("id"));
                                }
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("获取歌单当前曲目列表失败，将跳过前置去重直接尝试添加, playlistId={}", playlistId, e);
            }

            // 2. 歌单容量上限检测（网易云官方单歌单上限为 10,000 首）
            int MAX_PLAYLIST_CAPACITY = 10000;
            if (currentTrackCount >= MAX_PLAYLIST_CAPACITY || existingTrackIds.size() >= MAX_PLAYLIST_CAPACITY) {
                return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(),
                        "歌单已达官方上限（最大 " + MAX_PLAYLIST_CAPACITY + " 首），无法继续添加", null);
            }

            // 3. 智能去重过滤：仅保留歌单中尚未存在的歌曲
            List<Long> needToAdd = new ArrayList<>();
            int duplicateCount = 0;
            for (Long tid : idList) {
                if (existingTrackIds.contains(tid)) {
                    duplicateCount++;
                } else if (!needToAdd.contains(tid)) {
                    needToAdd.add(tid);
                }
            }

            // 4.1 全量重复：所有待添加歌曲已存在
            if (needToAdd.isEmpty()) {
                com.alibaba.fastjson.JSONObject resData = new com.alibaba.fastjson.JSONObject();
                resData.put("addedCount", 0);
                resData.put("duplicateCount", duplicateCount);
                resData.put("totalCount", idList.size());
                resData.put("allExisted", true);
                return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(),
                        idList.size() == 1 ? "该歌曲已在歌单中，无需重复添加" : "所选歌曲已全部在歌单中，无需重复添加", resData);
            }

            // 4.2 检查加上新增后是否超出上限，如超出则做安全截断
            if (currentTrackCount + needToAdd.size() > MAX_PLAYLIST_CAPACITY) {
                int canAddCount = Math.max(0, MAX_PLAYLIST_CAPACITY - currentTrackCount);
                if (canAddCount <= 0) {
                    return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(),
                            "歌单已接近官方上限（最大 " + MAX_PLAYLIST_CAPACITY + " 首），无法容纳全部新增歌曲", null);
                }
                needToAdd = needToAdd.subList(0, canAddCount);
            }

            // 5. 分批提交给网易云 Linux API 添加曲目（单批上限 500 首，防止大批量溢出）
            int batchSize = 500;
            for (int i = 0; i < needToAdd.size(); i += batchSize) {
                List<Long> chunk = needToAdd.subList(i, Math.min(i + batchSize, needToAdd.size()));
                String jsonResp = neteaseAPIService.addTracksToPlaylist(playlistId, chunk);
                if (jsonResp != null) {
                    com.alibaba.fastjson.JSONObject obj = com.alibaba.fastjson.JSON.parseObject(jsonResp);
                    int code = obj.getIntValue("code");
                    if (code != 200) {
                        String msg = obj.getString("message") != null ? obj.getString("message") : obj.getString("msg");
                        if (msg == null || msg.isEmpty()) msg = "添加到歌单失败(code:" + code + ")";
                        return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), msg, obj);
                    }
                }
            }

            // 6. 返回成功结果与详细统计
            com.alibaba.fastjson.JSONObject resData = new com.alibaba.fastjson.JSONObject();
            resData.put("addedCount", needToAdd.size());
            resData.put("duplicateCount", duplicateCount);
            resData.put("totalCount", idList.size());
            String successMsg = duplicateCount > 0
                    ? "已成功添加 " + needToAdd.size() + " 首（已自动跳过 " + duplicateCount + " 首重复歌曲）"
                    : "已成功添加 " + needToAdd.size() + " 首歌曲到歌单";
            return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), successMsg, resData);

        } catch (Exception e) {
            log.error("添加歌曲到歌单失败, playlistId={}, trackIds={}", playlistId, trackIds, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), e.getMessage() != null ? e.getMessage() : "添加歌曲异常", null);
        }
    }

    /**
     * 从歌单删除歌曲
     */
    @RequestMapping(value = "/playlist/tracks/remove", method = {RequestMethod.POST, RequestMethod.GET, RequestMethod.DELETE})
    public RespEntity<?> removeTracksFromPlaylist(@RequestParam Long playlistId,
                                                 @RequestParam String trackIds) {
        try {
            List<Long> idList = parseTrackIds(trackIds);
            String jsonResp = neteaseAPIService.removeTracksFromPlaylist(playlistId, idList);
            if (jsonResp != null) {
                com.alibaba.fastjson.JSONObject obj = com.alibaba.fastjson.JSON.parseObject(jsonResp);
                if (obj.getIntValue("code") == 200) {
                    return RespEntity.apply(CommonRespInfo.SUCCESS, obj);
                } else {
                    String msg = obj.getString("message") != null ? obj.getString("message") : obj.getString("msg");
                    return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), msg != null ? msg : "删除失败", obj);
                }
            }
            return RespEntity.apply(CommonRespInfo.SUCCESS, null);
        } catch (Exception e) {
            log.error("从歌单删除歌曲失败, playlistId={}, trackIds={}", playlistId, trackIds, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), e.getMessage(), null);
        }
    }

    /**
     * 创建新歌单
     */
    @RequestMapping(value = "/playlist/create", method = {RequestMethod.POST, RequestMethod.GET})
    public RespEntity<?> createPlaylist(@RequestParam String name,
                                        @RequestParam(defaultValue = "false") boolean isPrivate) {
        try {
            String jsonResp = neteaseAPIService.createPlaylist(name, isPrivate);
            if (jsonResp != null) {
                com.alibaba.fastjson.JSONObject obj = com.alibaba.fastjson.JSON.parseObject(jsonResp);
                if (obj.getIntValue("code") == 200) {
                    return RespEntity.apply(CommonRespInfo.SUCCESS, obj);
                } else {
                    String msg = obj.getString("message") != null ? obj.getString("message") : obj.getString("msg");
                    return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, msg != null ? msg : "创建歌单失败");
                }
            }
            return RespEntity.apply(CommonRespInfo.SUCCESS, null);
        } catch (Exception e) {
            log.error("创建歌单失败, name={}, isPrivate={}", name, isPrivate, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, e.getMessage());
        }
    }

    /**
     * 转存 / 克隆歌单为我的自建歌单 (新建歌单并批量添加选中的曲目)
     */
    @RequestMapping(value = "/playlist/fork", method = {RequestMethod.POST, RequestMethod.GET})
    public RespEntity<?> forkPlaylist(@RequestParam String name,
                                      @RequestParam(defaultValue = "false") boolean isPrivate,
                                      @RequestParam String trackIds) {
        try {
            if (name == null || name.trim().isEmpty()) {
                return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, "歌单名称不能为空");
            }
            List<Long> idList = parseTrackIds(trackIds);
            if (idList.isEmpty()) {
                return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, "歌曲列表不能为空");
            }

            // 1. 创建新歌单
            String createResp = neteaseAPIService.createPlaylist(name.trim(), isPrivate);
            if (createResp == null) {
                return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, "创建歌单失败");
            }
            com.alibaba.fastjson.JSONObject createObj = com.alibaba.fastjson.JSON.parseObject(createResp);
            if (createObj.getIntValue("code") != 200) {
                String msg = createObj.getString("message") != null ? createObj.getString("message") : createObj.getString("msg");
                return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, msg != null ? msg : "创建歌单失败");
            }

            Long newPlaylistId = createObj.getLong("id");
            if (newPlaylistId == null && createObj.getJSONObject("playlist") != null) {
                newPlaylistId = createObj.getJSONObject("playlist").getLong("id");
            }
            if (newPlaylistId == null) {
                return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, "未获取到新建歌单 ID");
            }

            // 2. 分批将歌曲添加至新歌单 (每批 500 首)
            int batchSize = 500;
            for (int i = 0; i < idList.size(); i += batchSize) {
                List<Long> chunk = idList.subList(i, Math.min(i + batchSize, idList.size()));
                neteaseAPIService.addTracksToPlaylist(newPlaylistId, chunk);
            }

            com.alibaba.fastjson.JSONObject resData = new com.alibaba.fastjson.JSONObject();
            resData.put("id", newPlaylistId);
            resData.put("name", name.trim());
            resData.put("trackCount", idList.size());
            return RespEntity.apply(CommonRespInfo.SUCCESS, resData);
        } catch (Exception e) {
            log.error("转存歌单失败, name={}, trackIds={}", name, trackIds, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, e.getMessage());
        }
    }

    /**
     * 删除歌单
     */
    @RequestMapping(value = "/playlist/delete", method = {RequestMethod.POST, RequestMethod.GET, RequestMethod.DELETE})
    public RespEntity<?> deletePlaylist(@RequestParam Long id) {
        try {
            String jsonResp = neteaseAPIService.deletePlaylist(id);
            if (jsonResp != null) {
                com.alibaba.fastjson.JSONObject obj = com.alibaba.fastjson.JSON.parseObject(jsonResp);
                if (obj.getIntValue("code") == 200) {
                    return RespEntity.apply(CommonRespInfo.SUCCESS, obj);
                } else {
                    String msg = obj.getString("message") != null ? obj.getString("message") : obj.getString("msg");
                    return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, msg != null ? msg : "删除歌单失败");
                }
            }
            return RespEntity.apply(CommonRespInfo.SUCCESS, null);
        } catch (Exception e) {
            log.error("删除歌单失败, id={}", id, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, e.getMessage());
        }
    }

    private List<Long> parseTrackIds(String trackIds) {
        if (trackIds == null || trackIds.trim().isEmpty()) {
            return Collections.emptyList();
        }
        String clean = trackIds.trim().replaceAll("[\\[\\]\\s]", "");
        String[] parts = clean.split(",");
        List<Long> result = new java.util.ArrayList<>();
        for (String p : parts) {
            if (!p.isEmpty()) {
                result.add(Long.parseLong(p));
            }
        }
        return result;
    }
}
