package com.pewee.neteasemusic.controller;

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
	
	@RequestMapping(value = "/setCookie", method = {RequestMethod.GET, RequestMethod.POST})
	public RespEntity<?> refreshCookie(@RequestParam(value = "cookie",required = true) String cookie) {
		analysisService.refreshCookie(cookie);
		return RespEntity.apply(CommonRespInfo.SUCCESS,"OK");
	}

	
	
	@RequestMapping(value = "/Album", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> album(@RequestParam(required = true) Long id) {
		AlbumAnalysisRespDTO  result = analysisService.analyzeAlbum(id);
        return RespEntity.apply(CommonRespInfo.SUCCESS,result);
    }

    @RequestMapping(value = "/Playlist", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> playlist(@RequestParam(required = true) Long id) {
    	PlaylistAnalysisRespDTO  result = analysisService.analyzePlaylist(id);
            return RespEntity.apply(CommonRespInfo.SUCCESS,result);
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
                                @RequestParam(required = false, defaultValue = "json") String type) {
        SingleMusicAnalysisRespDTO songInfo = analysisService.analyzeSingleSong(id, level);

        // 🚀 优先检查本地磁盘中是否存在该音频物理文件！
        com.pewee.neteasemusic.dao.DownloadHistoryDAO.DownloadHistoryItem localItem = downloadHistoryDAO.findLocalFileBySongId(id);
        if (localItem != null && Boolean.TRUE.equals(localItem.getFileExists())) {
            if (songInfo != null) {
                // 本地存在完整物理文件，优先返回本地秒开流链接！
                songInfo.setUrl("/v2/stream?id=" + id);
            }
        }

        return RespEntity.apply(CommonRespInfo.SUCCESS, songInfo);
    }

    @RequestMapping(value = "/v2/stream", method = {RequestMethod.GET})
    public void streamAudio(@RequestParam Long id, javax.servlet.http.HttpServletRequest request, javax.servlet.http.HttpServletResponse response) {
        com.pewee.neteasemusic.dao.DownloadHistoryDAO.DownloadHistoryItem localItem = downloadHistoryDAO.findLocalFileBySongId(id);
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
            String name = file.getName().toLowerCase();
            String contentType = "audio/mpeg";
            if (name.endsWith(".flac")) contentType = "audio/flac";
            else if (name.endsWith(".wav")) contentType = "audio/wav";
            else if (name.endsWith(".m4a") || name.endsWith(".aac")) contentType = "audio/mp4";

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
            log.error("播放本地音频流异常, songId={}", id, e);
        }
    }
    
    
    @RequestMapping(value = "/MyPlaylist", method = {RequestMethod.GET, RequestMethod.POST})
    public RespEntity<?> getUserPlaylists(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return RespEntity.apply(CommonRespInfo.SUCCESS,analysisService.getUserPlaylists(limit, offset));
    }
}
