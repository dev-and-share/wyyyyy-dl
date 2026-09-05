package com.pewee.neteasemusic.controller;

import java.io.File;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import jakarta.annotation.Resource;

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

    @org.springframework.beans.factory.annotation.Value("${reveal.auto-open.enabled:true}")
    private boolean autoOpenEnabled = true;

    /**
     * 定位/在 Finder/Explorer 中打开文件
     */
    @GetMapping("/reveal")
    public RespEntity<String> revealFile(
            @RequestParam(value = "path", required = false) String path,
            @RequestParam(value = "taskId", required = false) Long taskId,
            @RequestParam(value = "id", required = false) Long songId,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "artist", required = false) String artist) {
        
        String targetPath = path;
        if (StringUtils.isBlank(targetPath) && taskId != null) {
            DownloadTaskStatus status = MusicDownloadService.downloadTasks.get(taskId);
            if (status != null && StringUtils.isNotBlank(status.getFilePath())) {
                targetPath = status.getFilePath();
            }
        }

        File file = null;
        if (StringUtils.isNotBlank(targetPath)) {
            file = downloadHistoryDAO.resolveFile(targetPath);
        } else if ((songId != null && songId > 0) || StringUtils.isNotBlank(name)) {
            DownloadHistoryDAO.DownloadHistoryItem found = downloadHistoryDAO.findLocalFileBySongOrName(songId, name, artist);
            if (found != null && StringUtils.isNotBlank(found.getFilePath())) {
                file = downloadHistoryDAO.resolveFile(found.getFilePath());
            }
        }

        if (file == null || !file.exists()) {
            return RespEntity.apply(CommonRespInfo.NOT_LEGAL_PARAM.getCode(), "物理文件不存在: " + (targetPath != null ? targetPath : (name != null ? name : "id=" + songId)), null);
        }

        String hostAbsPath = downloadHistoryDAO.toHostPath(file);
        openInSystemFileManager(file);
        return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "定位文件成功: " + hostAbsPath, hostAbsPath);
    }

    private void openInSystemFileManager(File file) {
        if (!autoOpenEnabled || file == null || !file.exists()) {
            return;
        }
        try {
            String containerAbsPath = file.getAbsolutePath();
            String osName = System.getProperty("os.name").toLowerCase();
            if (osName.contains("mac")) {
                Runtime.getRuntime().exec(new String[]{"open", "-R", containerAbsPath});
            } else if (osName.contains("win")) {
                Runtime.getRuntime().exec(new String[]{"explorer", "/select,", containerAbsPath});
            } else {
                try {
                    Runtime.getRuntime().exec(new String[]{"xdg-open", file.getParent()});
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            log.warn("调用系统文件管理器打开文件失败: {}", file.getAbsolutePath(), e);
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
     * 获取当前所有已下载并存在的歌曲 ID 集合
     */
    @GetMapping("/history/ids")
    public RespEntity<java.util.Set<Long>> getAllDownloadedSongIds() {
        return RespEntity.apply(CommonRespInfo.SUCCESS, downloadHistoryDAO.getAllDownloadedSongIds());
    }

    /**
     * 根据 historyId 或 songId 获取单条历史记录详情 (用于匹配离线缓存元数据)
     */
    @GetMapping("/history/detail")
    public RespEntity<DownloadHistoryDAO.DownloadHistoryItem> getHistoryDetail(
            @RequestParam(value = "historyId", required = false) Long historyId,
            @RequestParam(value = "songId", required = false) Long songId) {
        DownloadHistoryDAO.DownloadHistoryItem item = null;
        if (historyId != null && historyId > 0) {
            item = downloadHistoryDAO.getRecordById(historyId);
        }
        if (item == null && songId != null && songId > 0) {
            item = downloadHistoryDAO.findLocalFileBySongId(songId);
        }
        return RespEntity.apply(CommonRespInfo.SUCCESS, item);
    }

    /**
     * 批量获取历史记录详情 (用于前端批量匹配浏览器离线缓存歌曲信息)
     */
    @PostMapping("/history/batch_detail")
    public RespEntity<Map<String, Object>> getBatchHistoryDetail(@RequestBody Map<String, List<Long>> requestBody) {
        List<Long> historyIds = requestBody != null ? requestBody.get("historyIds") : null;
        List<Long> songIds = requestBody != null ? requestBody.get("songIds") : null;

        Map<String, Object> result = new HashMap<>();
        if (historyIds != null && !historyIds.isEmpty()) {
            result.put("byHistoryId", downloadHistoryDAO.getRecordsByIds(historyIds));
        }
        if (songIds != null && !songIds.isEmpty()) {
            result.put("bySongId", downloadHistoryDAO.getRecordsBySongIds(songIds));
        }
        return RespEntity.apply(CommonRespInfo.SUCCESS, result);
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
     * 查询所有物理文件已缺失的历史记录清单
     */
    @GetMapping("/history/missing")
    public RespEntity<List<DownloadHistoryDAO.DownloadHistoryItem>> getMissingRecords() {
        List<DownloadHistoryDAO.DownloadHistoryItem> missing = downloadHistoryDAO.getMissingRecords();
        return RespEntity.apply(CommonRespInfo.SUCCESS, missing);
    }

    /**
     * 查询所有非 .mp3 格式的历史记录清单
     */
    @GetMapping("/history/non_mp3")
    public RespEntity<List<DownloadHistoryDAO.DownloadHistoryItem>> getNonMp3Records() {
        List<DownloadHistoryDAO.DownloadHistoryItem> nonMp3 = downloadHistoryDAO.getNonMp3Records();
        return RespEntity.apply(CommonRespInfo.SUCCESS, nonMp3);
    }

    /**
     * 批量清理所有非 .mp3 格式的历史记录
     */
    @PostMapping("/history/cleanNonMp3")
    public RespEntity<Integer> cleanNonMp3Records() {
        int count = downloadHistoryDAO.cleanNonMp3Records();
        return RespEntity.apply(CommonRespInfo.SUCCESS, count);
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
     * 触发多目录外部曲库一键扫描与索引导入 (.env EXTERNAL_LIBRARY_PATHS)
     */
    @PostMapping("/history/scan_external")
    public RespEntity<Map<String, Object>> scanExternalLibraries() {
        Map<String, Object> result = downloadHistoryDAO.scanExternalLibraries();
        return RespEntity.apply(CommonRespInfo.SUCCESS, result);
    }

    /**
     * 本地已下载音频播放/流传输接口
     */
    @GetMapping("/history/stream")
    public void streamLocalAudio(
            @RequestParam(value = "path", required = false) String path,
            jakarta.servlet.http.HttpServletRequest request,
            jakarta.servlet.http.HttpServletResponse response) {
        if (StringUtils.isBlank(path)) {
            response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        File file = downloadHistoryDAO.resolveFile(path);
        if (!file.exists() || !file.isFile()) {
            response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        // 统一本地文件流（DRY：复用 AudioStreamUtil，支持 Range/206 分片）
        com.pewee.neteasemusic.utils.AudioStreamUtil.streamLocalFile(file, request, response);
    }

    /**
     * 读取指定历史记录关联的 Raw JSON 快照
     */
    @GetMapping("/history/raw")
    public RespEntity<String> getRawJson(@RequestParam("id") Long id) {
        String rawJson = downloadHistoryDAO.getRawJson(id);
        if (StringUtils.isBlank(rawJson)) {
            return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "暂无关联的 Raw JSON 离线快照", null);
        }
        return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "查询成功", rawJson);
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
