package com.wyyyyydl.dao.impl;

import com.google.common.collect.Lists;
import com.wyyyyydl.dao.IHistoryStorageRepository;
import com.wyyyyydl.models.dtos.DownloadHistoryItem;
import com.wyyyyydl.models.dtos.FolderCheckDTO;
import com.wyyyyydl.models.dtos.FolderItemDTO;
import com.wyyyyydl.models.dtos.TrackDTO;
import com.wyyyyydl.service.storage.IStorageService;
import com.wyyyyydl.utils.TagUtils;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 关系型数据库 (JDBC) 持久化抽象基类 (Template Method Pattern)
 * 封装 SQLite 与 PostgreSQL 通用的 SQL 查询、本地曲库目录扫描与文件探测逻辑。
 * 差异化的数据库连接获取与 SQL 方言（自增主键类型、主键冲突策略）由具体子类实现。
 */
@Slf4j
public abstract class AbstractJdbcHistoryRepository implements IHistoryStorageRepository {

    @Value("${download.path}")
    protected String downloadPath;

    @Value("${host.download.path:}")
    protected String hostDownloadPath;

    @Value("${external.library.paths:}")
    protected String externalLibraryPaths;

    @Value("${external.library.host.path:}")
    protected String externalLibraryHostPath;

    @Value("${external.library.container.path:/media/external}")
    protected String externalLibraryContainerPath;

    @Autowired(required = false)
    protected IStorageService storageService;

    protected final Set<String> ignoredFolderSet = Collections.synchronizedSet(new HashSet<>());

    // ==========================================
    // 抽象模板方法 (由 SQLite / PostgreSQL 差异化提供)
    // ==========================================
    protected abstract Connection getConnection() throws SQLException;
    protected abstract String getAutoIncrementPkSql();
    protected abstract String getBatchLikedSongsInsertSql();

    @PostConstruct
    public void init() {
        try {
            initSchema();
            loadIgnoredFolders();
            log.info("✅ [{}] 关系型持久化存储初始化完毕", getClass().getSimpleName());
        } catch (Exception e) {
            log.error("❌ [{}] 初始化数据库异常", getClass().getSimpleName(), e);
        }
    }

    protected void initSchema() throws Exception {
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {

            String autoIncCol = getAutoIncrementPkSql();

            String sql = "CREATE TABLE IF NOT EXISTS download_history (" +
                    autoIncCol + ", " +
                    "song_id BIGINT, " +
                    "song_name TEXT, " +
                    "artist TEXT, " +
                    "album TEXT, " +
                    "file_path TEXT, " +
                    "file_size BIGINT, " +
                    "quality VARCHAR(64), " +
                    "status VARCHAR(64), " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")";
            stmt.execute(sql);

            String rawSql = "CREATE TABLE IF NOT EXISTS download_history_raw (" +
                    "history_id BIGINT PRIMARY KEY, " +
                    "raw_json TEXT, " +
                    "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "FOREIGN KEY(history_id) REFERENCES download_history(id) ON DELETE CASCADE" +
                    ")";
            stmt.execute(rawSql);

            String ignoredSql = "CREATE TABLE IF NOT EXISTS ignored_folders (" +
                    autoIncCol + ", " +
                    "folder_path VARCHAR(512) UNIQUE, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")";
            stmt.execute(ignoredSql);

            String likedSql = "CREATE TABLE IF NOT EXISTS liked_songs (" +
                    "song_id BIGINT PRIMARY KEY, " +
                    "song_name TEXT, " +
                    "artist TEXT, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")";
            stmt.execute(likedSql);

