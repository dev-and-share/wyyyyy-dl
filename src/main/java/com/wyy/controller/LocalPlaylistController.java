package com.wyy.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.wyy.dao.DownloadHistoryDAO;
import com.wyy.enums.CommonRespInfo;
import com.wyy.models.common.RespEntity;
import com.wyy.models.dtos.DownloadHistoryItem;
import com.wyy.service.AuthContextService;

import jakarta.annotation.Resource;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

/**
 * 📁 本地专属自建歌单控制器 (Local Hybrid Playlists)
 *
 * 核心设计理念：
 * 1. 100% 存储于本地 SQLite，绝不调用云端 API，保证云端同步零污染
 * 2. 以物理落盘为准：仅管理已下载/已落盘的真实音频文件，播放时 0 延迟秒播，不依赖动态外网寻源
 * 3. 支持多租户轻量隔离：根据 Cloudflare 认证邮箱，实现访客自建本地歌单隔离管理
 */
@Slf4j
@RestController
@RequestMapping("/v3/local-playlist")
public class LocalPlaylistController {

    @Resource
    private DownloadHistoryDAO downloadHistoryDAO;

    @Resource
    private AuthContextService authContextService;

    @Data
    public static class CreatePlaylistReq {
        private String name;
        private String coverUrl;
    }

    @Data
    public static class AddTrackReq {
        private String playlistId;
        private Long historyId;
        private String name;
        private String artist;
        private String filePath;
        private String coverUrl;
    }

    @GetMapping("/list")
    public RespEntity<List<Map<String, Object>>> listPlaylists() {
        return RespEntity.apply(CommonRespInfo.SUCCESS,
                downloadHistoryDAO.listLocalPlaylists(
                        authContextService.getCurrentUserEmail(),
                        authContextService.isAdmin(),
                        authContextService.isAuthEnabled()
                ));
    }

    @PostMapping("/create")
    public RespEntity<Map<String, Object>> createPlaylist(@RequestBody CreatePlaylistReq req) {
        if (req == null || StringUtils.isBlank(req.getName())) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "歌单名称不能为空", null);
        }
        String id = "local_" + System.currentTimeMillis();
        boolean ok = downloadHistoryDAO.createLocalPlaylist(
                id,
                req.getName().trim(),
                req.getCoverUrl(),
                authContextService.getCurrentUserEmail()
        );
        if (!ok) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "创建本地歌单失败", null);
        }
        Map<String, Object> map = new HashMap<>();
        map.put("id", id);
        map.put("name", req.getName().trim());
        map.put("coverImgUrl", req.getCoverUrl());
        map.put("trackCount", 0);
        map.put("isLocal", true);
        map.put("subscribed", false);
        map.put("userEmail", authContextService.getCurrentUserEmail());
        return RespEntity.apply(CommonRespInfo.SUCCESS, map);
    }

    @PostMapping("/delete")
    public RespEntity<String> deletePlaylist(@RequestParam("id") String id) {
        if (StringUtils.isBlank(id)) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "歌单ID不能为空", null);
        }
        if ("local_favorites".equals(id) || id.startsWith("local_fav_")) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "系统内置专属歌单不支持删除", null);
        }
        boolean ok = downloadHistoryDAO.deleteLocalPlaylist(
                id,
                authContextService.getCurrentUserEmail(),
                authContextService.isAdmin(),
                authContextService.isAuthEnabled()
        );
        return ok ? RespEntity.apply(CommonRespInfo.SUCCESS, "删除成功")
                  : RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "删除失败或无权删除该歌单", null);
    }

    @PostMapping("/tracks/add")
    public RespEntity<String> addTrack(@RequestBody AddTrackReq req) {
        if (req == null || StringUtils.isBlank(req.getPlaylistId())) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "目标歌单ID不能为空", null);
        }
        if (StringUtils.isBlank(req.getName())) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "歌曲名称不能为空", null);
        }

        // 权限校验：访客仅能修改属于自己的歌单
        if (!downloadHistoryDAO.isPlaylistOwnerOrAdmin(
                req.getPlaylistId(),
                authContextService.getCurrentUserEmail(),
                authContextService.isAdmin(),
                authContextService.isAuthEnabled())) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "无权修改该歌单", null);
        }

        Long historyId = req.getHistoryId();
        String filePath = req.getFilePath();

        // 若前端未传入 historyId，尝试通过歌名与歌手在已落盘历史中反查
        if ((historyId == null || historyId <= 0) || StringUtils.isBlank(filePath)) {
            DownloadHistoryItem found = downloadHistoryDAO.findLocalFileBySongOrName(null, req.getName(), req.getArtist());
            if (found != null) {
                historyId = found.getId();
                filePath = found.getFilePath();
            }
        }

        boolean ok = downloadHistoryDAO.addTrackToLocalPlaylist(
                req.getPlaylistId(),
                historyId,
                req.getName(),
                req.getArtist(),
                filePath,
                req.getCoverUrl()
        );
        return ok ? RespEntity.apply(CommonRespInfo.SUCCESS, "已成功加入本地歌单")
                  : RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "添加失败", null);
    }

    @PostMapping("/tracks/remove")
    public RespEntity<String> removeTrack(@RequestParam("playlistId") String playlistId,
                                          @RequestParam(value = "trackId", required = false) String trackIdStr,
                                          @RequestParam(value = "songName", required = false) String songName,
                                          @RequestParam(value = "artist", required = false) String artist) {
        if (StringUtils.isBlank(playlistId)) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "歌单ID不能为空", null);
        }

        // 权限校验：访客仅能修改属于自己的歌单
        if (!downloadHistoryDAO.isPlaylistOwnerOrAdmin(
                playlistId,
                authContextService.getCurrentUserEmail(),
                authContextService.isAdmin(),
                authContextService.isAuthEnabled())) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "无权修改该歌单", null);
        }

        Long trackId = null;
        if (StringUtils.isNotBlank(trackIdStr)) {
            try {
                trackId = Long.parseLong(trackIdStr.trim());
            } catch (Exception ignored) {
            }
        }
        if (trackId == null && StringUtils.isBlank(songName)) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "需提供 trackId 或 songName", null);
        }
        boolean ok = downloadHistoryDAO.removeTrackFromLocalPlaylist(playlistId, trackId, songName, artist);
        return ok ? RespEntity.apply(CommonRespInfo.SUCCESS, "移除成功")
                  : RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "移除失败或未找到匹配曲目", null);
    }

    @GetMapping("/detail")
    public RespEntity<Map<String, Object>> getPlaylistDetail(@RequestParam("id") String id) {
        if (StringUtils.isBlank(id)) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "歌单ID不能为空", null);
        }
        List<Map<String, Object>> playlists = downloadHistoryDAO.listLocalPlaylists(
                authContextService.getCurrentUserEmail(),
                authContextService.isAdmin(),
                authContextService.isAuthEnabled()
        );
        Map<String, Object> current = null;
        for (Map<String, Object> pl : playlists) {
            if (id.equals(pl.get("id"))) {
                current = pl;
                break;
            }
        }
        if (current == null) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "歌单不存在", null);
        }

        List<Map<String, Object>> tracks = downloadHistoryDAO.getLocalPlaylistTracks(id);
        Map<String, Object> result = new HashMap<>(current);
        result.put("tracks", tracks);
        result.put("trackCount", tracks.size());
        return RespEntity.apply(CommonRespInfo.SUCCESS, result);
    }
}
