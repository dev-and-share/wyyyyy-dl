package com.pewee.neteasemusic.controller;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.pewee.neteasemusic.enums.CommonRespInfo;
import com.pewee.neteasemusic.models.common.RespEntity;
import com.pewee.neteasemusic.models.dtos.AlbumAnalysisRespDTO;
import com.pewee.neteasemusic.models.dtos.ArtistAnalysisRespDTO;
import com.pewee.neteasemusic.models.dtos.PlaylistAnalysisRespDTO;
import com.pewee.neteasemusic.models.dtos.SingleMusicAnalysisRespDTO;
import com.pewee.neteasemusic.models.dtos.TrackDTO;
import com.pewee.neteasemusic.service.AnalysisService;
import com.pewee.neteasemusic.service.NeteaseAPIService;

import lombok.extern.slf4j.Slf4j;

/**
 * 整体api接口和https://github.com/Suxiaoqinx/Netease_url相同
 * @author pewee
 *
 */
@RestController
@Slf4j
public class AnalysisController {
	
	@Autowired
    private AnalysisService analysisService;

	@Autowired
    private NeteaseAPIService neteaseAPIService;
	
	@RequestMapping(value = "/setCookie", method = {RequestMethod.GET, RequestMethod.POST})
	public RespEntity<?> refreshCookie(@RequestParam(value = "cookie",required = true) String cookie) {
		analysisService.refreshCookie(cookie);
		return RespEntity.apply(CommonRespInfo.SUCCESS,"OK");
	}

	
	
