package com.pewee.neteasemusic.dao;

import java.io.File;
import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import javax.annotation.PostConstruct;

import com.google.common.collect.Lists;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class DownloadHistoryDAO {

    @Value("${download.path}")
    private String downloadPath;

    @Value("${host.download.path:}")
    private String hostDownloadPath;

    @Value("${external.library.paths:}")
    private String externalLibraryPaths;

    /** 宿主机外部曲库根目录。用于兼容数据库中已经保存的宿主机绝对路径。 */
    @Value("${external.library.host.path:}")
    private String externalLibraryHostPath;

    /** 外部曲库在容器内的固定挂载路径。 */
    @Value("${external.library.container.path:/media/external}")
    private String externalLibraryContainerPath;

    private String dbUrl;

    @Data
    public static class DownloadHistoryItem {
        private Long id;
        private Long songId;
        private String songName;
        private String artist;
        private String album;
        private String filePath;
        private String relativePath;
        private String hostFilePath;
        private Long fileSize;
        private String quality;
        private String status;
        private String createdAt;
        private Boolean fileExists;
    }

    @Data
    public static class FolderCheckDTO {
        private String path;
        private String hostPath;
        private String folderName;
        private int totalFiles;
        private int totalDirs;
        private List<String> sampleFiles;
        private boolean isRoot;
    }

    private final Set<String> ignoredFolderSet = java.util.Collections.synchronizedSet(new HashSet<>());

    @PostConstruct
    public void init() {
        try {
            Class.forName("org.sqlite.JDBC");
            File dir = new File(downloadPath);
            if (!dir.exists()) {
                dir.mkdirs();
            }
            File dbFile = new File(dir, "downloads.db");
            this.dbUrl = "jdbc:sqlite:" + dbFile.getAbsolutePath();

            try (Connection conn = DriverManager.getConnection(dbUrl);
                 Statement stmt = conn.createStatement()) {
                String sql = "CREATE TABLE IF NOT EXISTS download_history (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                        "song_id BIGINT, " +
                        "song_name TEXT, " +
                        "artist TEXT, " +
                        "album TEXT, " +
                        "file_path TEXT, " +
                        "file_size BIGINT, " +
                        "quality TEXT, " +
                        "status TEXT, " +
                        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                        ")";
                stmt.execute(sql);

                String rawSql = "CREATE TABLE IF NOT EXISTS download_history_raw (" +
                        "history_id INTEGER PRIMARY KEY, " +
                        "raw_json TEXT, " +
                        "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                        "FOREIGN KEY(history_id) REFERENCES download_history(id) ON DELETE CASCADE" +
                        ")";
                stmt.execute(rawSql);

                String ignoredSql = "CREATE TABLE IF NOT EXISTS ignored_folders (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                        "folder_path TEXT UNIQUE, " +
                        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                        ")";
                stmt.execute(ignoredSql);
            }

            loadIgnoredFolders();
            log.info("SQLite 数据库、Raw JSON 子表及 ignored_folders 表初始化完毕: {}", dbFile.getAbsolutePath());
        } catch (Exception e) {
            log.error("初始化 SQLite 数据库失败!", e);
        }
    }

    private void loadIgnoredFolders() {
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT folder_path FROM ignored_folders")) {
            while (rs.next()) {
                String p = rs.getString("folder_path");
                if (p != null && !p.trim().isEmpty()) {
                    ignoredFolderSet.add(p.trim());
                }
            }
            log.info("🚫 已载入已忽略目录总数: {}", ignoredFolderSet.size());
        } catch (Exception e) {
            log.warn("载入已忽略目录失败: {}", e.getMessage());
        }
    }

    private Connection getConnection() throws SQLException {
        return DriverManager.getConnection(dbUrl);
    }

    private String toRelativePath(String fullPath) {
        if (fullPath == null || fullPath.isEmpty()) return "";
        try {
            File root = new File(downloadPath).getCanonicalFile();
            File file = new File(fullPath).getCanonicalFile();
            String rootPath = root.getAbsolutePath();
            String filePath = file.getAbsolutePath();
            if (filePath.startsWith(rootPath)) {
                String rel = filePath.substring(rootPath.length());
                if (rel.startsWith("/") || rel.startsWith("\\")) {
                    rel = rel.substring(1);
                }
                return rel;
            }
        } catch (Exception ignored) {}
        return "";
    }

    public String toHostPath(File file) {
        if (file == null) return "";
        String absPath = file.getAbsolutePath();

        // 1. 优先尝试外部曲库映射 (如 /media/external/... -> /Users/houtokki/Music/...)
        if (externalLibraryContainerPath != null && !externalLibraryContainerPath.trim().isEmpty()
                && externalLibraryHostPath != null && !externalLibraryHostPath.trim().isEmpty()) {
            String externalHostPath = remapPathInsideRoot(absPath, externalLibraryContainerPath, externalLibraryHostPath);
            if (!externalHostPath.equals(absPath)) {
                return externalHostPath;
            }
        }

        // 2. 检查是否在下载主目录 (downloadPath)
        String rel = toRelativePath(absPath);
        if (!rel.isEmpty() && hostDownloadPath != null && !hostDownloadPath.trim().isEmpty()) {
            return new File(hostDownloadPath, rel).getAbsolutePath();
        }

        return absPath;
    }

    public static String safeUrlDecode(String str) {
        if (str == null || !str.contains("%")) return str;
        try {
            String safeStr = str.replace("+", "%2B");
            return java.net.URLDecoder.decode(safeStr, "UTF-8");
        } catch (Exception e) {
            return str;
        }
    }

    public File resolveFile(String savedPath) {
        if (savedPath == null || savedPath.isEmpty()) return new File("");
        
        savedPath = safeUrlDecode(savedPath);

        // 如果路径中错误拼接了 hostDownloadPath 与 external 路径 (如 /Users/.../media/external/...)，提取真实外部路径
        if (externalLibraryContainerPath != null && !externalLibraryContainerPath.trim().isEmpty()) {
            int extIdx = savedPath.indexOf(externalLibraryContainerPath);
            if (extIdx > 0) {
                savedPath = savedPath.substring(extIdx);
            }
        }

        if (hostDownloadPath != null && !hostDownloadPath.isEmpty() && savedPath.startsWith(hostDownloadPath)) {
            String sub = savedPath.substring(hostDownloadPath.length());
            if (sub.startsWith("/") || sub.startsWith("\\")) sub = sub.substring(1);
            savedPath = sub;
        }

        // 外部曲库早期会将宿主机绝对路径直接写入 SQLite。Docker 中该路径不存在，
        // 因此按配置的根目录改写为容器挂载路径，避免历史索引被误判为“失效”。
        savedPath = remapPathInsideRoot(savedPath, externalLibraryHostPath, externalLibraryContainerPath);

        File directFile = new File(savedPath);
        if (directFile.isAbsolute() && directFile.exists()) {
            return directFile;
        }
        File relativeFile = new File(downloadPath, savedPath);
        if (relativeFile.exists()) {
            return relativeFile;
        }
        return directFile.isAbsolute() ? directFile : relativeFile;
    }

    private String remapPathInsideRoot(String path, String sourceRoot, String targetRoot) {
        if (path == null || sourceRoot == null || sourceRoot.trim().isEmpty()
                || targetRoot == null || targetRoot.trim().isEmpty()) {
            return path;
        }
        try {
            String canonicalPath = new File(path).getCanonicalPath();
            String canonicalSourceRoot = new File(sourceRoot).getCanonicalPath();
            if (canonicalPath.equals(canonicalSourceRoot)) {
                return new File(targetRoot).getPath();
            }
            String sourcePrefix = canonicalSourceRoot.endsWith(File.separator)
                    ? canonicalSourceRoot : canonicalSourceRoot + File.separator;
            if (canonicalPath.startsWith(sourcePrefix)) {
                return new File(targetRoot, canonicalPath.substring(sourcePrefix.length())).getPath();
            }
        } catch (Exception ignored) {
            // 路径无法规范化时按原值处理，维持原有的文件解析行为。
        }
        return path;
    }

    public synchronized long addRecord(Long songId, String songName, String artist, String album, String filePath, Long fileSize, String quality, String status) {
        String sql = "INSERT INTO download_history (song_id, song_name, artist, album, file_path, file_size, quality, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        String relPath = toRelativePath(filePath);
        String savedPath = (relPath != null && !relPath.isEmpty()) ? relPath : (filePath != null ? filePath : "");
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            pstmt.setObject(1, songId);
            pstmt.setString(2, songName != null ? songName : "未知歌曲");
            pstmt.setString(3, artist != null ? artist : "");
            pstmt.setString(4, album != null ? album : "");
            pstmt.setString(5, savedPath);
            pstmt.setObject(6, fileSize != null ? fileSize : 0L);
            pstmt.setString(7, quality != null ? quality : "standard");
            pstmt.setString(8, status != null ? status : "SUCCESS");
            pstmt.executeUpdate();
            try (ResultSet rs = pstmt.getGeneratedKeys()) {
                if (rs.next()) {
                    return rs.getLong(1);
                }
            }
        } catch (Exception e) {
            log.error("保存下载历史记录到 SQLite 失败!", e);
        }
        return -1L;
    }

    public void saveRawJson(Long historyId, String rawJson) {
        if (historyId == null || historyId <= 0 || rawJson == null || rawJson.trim().isEmpty()) return;
        String sql = "INSERT INTO download_history_raw (history_id, raw_json) VALUES (?, ?) " +
                     "ON CONFLICT(history_id) DO UPDATE SET raw_json=excluded.raw_json, updated_at=CURRENT_TIMESTAMP";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setLong(1, historyId);
            pstmt.setString(2, rawJson);
            pstmt.executeUpdate();
        } catch (Exception e) {
            log.error("保存 Raw JSON 到扩展子表失败, historyId={}", historyId, e);
        }
    }

    public String getRawJson(Long historyId) {
        if (historyId == null || historyId <= 0) return null;
        String sql = "SELECT raw_json FROM download_history_raw WHERE history_id = ?";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setLong(1, historyId);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getString("raw_json");
                }
            }
        } catch (Exception e) {
            log.error("查询 Raw JSON 失败, historyId={}", historyId, e);
        }
        return null;
    }

    public DownloadHistoryItem findLocalFileBySongId(Long songId) {
        return findLocalFileBySongOrName(songId, null, null);
    }

    /**
     * 规范化歌名：去除括号修饰后缀（Live/Remaster等）、去除标点与空格并转小写
     */
    public static String normalizeTrackName(String name) {
        if (name == null) return "";
        // 1. 去除常见括号修饰词（如 (Live), [2003 Remaster], （电影原声版）等）
        String clean = name.replaceAll("[\\(\\[（【].*?[\\)\\]）】]", "").trim();
        if (clean.isEmpty()) clean = name.trim();
        // 2. 去除所有标点符号与空格并转小写
        return clean.toLowerCase().replaceAll("[\\s\\p{Punct}\\p{IsPunctuation}]+", "");
    }

    /**
     * 规范化歌手名：去除标点与空格并转小写
     */
    public static String normalizeArtistName(String artist) {
        if (artist == null) return "";
        return artist.toLowerCase().replaceAll("[\\s\\p{Punct}\\p{IsPunctuation}]+", "");
    }

    /**
     * 检查两个歌手是否匹配（支持多歌手场景）
     */
    public static boolean isArtistMatch(String artist1, String artist2) {
        String a1 = normalizeArtistName(artist1);
        String a2 = normalizeArtistName(artist2);
        if (a1.isEmpty() || a2.isEmpty()) {
            return false;
        }
        if (a1.equals(a2)) return true;
        return a1.contains(a2) || a2.contains(a1);
    }

    public DownloadHistoryItem findLocalFileBySongOrName(Long songId, String name, String artist) {
        // 1. 优先根据 song_id 精确匹配
        if (songId != null && songId > 0) {
            String sql = "SELECT * FROM download_history WHERE song_id = ? ORDER BY id DESC LIMIT 1";
            try (Connection conn = getConnection();
                 PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setLong(1, songId);
                try (ResultSet rs = pstmt.executeQuery()) {
                    if (rs.next()) {
                        DownloadHistoryItem item = mapItemFromRs(rs);
                        if (Boolean.TRUE.equals(item.getFileExists())) {
                            log.info("🎯 按 songId 成功匹配本地文件: {}, path: {}", songId, item.getFilePath());
                            return item;
                        }
                    }
                }
            } catch (Exception e) {
                log.error("按 songId 查询本地文件失败, songId={}", songId, e);
            }
        }

        // 2. 智能跨专辑比对：核心歌名完全匹配 + 歌手严格匹配（绝不使用模糊子串 contains 匹配，防止不同歌曲误伤）
        if (name != null && !name.trim().isEmpty()) {
            String targetCleanName = name.trim();
            String targetNormName = normalizeTrackName(targetCleanName);
            String targetArtist = (artist != null) ? artist.trim() : "";

            if (!targetNormName.isEmpty()) {
                String sql = "SELECT * FROM download_history ORDER BY id DESC";
                try (Connection conn = getConnection();
                     Statement stmt = conn.createStatement();
                     ResultSet rs = stmt.executeQuery(sql)) {
                    while (rs.next()) {
                        DownloadHistoryItem item = mapItemFromRs(rs);
                        if (Boolean.TRUE.equals(item.getFileExists())) {
                            String localName = item.getSongName() != null ? item.getSongName().trim() : "";
                            String localNormName = normalizeTrackName(localName);

                            // 核心歌名（去除括号版本后缀后）必须完全相等
                            if (targetNormName.equals(localNormName)) {
                                String localArtist = item.getArtist() != null ? item.getArtist().trim() : "";

                                // Case A: 双方都有歌手信息，必须歌手匹配
                                if (isArtistMatch(targetArtist, localArtist)) {
                                    log.info("🎯 跨专辑/版本精准命中本地音轨: 《{}》({}) -> 《{}》({}), path: {}",
                                            targetCleanName, targetArtist, localName, localArtist, item.getFilePath());
                                    return item;
                                }
                                // Case B: 未剥离括号的完整歌名严格全字相等，且一方缺少歌手，且歌名长度 >= 4 字符
                                else if ((targetArtist.isEmpty() || localArtist.isEmpty()) 
                                        && targetCleanName.equalsIgnoreCase(localName) 
                                        && targetNormName.length() >= 4) {
                                    log.info("🎯 歌名全字精确命中无歌手音轨: 《{}》 -> 《{}》, path: {}", targetCleanName, localName, item.getFilePath());
                                    return item;
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    log.error("按歌名歌手匹配本地文件失败: name={}, artist={}", name, artist, e);
                }
            }
        }

        log.warn("⚠️ 未找到本地可用的匹配文件: songId={}, name={}, artist={}", songId, name, artist);
        return null;
    }

    private DownloadHistoryItem mapItemFromRs(ResultSet rs) throws SQLException {
        DownloadHistoryItem item = new DownloadHistoryItem();
        item.setId(rs.getLong("id"));
        item.setSongId(rs.getLong("song_id"));
        item.setSongName(rs.getString("song_name"));
        item.setArtist(rs.getString("artist"));
        item.setAlbum(rs.getString("album"));
        String fpath = rs.getString("file_path");
        File resolved = resolveFile(fpath);
        String relPath = toRelativePath(fpath);
        item.setFilePath(resolved.getAbsolutePath());
        item.setRelativePath(relPath);
        item.setHostFilePath(toHostPath(resolved));
        item.setFileSize(rs.getLong("file_size"));
        item.setQuality(rs.getString("quality"));
        item.setStatus(rs.getString("status"));
        item.setCreatedAt(rs.getString("created_at"));
        item.setFileExists(resolved.exists() && resolved.isFile() && resolved.length() > 0);
        return item;
    }

    public DownloadHistoryItem getRecordById(Long historyId) {
        if (historyId == null || historyId <= 0) return null;
        String sql = "SELECT * FROM download_history WHERE id = ?";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setLong(1, historyId);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return mapItemFromRs(rs);
                }
            }
        } catch (Exception e) {
            log.error("根据 id 查询历史记录异常, historyId={}", historyId, e);
        }
        return null;
    }

    public List<DownloadHistoryItem> getRecordsByIds(List<Long> ids) {
        List<DownloadHistoryItem> result = new ArrayList<>();
        if (ids == null || ids.isEmpty()) return result;
        StringBuilder sql = new StringBuilder("SELECT * FROM download_history WHERE id IN (");
        for (int i = 0; i < ids.size(); i++) {
            if (i > 0) sql.append(",");
            sql.append("?");
        }
        sql.append(")");
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < ids.size(); i++) {
                pstmt.setLong(i + 1, ids.get(i));
            }
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    result.add(mapItemFromRs(rs));
                }
            }
        } catch (Exception e) {
            log.error("批量查询历史记录失败, ids={}", ids, e);
        }
        return result;
    }

    public List<DownloadHistoryItem> getRecordsBySongIds(List<Long> songIds) {
        List<DownloadHistoryItem> result = new ArrayList<>();
        if (songIds == null || songIds.isEmpty()) return result;
        StringBuilder sql = new StringBuilder("SELECT * FROM download_history WHERE song_id IN (");
        for (int i = 0; i < songIds.size(); i++) {
            if (i > 0) sql.append(",");
            sql.append("?");
        }
        sql.append(")");
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < songIds.size(); i++) {
                pstmt.setLong(i + 1, songIds.get(i));
            }
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    result.add(mapItemFromRs(rs));
                }
            }
        } catch (Exception e) {
            log.error("批量按 songId 查询历史记录失败, songIds={}", songIds, e);
        }
        return result;
    }

    public void markLocalStatusBatch(List<com.pewee.neteasemusic.models.dtos.TrackDTO> tracks) {
        if (tracks == null || tracks.isEmpty()) return;

        // 1. 一次性从数据库读取所有有效本地文件记录，避免数千次循环 SQL 和重复磁盘 I/O
        Map<Long, DownloadHistoryItem> songIdMap = new HashMap<>();
        List<DownloadHistoryItem> validRecords = new ArrayList<>();

        String sql = "SELECT * FROM download_history ORDER BY id DESC";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                DownloadHistoryItem item = mapItemFromRs(rs);
                if (Boolean.TRUE.equals(item.getFileExists())) {
                    if (item.getSongId() != null && item.getSongId() > 0 && !songIdMap.containsKey(item.getSongId())) {
                        songIdMap.put(item.getSongId(), item);
                    }
                    validRecords.add(item);
                }
            }
        } catch (Exception e) {
            log.error("批量标记本地状态时加载数据库记录失败", e);
        }

        // 2. 内存极速比对（ID 优先，降级歌名+歌手全量模糊匹配）
        for (com.pewee.neteasemusic.models.dtos.TrackDTO track : tracks) {
            if (track == null) continue;

            // Step 1: ID 精确匹配
            if (track.getId() != null && songIdMap.containsKey(track.getId())) {
                track.setIsLocal(true);
                continue;
            }

            // Step 2: 歌名 + 歌手降级内存匹配
            String trackName = track.getName() != null ? track.getName().trim() : "";
            if (trackName.isEmpty()) {
                track.setIsLocal(false);
                continue;
            }

            String targetNormName = normalizeTrackName(trackName);
            String trackArtist = track.getArtists() != null ? track.getArtists().trim() : "";

            boolean matched = false;
            for (DownloadHistoryItem local : validRecords) {
                String localName = local.getSongName() != null ? local.getSongName().trim() : "";
                String localNormName = normalizeTrackName(localName);

                if (targetNormName.equals(localNormName)) {
                    String localArtist = local.getArtist() != null ? local.getArtist().trim() : "";
                    if (isArtistMatch(trackArtist, localArtist)) {
                        matched = true;
                        break;
                    } else if ((trackArtist.isEmpty() || localArtist.isEmpty()) 
                            && trackName.equalsIgnoreCase(localName) 
                            && targetNormName.length() >= 4) {
                        matched = true;
                        break;
                    }
                }
            }
            track.setIsLocal(matched);
        }
    }

    public synchronized Map<String, Object> scanExternalLibraries() {
        int scannedFiles = 0;
        int addedCount = 0;
        List<String> targetDirs = new ArrayList<>();

        if (externalLibraryPaths != null && !externalLibraryPaths.trim().isEmpty()) {
            String[] parts = externalLibraryPaths.split("[,;]");
            for (String p : parts) {
                if (p != null && !p.trim().isEmpty()) {
                    targetDirs.add(p.trim());
                }
            }
        }

        if (targetDirs.isEmpty()) {
            targetDirs.add(downloadPath);
        }

        for (String dirPath : targetDirs) {
            File dirFile = new File(dirPath);
            if (!dirFile.exists() || !dirFile.isDirectory()) {
                log.warn("⚠️ 跳过不存在的外部曲库目录: {}", dirPath);
                continue;
            }

            List<File> audioFiles = new ArrayList<>();
            collectAudioFiles(dirFile, audioFiles);
            scannedFiles += audioFiles.size();

            for (File file : audioFiles) {
                if (file.length() == 0) continue; // 过滤 0 字节空文件
                String absPath = file.getAbsolutePath();
                com.pewee.neteasemusic.utils.TagUtils.TagInfo info = com.pewee.neteasemusic.utils.TagUtils.readTags(file);
                String songName = (info.getTitle() != null && !info.getTitle().isEmpty()) ? info.getTitle() : file.getName();
                String artist = (info.getArtist() != null && !info.getArtist().isEmpty()) ? info.getArtist() : "未知歌手";
                String album = (info.getAlbum() != null && !info.getAlbum().isEmpty()) ? info.getAlbum() : "外部导入曲库";

                if (!isFilePathExistsInDb(absPath)) {
                    long newId = addRecord(null, songName, artist, album, absPath, file.length(), "lossless", "SUCCESS");
                    if (newId > 0) {
                        addedCount++;
                    }
                } else {
                    // 若已存在但在早期导入时未能识别歌手/专辑，自动修复补全！
                    updateMissingMetadataIfPresent(absPath, songName, artist, album);
                }
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("scannedFiles", scannedFiles);
        result.put("addedCount", addedCount);
        result.put("configuredDirs", targetDirs);
        log.info("📂 多目录外部曲库扫描完成: 扫描 {} 个文件，成功新录入 {} 首到 SQLite", scannedFiles, addedCount);
        return result;
    }

    private void updateMissingMetadataIfPresent(String filePath, String songName, String artist, String album) {
        if ("未知歌手".equals(artist) || artist == null || artist.trim().isEmpty()) {
            return;
        }
        String relPath = toRelativePath(filePath);
        String sql = "UPDATE download_history SET song_name = ?, artist = ?, album = ? " +
                     "WHERE (artist = '未知歌手' OR artist = '' OR artist IS NULL OR album = '外部导入曲库' OR album = '' OR album IS NULL) " +
                     "AND (file_path = ? OR file_path = ?)";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, songName);
            pstmt.setString(2, artist);
            pstmt.setString(3, album);
            pstmt.setString(4, filePath);
            pstmt.setString(5, relPath);
            pstmt.executeUpdate();
        } catch (Exception e) {
            log.warn("更新历史元数据失败: filePath={}", filePath, e);
        }
    }

    public boolean isIgnoredDirectory(File dir) {
        if (dir == null || !dir.exists() || !dir.isDirectory()) return false;
        if (dir.getName().startsWith(".")) return true;
        // 1. 物理标记 .musicignore 文件
        File ignoreMarker = new File(dir, ".musicignore");
        if (ignoreMarker.exists()) return true;

        // 2. 数据库 ignored_folders 忽略黑名单（包含自身或任一祖先路径）
        String abs = dir.getAbsolutePath();
        synchronized (ignoredFolderSet) {
            for (String ignored : ignoredFolderSet) {
                if (abs.equals(ignored) || abs.startsWith(ignored + File.separator) || abs.startsWith(ignored + "/")) {
                    return true;
                }
            }
        }
        return false;
    }

    private void collectAudioFiles(File dir, List<File> list) {
        if (dir == null || isIgnoredDirectory(dir)) return;
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.isDirectory()) {
                if (!isIgnoredDirectory(f)) {
                    collectAudioFiles(f, list);
                }
            } else if (f.isFile()) {
                String name = f.getName().toLowerCase();
                // 仅扫描并入库 .mp3 格式音频
                if (name.endsWith(".mp3")) {
                    list.add(f);
                }
            }
        }
    }

    private boolean isFilePathExistsInDb(String filePath) {
        String relPath = toRelativePath(filePath);
        String legacyHostPath = remapPathInsideRoot(filePath, externalLibraryContainerPath, externalLibraryHostPath);
        String sql = "SELECT COUNT(*) FROM download_history WHERE file_path = ? OR file_path = ? OR file_path = ?";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, filePath);
            pstmt.setString(2, relPath);
            pstmt.setString(3, legacyHostPath);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1) > 0;
                }
            }
        } catch (Exception e) {
            log.error("检查文件路径是否已存在失败", e);
        }
        return false;
    }

    public List<DownloadHistoryItem> getRecords(String keyword, int page, int pageSize) {
        List<DownloadHistoryItem> list = new ArrayList<>();
        int offset = (page - 1) * pageSize;
        boolean hasSearch = keyword != null && !keyword.trim().isEmpty();
        String sql = "SELECT * FROM download_history " +
                (hasSearch ? "WHERE song_name LIKE ? OR artist LIKE ? OR album LIKE ? OR file_path LIKE ? " : "") +
                "ORDER BY id DESC LIMIT ? OFFSET ?";

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            int paramIndex = 1;
            if (hasSearch) {
                String kw = "%" + keyword.trim() + "%";
                pstmt.setString(paramIndex++, kw);
                pstmt.setString(paramIndex++, kw);
                pstmt.setString(paramIndex++, kw);
                pstmt.setString(paramIndex++, kw);
            }
            pstmt.setInt(paramIndex++, pageSize);
            pstmt.setInt(paramIndex++, offset);

            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    list.add(mapItemFromRs(rs));
                }
            }
        } catch (Exception e) {
            log.error("查询下载历史失败!", e);
        }
        return list;
    }

    /**
     * 查询所有物理文件已缺失的历史记录
     */
    public List<DownloadHistoryItem> getMissingRecords() {
        List<DownloadHistoryItem> missing = new ArrayList<>();
        String sql = "SELECT * FROM download_history ORDER BY id DESC";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                DownloadHistoryItem item = mapItemFromRs(rs);
                if (Boolean.FALSE.equals(item.getFileExists())) {
                    missing.add(item);
                }
            }
        } catch (Exception e) {
            log.error("查询缺失文件记录失败!", e);
        }
        return missing;
    }

    /**
     * 查询所有非 .mp3 格式的历史记录
     */
    public List<DownloadHistoryItem> getNonMp3Records() {
        List<DownloadHistoryItem> nonMp3List = new ArrayList<>();
        String sql = "SELECT * FROM download_history ORDER BY id DESC";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                DownloadHistoryItem item = mapItemFromRs(rs);
                String fpath = item.getFilePath();
                if (fpath == null || !fpath.toLowerCase().endsWith(".mp3")) {
                    nonMp3List.add(item);
                }
            }
        } catch (Exception e) {
            log.error("查询非 MP3 记录失败!", e);
        }
        return nonMp3List;
    }

    /**
     * 批量清理所有非 .mp3 格式的历史记录
     */
    public int cleanNonMp3Records() {
        List<DownloadHistoryItem> nonMp3 = getNonMp3Records();
        if (nonMp3.isEmpty()) return 0;

        String sql = "DELETE FROM download_history WHERE id = ?";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            for (DownloadHistoryItem item : nonMp3) {
                pstmt.setLong(1, item.getId());
                pstmt.addBatch();
            }
            int[] counts = pstmt.executeBatch();
            return counts.length;
        } catch (Exception e) {
            log.error("批量清理非 MP3 记录失败!", e);
            return 0;
        }
    }

    public int countRecords(String keyword) {
        boolean hasSearch = keyword != null && !keyword.trim().isEmpty();
        String sql = "SELECT COUNT(*) FROM download_history " +
                (hasSearch ? "WHERE song_name LIKE ? OR artist LIKE ? OR album LIKE ? OR file_path LIKE ?" : "");

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            if (hasSearch) {
                String kw = "%" + keyword.trim() + "%";
                pstmt.setString(1, kw);
                pstmt.setString(2, kw);
                pstmt.setString(3, kw);
                pstmt.setString(4, kw);
            }
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
        } catch (Exception e) {
            log.error("统计记录数失败!", e);
        }
        return 0;
    }

    public boolean deleteRecord(Long id) {
        String sql = "DELETE FROM download_history WHERE id = ?";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setLong(1, id);
            return pstmt.executeUpdate() > 0;
        } catch (Exception e) {
            log.error("删除记录失败!", e);
            return false;
        }
    }

    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        String sql = "SELECT COUNT(*) as total_count, COALESCE(SUM(file_size), 0) as total_size FROM download_history";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            if (rs.next()) {
                stats.put("totalCount", rs.getInt("total_count"));
                stats.put("totalSize", rs.getLong("total_size"));
            }
        } catch (Exception e) {
            log.error("获取下载统计失败!", e);
        }

        // 校验实际存在的文件数量与缺失文件数、非 MP3 文件数
        int missingCount = 0;
        int nonMp3Count = 0;
        String allSql = "SELECT file_path FROM download_history";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(allSql)) {
            while (rs.next()) {
                String fpath = rs.getString("file_path");
                File f = resolveFile(fpath);
                if (!f.exists()) {
                    missingCount++;
                }
                if (fpath == null || !fpath.toLowerCase().endsWith(".mp3")) {
                    nonMp3Count++;
                }
            }
        } catch (Exception e) {
            log.error("校验文件存在性与格式失败!", e);
        }
        stats.put("missingCount", missingCount);
        stats.put("nonMp3Count", nonMp3Count);
        return stats;
    }

    private static final java.util.Set<String> AUDIO_EXTENSIONS = new java.util.HashSet<>(
            java.util.Collections.singletonList(".mp3")
    );

    private boolean isAudioFile(File file) {
        if (file == null || !file.isFile() || file.getName().startsWith(".")) return false;
        String name = file.getName().toLowerCase();
        return name.endsWith(".mp3");
    }

    private void scanDirectoryRecursive(File dir, Map<String, DownloadHistoryItem> dbFilePathMap, List<Map<String, Object>> untrackedFiles) {
        if (dir == null || !dir.exists() || !dir.isDirectory() || isIgnoredDirectory(dir)) return;
        File[] files = dir.listFiles();
        if (files == null) return;

        for (File f : files) {
            if (f.isDirectory()) {
                if (!isIgnoredDirectory(f)) {
                    scanDirectoryRecursive(f, dbFilePathMap, untrackedFiles);
                }
            } else if (isAudioFile(f)) {
                String absPath = f.getAbsolutePath();
                if (!dbFilePathMap.containsKey(absPath)) {
                    Map<String, Object> u = new HashMap<>();
                    u.put("fileName", f.getName());
                    u.put("filePath", absPath);
                    u.put("fileSize", f.length());
                    untrackedFiles.add(u);
                }
            }
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FolderItemDTO {
        private String name;
        private String path;
        private String hostPath;
        private boolean isDirectory;
        private long size;
        private int trackCount;
        private String songName;
        private String artist;
        private String album;
        private Long songId;
        private Long historyId;
        private String streamUrl;
    }

    public List<Map<String, String>> getFolderRoots() {
        List<Map<String, String>> roots = new ArrayList<>();
        // 1. 下载主目录
        File downloadDir = new File(downloadPath);
        if (downloadDir.exists()) {
            Map<String, String> r1 = new HashMap<>();
            r1.put("name", "📥 默认下载主目录");
            r1.put("path", downloadDir.getAbsolutePath());
            r1.put("hostPath", hostDownloadPath != null && !hostDownloadPath.isEmpty() ? hostDownloadPath : downloadDir.getAbsolutePath());
            roots.add(r1);
        }

        // 2. 外部曲库目录
        if (externalLibraryPaths != null && !externalLibraryPaths.trim().isEmpty()) {
            String[] parts = externalLibraryPaths.split("[,;]");
            for (String p : parts) {
                if (p != null && !p.trim().isEmpty()) {
                    File extDir = new File(p.trim());
                    if (extDir.exists()) {
                        Map<String, String> r = new HashMap<>();
                        r.put("name", "📁 外部曲库 (" + extDir.getName() + ")");
                        r.put("path", extDir.getAbsolutePath());
                        r.put("hostPath", toHostPath(extDir));
                        roots.add(r);
                    }
                }
            }
        }
        return roots;
    }

    public List<FolderItemDTO> listFolderContents(String folderPath) {
        List<FolderItemDTO> result = new ArrayList<>();
        if (folderPath == null || folderPath.trim().isEmpty()) {
            return result;
        }

        File dir = resolveFile(folderPath);
        if (!dir.exists() || !dir.isDirectory() || isIgnoredDirectory(dir)) {
            return result;
        }

        // 预加载所有有效数据库记录供元数据毫秒级比对
        Map<String, DownloadHistoryItem> dbMap = new HashMap<>();
        String sql = "SELECT * FROM download_history ORDER BY id DESC";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                DownloadHistoryItem item = mapItemFromRs(rs);
                if (item.getFilePath() != null) {
                    dbMap.put(item.getFilePath(), item);
                }
            }
        } catch (Exception ignored) {}

        File[] files = dir.listFiles();
        if (files == null) return result;

        List<FolderItemDTO> dirList = new ArrayList<>();
        List<FolderItemDTO> fileList = new ArrayList<>();

        for (File f : files) {
            if (f.getName().startsWith(".")) continue;
            if (f.isDirectory()) {
                if (isIgnoredDirectory(f)) continue;
                int trackCount = countMp3FilesRecursive(f);
                FolderItemDTO dto = new FolderItemDTO();
                dto.setName(f.getName());
                dto.setPath(f.getAbsolutePath());
                dto.setHostPath(toHostPath(f));
                dto.setDirectory(true);
                dto.setTrackCount(trackCount);
                dirList.add(dto);
            } else if (f.isFile() && f.getName().toLowerCase().endsWith(".mp3")) {
                FolderItemDTO dto = new FolderItemDTO();
                dto.setName(f.getName());
                dto.setPath(f.getAbsolutePath());
                dto.setHostPath(toHostPath(f));
                dto.setDirectory(false);
                dto.setSize(f.length());

                DownloadHistoryItem dbItem = dbMap.get(f.getAbsolutePath());
                if (dbItem != null) {
                    dto.setSongName(dbItem.getSongName());
                    dto.setArtist(dbItem.getArtist());
                    dto.setAlbum(dbItem.getAlbum());
                    dto.setSongId(dbItem.getSongId());
                    dto.setHistoryId(dbItem.getId());
                } else {
                    com.pewee.neteasemusic.utils.TagUtils.TagInfo tag = com.pewee.neteasemusic.utils.TagUtils.readTags(f);
                    dto.setSongName(tag.getTitle() != null ? tag.getTitle() : f.getName());
                    dto.setArtist(tag.getArtist() != null ? tag.getArtist() : "未知歌手");
                    dto.setAlbum(tag.getAlbum() != null ? tag.getAlbum() : dir.getName());
                }
                String relPath = toRelativePath(f.getAbsolutePath());
                String playPath = relPath.isEmpty() ? f.getAbsolutePath() : relPath;
                try {
                    dto.setStreamUrl("/v2/history/stream?path=" + java.net.URLEncoder.encode(playPath, "UTF-8"));
                } catch (Exception e) {
                    dto.setStreamUrl("/v2/history/stream?path=" + playPath);
                }
                fileList.add(dto);
            }
        }

        dirList.sort((a, b) -> a.getName().compareToIgnoreCase(b.getName()));
        fileList.sort((a, b) -> a.getName().compareToIgnoreCase(b.getName()));

        result.addAll(dirList);
        result.addAll(fileList);
        return result;
    }

    public int countMp3FilesRecursive(File dir) {
        if (dir == null || isIgnoredDirectory(dir)) return 0;
        File[] files = dir.listFiles();
        if (files == null) return 0;
        int count = 0;
        for (File f : files) {
            if (f.isDirectory()) {
                if (!isIgnoredDirectory(f)) {
                    count += countMp3FilesRecursive(f);
                }
            } else if (f.isFile() && f.getName().toLowerCase().endsWith(".mp3")) {
                count++;
            }
        }
        return count;
    }

    public List<DownloadHistoryItem> getFolderTracks(String folderPath, boolean recursive) {
        List<DownloadHistoryItem> tracks = new ArrayList<>();
        if (folderPath == null || folderPath.trim().isEmpty()) return tracks;

        File dir = resolveFile(folderPath);
        if (!dir.exists() || !dir.isDirectory() || isIgnoredDirectory(dir)) return tracks;

        List<File> mp3Files = new ArrayList<>();
        collectMp3Files(dir, mp3Files, recursive);

        Map<String, DownloadHistoryItem> dbMap = new HashMap<>();
        String sql = "SELECT * FROM download_history ORDER BY id DESC";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                DownloadHistoryItem item = mapItemFromRs(rs);
                if (item.getFilePath() != null) {
                    dbMap.put(item.getFilePath(), item);
                }
            }
        } catch (Exception ignored) {}

        for (File f : mp3Files) {
            DownloadHistoryItem item = dbMap.get(f.getAbsolutePath());
            if (item == null) {
                com.pewee.neteasemusic.utils.TagUtils.TagInfo tag = com.pewee.neteasemusic.utils.TagUtils.readTags(f);
                item = new DownloadHistoryItem();
                item.setId(0L);
                item.setSongId(0L);
                item.setSongName(tag.getTitle() != null ? tag.getTitle() : f.getName());
                item.setArtist(tag.getArtist() != null ? tag.getArtist() : "未知歌手");
                item.setAlbum(tag.getAlbum() != null ? tag.getAlbum() : dir.getName());
                item.setFilePath(f.getAbsolutePath());
                item.setRelativePath(toRelativePath(f.getAbsolutePath()));
                item.setHostFilePath(toHostPath(f));
                item.setFileSize(f.length());
                item.setQuality("local");
                item.setStatus("SUCCESS");
                item.setFileExists(true);
            }
            tracks.add(item);
        }
        return tracks;
    }

    private void collectMp3Files(File dir, List<File> list, boolean recursive) {
        if (dir == null || isIgnoredDirectory(dir)) return;
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.isDirectory() && recursive) {
                if (!isIgnoredDirectory(f)) {
                    collectMp3Files(f, list, true);
                }
            } else if (f.isFile() && f.getName().toLowerCase().endsWith(".mp3")) {
                list.add(f);
            }
        }
    }

    public Map<String, Object> scanFiles() {
        Map<String, Object> res = new HashMap<>();
        List<Map<String, Object>> missingRecords = new ArrayList<>();
        List<Map<String, Object>> untrackedFiles = new ArrayList<>();
        int validCount = 0;

        List<DownloadHistoryItem> all = getRecords(null, 1, 10000);
        Map<String, DownloadHistoryItem> dbFilePathMap = new HashMap<>();

        for (DownloadHistoryItem item : all) {
            if (Boolean.TRUE.equals(item.getFileExists())) {
                validCount++;
                if (item.getFilePath() != null && !item.getFilePath().isEmpty()) {
                    File f = resolveFile(item.getFilePath());
                    dbFilePathMap.put(f.getAbsolutePath(), item);
                }
            } else {
                Map<String, Object> m = new HashMap<>();
                m.put("id", item.getId());
                m.put("songName", item.getSongName() != null ? item.getSongName() : "未知歌曲");
                m.put("artist", item.getArtist() != null ? item.getArtist() : "未知歌手");
                m.put("album", item.getAlbum() != null ? item.getAlbum() : "");
                m.put("filePath", item.getFilePath() != null ? item.getFilePath() : "");
                missingRecords.add(m);
            }
        }

        File folder = new File(downloadPath);
        scanDirectoryRecursive(folder, dbFilePathMap, untrackedFiles);

        res.put("totalRecords", all.size());
        res.put("validRecordsCount", validCount);
        res.put("missingCount", missingRecords.size());
        res.put("missingRecords", missingRecords);
        res.put("untrackedCount", untrackedFiles.size());
        res.put("untrackedFiles", untrackedFiles);
        return res;
    }

    public int importUntrackedFiles() {
        Map<String, Object> scanRes = scanFiles();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> untracked = (List<Map<String, Object>>) scanRes.get("untrackedFiles");
        if (untracked == null || untracked.isEmpty()) return 0;

        int importedCount = 0;
        String sql = "INSERT INTO download_history (song_id, song_name, artist, album, file_path, file_size, quality, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            conn.setAutoCommit(false);
            for (Map<String, Object> u : untracked) {
                String fpath = (String) u.get("filePath");
                Long size = (Long) u.get("fileSize");
                if (fpath == null) continue;
                File file = new File(fpath);
                if (!file.exists() || file.length() < 1250000) continue; // 🛑 过滤小于 1.2MB 的 30s VIP 试听片段

                com.pewee.neteasemusic.utils.TagUtils.TagInfo info = com.pewee.neteasemusic.utils.TagUtils.readTags(file);
                String relPath = toRelativePath(fpath);

                pstmt.setObject(1, 0L); // 未识别数字 ID
                pstmt.setString(2, info.getTitle() != null ? info.getTitle() : file.getName());
                pstmt.setString(3, info.getArtist() != null ? info.getArtist() : "");
                pstmt.setString(4, info.getAlbum() != null ? info.getAlbum() : "");
                pstmt.setString(5, relPath);
                pstmt.setObject(6, size != null ? size : file.length());
                pstmt.setString(7, "local");
                pstmt.setString(8, "SUCCESS");
                pstmt.addBatch();
                importedCount++;
            }
            pstmt.executeBatch();
            conn.commit();
            conn.setAutoCommit(true);
            log.info("成功批量导入 {} 首本地发现的音频到数据库!", importedCount);
        } catch (Exception e) {
            log.error("批量导入本地未录入音频失败!", e);
        }
        return importedCount;
    }

    public int cleanMissingRecords() {
        List<DownloadHistoryItem> missing = getMissingRecords();
        if (missing.isEmpty()) return 0;

        List<Long> deleteIds = new ArrayList<>();
        for (DownloadHistoryItem item : missing) {
            deleteIds.add(item.getId());
            if (item.getFilePath() != null && !item.getFilePath().isEmpty()) {
                File resolved = resolveFile(item.getFilePath());
                // 自动擦除以前残留在 Mac 硬盘的小于 1.2MB 试听垃圾文件
                if (resolved.exists() && resolved.length() < 1250000) {
                    try { resolved.delete(); } catch (Exception ignored) {}
                }
            }
        }

        String sql = "DELETE FROM download_history WHERE id = ?";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            for (Long id : deleteIds) {
                pstmt.setLong(1, id);
                pstmt.addBatch();
            }
            int[] counts = pstmt.executeBatch();
            return counts.length;
        } catch (Exception e) {
            log.error("批量清理文件缺失记录失败!", e);
            return 0;
        }
    }

    public boolean ignoreFolder(String folderPath) {
        if (folderPath == null || folderPath.trim().isEmpty()) return false;
        try {
            File dir = resolveFile(folderPath);
            String absPath = dir.getAbsolutePath();

            // 1. 尝试物理创建 .musicignore 标记文件
            try {
                if (dir.exists() && dir.isDirectory()) {
                    File ignoreMarker = new File(dir, ".musicignore");
                    if (!ignoreMarker.exists()) {
                        boolean created = ignoreMarker.createNewFile();
                        log.info("🚫 物理创建 .musicignore 文件结果: dir={}, created={}", absPath, created);
                    }
                }
            } catch (Exception e) {
                log.warn("⚠️ 物理创建 .musicignore 失败 (可能是只读挂载或无写入权限)，自动降级为数据库持久化忽略: {}", e.getMessage());
            }

            // 2. 数据库 ignored_folders 表持久化记录（即使是只读挂载也能 100% 忽略生效）
            String sql = "INSERT OR IGNORE INTO ignored_folders (folder_path) VALUES (?)";
            try (Connection conn = getConnection();
                 PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setString(1, absPath);
                pstmt.executeUpdate();
                if (!absPath.equals(folderPath)) {
                    pstmt.setString(1, folderPath);
                    pstmt.executeUpdate();
                }
            } catch (Exception e) {
                log.warn("保存忽略目录到 SQLite 失败: {}", e.getMessage());
            }

            ignoredFolderSet.add(absPath);
            ignoredFolderSet.add(folderPath);
            log.info("🚫 成功将目录加入忽略黑名单: absPath={}, inputPath={}", absPath, folderPath);
            return true;
        } catch (Exception e) {
            log.error("忽略目录处理失败: path={}", folderPath, e);
            return false;
        }
    }

    public boolean deleteFolder(String folderPath) {
        if (folderPath == null || folderPath.trim().isEmpty()) return false;
        try {
            File dir = resolveFile(folderPath);
            if (!dir.exists() || !dir.isDirectory()) return false;

            // 安全检查：禁止删除根路径或主下载目录
            String absPath = dir.getAbsolutePath();
            if (absPath.equals("/") || absPath.equals("/media") || (downloadPath != null && absPath.equals(new File(downloadPath).getAbsolutePath()))) {
                log.warn("⚠️ 拒绝删除根目录: {}", absPath);
                return false;
            }

            // 1. 递归删除物理文件夹及所有内容
            boolean deleted = deleteDirectoryRecursively(dir);

            // 2. 同步清理数据库历史记录与忽略黑名单
            String relPath = toRelativePath(absPath);
            String prefix1 = relPath.isEmpty() ? absPath + "/%" : relPath + "/%";
            String prefix2 = absPath + "/%";
            String sql = "DELETE FROM download_history WHERE file_path = ? OR file_path LIKE ? OR file_path LIKE ?";
            try (Connection conn = getConnection();
                 PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setString(1, relPath.isEmpty() ? absPath : relPath);
                pstmt.setString(2, prefix1);
                pstmt.setString(3, prefix2);
                pstmt.executeUpdate();

                // 同步清理 ignored_folders 表
                try (PreparedStatement delIgnored = conn.prepareStatement("DELETE FROM ignored_folders WHERE folder_path = ? OR folder_path LIKE ? OR folder_path LIKE ?")) {
                    delIgnored.setString(1, absPath);
                    delIgnored.setString(2, prefix1);
                    delIgnored.setString(3, prefix2);
                    delIgnored.executeUpdate();
                }
            } catch (Exception e) {
                log.warn("删除文件夹时清理数据库记录异常: {}", e.getMessage());
            }

            ignoredFolderSet.remove(absPath);
            ignoredFolderSet.remove(folderPath);

            log.info("🗑️ 成功物理删除文件夹: {}", absPath);
            return deleted;
        } catch (Exception e) {
            log.error("物理删除文件夹失败: path={}", folderPath, e);
            return false;
        }
    }

    private boolean deleteDirectoryRecursively(File dir) {
        if (dir.isDirectory()) {
            File[] files = dir.listFiles();
            if (files != null) {
                for (File child : files) {
                    deleteDirectoryRecursively(child);
                }
            }
        }
        return dir.delete();
    }

    public FolderCheckDTO checkFolder(String folderPath) {
        if (folderPath == null || folderPath.trim().isEmpty()) return null;
        try {
            File dir = resolveFile(folderPath);
            if (!dir.exists() || !dir.isDirectory()) return null;

            FolderCheckDTO dto = new FolderCheckDTO();
            dto.setPath(folderPath);
            dto.setHostPath(toHostPath(dir));
            dto.setFolderName(dir.getName());

            String absPath = dir.getAbsolutePath();
            boolean isRoot = absPath.equals("/") || absPath.equals("/media")
                    || (downloadPath != null && absPath.equals(new File(downloadPath).getAbsolutePath()));
            dto.setRoot(isRoot);

            List<String> samples = new ArrayList<>();
            int[] counts = new int[]{0, 0}; // [files, dirs]
            collectDirectoryStats(dir, samples, counts);

            dto.setTotalFiles(counts[0]);
            dto.setTotalDirs(counts[1]);
            dto.setSampleFiles(samples);
            return dto;
        } catch (Exception e) {
            log.error("预检文件夹失败: path={}", folderPath, e);
            return null;
        }
    }

    private void collectDirectoryStats(File dir, List<String> samples, int[] counts) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.isDirectory()) {
                counts[1]++;
                collectDirectoryStats(f, samples, counts);
            } else {
                counts[0]++;
                if (samples.size() < 5) {
                    samples.add(f.getName());
                }
            }
        }
    }
}
