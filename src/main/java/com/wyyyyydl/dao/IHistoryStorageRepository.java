package com.wyyyyydl.dao;

import com.wyyyyydl.models.dtos.DownloadHistoryItem;
import com.wyyyyydl.models.dtos.FolderCheckDTO;
import com.wyyyyydl.models.dtos.FolderItemDTO;
import com.wyyyyydl.models.dtos.TrackDTO;

import java.io.File;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 核心曲库持久化与历史数据仓储接口 (Repository Contract)
 * 面向接口编程：强制所有存储后端 (SQLite / PostgreSQL / AWS DynamoDB)
 * 必须完整实现以下所有契约方法，由 Java 编译器严格保障无一遗漏。
 */
public interface IHistoryStorageRepository {

    // ==========================================
    // 1. 系统配置存储 (Cookie 持久化等)
    // ==========================================
    void saveConfig(String key, String value);
    String getConfig(String key);

    // ==========================================
    // 2. 红心单曲 (Likes) 全生命周期
    // ==========================================
    boolean addLikedSong(Long songId, String songName, String artist);
    boolean removeLikedSong(Long songId);
    boolean isLiked(Long songId);
    Set<Long> getLikedSongIds();
    void syncLikedSongIds(List<Long> onlineIds);

    // ==========================================
    // 3. 下载历史记录 CRUD
    // ==========================================
    long addRecord(Long songId, String songName, String artist, String album,
                   String filePath, Long fileSize, String quality, String status);
    DownloadHistoryItem getRecordById(Long historyId);
    List<DownloadHistoryItem> getRecordsByIds(List<Long> ids);
    List<DownloadHistoryItem> getRecords(String keyword, int page, int pageSize);
    int countRecords(String keyword);
    boolean deleteRecord(Long id);
    boolean deleteSongFileAndRecord(Long songId, String name, String artist);

    void saveRawJson(Long historyId, String rawJson);
    String getRawJson(Long historyId);

    // ==========================================
    // 4. 音轨匹配、查重与定位
    // ==========================================
    DownloadHistoryItem findLocalFileBySongOrName(Long songId, String name, String artist);
    DownloadHistoryItem findLocalFileBySongId(Long songId);
    List<DownloadHistoryItem> getRecordsBySongIds(List<Long> songIds);
    Set<Long> getAllDownloadedSongIds();
    boolean isSongDownloaded(Long songId);
    void migrateLegacyIdsFileIfPresent(String basePath);
    void markLocalStatusBatch(List<TrackDTO> tracks);

    // ==========================================
    // 5. 统计与巡检维护
    // ==========================================
    Map<String, Object> getStats();
    List<DownloadHistoryItem> getMissingRecords();
    int cleanMissingRecords();
    List<DownloadHistoryItem> getNonMp3Records();
    int cleanNonMp3Records();

    // ==========================================
    // 6. 文件系统与目录树兼容抽象
    // ==========================================
    List<Map<String, String>> getFolderRoots();
    List<FolderItemDTO> listFolderContents(String relativePath);
    List<DownloadHistoryItem> getFolderTracks(String folderPath, boolean recursive);
    FolderCheckDTO checkFolder(String path);
    boolean ignoreFolder(String folderPath);
    boolean deleteFolder(String folderPath);
    Map<String, Object> scanFiles();
    Map<String, Object> scanExternalLibraries();
    int importUntrackedFiles();

    File resolveFile(String filePath);
    String toHostPath(File file);
    String toRelativePath(String fullPath);
}
