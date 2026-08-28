package com.pewee.neteasemusic.controller;

import java.util.Collections;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.pewee.neteasemusic.enums.CommonRespInfo;
import com.pewee.neteasemusic.models.common.RespEntity;
import com.pewee.neteasemusic.models.dtos.AlbumAnalysisRespDTO;
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
        return RespEntity.apply(CommonRespInfo.SUCCESS, result);
    }

    @Autowired
    private com.pewee.neteasemusic.dao.DownloadHistoryDAO downloadHistoryDAO;

    @RequestMapping(value = "/Song_V1", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> songV1(@RequestParam(required = true) Long id,
                                @RequestParam(required = true) String level,
                                @RequestParam(required = false) String name,
                                @RequestParam(required = false) String artist,
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
            }
        }

        return RespEntity.apply(CommonRespInfo.SUCCESS, songInfo);
    }

    @RequestMapping(value = "/v2/stream", method = {RequestMethod.GET})
    public void streamAudio(@RequestParam(required = false) Long id,
                            @RequestParam(required = false) Long historyId,
                            javax.servlet.http.HttpServletRequest request,
                            javax.servlet.http.HttpServletResponse response) {
        com.pewee.neteasemusic.dao.DownloadHistoryDAO.DownloadHistoryItem localItem = null;
        if (historyId != null && historyId > 0) {
            localItem = downloadHistoryDAO.getRecordById(historyId);
        }
        if (localItem == null && id != null) {
            localItem = downloadHistoryDAO.findLocalFileBySongId(id);
        }
        if (localItem == null || !Boolean.TRUE.equals(localItem.getFileExists())) {
            response.setStatus(javax.servlet.http.HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        java.io.File file = new java.io.File(localItem.getFilePath());
        if (!file.exists()) {
            response.setStatus(javax.servlet.http.HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        try {
            String fileName = file.getName().toLowerCase();
            String contentType = "audio/mpeg";
            if (fileName.endsWith(".flac")) contentType = "audio/flac";
            else if (fileName.endsWith(".wav")) contentType = "audio/wav";
            else if (fileName.endsWith(".m4a") || fileName.endsWith(".aac")) contentType = "audio/mp4";

            response.setContentType(contentType);
            response.setHeader("Accept-Ranges", "bytes");
            response.setContentLengthLong(file.length());

            try (java.io.InputStream in = new java.io.FileInputStream(file);
                 java.io.OutputStream out = response.getOutputStream()) {
                byte[] buffer = new byte[16384];
                int bytesRead;
                while ((bytesRead = in.read(buffer)) != -1) {
                    out.write(buffer, 0, bytesRead);
                }
                out.flush();
            }
        } catch (Exception e) {
            log.error("播放本地音频流异常, songId={}, historyId={}", id, historyId, e);
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
    @RequestMapping(value = "/v2/like/list", method = {RequestMethod.GET})
    public RespEntity<?> getLikedSongIds() {
        try {
            String jsonResp = neteaseAPIService.getLikedSongIds(null);
            if (jsonResp != null) {
                com.alibaba.fastjson.JSONObject obj = com.alibaba.fastjson.JSON.parseObject(jsonResp);
                if (obj.getIntValue("code") == 200) {
                    com.alibaba.fastjson.JSONArray ids = obj.getJSONArray("ids");
                    return RespEntity.apply(CommonRespInfo.SUCCESS, ids != null ? ids : Collections.emptyList());
                } else {
                    return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, obj.getString("message"));
                }
            }
            return RespEntity.apply(CommonRespInfo.SUCCESS, Collections.emptyList());
        } catch (Exception e) {
            log.error("获取红心歌曲列表失败", e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, e.getMessage());
        }
    }

    /**
     * 添加红心 / 取消红心单曲
     */
    @RequestMapping(value = "/v2/like", method = {RequestMethod.POST, RequestMethod.GET})
    public RespEntity<?> toggleLikeTrack(@RequestParam Long id,
                                         @RequestParam(defaultValue = "true") boolean like) {
        try {
            String jsonResp = neteaseAPIService.likeTrack(id, like);
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
            log.error("切换红心状态失败, id={}, like={}", id, like, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, e.getMessage());
        }
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