	@RequestMapping(value = "/Album", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> album(@RequestParam(required = true) Long id) {
		AlbumAnalysisRespDTO result = analysisService.analyzeAlbum(id);
		if (result != null && result.getAlbum() != null && result.getAlbum().getSongs() != null) {
			downloadHistoryDAO.markLocalStatusBatch(result.getAlbum().getSongs());
		}
        return RespEntity.apply(CommonRespInfo.SUCCESS, result);
    }

    @RequestMapping(value = "/Playlist", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> playlist(@RequestParam(required = true) Long id) {
    	PlaylistAnalysisRespDTO result = analysisService.analyzePlaylist(id);
    	if (result != null && result.getPlaylist() != null && result.getPlaylist().getTracks() != null) {
			downloadHistoryDAO.markLocalStatusBatch(result.getPlaylist().getTracks());
		}
        return RespEntity.apply(CommonRespInfo.SUCCESS, result);
    }

    @RequestMapping(value = "/Artist", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> artist(@RequestParam(required = true) Long id) {
        ArtistAnalysisRespDTO result = analysisService.analyzeArtist(id);
        if (result != null && result.getArtist() != null && result.getArtist().getSongs() != null) {
            downloadHistoryDAO.markLocalStatusBatch(result.getArtist().getSongs());
        }
        return RespEntity.apply(CommonRespInfo.SUCCESS, result);
    }
    
    
    /**
     * 搜索 
     * @param keyword 关键词
     * @param limit 每页条数
     * @param offset 偏移量
     * @param type  搜索类型
     * 	单曲	1
		歌手	100
		专辑	10
		歌单	1000
		用户	1002
		MV	1004
		歌词	1006
     * @return
     * @throws Exception
     */
    @RequestMapping(value = "/Search", method = {RequestMethod.GET, RequestMethod.POST})
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

    @Autowired
    private com.pewee.neteasemusic.dao.DownloadHistoryDAO downloadHistoryDAO;

    @Autowired
    private com.pewee.neteasemusic.service.MusicDownloadService musicDownloadService;

    @RequestMapping(value = "/Song_V1", method = {RequestMethod.GET, RequestMethod.POST})
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
        com.pewee.neteasemusic.dao.DownloadHistoryDAO.DownloadHistoryItem localItem = downloadHistoryDAO.findLocalFileBySongOrName(id, searchName, searchArtist);
        if (localItem != null && Boolean.TRUE.equals(localItem.getFileExists())) {
            if (songInfo != null) {
                // 瞬间切为本地无损秒播流！
                songInfo.setUrl("/v2/stream?id=" + localItem.getSongId() + "&historyId=" + localItem.getId());
                songInfo.setFreeTrial(false);
                songInfo.setFreeTrialDuration(null);
                songInfo.setUnplayableReason(null);
                songInfo.setStatus(200);
                songInfo.setIsLocal(true);
            }
        } else {
            if (songInfo != null) {
                songInfo.setIsLocal(false);
                if (songInfo.getUrl() != null && !songInfo.getUrl().isEmpty()) {
                    String rawUrl = songInfo.getUrl();
                    boolean isTrial = Boolean.TRUE.equals(songInfo.getFreeTrial());

                    // 构造带 CORS 头与分片支持的在线代理播放地址
                    StringBuilder sb = new StringBuilder("/v2/online/stream?id=").append(id);
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
     * 🌐 在线音频 CORS 代理流接口（解决 Web Audio API 均衡器跨域静音，并支持 Range 分片拖拽与边播边存）
     */
    @RequestMapping(value = "/v2/online/stream", method = {RequestMethod.GET, RequestMethod.HEAD, RequestMethod.OPTIONS})
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

        // 注入标准 CORS 响应头，确保 Web Audio 均衡器不受沙箱静音拦截
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Range, Accept, Origin, Content-Type");
        response.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
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

        org.apache.http.client.methods.HttpGet httpGet = new org.apache.http.client.methods.HttpGet(url);
        String rangeHeader = request.getHeader("Range");
        if (org.apache.commons.lang3.StringUtils.isNotBlank(rangeHeader)) {
            httpGet.setHeader("Range", rangeHeader);
        }
        httpGet.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36");
        httpGet.setHeader("Referer", "https://music.163.com/");

        org.apache.http.client.config.RequestConfig requestConfig = org.apache.http.client.config.RequestConfig.custom()
                .setConnectTimeout(15000)
                .setSocketTimeout(30000)
                .build();
        httpGet.setConfig(requestConfig);

        try (org.apache.http.client.methods.CloseableHttpResponse clientResp = com.pewee.neteasemusic.utils.HttpClientUtil.getInstance().execute(httpGet)) {
            int statusCode = clientResp.getStatusLine().getStatusCode();
            response.setStatus(statusCode);

            org.apache.http.HttpEntity entity = clientResp.getEntity();
            if (entity != null) {
                if (entity.getContentType() != null) {
                    response.setContentType(entity.getContentType().getValue());
                } else {
                    response.setContentType("audio/mpeg");
                }
                if (entity.getContentLength() >= 0) {
                    response.setContentLengthLong(entity.getContentLength());
                }
                org.apache.http.Header contentRange = clientResp.getFirstHeader("Content-Range");
                if (contentRange != null) {
                    response.setHeader("Content-Range", contentRange.getValue());
                }
                response.setHeader("Accept-Ranges", "bytes");

                if (!"HEAD".equalsIgnoreCase(request.getMethod())) {
                    try (java.io.InputStream in = entity.getContent();
                         java.io.OutputStream out = response.getOutputStream()) {
                        byte[] buffer = new byte[16384];
                        int bytesRead;
                        while ((bytesRead = in.read(buffer)) != -1) {
                            out.write(buffer, 0, bytesRead);
                        }
                        out.flush();
                    }
                }
            }
        } catch (Exception e) {
            log.warn("透传在线音频流异常: url={}, id={}, error={}", url, id, e.getMessage());
        }
    }

    @RequestMapping(value = "/v2/stream", method = {RequestMethod.GET})
    public void streamAudio(@RequestParam(required = false) Long id,
                            @RequestParam(required = false) Long historyId,
                            jakarta.servlet.http.HttpServletRequest request,
                            jakarta.servlet.http.HttpServletResponse response) {
        com.pewee.neteasemusic.dao.DownloadHistoryDAO.DownloadHistoryItem localItem = null;
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

        try {
            response.setHeader("Access-Control-Allow-Origin", "*");
            response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
            response.setHeader("Access-Control-Allow-Headers", "Range, Accept, Origin, Content-Type");
            response.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
            response.setHeader("Accept-Ranges", "bytes");

            String fileName = file.getName().toLowerCase();
            String contentType = "audio/mpeg";
            if (fileName.endsWith(".flac")) contentType = "audio/flac";
            else if (fileName.endsWith(".wav")) contentType = "audio/wav";
            else if (fileName.endsWith(".m4a") || fileName.endsWith(".aac")) contentType = "audio/mp4";
            else if (fileName.endsWith(".ogg")) contentType = "audio/ogg";

            response.setContentType(contentType);

            long fileLength = file.length();
            String rangeHeader = request.getHeader("Range");

            long start = 0;
            long end = fileLength - 1;

            if (org.apache.commons.lang3.StringUtils.isNotBlank(rangeHeader) && rangeHeader.startsWith("bytes=")) {
                String rangeValue = rangeHeader.substring(6).trim();
                String[] parts = rangeValue.split("-");
                try {
                    if (parts.length > 0 && !parts[0].isEmpty()) {
                        start = Long.parseLong(parts[0]);
                    }
                    if (parts.length > 1 && !parts[1].isEmpty()) {
                        end = Long.parseLong(parts[1]);
                    }
                } catch (NumberFormatException ignored) {}

                if (start > end || start >= fileLength) {
                    response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_REQUESTED_RANGE_NOT_SATISFIABLE);
                    response.setHeader("Content-Range", "bytes */" + fileLength);
                    return;
                }
                if (end >= fileLength) {
                    end = fileLength - 1;
                }

                long contentLength = end - start + 1;
                response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_PARTIAL_CONTENT);
                response.setHeader("Content-Range", "bytes " + start + "-" + end + "/" + fileLength);
                response.setContentLengthLong(contentLength);
            } else {
                response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_OK);
                response.setContentLengthLong(fileLength);
            }

            if ("HEAD".equalsIgnoreCase(request.getMethod())) {
                return;
            }

            try (java.io.RandomAccessFile raf = new java.io.RandomAccessFile(file, "r");
                 java.io.OutputStream out = response.getOutputStream()) {
                raf.seek(start);
                byte[] buffer = new byte[16384];
                long bytesToRead = end - start + 1;
                while (bytesToRead > 0) {
                    int len = (int) Math.min(buffer.length, bytesToRead);
                    int read = raf.read(buffer, 0, len);
                    if (read == -1) break;
                    out.write(buffer, 0, read);
                    bytesToRead -= read;
                }
                out.flush();
            }
        } catch (Exception e) {
            log.warn("播放本地音频流异常或客户端中断: songId={}, historyId={}, msg={}", id, historyId, e.getMessage());
        }
    }
    
    
    @RequestMapping(value = "/MyPlaylist", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> getUserPlaylists(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return RespEntity.apply(CommonRespInfo.SUCCESS,analysisService.getUserPlaylists(limit, offset));
    }

    /**
     * 获取当前登录用户喜欢的全部红心歌曲 ID 列表
     */
    /**
     * 获取当前登录用户喜欢的全部红心歌曲 ID 列表 (本地数据库优先保障 + 线上双向同步)
     */
    @RequestMapping(value = "/v2/like/list", method = {RequestMethod.GET})
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
    @RequestMapping(value = "/v2/like", method = {RequestMethod.POST, RequestMethod.GET})
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
    @RequestMapping(value = "/v2/playlist/subscribe", method = {RequestMethod.POST, RequestMethod.GET})
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
                    return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, msg != null ? msg : "操作失败");
                }
            }
            return RespEntity.apply(CommonRespInfo.SUCCESS, null);
        } catch (Exception e) {
            log.error("收藏/取消收藏歌单失败, id={}, subscribe={}", id, subscribe, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, e.getMessage());
        }
    }

    /**
     * 添加歌曲到歌单
     */
    @RequestMapping(value = "/v2/playlist/tracks/add", method = {RequestMethod.POST, RequestMethod.GET})
    public RespEntity<?> addTracksToPlaylist(@RequestParam Long playlistId,
                                             @RequestParam String trackIds) {
        try {
            List<Long> idList = parseTrackIds(trackIds);
            String jsonResp = neteaseAPIService.addTracksToPlaylist(playlistId, idList);
            if (jsonResp != null) {
                com.alibaba.fastjson.JSONObject obj = com.alibaba.fastjson.JSON.parseObject(jsonResp);
                if (obj.getIntValue("code") == 200 || obj.getIntValue("code") == 502) {
                    // code 502 在部分网易云返回中可能表示包含重复歌曲但其余已添加，返回给前端处理
                    if (obj.getIntValue("code") == 200) {
                        return RespEntity.apply(CommonRespInfo.SUCCESS, obj);
                    }
                    String msg = obj.getString("message") != null ? obj.getString("message") : obj.getString("msg");
                    return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, msg != null ? msg : "添加异常或歌曲已存在");
                } else {
                    String msg = obj.getString("message") != null ? obj.getString("message") : obj.getString("msg");
                    return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, msg != null ? msg : "添加失败");
                }
            }
            return RespEntity.apply(CommonRespInfo.SUCCESS, null);
        } catch (Exception e) {
            log.error("添加歌曲到歌单失败, playlistId={}, trackIds={}", playlistId, trackIds, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, e.getMessage());
        }
    }

    /**
     * 从歌单删除歌曲
     */
    @RequestMapping(value = "/v2/playlist/tracks/remove", method = {RequestMethod.POST, RequestMethod.GET, RequestMethod.DELETE})
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
                    return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, msg != null ? msg : "删除失败");
                }
            }
            return RespEntity.apply(CommonRespInfo.SUCCESS, null);
        } catch (Exception e) {
            log.error("从歌单删除歌曲失败, playlistId={}, trackIds={}", playlistId, trackIds, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, e.getMessage());
        }
    }

    /**
     * 创建新歌单
     */
    @RequestMapping(value = "/v2/playlist/create", method = {RequestMethod.POST, RequestMethod.GET})
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
    @RequestMapping(value = "/v2/playlist/fork", method = {RequestMethod.POST, RequestMethod.GET})
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
    @RequestMapping(value = "/v2/playlist/delete", method = {RequestMethod.POST, RequestMethod.GET, RequestMethod.DELETE})
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