            String legacyIdsSql = "CREATE TABLE IF NOT EXISTS legacy_downloaded_ids (" +
                    "song_id BIGINT PRIMARY KEY, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")";
            stmt.execute(legacyIdsSql);

            String configSql = "CREATE TABLE IF NOT EXISTS system_config (" +
                    "config_key VARCHAR(128) PRIMARY KEY, " +
                    "config_value TEXT, " +
                    "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")";
            stmt.execute(configSql);

            createIndexesSafely(stmt);
        }
    }

    protected void createIndexesSafely(Statement stmt) {
        String[] indexes = {
                "CREATE INDEX IF NOT EXISTS idx_dh_song_id ON download_history(song_id)",
                "CREATE INDEX IF NOT EXISTS idx_dh_name_artist ON download_history(song_name, artist)",
                "CREATE INDEX IF NOT EXISTS idx_dh_created_at ON download_history(created_at)"
        };
        for (String idxSql : indexes) {
            try {
                stmt.execute(idxSql);
            } catch (Exception ignored) {
            }
        }
    }

    protected void loadIgnoredFolders() {
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT folder_path FROM ignored_folders")) {
            while (rs.next()) {
                String p = rs.getString("folder_path");
                if (p != null && !p.trim().isEmpty()) {
                    ignoredFolderSet.add(p.trim());
                }
            }
        } catch (Exception e) {
            log.warn("载入已忽略目录失败: {}", e.getMessage());
        }
    }

    // ==========================================
    // 1. 系统配置
    // ==========================================
    @Override
    public void saveConfig(String key, String value) {
        if (key == null || key.trim().isEmpty()) return;
        try (Connection conn = getConnection()) {
            boolean exists = false;
            try (PreparedStatement check = conn.prepareStatement("SELECT 1 FROM system_config WHERE config_key = ?")) {
                check.setString(1, key);
                try (ResultSet rs = check.executeQuery()) {
                    exists = rs.next();
                }
            }
            if (exists) {
                try (PreparedStatement update = conn.prepareStatement("UPDATE system_config SET config_value = ?, updated_at = CURRENT_TIMESTAMP WHERE config_key = ?")) {
                    update.setString(1, value);
                    update.setString(2, key);
                    update.executeUpdate();
                }
            } else {
                try (PreparedStatement insert = conn.prepareStatement("INSERT INTO system_config (config_key, config_value) VALUES (?, ?)")) {
                    insert.setString(1, key);
                    insert.setString(2, value);
                    insert.executeUpdate();
                }
            }
        } catch (Exception e) {
            log.error("保存系统配置失败: key={}", key, e);
        }
    }

    @Override
    public String getConfig(String key) {
        if (key == null || key.trim().isEmpty()) return null;
        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT config_value FROM system_config WHERE config_key = ?")) {
            stmt.setString(1, key);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getString("config_value");
                }
            }
        } catch (Exception e) {
            log.warn("读取系统配置失败: key={}, 异常: {}", key, e.getMessage());
        }
        return null;
    }

    // ==========================================
    // 2. 红心单曲 (Likes)
    // ==========================================
    @Override
    public boolean addLikedSong(Long songId, String songName, String artist) {
        if (songId == null || songId <= 0) return false;
        String sql = "INSERT INTO liked_songs (song_id, song_name, artist, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setLong(1, songId);
            pstmt.setString(2, songName);
            pstmt.setString(3, artist);
            return pstmt.executeUpdate() > 0;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public boolean removeLikedSong(Long songId) {
        if (songId == null || songId <= 0) return false;
        String sql = "DELETE FROM liked_songs WHERE song_id = ?";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setLong(1, songId);
            return pstmt.executeUpdate() > 0;
        } catch (Exception e) {
            log.error("从本地数据库移除红心单曲失败, songId={}", songId, e);
            return false;
        }
    }

    @Override
    public boolean isLiked(Long songId) {
        if (songId == null || songId <= 0) return false;
        String sql = "SELECT 1 FROM liked_songs WHERE song_id = ?";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setLong(1, songId);
            try (ResultSet rs = pstmt.executeQuery()) {
                return rs.next();
            }
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public Set<Long> getLikedSongIds() {
        Set<Long> ids = new HashSet<>();
        String sql = "SELECT song_id FROM liked_songs";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                ids.add(rs.getLong("song_id"));
            }
        } catch (Exception e) {
            log.error("查询本地数据库红心单曲列表失败", e);
        }
        return ids;
    }

    @Override
    public void syncLikedSongIds(List<Long> onlineIds) {
        if (onlineIds == null || onlineIds.isEmpty()) return;
        String sql = getBatchLikedSongsInsertSql();
        try (Connection conn = getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                for (Long id : onlineIds) {
                    if (id != null && id > 0) {
                        pstmt.setLong(1, id);
                        pstmt.addBatch();
                    }
                }
                pstmt.executeBatch();
            }
            conn.commit();
        } catch (Exception e) {
            log.warn("同步线上红心至数据库失败: {}", e.getMessage());
        }
    }

    // ==========================================
    // 3. 下载历史 CRUD
    // ==========================================
    @Override
    public synchronized long addRecord(Long songId, String songName, String artist, String album, String filePath, Long fileSize, String quality, String status) {
        String insertSql = "INSERT INTO download_history (song_id, song_name, artist, album, file_path, file_size, quality, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
            if (songId != null) {
                pstmt.setLong(1, songId);
            } else {
                pstmt.setNull(1, Types.BIGINT);
            }
            pstmt.setString(2, songName);
            pstmt.setString(3, artist);
            pstmt.setString(4, album);
            pstmt.setString(5, toRelativePath(filePath));
            pstmt.setLong(6, fileSize != null ? fileSize : 0L);
            pstmt.setString(7, quality);
            pstmt.setString(8, status);

            int affected = pstmt.executeUpdate();
            if (affected > 0) {
                try (ResultSet rs = pstmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        return rs.getLong(1);
                    }
                }
            }
        } catch (Exception e) {
            log.error("保存下载历史记录异常: songName={}, artist={}", songName, artist, e);
        }
        return -1;
    }

    @Override
    public void saveRawJson(Long historyId, String rawJson) {
        if (historyId == null || historyId <= 0 || rawJson == null) return;
        String sql = "INSERT INTO download_history_raw (history_id, raw_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setLong(1, historyId);
            pstmt.setString(2, rawJson);
            pstmt.executeUpdate();
        } catch (Exception e) {
            log.error("保存 Raw JSON 异常, historyId={}", historyId, e);
        }
    }

    @Override
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
            log.error("读取 Raw JSON 异常, historyId={}", historyId, e);
        }
        return null;
    }

    @Override
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

    @Override
    public List<DownloadHistoryItem> getRecordsByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return Collections.emptyList();
        String inSql = ids.stream().map(i -> "?").collect(Collectors.joining(","));
        String sql = "SELECT * FROM download_history WHERE id IN (" + inSql + ") ORDER BY id DESC";
        List<DownloadHistoryItem> list = new ArrayList<>();
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            for (int i = 0; i < ids.size(); i++) {
                pstmt.setLong(i + 1, ids.get(i));
            }
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    list.add(mapItemFromRs(rs));
                }
            }
        } catch (Exception e) {
            log.error("根据 ID 列表批量查询记录异常, size={}", ids.size(), e);
        }
        return list;
    }

    @Override
    public List<DownloadHistoryItem> getRecords(String keyword, int page, int pageSize) {
        StringBuilder sql = new StringBuilder("SELECT * FROM download_history WHERE 1=1 ");
        List<Object> params = new ArrayList<>();
        if (keyword != null && !keyword.trim().isEmpty()) {
            sql.append("AND (song_name LIKE ? OR artist LIKE ? OR album LIKE ?) ");
            String kw = "%" + keyword.trim() + "%";
            params.add(kw);
            params.add(kw);
            params.add(kw);
        }
        sql.append("ORDER BY id DESC LIMIT ? OFFSET ?");
        params.add(pageSize);
        params.add((page - 1) * pageSize);

        List<DownloadHistoryItem> list = new ArrayList<>();
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                pstmt.setObject(i + 1, params.get(i));
            }
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    list.add(mapItemFromRs(rs));
                }
            }
        } catch (Exception e) {
            log.error("分页查询下载历史记录异常: keyword={}, page={}", keyword, page, e);
        }
        return list;
    }

    @Override
    public int countRecords(String keyword) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM download_history WHERE 1=1 ");
        List<Object> params = new ArrayList<>();
        if (keyword != null && !keyword.trim().isEmpty()) {
            sql.append("AND (song_name LIKE ? OR artist LIKE ? OR album LIKE ?) ");
            String kw = "%" + keyword.trim() + "%";
            params.add(kw);
            params.add(kw);
            params.add(kw);
        }
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                pstmt.setObject(i + 1, params.get(i));
            }
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
        } catch (Exception e) {
            log.error("统计历史记录数异常: keyword={}", keyword, e);
        }
        return 0;
    }

    @Override
    public boolean deleteRecord(Long id) {
        if (id == null || id <= 0) return false;
        String sql = "DELETE FROM download_history WHERE id = ?";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setLong(1, id);
            return pstmt.executeUpdate() > 0;
        } catch (Exception e) {
            log.error("删除记录失败: id={}", id, e);
            return false;
        }
    }

    @Override
    public boolean deleteSongFileAndRecord(Long songId, String name, String artist) {
        DownloadHistoryItem item = findLocalFileBySongOrName(songId, name, artist);
        if (item == null) return false;
        try {
            if (storageService != null && storageService.isCloudStorage() && item.getRelativePath() != null && !item.getRelativePath().isEmpty()) {
                storageService.deleteFile(item.getRelativePath());
            }
            if (item.getFilePath() != null) {
                File targetFile = resolveFile(item.getFilePath());
                if (targetFile.exists() && targetFile.isFile()) {
                    targetFile.delete();
                }
            }
            return deleteRecord(item.getId());
        } catch (Exception e) {
            log.error("物理删除曲目及记录失败: songId={}, name={}", songId, name, e);
            return false;
        }
    }

    // ==========================================
    // 4. 音轨匹配与查重
    // ==========================================
    @Override
    public DownloadHistoryItem findLocalFileBySongId(Long songId) {
        if (songId == null || songId <= 0) return null;
        String sql = "SELECT * FROM download_history WHERE song_id = ? ORDER BY id DESC LIMIT 1";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setLong(1, songId);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return mapItemFromRs(rs);
                }
            }
        } catch (Exception e) {
            log.error("根据 song_id 查询记录异常: songId={}", songId, e);
        }
        return null;
    }

    @Override
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

    @Override
    public List<DownloadHistoryItem> getRecordsBySongIds(List<Long> songIds) {
        if (songIds == null || songIds.isEmpty()) return Collections.emptyList();
        String inSql = songIds.stream().map(i -> "?").collect(Collectors.joining(","));
        String sql = "SELECT * FROM download_history WHERE song_id IN (" + inSql + ") ORDER BY id DESC";
        List<DownloadHistoryItem> list = new ArrayList<>();
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            for (int i = 0; i < songIds.size(); i++) {
                pstmt.setLong(i + 1, songIds.get(i));
            }
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    list.add(mapItemFromRs(rs));
                }
            }
        } catch (Exception e) {
            log.error("批量查询曲目异常: size={}", songIds.size(), e);
        }
        return list;
    }

    @Override
    public void markLocalStatusBatch(List<TrackDTO> tracks) {
        if (tracks == null || tracks.isEmpty()) return;
        List<Long> songIds = tracks.stream()
                .map(TrackDTO::getId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toList());

        Map<Long, DownloadHistoryItem> hitMap = new HashMap<>();
        if (!songIds.isEmpty()) {
            for (List<Long> chunk : Lists.partition(songIds, 500)) {
                List<DownloadHistoryItem> found = getRecordsBySongIds(chunk);
                for (DownloadHistoryItem item : found) {
                    hitMap.put(item.getSongId(), item);
                }
            }
        }

        for (TrackDTO track : tracks) {
            if (track == null) continue;
            DownloadHistoryItem item = hitMap.get(track.getId());
            if (item != null && Boolean.TRUE.equals(item.getFileExists())) {
                track.setIsLocal(true);
            }
        }
    }

    // ==========================================
    // 5. 统计与维护
    // ==========================================
    @Override
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        String sql = "SELECT COUNT(*) as total_count, COALESCE(SUM(file_size), 0) as total_size FROM download_history";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            if (rs.next()) {
                long totalCount = rs.getLong("total_count");
                long totalSize = rs.getLong("total_size");
                stats.put("total", totalCount);
                stats.put("totalCount", totalCount);
                stats.put("totalTracks", totalCount);
                stats.put("successTotal", totalCount);
                stats.put("totalSize", totalSize);
                stats.put("totalSizeFormatted", formatSize(totalSize));
                stats.put("missingCount", getMissingRecords().size());
                stats.put("nonMp3Count", getNonMp3Records().size());
            }
        } catch (Exception e) {
            log.error("查询持久化统计异常", e);
        }
        return stats;
    }

    @Override
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

    @Override
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

    @Override
    public int cleanNonMp3Records() {
        String sql = "DELETE FROM download_history WHERE file_path NOT LIKE '%.mp3' AND file_path NOT LIKE '%.MP3'";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {
            return stmt.executeUpdate(sql);
        } catch (Exception e) {
            log.error("清理非 MP3 记录异常", e);
            return 0;
        }
    }

    @Override
    public int cleanMissingRecords() {
        List<DownloadHistoryItem> missing = getMissingRecords();
        int count = 0;
        for (DownloadHistoryItem item : missing) {
            if (deleteRecord(item.getId())) {
                count++;
            }
        }
        return count;
    }

    // ==========================================
    // 6. 文件夹浏览与曲库同步
    // ==========================================
    @Override
    public List<Map<String, String>> getFolderRoots() {
        List<Map<String, String>> roots = new ArrayList<>();
        Map<String, String> defaultRoot = new HashMap<>();
        defaultRoot.put("name", "下载主目录");
        defaultRoot.put("path", downloadPath);
        defaultRoot.put("type", "primary");
        roots.add(defaultRoot);
        return roots;
    }

    @Override
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
                    com.wyyyyydl.utils.TagUtils.TagInfo tag = com.wyyyyydl.utils.TagUtils.readTags(f);
                    dto.setSongName(tag.getTitle() != null ? tag.getTitle() : f.getName());
                    dto.setArtist(tag.getArtist() != null ? tag.getArtist() : "未知歌手");
                    dto.setAlbum(tag.getAlbum() != null ? tag.getAlbum() : dir.getName());
                }
                String relPath = toRelativePath(f.getAbsolutePath());
                String playPath = relPath.isEmpty() ? f.getAbsolutePath() : relPath;
                try {
                    dto.setStreamUrl("/v3/history/stream?path=" + java.net.URLEncoder.encode(playPath, "UTF-8"));
                } catch (Exception e) {
                    dto.setStreamUrl("/v3/history/stream?path=" + playPath);
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

    @Override
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
                com.wyyyyydl.utils.TagUtils.TagInfo tag = com.wyyyyydl.utils.TagUtils.readTags(f);
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

    protected void collectMp3Files(File dir, List<File> list, boolean recursive) {
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

    @Override
    public Map<String, Object> scanFiles() {
        return scanExternalLibraries();
    }

    @Override
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
                com.wyyyyydl.utils.TagUtils.TagInfo info = com.wyyyyydl.utils.TagUtils.readTags(file);
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
        log.info("📂 多目录外部曲库扫描完成: 扫描 {} 个文件，成功新录入 {} 首到数据库", scannedFiles, addedCount);
        return result;
    }

    protected void collectAudioFiles(File dir, List<File> list) {
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

    protected boolean isFilePathExistsInDb(String filePath) {
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

    protected void updateMissingMetadataIfPresent(String filePath, String songName, String artist, String album) {
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

    @Override
    public int importUntrackedFiles() {
        List<DownloadHistoryItem> tracks = getFolderTracks(downloadPath, true);
        int imported = 0;
        for (DownloadHistoryItem item : tracks) {
            if (item != null && item.getFilePath() != null) {
                long id = addRecord(null, item.getSongName(), "未知歌手", "本地导入", item.getFilePath(), item.getFileSize(), "unknown", "SUCCESS");
                if (id > 0) imported++;
            }
        }
        return imported;
    }

    @Override
    public boolean ignoreFolder(String folderPath) {
        if (folderPath == null || folderPath.trim().isEmpty()) return false;
        ignoredFolderSet.add(folderPath.trim());
        String sql = "INSERT INTO ignored_folders (folder_path, created_at) VALUES (?, CURRENT_TIMESTAMP)";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, folderPath.trim());
            return pstmt.executeUpdate() > 0;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public boolean deleteFolder(String folderPath) {
        if (folderPath == null || folderPath.trim().isEmpty()) return false;
        File dir = resolveFile(folderPath);
        if (dir.exists() && dir.isDirectory()) {
            return org.springframework.util.FileSystemUtils.deleteRecursively(dir);
        }
        return false;
    }

    @Override
    public FolderCheckDTO checkFolder(String folderPath) {
        String targetPath = (folderPath == null || folderPath.trim().isEmpty()) ? downloadPath : folderPath;
        File dir = resolveFile(targetPath);
        FolderCheckDTO check = new FolderCheckDTO();
        check.setPath(targetPath);
        check.setHostPath(toHostPath(dir));
        check.setFolderName(dir.getName());
        check.setRoot(dir.getAbsolutePath().equals(new File(downloadPath).getAbsolutePath()));
        if (dir.exists() && dir.isDirectory()) {
            File[] files = dir.listFiles();
            if (files != null) {
                check.setTotalFiles((int) Arrays.stream(files).filter(File::isFile).count());
                check.setTotalDirs((int) Arrays.stream(files).filter(File::isDirectory).count());
            }
        }
        return check;
    }

    @Override
    public Set<Long> getAllDownloadedSongIds() {
        Set<Long> ids = new HashSet<>();
        String sql = "SELECT DISTINCT song_id FROM download_history WHERE song_id IS NOT NULL";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                ids.add(rs.getLong("song_id"));
            }
        } catch (Exception e) {
            log.error("查询全部已下载歌曲 ID 异常", e);
        }
        return ids;
    }

    @Override
    public boolean isSongDownloaded(Long songId) {
        if (songId == null || songId <= 0) return false;
        return findLocalFileBySongId(songId) != null;
    }

    @Override
    public void migrateLegacyIdsFileIfPresent(String basePath) {
        // 兼容迁移历史文本 ID 记录
    }

    // ==========================================
    // 内部通用映射与路径解析工具方法
    // ==========================================
    protected DownloadHistoryItem mapItemFromRs(ResultSet rs) throws SQLException {
        DownloadHistoryItem item = new DownloadHistoryItem();
        item.setId(rs.getLong("id"));
        long songId = rs.getLong("song_id");
        item.setSongId(rs.wasNull() ? null : songId);
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

        boolean fileExists;
        if (storageService != null) {
            fileExists = storageService.checkFileExists(resolved, item.getStatus());
        } else {
            fileExists = resolved.exists() && resolved.isFile() && resolved.length() > 0;
        }
        item.setFileExists(fileExists);
        return item;
    }

    public File resolveFile(String savedPath) {
        if (savedPath == null || savedPath.isEmpty()) return new File("");
        savedPath = safeUrlDecode(savedPath);

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

    public String toRelativePath(String fullPath) {
        if (fullPath == null || fullPath.isEmpty()) return "";
        if (!fullPath.startsWith("/") && !fullPath.startsWith("\\") && !fullPath.contains(":")) {
            return fullPath;
        }
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
        String absPath = file.getAbsolutePath();
        if (externalLibraryContainerPath != null && !externalLibraryContainerPath.trim().isEmpty()
                && externalLibraryHostPath != null && !externalLibraryHostPath.trim().isEmpty()) {
            String externalHostPath = remapPathInsideRoot(absPath, externalLibraryContainerPath, externalLibraryHostPath);
            if (!externalHostPath.equals(absPath)) {
                return externalHostPath;
            }
        }
        String rel = toRelativePath(absPath);
        if (!rel.isEmpty() && hostDownloadPath != null && !hostDownloadPath.trim().isEmpty()) {
            return new File(hostDownloadPath, rel).getAbsolutePath();
        }
        return absPath;
    }

    protected String remapPathInsideRoot(String path, String sourceRoot, String targetRoot) {
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
                String sub = canonicalPath.substring(sourcePrefix.length());
                return new File(targetRoot, sub).getPath();
            }
        } catch (Exception ignored) {}
        return path;
    }

    public static String safeUrlDecode(String str) {
        if (str == null || !str.contains("%")) return str;
        try {
            return java.net.URLDecoder.decode(str.replace("+", "%2B"), "UTF-8");
        } catch (Exception e) {
            return str;
        }
    }

    public static String normalizeTrackName(String name) {
        if (name == null) return "";
        return name.replaceAll("\\(.*?\\)|\\[.*?\\]|\\{.*?\\}|（.*?）|【.*?】", "").trim().toLowerCase();
    }

    public static boolean isArtistMatch(String a1, String a2) {
        if (a1 == null || a2 == null) return false;
        String s1 = a1.trim().toLowerCase();
        String s2 = a2.trim().toLowerCase();
        return s1.contains(s2) || s2.contains(s1);
    }

    protected boolean isAudioFile(String name) {
        if (name == null) return false;
        String lower = name.toLowerCase();
        return lower.endsWith(".mp3") || lower.endsWith(".flac") || lower.endsWith(".m4a") || lower.endsWith(".wav");
    }

    protected String formatSize(long size) {
        if (size <= 0) return "0 B";
        final String[] units = new String[]{"B", "KB", "MB", "GB", "TB"};
        int digitGroups = (int) (Math.log10(size) / Math.log10(1024));
        return new java.text.DecimalFormat("#,##0.00").format(size / Math.pow(1024, digitGroups)) + " " + units[digitGroups];
    }
}
