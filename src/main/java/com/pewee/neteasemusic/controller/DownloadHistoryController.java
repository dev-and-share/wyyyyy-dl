package com.pewee.neteasemusic.controller;

import java.io.File;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.annotation.Resource;

import org.apache.commons.lang3.StringUtils;
import org.springframework.web.bind.annotation.*;

import com.pewee.neteasemusic.dao.DownloadHistoryDAO;
import com.pewee.neteasemusic.enums.CommonRespInfo;
import com.pewee.neteasemusic.models.common.DownloadTaskStatus;
import com.pewee.neteasemusic.models.common.RespEntity;
import com.pewee.neteasemusic.service.MusicDownloadService;

import lombok.extern.slf4j.Slf4j;

@RestController
@Slf4j
@RequestMapping("/v2")
public class DownloadHistoryController {

    @Resource
    private DownloadHistoryDAO downloadHistoryDAO;

    @Resource
    private MusicDownloadService musicDownloadService;

    /**
     * 定位/在 Finder/Explorer 中打开文件
     */
    @GetMapping("/reveal")
    public RespEntity<String> revealFile(
            @RequestParam(value = "path", required = false) String path,
            @RequestParam(value = "taskId", required = false) Long taskId) {
        
        String targetPath = path;
        if (StringUtils.isBlank(targetPath) && taskId != null) {
            DownloadTaskStatus status = MusicDownloadService.downloadTasks.get(taskId);
            if (status != null && StringUtils.isNotBlank(status.getFilePath())) {
                targetPath = status.getFilePath();
            }
        }

        if (StringUtils.isBlank(targetPath)) {
            return RespEntity.apply(CommonRespInfo.NOT_LEGAL_PARAM.getCode(), "未找到有效的指定文件路径", null);
        }

        File file = downloadHistoryDAO.resolveFile(targetPath);
        if (!file.exists()) {
            return RespEntity.apply(CommonRespInfo.NOT_LEGAL_PARAM.getCode(), "物理文件不存在: " + targetPath, null);
        }

        String containerAbsPath = file.getAbsolutePath();
        String hostAbsPath = downloadHistoryDAO.toHostPath(file);
        try {
            String osName = System.getProperty("os.name").toLowerCase();
            if (osName.contains("mac")) {
                Runtime.getRuntime().exec(new String[]{"open", "-R", containerAbsPath});
            } else if (osName.contains("win")) {
                Runtime.getRuntime().exec(new String[]{"explorer", "/select,", containerAbsPath});
            } else {
                // Linux / Docker 容器环境
                try {
                    Runtime.getRuntime().exec(new String[]{"xdg-open", file.getParent()});
                } catch (Exception e) {
                    log.warn("Docker / 无 GUI 环境，文件宿主机绝对路径为: {}", hostAbsPath);
                    return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "已找到对应文件路径", hostAbsPath);
                }
            }
            return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "定位文件成功: " + hostAbsPath, hostAbsPath);
        } catch (Exception e) {
            log.error("定位打开文件失败, path={}", hostAbsPath, e);
            return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "已找到对应文件路径: " + hostAbsPath, hostAbsPath);
        }
    }

    /**
     * 分页查询下载历史
     */
    @GetMapping("/history/list")
    public RespEntity<Map<String, Object>> getHistoryList(
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "pageSize", defaultValue = "15") int pageSize) {
        
        List<DownloadHistoryDAO.DownloadHistoryItem> list = downloadHistoryDAO.getRecords(keyword, page, pageSize);
        int total = downloadHistoryDAO.countRecords(keyword);
        
        Map<String, Object> data = new HashMap<>();
        data.put("list", list);
        data.put("total", total);
        data.put("page", page);
        data.put("pageSize", pageSize);
        
        return RespEntity.apply(CommonRespInfo.SUCCESS, data);
    }

    /**
     * 获取统计数据
     */
    @GetMapping("/history/stats")
    public RespEntity<Map<String, Object>> getHistoryStats() {
        return RespEntity.apply(CommonRespInfo.SUCCESS, downloadHistoryDAO.getStats());
    }

    /**
     * 扫描物理磁盘与数据库记录映射状态 (Scan)
     */
    @PostMapping("/history/scan")
    public RespEntity<Map<String, Object>> scanHistoryFiles() {
        return RespEntity.apply(CommonRespInfo.SUCCESS, downloadHistoryDAO.scanFiles());
    }

    /**
     * 批量清理物理文件已不存在的历史记录
     */
    @PostMapping("/history/cleanMissing")
    public RespEntity<Integer> cleanMissingRecords() {
        int count = downloadHistoryDAO.cleanMissingRecords();
        return RespEntity.apply(CommonRespInfo.SUCCESS, count);
    }

    /**
     * 一键同步/导入所有未录入的本地物理音频到数据库
     */
    @PostMapping("/history/importUntracked")
    public RespEntity<Integer> importUntrackedFiles() {
        int count = downloadHistoryDAO.importUntrackedFiles();
        return RespEntity.apply(CommonRespInfo.SUCCESS, count);
    }

    /**
     * 本地已下载音频播放/流传输接口
     */
    @GetMapping("/history/stream")
    public org.springframework.http.ResponseEntity<org.springframework.core.io.Resource> streamLocalAudio(
            @RequestParam(value = "path", required = false) String path) {
        if (StringUtils.isBlank(path)) {
            return org.springframework.http.ResponseEntity.notFound().build();
        }
        File file = downloadHistoryDAO.resolveFile(path);
        if (!file.exists() || !file.isFile()) {
            return org.springframework.http.ResponseEntity.notFound().build();
        }

        String mimeType = "audio/mpeg";
        String lowerName = file.getName().toLowerCase();
        if (lowerName.endsWith(".flac")) mimeType = "audio/flac";
        else if (lowerName.endsWith(".m4a")) mimeType = "audio/mp4";
        else if (lowerName.endsWith(".ogg")) mimeType = "audio/ogg";
        else if (lowerName.endsWith(".wav")) mimeType = "audio/wav";

        org.springframework.core.io.FileSystemResource resource = new org.springframework.core.io.FileSystemResource(file);
        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_TYPE, mimeType)
                .header(org.springframework.http.HttpHeaders.CONTENT_LENGTH, String.valueOf(file.length()))
                .body(resource);
    }

    /**
     * 删除单条历史记录
     */
    @DeleteMapping("/history/delete")
    public RespEntity<Boolean> deleteRecord(@RequestParam("id") Long id) {
        boolean ok = downloadHistoryDAO.deleteRecord(id);
        return RespEntity.apply(CommonRespInfo.SUCCESS, ok);
    }
}
