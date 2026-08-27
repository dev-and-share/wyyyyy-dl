package com.pewee.neteasemusic.dao;

import java.io.File;
import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import lombok.Data;
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
            }
            log.info("SQLite 数据库及扩展 Raw JSON 子表初始化完毕: {}", dbFile.getAbsolutePath());
        } catch (Exception e) {
            log.error("初始化 SQLite 数据库失败!", e);
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
        return fullPath;
    }

    public String toHostPath(File file) {
        if (file == null) return "";
        String externalHostPath = remapPathInsideRoot(file.getAbsolutePath(), externalLibraryContainerPath, externalLibraryHostPath);
        if (!externalHostPath.equals(file.getAbsolutePath())) {
            return externalHostPath;
        }
        String rel = toRelativePath(file.getAbsolutePath());
        if (hostDownloadPath != null && !hostDownloadPath.trim().isEmpty()) {
            return new File(hostDownloadPath, rel).getAbsolutePath();
        }
        return file.getAbsolutePath();
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
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            pstmt.setObject(1, songId);
            pstmt.setString(2, songName != null ? songName : "未知歌曲");
            pstmt.setString(3, artist != null ? artist : "");
            pstmt.setString(4, album != null ? album : "");
            pstmt.setString(5, relPath);
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

    public DownloadHistoryItem findLocalFileBySongOrName(Long songId, String name, String artist) {
        // 1. 优先根据 song_id 匹配
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

        // 2. 智能降级：按歌名+歌手全量模糊比对
        if (name != null && !name.trim().isEmpty()) {
            String cleanName = name.trim();
            String baseName = cleanName.replaceAll("[\\(\\[（【].*?[\\)\\]）】]", "").trim();
            if (baseName.isEmpty()) baseName = cleanName;

            String sql = "SELECT * FROM download_history ORDER BY id DESC";
            try (Connection conn = getConnection();
                 Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(sql)) {
                while (rs.next()) {
                    DownloadHistoryItem item = mapItemFromRs(rs);
                    if (Boolean.TRUE.equals(item.getFileExists())) {
                        String localName = item.getSongName() != null ? item.getSongName().trim() : "";
                        String localBaseName = localName.replaceAll("[\\(\\[（【].*?[\\)\\]）】]", "").trim();

                        if (localName.equalsIgnoreCase(cleanName) || localBaseName.equalsIgnoreCase(baseName) || localName.contains(baseName) || cleanName.contains(localName)) {
                            String cleanArtist = (artist != null) ? artist.trim() : "";
                            String localArtist = item.getArtist() != null ? item.getArtist().trim() : "";

                            if (cleanArtist.isEmpty() || localArtist.isEmpty() || localArtist.contains(cleanArtist) || cleanArtist.contains(localArtist)) {
                                log.info("🎯 按歌名歌手成功智能匹配本地文件: 《{}》 -> {}, path: {}", cleanName, item.getSongName(), item.getFilePath());
                                return item;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.error("按歌名歌手匹配本地文件失败: name={}, artist={}", name, artist, e);
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
                String absPath = file.getAbsolutePath();
                if (!isFilePathExistsInDb(absPath)) {
                    String fileName = file.getName();
                    int lastDot = fileName.lastIndexOf('.');
                    String nameWithoutExt = (lastDot > 0) ? fileName.substring(0, lastDot) : fileName;

                    String songName = nameWithoutExt;
                    String artist = "未知歌手";

                    if (nameWithoutExt.contains("-")) {
                        String[] segments = nameWithoutExt.split("-", 2);
                        artist = segments[0].trim();
                        songName = segments[1].trim();
                    }

                    long newId = addRecord(null, songName, artist, "外部导入曲库", absPath, file.length(), "lossless", "SUCCESS");
                    if (newId > 0) {
                        addedCount++;
                    }
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

    private void collectAudioFiles(File dir, List<File> list) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.isDirectory()) {
                collectAudioFiles(f, list);
            } else if (f.isFile()) {
                String name = f.getName().toLowerCase();
                if (name.endsWith(".mp3") || name.endsWith(".flac") || name.endsWith(".m4a") || name.endsWith(".wav") || name.endsWith(".aac") || name.endsWith(".ogg")) {
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
                (hasSearch ? "WHERE song_name LIKE ? OR artist LIKE ? OR album LIKE ? " : "") +
                "ORDER BY id DESC LIMIT ? OFFSET ?";

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            int paramIndex = 1;
            if (hasSearch) {
                String kw = "%" + keyword.trim() + "%";
                pstmt.setString(paramIndex++, kw);
                pstmt.setString(paramIndex++, kw);
                pstmt.setString(paramIndex++, kw);
            }
            pstmt.setInt(paramIndex++, pageSize);
            pstmt.setInt(paramIndex++, offset);

            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
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
                    item.setHostFilePath(new File(hostDownloadPath, relPath).getAbsolutePath());
                    item.setFileSize(rs.getLong("file_size"));
                    item.setQuality(rs.getString("quality"));
                    item.setStatus(rs.getString("status"));
                    item.setCreatedAt(rs.getString("created_at"));

                    item.setFileExists(resolved.exists());
                    list.add(item);
                }
            }
        } catch (Exception e) {
            log.error("查询下载历史失败!", e);
        }
        return list;
    }

    public int countRecords(String keyword) {
        boolean hasSearch = keyword != null && !keyword.trim().isEmpty();
        String sql = "SELECT COUNT(*) FROM download_history " +
                (hasSearch ? "WHERE song_name LIKE ? OR artist LIKE ? OR album LIKE ?" : "");

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            if (hasSearch) {
                String kw = "%" + keyword.trim() + "%";
                pstmt.setString(1, kw);
                pstmt.setString(2, kw);
                pstmt.setString(3, kw);
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

        // 校验实际存在的文件数量与缺失文件数
        int missingCount = 0;
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
            }
        } catch (Exception e) {
            log.error("校验文件存在性失败!", e);
        }
        stats.put("missingCount", missingCount);
        return stats;
    }

    private static final java.util.Set<String> AUDIO_EXTENSIONS = new java.util.HashSet<>(
            java.util.Arrays.asList(".flac", ".mp3", ".m4a", ".ogg", ".wav", ".aac", ".ape", ".ncm")
    );

    private boolean isAudioFile(File file) {
        if (file == null || !file.isFile() || file.getName().startsWith(".")) return false;
        String name = file.getName().toLowerCase();
        for (String ext : AUDIO_EXTENSIONS) {
            if (name.endsWith(ext)) return true;
        }
        return false;
    }

    private void scanDirectoryRecursive(File dir, Map<String, DownloadHistoryItem> dbFilePathMap, List<Map<String, Object>> untrackedFiles) {
        if (dir == null || !dir.exists() || !dir.isDirectory()) return;
        File[] files = dir.listFiles();
        if (files == null) return;

        for (File f : files) {
            if (f.isDirectory()) {
                if (!f.getName().startsWith(".")) {
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

    public Map<String, Object> scanFiles() {
        Map<String, Object> res = new HashMap<>();
        List<Map<String, Object>> missingRecords = new ArrayList<>();
        List<Map<String, Object>> untrackedFiles = new ArrayList<>();
        int validCount = 0;

        List<DownloadHistoryItem> all = getRecords(null, 1, 10000);
        Map<String, DownloadHistoryItem> dbFilePathMap = new HashMap<>();

        for (DownloadHistoryItem item : all) {
            if (item.getFilePath() != null && !item.getFilePath().isEmpty()) {
                File f = resolveFile(item.getFilePath());
                if (f.exists()) {
                    validCount++;
                    dbFilePathMap.put(f.getAbsolutePath(), item);
                } else {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", item.getId());
                    m.put("songName", item.getSongName());
                    m.put("artist", item.getArtist());
                    m.put("filePath", item.getFilePath());
                    missingRecords.add(m);
                }
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
        List<DownloadHistoryItem> all = getRecords(null, 1, 10000);
        List<Long> deleteIds = new ArrayList<>();
        for (DownloadHistoryItem item : all) {
            if (item.getFilePath() == null || item.getFilePath().isEmpty()) {
                deleteIds.add(item.getId());
                continue;
            }
            File resolved = resolveFile(item.getFilePath());
            if (!resolved.exists() || resolved.length() < 1250000) {
                deleteIds.add(item.getId());
                // 自动擦除以前残留在 Mac 硬盘的小于 1.2MB 试听垃圾文件
                if (resolved.exists() && resolved.length() < 1250000) {
                    try { resolved.delete(); } catch (Exception ignored) {}
                }
            }
        }

        if (deleteIds.isEmpty()) return 0;

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
}
