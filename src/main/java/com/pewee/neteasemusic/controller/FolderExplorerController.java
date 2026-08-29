package com.pewee.neteasemusic.controller;

import java.util.List;
import java.util.Map;
import jakarta.annotation.Resource;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.pewee.neteasemusic.dao.DownloadHistoryDAO;
import com.pewee.neteasemusic.enums.CommonRespInfo;
import com.pewee.neteasemusic.models.common.RespEntity;

import lombok.extern.slf4j.Slf4j;

/**
 * 📁 本地曲库与文件夹浏览控制器 (Folder Explorer Controller)
 */
@RestController
@Slf4j
@RequestMapping("/v2/folder")
public class FolderExplorerController {

    @Resource
    private DownloadHistoryDAO downloadHistoryDAO;

    /**
     * 获取所有可浏览的本地根目录（下载主目录、外部曲库目录等）
     */
    @GetMapping("/roots")
    public RespEntity<List<Map<String, String>>> getFolderRoots() {
        return RespEntity.apply(CommonRespInfo.SUCCESS, downloadHistoryDAO.getFolderRoots());
    }

    /**
     * 浏览指定文件夹内容（返回子目录与 MP3 文件）
     */
    @GetMapping("/browse")
    public RespEntity<List<DownloadHistoryDAO.FolderItemDTO>> listFolderContents(
            @RequestParam(value = "path", required = false) String path) {
        List<DownloadHistoryDAO.FolderItemDTO> contents = downloadHistoryDAO.listFolderContents(path);
        return RespEntity.apply(CommonRespInfo.SUCCESS, contents);
    }

    /**
     * 一键抓取指定文件夹（或含子目录）的全部 MP3 音轨元数据，供前端构建本地临时歌单连播
     */
    @GetMapping("/tracks")
    public RespEntity<List<DownloadHistoryDAO.DownloadHistoryItem>> getFolderTracks(
            @RequestParam(value = "path") String path,
            @RequestParam(value = "recursive", defaultValue = "true") boolean recursive) {
        List<DownloadHistoryDAO.DownloadHistoryItem> tracks = downloadHistoryDAO.getFolderTracks(path, recursive);
        return RespEntity.apply(CommonRespInfo.SUCCESS, tracks);
    }

    /**
     * 在指定目录下创建 .musicignore 标记，忽略该目录及其子目录
     */
    @PostMapping("/ignore")
    public RespEntity<Boolean> ignoreFolder(@RequestParam("path") String path) {
        boolean ok = downloadHistoryDAO.ignoreFolder(path);
        if (ok) {
            return RespEntity.apply(CommonRespInfo.SUCCESS, true);
        } else {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, false);
        }
    }

    /**
     * 删除前预检：获取文件夹下的实际物理文件总数、子目录数、最多5个文件列表及宿主机路径
     */
    @GetMapping("/check")
    public RespEntity<DownloadHistoryDAO.FolderCheckDTO> checkFolder(@RequestParam("path") String path) {
        DownloadHistoryDAO.FolderCheckDTO check = downloadHistoryDAO.checkFolder(path);
        if (check != null) {
            return RespEntity.apply(CommonRespInfo.SUCCESS, check);
        } else {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, null);
        }
    }

    /**
     * 物理删除指定文件夹及其全部子内容，并同步清理数据库下载记录
     */
    @PostMapping("/delete")
    public RespEntity<Boolean> deleteFolder(@RequestParam("path") String path) {
        boolean ok = downloadHistoryDAO.deleteFolder(path);
        if (ok) {
            return RespEntity.apply(CommonRespInfo.SUCCESS, true);
        } else {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR, false);
        }
    }
}
