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
            }
            log.info("SQLite 数据库初始化完毕: {}", dbFile.getAbsolutePath());
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

    public synchronized void addRecord(Long songId, String songName, String artist, String album, String filePath, Long fileSize, String quality, String status) {
        String sql = "INSERT INTO download_history (song_id, song_name, artist, album, file_path, file_size, quality, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        String relPath = toRelativePath(filePath);
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setObject(1, songId);
            pstmt.setString(2, songName != null ? songName : "未知歌曲");
            pstmt.setString(3, artist != null ? artist : "");
            pstmt.setString(4, album != null ? album : "");
            pstmt.setString(5, relPath);
            pstmt.setObject(6, fileSize != null ? fileSize : 0L);
            pstmt.setString(7, quality != null ? quality : "");
            pstmt.setString(8, status != null ? status : "SUCCESS");
            pstmt.executeUpdate();
        } catch (Exception e) {
            log.error("写入下载历史记录失败!", e);
        }
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
                if (!file.exists()) continue;

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
            if (item.getFilePath() == null || item.getFilePath().isEmpty() || !resolveFile(item.getFilePath()).exists()) {
                deleteIds.add(item.getId());
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
